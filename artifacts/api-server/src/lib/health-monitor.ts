import { and, eq, inArray } from "drizzle-orm";
import {
  db,
  incidentsTable,
  incidentTimelineTable,
  servicesTable,
  type Service,
} from "@workspace/db";
import { logger } from "./logger";

const FAILURE_THRESHOLD = 3;
const MONITOR_INTERVAL_MS = 30_000;

export type HealthCheckResult = {
  healthy: boolean;
  responseTime: number | null;
  message: string;
};

type HealthCheckOptions = {
  recordIncident?: boolean;
  triggerRecovery?: boolean;
};

async function checkService(
  service: Service,
  options: HealthCheckOptions = {},
): Promise<HealthCheckResult> {
  const { recordIncident = true, triggerRecovery = true } = options;
  const startedAt = performance.now();
  let responseTime: number | null = null;
  let healthy = false;
  let failureMessage = "Health check failed";

  try {
    const response = await fetch(service.healthEndpoint, {
      method: "GET",
      signal: AbortSignal.timeout(Math.min(Math.max(service.timeout, 250), 30_000)),
      headers: { accept: "application/json" },
    });
    responseTime = Math.round(performance.now() - startedAt);
    healthy = response.status === service.expectedStatus;
    if (!healthy) {
      failureMessage = `Expected HTTP ${service.expectedStatus}, received HTTP ${response.status}`;
    }
  } catch (error) {
    responseTime = Math.round(performance.now() - startedAt);
    failureMessage = error instanceof Error ? error.message : "Health check request failed";
  }

  const checkedAt = new Date();
  const nextFailureCount = healthy ? 0 : service.consecutiveFailures + 1;
  const nextStatus = healthy
    ? "HEALTHY"
    : nextFailureCount >= FAILURE_THRESHOLD
      ? "DOWN"
      : "DEGRADED";

  await db
    .update(servicesTable)
    .set({
      status: nextStatus,
      consecutiveFailures: nextFailureCount,
      lastCheckedAt: checkedAt,
      responseTime,
    })
    .where(eq(servicesTable.id, service.id));

  if (!recordIncident) {
    return { healthy, responseTime, message: healthy ? `HTTP ${service.expectedStatus} verified.` : failureMessage };
  }

  const [openIncident] = await db
    .select()
    .from(incidentsTable)
    .where(
      and(
        eq(incidentsTable.serviceId, service.id),
        inArray(incidentsTable.status, ["OPEN", "RECOVERING"]),
      ),
    );

  if (!healthy && nextFailureCount >= FAILURE_THRESHOLD && !openIncident) {
    const [incident] = await db
      .insert(incidentsTable)
      .values({
        applicationId: service.applicationId,
        serviceId: service.id,
        type: "HEALTH_CHECK_FAILURE",
        severity: nextFailureCount >= 5 ? "CRITICAL" : "HIGH",
        status: "OPEN",
        failureCount: nextFailureCount,
        description: failureMessage,
      })
      .returning();

    if (incident) {
      await db.insert(incidentTimelineTable).values([
        {
          incidentId: incident.id,
          eventType: "FAILURE_DETECTED",
          message: failureMessage,
        },
        {
          incidentId: incident.id,
          eventType: "INCIDENT_CREATED",
          message: `Incident created after ${nextFailureCount} consecutive failed health checks.`,
        },
      ]);
      if (triggerRecovery) {
        void import("./recovery-engine")
          .then(({ evaluateIncident }) => evaluateIncident(incident.id))
          .catch((error: unknown) => logger.error({ error, incidentId: incident.id }, "Could not start recovery evaluation"));
      }
    }
  }

  if (healthy && openIncident) {
    await db
      .update(incidentsTable)
      .set({
        status: "RESOLVED",
        resolvedAt: checkedAt,
      })
      .where(eq(incidentsTable.id, openIncident.id));
    await db.insert(incidentTimelineTable).values([
      {
        incidentId: openIncident.id,
        eventType: "HEALTH_VERIFIED",
        message: `Health check returned HTTP ${service.expectedStatus} in ${responseTime ?? 0}ms.`,
      },
      {
        incidentId: openIncident.id,
        eventType: "INCIDENT_RESOLVED",
        message: "Incident resolved after a successful health check.",
      },
    ]);
  }

  return { healthy, responseTime, message: healthy ? `HTTP ${service.expectedStatus} verified.` : failureMessage };
}

export async function runHealthCheckForService(
  serviceId: number,
  options: HealthCheckOptions = {},
): Promise<HealthCheckResult> {
  const [service] = await db.select().from(servicesTable).where(eq(servicesTable.id, serviceId));
  if (!service) {
    return { healthy: false, responseTime: null, message: "Service no longer exists." };
  }
  return checkService(service, options);
}

let monitorRunning = false;

export async function runHealthChecks(): Promise<void> {
  if (monitorRunning) return;
  monitorRunning = true;
  try {
    const services = await db.select().from(servicesTable);
    const now = Date.now();
    await Promise.all(
      services
        .filter((service) => {
          if (!service.lastCheckedAt) return true;
          return now - service.lastCheckedAt.getTime() >= Math.max(service.interval, 5) * 1000;
        })
        .map(async (service) => {
          try {
            await checkService(service);
          } catch (error) {
            logger.error({ error, serviceId: service.id }, "Health check processing failed");
          }
        }),
    );
  } finally {
    monitorRunning = false;
  }
}

export function startHealthMonitor(): NodeJS.Timeout {
  const timer = setInterval(() => {
    void runHealthChecks();
  }, MONITOR_INTERVAL_MS);
  timer.unref();
  void runHealthChecks();
  return timer;
}
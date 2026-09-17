import { and, desc, eq } from "drizzle-orm";
import {
  db,
  incidentTimelineTable,
  incidentsTable,
  recoveryActionsTable,
  recoveryRulesTable,
  servicesTable,
  type Incident,
  type RecoveryRule,
  type Service,
} from "@workspace/db";
import { logger } from "./logger";
import { executeAllowlistedAction } from "./docker-recovery";

const evaluatingIncidents = new Set<number>();

function ruleMatches(rule: RecoveryRule, incident: Incident, service: Service): boolean {
  if (!rule.enabled || incident.recoveryAttempts >= rule.maxAttempts) return false;
  if (rule.triggerType === "CONSECUTIVE_FAILURES") {
    return incident.failureCount >= rule.threshold;
  }
  if (rule.triggerType === "HTTP_5XX") {
    return incident.description.includes("HTTP 5");
  }
  return service.status !== "HEALTHY";
}

async function isWithinCooldown(rule: RecoveryRule, incidentId: number): Promise<boolean> {
  const [lastAction] = await db
    .select({ startedAt: recoveryActionsTable.startedAt })
    .from(recoveryActionsTable)
    .where(
      and(
        eq(recoveryActionsTable.incidentId, incidentId),
        eq(recoveryActionsTable.actionType, rule.actionType),
      ),
    )
    .orderBy(desc(recoveryActionsTable.startedAt))
    .limit(1);

  return Boolean(
    lastAction &&
      Date.now() - lastAction.startedAt.getTime() < rule.cooldownSeconds * 1000,
  );
}

async function verifyRecovery(serviceId: number): Promise<{ healthy: boolean; message: string }> {
  const { runHealthCheckForService } = await import("./health-monitor");
  const result = await runHealthCheckForService(serviceId, {
    recordIncident: true,
    triggerRecovery: false,
  });
  return { healthy: result.healthy, message: result.message };
}

export async function evaluateIncident(incidentId: number): Promise<void> {
  if (evaluatingIncidents.has(incidentId)) return;
  evaluatingIncidents.add(incidentId);

  try {
    const [incident] = await db
      .select()
      .from(incidentsTable)
      .where(eq(incidentsTable.id, incidentId));
    if (!incident || incident.status === "RESOLVED") return;

    const [service] = await db
      .select()
      .from(servicesTable)
      .where(eq(servicesTable.id, incident.serviceId));
    if (!service) return;

    const rules = await db
      .select()
      .from(recoveryRulesTable)
      .where(eq(recoveryRulesTable.enabled, true))
      .orderBy(recoveryRulesTable.createdAt);
    const rule = rules.find((candidate) => ruleMatches(candidate, incident, service));
    if (!rule || (await isWithinCooldown(rule, incident.id))) return;

    const [action] = await db
      .insert(recoveryActionsTable)
      .values({
        incidentId: incident.id,
        actionType: rule.actionType,
        status: "RUNNING",
      })
      .returning();
    if (!action) return;

    await db
      .update(incidentsTable)
      .set({ recoveryAttempts: incident.recoveryAttempts + 1, status: "RECOVERING" })
      .where(eq(incidentsTable.id, incident.id));
    await db.insert(incidentTimelineTable).values({
      incidentId: incident.id,
      eventType: "RECOVERY_STARTED",
      message: `Allowlisted rule "${rule.name}" started ${rule.actionType.toLowerCase().replaceAll("_", " ")}.`,
      metadata: { ruleId: rule.id, target: rule.target },
    });

    const execution = await executeAllowlistedAction(rule.actionType, rule.target);
    let finalStatus = execution.status;
    let finalResult = execution.result;
    if (execution.status === "SUCCESS") {
      const verification = await verifyRecovery(service.id);
      finalResult = `${execution.result} Verification: ${verification.message}`;
      if (!verification.healthy) finalStatus = "FAILED";
    }

    const completedAt = new Date();
    await db
      .update(recoveryActionsTable)
      .set({ status: finalStatus, completedAt, result: finalResult })
      .where(eq(recoveryActionsTable.id, action.id));
    await db.insert(incidentTimelineTable).values({
      incidentId: incident.id,
      eventType: finalStatus === "SUCCESS" ? "RECOVERY_SUCCEEDED" : "RECOVERY_FAILED",
      message: finalResult,
      metadata: { actionId: action.id, ruleId: rule.id },
    });
  } catch (error) {
    logger.error({ error, incidentId }, "Recovery evaluation failed");
  } finally {
    evaluatingIncidents.delete(incidentId);
  }
}
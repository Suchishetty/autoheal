import { and, count, desc, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { db, applicationsTable, incidentsTable, incidentTimelineTable, recoveryActionsTable, recoveryRulesTable, servicesTable } from "@workspace/db";
import {
  AnalyzeIncidentParams,
  AnalyzeIncidentResponse,
  CreateApplicationBody,
  CreateApplicationResponse,
  CreateRecoveryRuleBody,
  CreateRecoveryRuleResponse,
  CreateServiceBody,
  CreateServiceResponse,
  DeleteApplicationParams,
  DeleteRecoveryRuleParams,
  DeleteServiceParams,
  GetApplicationParams,
  GetApplicationResponse,
  GetIncidentParams,
  GetIncidentResponse,
  GetServiceParams,
  GetServiceResponse,
  GetDashboardSummaryResponse,
  ListApplicationsResponse,
  ListIncidentsQueryParams,
  ListIncidentsResponse,
  ListRecoveryActionsResponse,
  ListRecoveryRulesResponse,
  ListServicesQueryParams,
  ListServicesResponse,
  UpdateApplicationBody,
  UpdateApplicationParams,
  UpdateApplicationResponse,
  UpdateRecoveryRuleBody,
  UpdateRecoveryRuleParams,
  UpdateRecoveryRuleResponse,
  UpdateServiceBody,
  UpdateServiceParams,
  UpdateServiceResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.use("/v1", (req, res, next): void => {
  const auth = getAuth(req);
  const userId = auth?.sessionClaims?.userId || auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
});

const notFound = (res: Parameters<Parameters<IRouter["get"]>[1]>[1]) => {
  res.status(404).json({ error: "Resource not found" });
};

router.get("/v1/dashboard/summary", async (_req, res): Promise<void> => {
  const [applications, healthyServices, activeIncidents, recoveryActions] = await Promise.all([
    db.select({ value: count() }).from(applicationsTable),
    db.select({ value: count() }).from(servicesTable).where(eq(servicesTable.status, "HEALTHY")),
    db.select({ value: count() }).from(incidentsTable).where(eq(incidentsTable.status, "OPEN")),
    db.select({ value: count() }).from(recoveryActionsTable),
  ]);
  const serviceCount = await db.select({ value: count() }).from(servicesTable);
  const monitoringConnected = Number(serviceCount[0]?.value ?? 0) > 0;

  res.json(
    GetDashboardSummaryResponse.parse({
      totalApplications: Number(applications[0]?.value ?? 0),
      healthyServices: Number(healthyServices[0]?.value ?? 0),
      activeIncidents: Number(activeIncidents[0]?.value ?? 0),
      recoveryActions: Number(recoveryActions[0]?.value ?? 0),
      failedHealthChecks: 0,
      recentDeployments: 0,
      monitoringConnected,
      monitoringMessage: monitoringConnected
        ? "Live HTTP health checks are running for registered services."
        : "Monitoring integration not connected. Register a service to begin real health checks.",
    }),
  );
});

router.get("/v1/applications", async (_req, res): Promise<void> => {
  const applications = await db.select().from(applicationsTable).orderBy(desc(applicationsTable.createdAt));
  res.json(ListApplicationsResponse.parse(applications));
});

router.post("/v1/applications", async (req, res): Promise<void> => {
  const parsed = CreateApplicationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [application] = await db.insert(applicationsTable).values(parsed.data).returning();
  res.status(201).json(CreateApplicationResponse.parse(application));
});

router.get("/v1/applications/:id", async (req, res): Promise<void> => {
  const params = GetApplicationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [application] = await db.select().from(applicationsTable).where(eq(applicationsTable.id, params.data.id));
  if (!application) {
    notFound(res);
    return;
  }
  res.json(GetApplicationResponse.parse(application));
});

router.patch("/v1/applications/:id", async (req, res): Promise<void> => {
  const params = UpdateApplicationParams.safeParse(req.params);
  const body = UpdateApplicationBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: !params.success ? params.error.message : body.error?.message ?? "Invalid request body" });
    return;
  }
  const [application] = await db.update(applicationsTable).set(body.data).where(eq(applicationsTable.id, params.data.id)).returning();
  if (!application) {
    notFound(res);
    return;
  }
  res.json(UpdateApplicationResponse.parse(application));
});

router.delete("/v1/applications/:id", async (req, res): Promise<void> => {
  const params = DeleteApplicationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const deleted = await db.delete(applicationsTable).where(eq(applicationsTable.id, params.data.id)).returning({ id: applicationsTable.id });
  if (!deleted.length) {
    notFound(res);
    return;
  }
  res.sendStatus(204);
});

router.get("/v1/services", async (req, res): Promise<void> => {
  const params = ListServicesQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const services = params.data.applicationId
    ? await db.select().from(servicesTable).where(eq(servicesTable.applicationId, params.data.applicationId)).orderBy(desc(servicesTable.createdAt))
    : await db.select().from(servicesTable).orderBy(desc(servicesTable.createdAt));
  res.json(ListServicesResponse.parse(services));
});

router.post("/v1/services", async (req, res): Promise<void> => {
  const parsed = CreateServiceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [service] = await db.insert(servicesTable).values(parsed.data).returning();
  res.status(201).json(CreateServiceResponse.parse(service));
});

router.get("/v1/services/:id", async (req, res): Promise<void> => {
  const params = GetServiceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [service] = await db.select().from(servicesTable).where(eq(servicesTable.id, params.data.id));
  if (!service) {
    notFound(res);
    return;
  }
  res.json(GetServiceResponse.parse(service));
});

router.patch("/v1/services/:id", async (req, res): Promise<void> => {
  const params = UpdateServiceParams.safeParse(req.params);
  const body = UpdateServiceBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: !params.success ? params.error.message : body.error?.message ?? "Invalid request body" });
    return;
  }
  const [service] = await db.update(servicesTable).set(body.data).where(eq(servicesTable.id, params.data.id)).returning();
  if (!service) {
    notFound(res);
    return;
  }
  res.json(UpdateServiceResponse.parse(service));
});

router.delete("/v1/services/:id", async (req, res): Promise<void> => {
  const params = DeleteServiceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const deleted = await db.delete(servicesTable).where(eq(servicesTable.id, params.data.id)).returning({ id: servicesTable.id });
  if (!deleted.length) {
    notFound(res);
    return;
  }
  res.sendStatus(204);
});

router.get("/v1/incidents", async (req, res): Promise<void> => {
  const params = ListIncidentsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const incidents = params.data.status
    ? await db.select().from(incidentsTable).where(eq(incidentsTable.status, params.data.status)).orderBy(desc(incidentsTable.detectedAt))
    : await db.select().from(incidentsTable).orderBy(desc(incidentsTable.detectedAt));
  res.json(ListIncidentsResponse.parse(incidents));
});

router.get("/v1/incidents/:id", async (req, res): Promise<void> => {
  const params = GetIncidentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [incident] = await db.select().from(incidentsTable).where(eq(incidentsTable.id, params.data.id));
  if (!incident) {
    notFound(res);
    return;
  }
  const timeline = await db.select().from(incidentTimelineTable).where(eq(incidentTimelineTable.incidentId, incident.id)).orderBy(incidentTimelineTable.timestamp);
  res.json(GetIncidentResponse.parse({ ...incident, timeline, aiInsight: null }));
});

router.post("/v1/incidents/:id/analyze", async (req, res): Promise<void> => {
  const params = AnalyzeIncidentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [incident] = await db.select().from(incidentsTable).where(eq(incidentsTable.id, params.data.id));
  if (!incident) {
    notFound(res);
    return;
  }
  res.json(
    AnalyzeIncidentResponse.parse({
      status: "NOT_CONNECTED",
      diagnosis: "AI diagnosis is not connected.",
      rootCause: "No Gemini integration is configured for this project.",
      evidence: [],
      confidence: null,
      recommendations: [],
      prevention: [],
    }),
  );
});

router.get("/v1/recovery/rules", async (_req, res): Promise<void> => {
  const rules = await db.select().from(recoveryRulesTable).orderBy(desc(recoveryRulesTable.createdAt));
  res.json(ListRecoveryRulesResponse.parse(rules));
});

router.post("/v1/recovery/rules", async (req, res): Promise<void> => {
  const parsed = CreateRecoveryRuleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [rule] = await db.insert(recoveryRulesTable).values(parsed.data).returning();
  res.status(201).json(CreateRecoveryRuleResponse.parse(rule));
});

router.patch("/v1/recovery/rules/:id", async (req, res): Promise<void> => {
  const params = UpdateRecoveryRuleParams.safeParse(req.params);
  const body = UpdateRecoveryRuleBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: !params.success ? params.error.message : body.error?.message ?? "Invalid request body" });
    return;
  }
  const [rule] = await db.update(recoveryRulesTable).set(body.data).where(eq(recoveryRulesTable.id, params.data.id)).returning();
  if (!rule) {
    notFound(res);
    return;
  }
  res.json(UpdateRecoveryRuleResponse.parse(rule));
});

router.delete("/v1/recovery/rules/:id", async (req, res): Promise<void> => {
  const params = DeleteRecoveryRuleParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const deleted = await db.delete(recoveryRulesTable).where(eq(recoveryRulesTable.id, params.data.id)).returning({ id: recoveryRulesTable.id });
  if (!deleted.length) {
    notFound(res);
    return;
  }
  res.sendStatus(204);
});

router.get("/v1/recovery/actions", async (_req, res): Promise<void> => {
  const actions = await db.select().from(recoveryActionsTable).orderBy(desc(recoveryActionsTable.startedAt));
  res.json(ListRecoveryActionsResponse.parse(actions));
});

export default router;
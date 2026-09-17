import { createInsertSchema } from "drizzle-zod";
import { integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { applicationsTable } from "./applications";
import { servicesTable } from "./services";
import { z } from "zod/v4";

export const incidentsTable = pgTable("incidents", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  applicationId: integer("application_id").notNull().references(() => applicationsTable.id, { onDelete: "cascade" }),
  serviceId: integer("service_id").notNull().references(() => servicesTable.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  severity: text("severity").notNull(),
  status: text("status").notNull().default("OPEN"),
  detectedAt: timestamp("detected_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  failureCount: integer("failure_count").notNull().default(0),
  description: text("description").notNull(),
  recoveryAttempts: integer("recovery_attempts").notNull().default(0),
});

export const incidentTimelineTable = pgTable("incident_timeline_events", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  incidentId: integer("incident_id").notNull().references(() => incidentsTable.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(),
  message: text("message").notNull(),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
  metadata: jsonb("metadata"),
});

export const insertIncidentSchema = createInsertSchema(incidentsTable);
export type InsertIncident = z.infer<typeof insertIncidentSchema>;
export type Incident = typeof incidentsTable.$inferSelect;
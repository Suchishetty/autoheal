import { createInsertSchema } from "drizzle-zod";
import {
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { incidentsTable } from "./incidents";
import { z } from "zod/v4";

export const aiInsightsTable = pgTable("ai_insights", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),

  incidentId: integer("incident_id")
    .notNull()
    .references(() => incidentsTable.id, { onDelete: "cascade" }),

  diagnosis: text("diagnosis").notNull(),

  rootCause: text("root_cause").notNull(),

  evidence: jsonb("evidence").notNull().default([]),

  confidence: real("confidence"),

  recommendations: jsonb("recommendations").notNull().default([]),

  prevention: jsonb("prevention").notNull().default([]),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertAiInsightSchema =
  createInsertSchema(aiInsightsTable);

export type InsertAiInsight =
  z.infer<typeof insertAiInsightSchema>;

export type AiInsight =
  typeof aiInsightsTable.$inferSelect;
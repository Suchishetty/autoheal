import { createInsertSchema } from "drizzle-zod";
import { boolean, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { incidentsTable } from "./incidents";
import { z } from "zod/v4";

export const recoveryRulesTable = pgTable("recovery_rules", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  triggerType: text("trigger_type").notNull(),
  threshold: integer("threshold").notNull(),
  actionType: text("action_type").notNull(),
  target: text("target"),
  enabled: boolean("enabled").notNull().default(true),
  cooldownSeconds: integer("cooldown_seconds").notNull(),
  maxAttempts: integer("max_attempts").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const recoveryActionsTable = pgTable("recovery_actions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  incidentId: integer("incident_id").references(() => incidentsTable.id, { onDelete: "set null" }),
  actionType: text("action_type").notNull(),
  status: text("status").notNull().default("PENDING"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  result: text("result"),
});

export const insertRecoveryRuleSchema = createInsertSchema(recoveryRulesTable);
export type InsertRecoveryRule = z.infer<typeof insertRecoveryRuleSchema>;
export type RecoveryRule = typeof recoveryRulesTable.$inferSelect;
export type RecoveryAction = typeof recoveryActionsTable.$inferSelect;
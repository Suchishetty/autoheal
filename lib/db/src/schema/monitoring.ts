import { createInsertSchema } from "drizzle-zod";
import { boolean, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const monitoringConfigurationsTable = pgTable("monitoring_configurations", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  providerType: text("provider_type").notNull().default("BUILT_IN_HTTP"),
  enabled: boolean("enabled").notNull().default(false),
  status: text("status").notNull().default("NOT_CONNECTED"),
  lastError: text("last_error"),
  lastTestedAt: timestamp("last_tested_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertMonitoringConfigurationSchema = createInsertSchema(monitoringConfigurationsTable);
export type InsertMonitoringConfiguration = z.infer<typeof insertMonitoringConfigurationSchema>;
export type MonitoringConfiguration = typeof monitoringConfigurationsTable.$inferSelect;
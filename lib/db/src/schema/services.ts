import { createInsertSchema } from "drizzle-zod";
import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { applicationsTable } from "./applications";
import { z } from "zod/v4";

export const servicesTable = pgTable("services", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  applicationId: integer("application_id").notNull().references(() => applicationsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type").notNull(),
  endpoint: text("endpoint").notNull(),
  healthEndpoint: text("health_endpoint").notNull(),
  expectedStatus: integer("expected_status").notNull().default(200),
  timeout: integer("timeout").notNull().default(5000),
  interval: integer("interval").notNull().default(60),
  status: text("status").notNull().default("NOT_CONNECTED"),
  consecutiveFailures: integer("consecutive_failures").notNull().default(0),
  lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
  responseTime: integer("response_time"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertServiceSchema = createInsertSchema(servicesTable);
export type InsertService = z.infer<typeof insertServiceSchema>;
export type Service = typeof servicesTable.$inferSelect;
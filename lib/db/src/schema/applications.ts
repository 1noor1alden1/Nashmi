import { pgTable, serial, integer, text, timestamp, pgEnum, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { servicesTable } from "./services";

export const applicationStatusEnum = pgEnum("application_status", ["pending", "accepted", "rejected"]);

export const applicationsTable = pgTable("applications", {
  id: serial("id").primaryKey(),
  serviceId: integer("service_id").notNull().references(() => servicesTable.id),
  applicantId: integer("applicant_id").notNull().references(() => usersTable.id),
  message: text("message"),
  proposedPoints: integer("proposed_points"),
  promisedDelivery: timestamp("promised_delivery"),
  status: applicationStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [uniqueIndex("applications_service_applicant_unique").on(t.serviceId,t.applicantId)]);

export const insertApplicationSchema = createInsertSchema(applicationsTable).omit({
  id: true,
  status: true,
  createdAt: true,
});

export type InsertApplication = z.infer<typeof insertApplicationSchema>;
export type Application = typeof applicationsTable.$inferSelect;

import { pgTable, text, serial, integer, boolean, timestamp, pgEnum, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { servicesTable } from "./services";

export const proofStatusEnum = pgEnum("proof_status", ["pending", "verified", "rejected"]);

export const serviceProofsTable = pgTable("service_proofs", {
  id: serial("id").primaryKey(),
  serviceId: integer("service_id").notNull().references(() => servicesTable.id),
  providerId: integer("provider_id").notNull().references(() => usersTable.id),
  proofType: text("proof_type").notNull(),
  proofContent: text("proof_content").notNull(),
  aiRelevanceScore: real("ai_relevance_score"),
  aiAnalysis: text("ai_analysis"),
  status: proofStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertProofSchema = createInsertSchema(serviceProofsTable).omit({
  id: true, aiRelevanceScore: true, aiAnalysis: true, status: true, createdAt: true,
});
export type InsertProof = z.infer<typeof insertProofSchema>;
export type ServiceProof = typeof serviceProofsTable.$inferSelect;

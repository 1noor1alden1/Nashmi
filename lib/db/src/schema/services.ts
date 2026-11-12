import { pgTable, text, serial, integer, boolean, timestamp, pgEnum, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const urgencyEnum = pgEnum("urgency", ["low", "medium", "high"]);
export const serviceStatusEnum = pgEnum("service_status", ["open", "in_progress", "completed", "cancelled"]);

export const servicesTable = pgTable("services", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  originalTitle: text("original_title"),
  originalDescription: text("original_description"),
  canonicalConcepts: text("canonical_concepts"),
  description: text("description").notNull(),
  category: text("category").notNull(),
  requiredSkills: text("required_skills").array().notNull().default([]),
  categorySuggestion: text("category_suggestion"),
  skillSuggestions: text("skill_suggestions").array().notNull().default([]),
  urgencyBonus: integer("urgency_bonus").notNull().default(0),
  bonusEscrowActive: boolean("bonus_escrow_active").notNull().default(false),
  urgency: urgencyEnum("urgency").notNull().default("medium"),
  status: serviceStatusEnum("status").notNull().default("open"),
  pointsPrice: integer("points_price").notNull().default(10),
  deadline: timestamp("deadline"),
  offersDeadline: timestamp("offers_deadline"),
  restrictToUniversity: boolean("restrict_to_university").notNull().default(false),
  restrictToMajor: boolean("restrict_to_major").notNull().default(false),
  requesterId: integer("requester_id").notNull().references(() => usersTable.id),
  providerId: integer("provider_id").references(() => usersTable.id),
  escrowActive: boolean("escrow_active").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertServiceSchema = createInsertSchema(servicesTable).omit({
  id: true,
  status: true,
  escrowActive: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertService = z.infer<typeof insertServiceSchema>;
export type Service = typeof servicesTable.$inferSelect;

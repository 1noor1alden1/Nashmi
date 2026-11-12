import { pgTable, text, serial, integer, real, boolean, timestamp, pgEnum, check, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { sql } from "drizzle-orm";

export const userLevelEnum = pgEnum("user_level", ["مستجد", "فزّاع", "حكيم"]);

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  university: text("university"),
  major: text("major"),
  bio: text("bio"),
  skillsText: text("skills_text"),
  skillTags: text("skill_tags").array().notNull().default([]),
  // Reviewed profile data, separate from unverified claims and public reputation.
  skillProfiles: jsonb("skill_profiles").$type<Array<{name:string;level:"beginner"|"intermediate"|"advanced";activity:"teach"|"build"|"both"}>>().notNull().default([]),
  availability: text("availability").notNull().default("available"),
  capacity: integer("capacity").notNull().default(2),
  portfolio: jsonb("portfolio").$type<Array<{title:string;url:string;description:string}>>().notNull().default([]),
  points: integer("points").notNull().default(100),
  loanBalance: integer("loan_balance").notNull().default(0),
  level: userLevelEnum("level").notNull().default("مستجد"),
  trustScore: real("trust_score").notNull().default(50.0),
  totalServicesGiven: integer("total_services_given").notNull().default(0),
  totalServicesReceived: integer("total_services_received").notNull().default(0),
  averageRating: real("average_rating"),
  withdrawalPenalties: integer("withdrawal_penalties").notNull().default(0),
  isVerified: boolean("is_verified").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
},(t)=>[check("users_points_nonnegative",sql`${t.points} >= 0`),check("users_loan_nonnegative",sql`${t.loanBalance} >= 0`)]);

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  points: true,
  loanBalance: true,
  level: true,
  trustScore: true,
  totalServicesGiven: true,
  totalServicesReceived: true,
  averageRating: true,
  isVerified: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;

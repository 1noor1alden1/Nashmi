import { pgTable, serial, integer, real, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { servicesTable } from "./services";
import { usersTable } from "./users";

// Immutable delivery snapshot; membership is determined on publication, not client-supplied scores.
export const serviceMatchesTable = pgTable("service_matches", {
  id: serial("id").primaryKey(),
  serviceId: integer("service_id").notNull().references(() => servicesTable.id),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  rank: integer("rank").notNull(),
  score: real("score").notNull(),
  explanation: text("explanation").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, t => [uniqueIndex("service_matches_unique").on(t.serviceId, t.userId)]);

import { pgTable, serial, integer, text, real, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { servicesTable } from "./services";

export const reviewsTable = pgTable("reviews", {
  id: serial("id").primaryKey(),
  reviewerId: integer("reviewer_id").notNull().references(() => usersTable.id),
  revieweeId: integer("reviewee_id").notNull().references(() => usersTable.id),
  serviceId: integer("service_id").notNull().references(() => servicesTable.id),
  qualityRating: integer("quality_rating").notNull(),
  commitmentRating: integer("commitment_rating").notNull(),
  respectRating: integer("respect_rating").notNull(),
  averageRating: real("average_rating").notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
},(t)=>[uniqueIndex("reviews_service_reviewer_unique").on(t.serviceId,t.reviewerId)]);

export const insertReviewSchema = createInsertSchema(reviewsTable).omit({
  id: true,
  averageRating: true,
  createdAt: true,
});

export type InsertReview = z.infer<typeof insertReviewSchema>;
export type Review = typeof reviewsTable.$inferSelect;

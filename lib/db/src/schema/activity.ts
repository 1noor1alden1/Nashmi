import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const activityFeedTable = pgTable("activity_feed", {
  id: serial("id").primaryKey(),
  message: text("message").notNull(),
  category: text("category"),
  providerUniversity: text("provider_university"),
  requesterUniversity: text("requester_university"),
  serviceId: integer("service_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type ActivityFeed = typeof activityFeedTable.$inferSelect;

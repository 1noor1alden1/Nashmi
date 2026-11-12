import { pgTable, serial, integer, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { servicesTable } from "./services";

export const transactionTypeEnum = pgEnum("transaction_type", [
  "earned",
  "spent",
  "escrow_locked",
  "escrow_released",
  "loan_given",
  "loan_repaid",
  "bonus",
  "penalty_deducted",
]);

export const transactionsTable = pgTable("transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  type: transactionTypeEnum("type").notNull(),
  amount: integer("amount").notNull(),
  balanceAfter: integer("balance_after").notNull(),
  description: text("description").notNull(),
  serviceId: integer("service_id").references(() => servicesTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTransactionSchema = createInsertSchema(transactionsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactionsTable.$inferSelect;

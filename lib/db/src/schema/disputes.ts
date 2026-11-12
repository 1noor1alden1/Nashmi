import {pgTable,serial,integer,text,timestamp,pgEnum,uniqueIndex} from "drizzle-orm/pg-core";
import {usersTable} from "./users";
import {servicesTable} from "./services";
export const disputeStatusEnum=pgEnum("dispute_status",["open","refunded","released"]);
export const disputesTable=pgTable("service_disputes",{
  id:serial("id").primaryKey(),serviceId:integer("service_id").notNull().references(()=>servicesTable.id),
  openedBy:integer("opened_by").notNull().references(()=>usersTable.id),reason:text("reason").notNull(),
  status:disputeStatusEnum("status").notNull().default("open"),resolutionNote:text("resolution_note"),
  resolvedBy:integer("resolved_by").references(()=>usersTable.id),createdAt:timestamp("created_at").notNull().defaultNow(),
  resolvedAt:timestamp("resolved_at"),
},t=>[uniqueIndex("service_disputes_one_per_service").on(t.serviceId)]);

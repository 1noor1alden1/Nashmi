import {pgTable,serial,integer,text,timestamp,uniqueIndex} from "drizzle-orm/pg-core";
import {usersTable} from "./users";
export const savedSearchesTable=pgTable("saved_searches",{
  id:serial("id").primaryKey(),userId:integer("user_id").notNull().references(()=>usersTable.id),
  query:text("query").notNull(),category:text("category").notNull().default(""),
  createdAt:timestamp("created_at").notNull().defaultNow(),
},t=>[uniqueIndex("saved_searches_unique").on(t.userId,t.query,t.category)]);

import { pgTable, text, serial, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const skillsTable = pgTable("skills", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  parent: text("parent"),
  category: text("category").notNull(),
  aliases: text("aliases").array().notNull().default([]),
  relatedSkills: text("related_skills").array().notNull().default([]),
  difficultyLevel: integer("difficulty_level").notNull().default(3),
});

export const insertSkillSchema = createInsertSchema(skillsTable).omit({ id: true });
export type InsertSkill = z.infer<typeof insertSkillSchema>;
export type Skill = typeof skillsTable.$inferSelect;

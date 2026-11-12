import { Router } from "express";
import { db, activityFeedTable, skillsTable, usersTable, servicesTable } from "@workspace/db";
import { desc, ilike, or, sql } from "drizzle-orm";
import { findSemanticSkillMatches } from "../lib/service-utils.js";
import { getSessionUser } from "../lib/auth.js";

const router = Router();

// GET /activity - شريط النشاط الحي
router.get("/", async (_req, res) => {
  try {
    const activities = await db
      .select()
      .from(activityFeedTable)
      .orderBy(desc(activityFeedTable.createdAt))
      .limit(20);

    return res.json(activities.map(a => ({
      id: a.id,
      message: a.message,
      category: a.category,
      createdAt: a.createdAt.toISOString(),
    })));
  } catch (err) {
    console.error("Activity feed error:", err);
    return res.status(500).json({ error: "server_error", message: "حدث خطأ في الخادم" });
  }
});

// GET /skills/search?q=... - بحث دلالي عن المهارات
router.get("/skills/search", async (req, res) => {
  try {
    const user=await getSessionUser(req);
    if(!user) return res.status(401).json({error:"unauthorized"});
    const { q, category } = req.query;
    if(typeof q==="string" && q.length>150) return res.status(400).json({error:"query_too_long"});
    if (!q || typeof q !== "string") {
      return res.json({ skills: [], semanticMatches: [] });
    }

    // Direct skill search
    const directSkills = await db
      .select()
      .from(skillsTable)
      .where(or(
        ilike(skillsTable.name, `%${q}%`),
        sql`${skillsTable.aliases} && ARRAY[${q}]::text[]`
      ))
      .limit(10);

    // AI Semantic matches
    const semanticMatches = await findSemanticSkillMatches(q, typeof category === "string" ? category : "");

    return res.json({
      skills: directSkills.map(s => ({
        id: s.id,
        name: s.name,
        parent: s.parent,
        category: s.category,
        relatedSkills: s.relatedSkills,
        difficultyLevel: s.difficultyLevel,
      })),
      semanticMatches,
    });
  } catch (err) {
    console.error("Skills search error:", err);
    return res.status(500).json({ error: "server_error", message: "حدث خطأ في الخادم" });
  }
});

export default router;

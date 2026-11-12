import { Router } from "express";
import { db, usersTable, servicesTable, transactionsTable, notificationsTable } from "@workspace/db";
import { eq, desc, and, sql } from "drizzle-orm";
import { getSessionUser, formatUser } from "../lib/auth.js";
import { calculateLevel } from "../lib/service-utils.js";

const router = Router();

router.get("/leaderboard", async (req, res) => {
  try {
    const users = await db
      .select()
      .from(usersTable)
      .orderBy(desc(usersTable.totalServicesGiven), desc(usersTable.trustScore))
      .limit(20);

    const leaderboard = users.map((u, idx) => ({
      rank: idx + 1,
      userId: u.id,
      name: u.name,
      level: u.level,
      trustScore: u.trustScore,
      totalServicesGiven: u.totalServicesGiven,
      averageRating: u.averageRating,
      university: u.university,
    }));

    return res.json(leaderboard);
  } catch (err) {
    console.error("Leaderboard error:", err);
    return res.status(500).json({ error: "server_error", message: "حدث خطأ في الخادم" });
  }
});

router.get("/dashboard/stats", async (req, res) => {
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return res.status(401).json({ error: "unauthorized", message: "يجب تسجيل الدخول أولاً" });
    }

    const activeServices = await db
      .select()
      .from(servicesTable)
      .where(
        and(
          eq(servicesTable.requesterId, user.id),
          eq(servicesTable.status, "in_progress")
        )
      );

    const recentTransactions = await db
      .select({
        id: transactionsTable.id,
        type: transactionsTable.type,
        amount: transactionsTable.amount,
        balanceAfter: transactionsTable.balanceAfter,
        description: transactionsTable.description,
        serviceId: transactionsTable.serviceId,
        createdAt: transactionsTable.createdAt,
        serviceTitle: servicesTable.title,
      })
      .from(transactionsTable)
      .leftJoin(servicesTable, eq(transactionsTable.serviceId, servicesTable.id))
      .where(eq(transactionsTable.userId, user.id))
      .orderBy(desc(transactionsTable.createdAt))
      .limit(10);

    // Points history (last 7 days)
    const pointsHistory = recentTransactions
      .slice(0, 7)
      .reverse()
      .map((t) => ({
        date: t.createdAt.toISOString().split("T")[0],
        points: t.balanceAfter,
      }));

    if (pointsHistory.length === 0) {
      pointsHistory.push({ date: new Date().toISOString().split("T")[0], points: user.points });
    }

    const nextLevelServices = user.level === "مستجد" ? 5 : user.level === "فزّاع" ? 15 : 15;
    const currentProgress = user.level === "مستجد"
      ? (user.totalServicesGiven / 5) * 100
      : user.level === "فزّاع"
      ? ((user.totalServicesGiven - 5) / 10) * 100
      : 100;

    return res.json({
      points: user.points,
      loanBalance: user.loanBalance,
      level: user.level,
      trustScore: user.trustScore,
      totalServicesGiven: user.totalServicesGiven,
      totalServicesReceived: user.totalServicesReceived,
      averageRating: user.averageRating,
      activeServices: activeServices.length,
      topSkills: user.skillTags.slice(0, 5),
      pointsHistory,
      recentTransactions: recentTransactions.map((t) => ({
        id: t.id,
        type: t.type,
        amount: t.amount,
        balanceAfter: t.balanceAfter,
        description: t.description,
        serviceId: t.serviceId,
        serviceTitle: t.serviceTitle,
        createdAt: t.createdAt.toISOString(),
      })),
      nextLevelProgress: Math.min(currentProgress, 100),
    });
  } catch (err) {
    console.error("Dashboard error:", err);
    return res.status(500).json({ error: "server_error", message: "حدث خطأ في الخادم" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);

    if (!user) {
      return res.status(404).json({ error: "not_found", message: "المستخدم غير موجود" });
    }

    return res.json({
      id: user.id,
      name: user.name,
      university: user.university,
      major: user.major,
      bio: user.bio,
      skillTags: user.skillTags || [],
      skillProfiles: user.skillProfiles || [],
      availability: user.availability,
      capacity: user.capacity,
      portfolio: user.portfolio || [],
      level: user.level,
      trustScore: user.trustScore,
      totalServicesGiven: user.totalServicesGiven,
      totalServicesReceived: user.totalServicesReceived,
      averageRating: user.averageRating,
      isVerified: user.isVerified,
      createdAt: user.createdAt.toISOString(),
    });
  } catch (err) {
    console.error("Get user error:", err);
    return res.status(500).json({ error: "server_error", message: "حدث خطأ في الخادم" });
  }
});

router.get("/:id/services", async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const services = await db
      .select({
        id: servicesTable.id,
        title: servicesTable.title,
        description: servicesTable.description,
        category: servicesTable.category,
        urgency: servicesTable.urgency,
        status: servicesTable.status,
        pointsPrice: servicesTable.pointsPrice,
        deadline: servicesTable.deadline,
        restrictToUniversity: servicesTable.restrictToUniversity,
        restrictToMajor: servicesTable.restrictToMajor,
        requesterId: servicesTable.requesterId,
        providerId: servicesTable.providerId,
        createdAt: servicesTable.createdAt,
        requesterName: usersTable.name,
        requesterLevel: usersTable.level,
      })
      .from(servicesTable)
      .leftJoin(usersTable, eq(servicesTable.requesterId, usersTable.id))
      .where(eq(servicesTable.requesterId, userId))
      .orderBy(desc(servicesTable.createdAt));

    return res.json(services.map((s) => ({
      ...s,
      applicantsCount: 0,
      deadline: s.deadline?.toISOString() || null,
      createdAt: s.createdAt.toISOString(),
      requesterLevel: s.requesterLevel || "مستجد",
      providerName: null,
    })));
  } catch (err) {
    console.error("User services error:", err);
    return res.status(500).json({ error: "server_error", message: "حدث خطأ في الخادم" });
  }
});

export default router;

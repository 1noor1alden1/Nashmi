import { Router } from "express";
import { db, notificationsTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { getSessionUser } from "../lib/auth.js";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const user = await getSessionUser(req);
    if (!user) return res.status(401).json({ error: "unauthorized", message: "يجب تسجيل الدخول" });

    const notifications = await db
      .select()
      .from(notificationsTable)
      .where(eq(notificationsTable.userId, user.id))
      .orderBy(desc(notificationsTable.createdAt))
      .limit(30);

    return res.json(notifications.map(n => ({
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      serviceId: n.serviceId,
      isRead: n.isRead,
      createdAt: n.createdAt.toISOString(),
    })));
  } catch (err) {
    console.error("Notifications error:", err);
    return res.status(500).json({ error: "server_error", message: "حدث خطأ في الخادم" });
  }
});

router.patch("/:id/read", async (req, res) => {
  try {
    const user = await getSessionUser(req);
    if (!user) return res.status(401).json({ error: "unauthorized", message: "يجب تسجيل الدخول" });

    const notifId = parseInt(req.params.id);
    await db.update(notificationsTable)
      .set({ isRead: true })
      .where(and(eq(notificationsTable.id, notifId), eq(notificationsTable.userId, user.id)));

    return res.json({ message: "تم تعليم الإشعار كمقروء", success: true });
  } catch (err) {
    console.error("Mark read error:", err);
    return res.status(500).json({ error: "server_error", message: "حدث خطأ في الخادم" });
  }
});

export default router;

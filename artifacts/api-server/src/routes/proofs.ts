import { Router } from "express";
import { db, serviceProofsTable, servicesTable, usersTable, notificationsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { getSessionUser } from "../lib/auth.js";
import { verifyProofWithAI } from "../lib/service-utils.js";

const router = Router();

// POST /proofs - رفع إثبات إنجاز
router.post("/", async (req, res) => {
  try {
    const user = await getSessionUser(req);
    if (!user) return res.status(401).json({ error: "unauthorized", message: "يجب تسجيل الدخول" });

    const { serviceId, proofType, proofContent } = req.body;

    if (!Number.isSafeInteger(serviceId) || serviceId <= 0 || typeof proofType !== "string" || proofType.length > 40 || typeof proofContent !== "string" || proofContent.length < 10 || proofContent.length > 5000) {
      return res.status(400).json({ error: "missing_fields", message: "يرجى ملء جميع الحقول" });
    }

    // Verify service belongs to user as provider
    const [service] = await db.select().from(servicesTable).where(eq(servicesTable.id, serviceId)).limit(1);
    if (!service) return res.status(404).json({ error: "not_found", message: "الخدمة غير موجودة" });
    if (service.providerId !== user.id) {
      return res.status(403).json({ error: "forbidden", message: "أنت لست مزود هذه الخدمة" });
    }
    if (service.status !== "in_progress") {
      return res.status(400).json({ error: "invalid_status", message: "الخدمة ليست قيد التنفيذ" });
    }

    // AI Verification of proof relevance
    const aiResult = await verifyProofWithAI(service.description, proofContent, proofType);

    const [proof] = await db.insert(serviceProofsTable).values({
      serviceId,
      providerId: user.id,
      proofType,
      proofContent,
      aiRelevanceScore: aiResult.relevanceScore,
      aiAnalysis: aiResult.analysis,
      // Relevance is AI advisory only; no automatic completion verification.
      status: "pending",
    }).returning();

    // Notify requester
    const notifTitle = aiResult.isValid
      ? "تم تحليل صلة النص بالطلب - يحتاج موافقتك"
      : "تم استلام وصف الإنجاز - قيد مراجعتك";

    const notifMsg = aiResult.isValid
      ? `قدّم المزود وصف إنجاز يبدو مرتبطًا بالطلب (${aiResult.relevanceScore}% صلة نصية). راجع العمل بنفسك قبل التأكيد`
      : `الإثبات المقدم يحتاج مراجعتك - درجة المطابقة ${aiResult.relevanceScore}%. ${aiResult.analysis}`;

    await db.insert(notificationsTable).values({
      userId: service.requesterId,
      type: "service_completed",
      title: notifTitle,
      message: notifMsg,
      serviceId,
    });

    return res.status(201).json({
      id: proof.id,
      serviceId: proof.serviceId,
      proofType: proof.proofType,
      aiRelevanceScore: proof.aiRelevanceScore,
      aiAnalysis: proof.aiAnalysis,
      status: proof.status,
      isVerified: false,
      message: `تم استلام وصف الإنجاز للتحقق البشري. مؤشر الصلة النصية: ${aiResult.relevanceScore}%. ${aiResult.analysis}`,
    });
  } catch (err) {
    console.error("Proof submission error:", err);
    return res.status(500).json({ error: "server_error", message: "حدث خطأ في الخادم" });
  }
});

// GET /proofs/:serviceId - إثباتات خدمة معينة
router.get("/:serviceId", async (req, res) => {
  try {
    const user = await getSessionUser(req);
    if (!user) return res.status(401).json({ error: "unauthorized", message: "يجب تسجيل الدخول" });

    const serviceId = parseInt(req.params.serviceId);
    const [service] = await db.select().from(servicesTable).where(eq(servicesTable.id,serviceId));
    if (!service) return res.status(404).json({error:"not_found"});
    if (service.requesterId !== user.id && service.providerId !== user.id) return res.status(403).json({error:"forbidden",message:"الإثبات متاح لطرفي الخدمة فقط"});
    const proofs = await db.select().from(serviceProofsTable).where(eq(serviceProofsTable.serviceId, serviceId));

    return res.json(proofs.map(p => ({
      id: p.id,
      proofType: p.proofType,
      proofContent: p.proofContent,
      aiRelevanceScore: p.aiRelevanceScore,
      aiAnalysis: p.aiAnalysis,
      status: p.status,
      createdAt: p.createdAt.toISOString(),
    })));
  } catch (err) {
    console.error("Get proofs error:", err);
    return res.status(500).json({ error: "server_error", message: "حدث خطأ في الخادم" });
  }
});

export default router;

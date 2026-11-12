import { Router } from "express";
import { db, reviewsTable, usersTable, servicesTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { getSessionUser } from "../lib/auth.js";
import { providerReputation } from "../lib/reputation.js";
import { WorkflowError, workflowFailure } from "../lib/workflow.js";

const router = Router();

router.post("/",async (req,res)=>{
  try {
    const user=await getSessionUser(req);
    if(!user) return res.status(401).json({error:"unauthorized",message:"يجب تسجيل الدخول"});
    const {serviceId,revieweeId,qualityRating,commitmentRating,respectRating,comment}=req.body;
    if(!Number.isSafeInteger(serviceId)||!Number.isSafeInteger(revieweeId)||![qualityRating,commitmentRating,respectRating].every(v=>Number.isInteger(v)&&v>=1&&v<=5)|| (comment!==undefined&&(typeof comment!=="string"||comment.length>1500))) return res.status(400).json({error:"invalid_rating",message:"أدخل تقييمات صحيحة من 1 إلى 5"});
    if(user.id===revieweeId) return res.status(400).json({error:"self_review",message:"لا يمكنك تقييم نفسك"});
    const review=await db.transaction(async(tx)=>{
      const [service]=await tx.select().from(servicesTable).where(eq(servicesTable.id,serviceId)).for("update");
      if(!service || service.status!=="completed"||!service.providerId) throw new WorkflowError(409,"not_completed","يجب إكمال الخدمة أولاً");
      const correctPair=(user.id===service.requesterId&&revieweeId===service.providerId)||(user.id===service.providerId&&revieweeId===service.requesterId);
      if(!correctPair) throw new WorkflowError(403,"not_participant","التقييم متاح لطرفي الخدمة فقط");
      const existing=await tx.select({id:reviewsTable.id}).from(reviewsTable).where(and(eq(reviewsTable.serviceId,serviceId),eq(reviewsTable.reviewerId,user.id)));
      if(existing.length) throw new WorkflowError(409,"already_reviewed","أرسلت تقييمًا لهذه الخدمة مسبقًا");
      const averageRating=Number(((qualityRating+commitmentRating+respectRating)/3).toFixed(2));
      const [result]=await tx.insert(reviewsTable).values({reviewerId:user.id,revieweeId,serviceId,qualityRating,commitmentRating,respectRating,averageRating,comment:comment||null}).returning();
      await tx.select({id:usersTable.id}).from(usersTable).where(eq(usersTable.id,revieweeId)).for("update");
      const rows=await tx.select({score:reviewsTable.averageRating}).from(reviewsTable)
        .innerJoin(servicesTable,eq(reviewsTable.serviceId,servicesTable.id))
        .where(and(eq(reviewsTable.revieweeId,revieweeId),eq(reviewsTable.reviewerId,servicesTable.requesterId),eq(servicesTable.providerId,revieweeId),eq(servicesTable.status,"completed")));
      // Provider reputation is derived only from requester reviews of completed services;
      // requester reviews do not change the provider-specific reputation indicator.
      const overallAvg=rows.length?Number((rows.reduce((sum,r)=>sum+r.score,0)/rows.length).toFixed(2)):null;
      const [reviewee]=await tx.select().from(usersTable).where(eq(usersTable.id,revieweeId));
      if(!reviewee) throw new WorkflowError(404,"not_found","المستخدم غير موجود");
      if(revieweeId===service.providerId) await tx.update(usersTable).set({averageRating:overallAvg,trustScore:providerReputation(rows.map(r=>r.score)),updatedAt:new Date()}).where(eq(usersTable.id,revieweeId));
      return result;
    });
    return res.status(201).json({id:review.id,reviewerId:review.reviewerId,reviewerName:user.name,revieweeId:review.revieweeId,serviceId:review.serviceId,qualityRating:review.qualityRating,commitmentRating:review.commitmentRating,respectRating:review.respectRating,averageRating:review.averageRating,comment:review.comment,createdAt:review.createdAt.toISOString()});
  }catch(err){
    console.error("Review error:",err);
    const e=workflowFailure(err);return res.status(e.status).json({error:e.error,message:e.message});
  }
});

router.get("/:serviceId", async (req, res) => {
  try {
    const serviceId = parseInt(req.params.serviceId);
    const reviews = await db
      .select({
        id: reviewsTable.id,
        reviewerId: reviewsTable.reviewerId,
        revieweeId: reviewsTable.revieweeId,
        serviceId: reviewsTable.serviceId,
        qualityRating: reviewsTable.qualityRating,
        commitmentRating: reviewsTable.commitmentRating,
        respectRating: reviewsTable.respectRating,
        averageRating: reviewsTable.averageRating,
        comment: reviewsTable.comment,
        createdAt: reviewsTable.createdAt,
        reviewerName: usersTable.name,
      })
      .from(reviewsTable)
      .leftJoin(usersTable, eq(reviewsTable.reviewerId, usersTable.id))
      .where(eq(reviewsTable.serviceId, serviceId))
      .orderBy(desc(reviewsTable.createdAt));

    return res.json(reviews.map(r => ({
      id: r.id,
      reviewerId: r.reviewerId,
      reviewerName: r.reviewerName || "مستخدم",
      revieweeId: r.revieweeId,
      serviceId: r.serviceId,
      qualityRating: r.qualityRating,
      commitmentRating: r.commitmentRating,
      respectRating: r.respectRating,
      averageRating: r.averageRating,
      comment: r.comment,
      createdAt: r.createdAt.toISOString(),
    })));
  } catch (err) {
    console.error("Get reviews error:", err);
    return res.status(500).json({ error: "server_error", message: "حدث خطأ في الخادم" });
  }
});

export default router;

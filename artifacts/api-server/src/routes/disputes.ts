import { Router } from "express";
import { db,disputesTable,servicesTable,usersTable,transactionsTable,notificationsTable,activityFeedTable,serviceProofsTable,applicationsTable } from "@workspace/db";
import { and,eq,desc } from "drizzle-orm";
import { z } from "zod/v4";
import { getSessionUser } from "../lib/auth.js";
import { WorkflowError,workflowFailure } from "../lib/workflow.js";
import {calculateLevel} from "../lib/service-utils.js";

const router=Router();
const isAdmin=(user:{id:number;isVerified:boolean})=>{
  const allowed=(process.env.NASHMI_ADMIN_USER_IDS||"").split(",").map(x=>Number(x.trim())).filter(Number.isSafeInteger);
  return user.isVerified&&allowed.includes(user.id);
};
// A participant may freeze a contested in-progress job; no one can self-release its escrow.
router.post("/",async(req,res)=>{
  try{
    const user=await getSessionUser(req);if(!user)return res.status(401).json({error:"unauthorized"});
    const parsed=z.object({serviceId:z.number().int().positive(),reason:z.string().trim().min(15).max(2000)}).safeParse(req.body);
    if(!parsed.success)return res.status(400).json({error:"invalid_dispute",message:"صف سبب الخلاف في 15 حرفًا على الأقل"});
    await db.transaction(async tx=>{
      const [service]=await tx.select().from(servicesTable).where(eq(servicesTable.id,parsed.data.serviceId)).for("update");
      if(!service||service.status!=="in_progress"||!service.escrowActive)throw new WorkflowError(409,"invalid_state","النزاع متاح للخدمات قيد التنفيذ فقط");
      if(service.requesterId!==user.id&&service.providerId!==user.id)throw new WorkflowError(403,"forbidden","النزاع لطرفي الخدمة فقط");
      const [old]=await tx.select().from(disputesTable).where(eq(disputesTable.serviceId,service.id));
      if(old)throw new WorkflowError(409,"duplicate_dispute","سُجّل نزاع لهذه الخدمة مسبقًا");
      await tx.insert(disputesTable).values({serviceId:service.id,openedBy:user.id,reason:parsed.data.reason});
      const otherId=user.id===service.requesterId?service.providerId:service.requesterId;
      if(otherId)await tx.insert(notificationsTable).values({userId:otherId,type:"service_match",title:"فتح نزاع على الخدمة",
        message:"النقاط مجمّدة حتى مراجعة النزاع من الإدارة",serviceId:service.id});
    });
    return res.status(201).json({success:true,message:"تم تسجيل النزاع وتجميد تسوية نقاط الخدمة"});
  }catch(err){const e=workflowFailure(err);return res.status(e.status).json({error:e.error,message:e.message});}
});
router.get("/:serviceId",async(req,res)=>{
  const user=await getSessionUser(req);if(!user)return res.status(401).json({error:"unauthorized"});
  const serviceId=Number(req.params.serviceId);if(!Number.isSafeInteger(serviceId)||serviceId<=0)return res.status(400).json({error:"invalid_id"});
  const [service]=await db.select().from(servicesTable).where(eq(servicesTable.id,serviceId));
  if(!service)return res.status(404).json({error:"not_found"});
  if(service.requesterId!==user.id&&service.providerId!==user.id&&!isAdmin(user))return res.status(403).json({error:"forbidden"});
  const [dispute]=await db.select().from(disputesTable).where(eq(disputesTable.serviceId,serviceId));
  return res.json(dispute||null);
});
router.get("/admin/pending",async(req,res)=>{
  const user=await getSessionUser(req);if(!user||!isAdmin(user))return res.status(403).json({error:"forbidden"});
  const disputes=await db.select().from(disputesTable).where(eq(disputesTable.status,"open")).orderBy(desc(disputesTable.createdAt)).limit(100);
  const detailed=await Promise.all(disputes.map(async d=>{
    const [service]=await db.select({title:servicesTable.title,description:servicesTable.description,
      category:servicesTable.category,pointsPrice:servicesTable.pointsPrice,
      urgencyBonus:servicesTable.urgencyBonus,providerId:servicesTable.providerId,
      requesterId:servicesTable.requesterId}).from(servicesTable).where(eq(servicesTable.id,d.serviceId));
    const proofs=await db.select({proofType:serviceProofsTable.proofType,proofContent:serviceProofsTable.proofContent,
      createdAt:serviceProofsTable.createdAt,aiAnalysis:serviceProofsTable.aiAnalysis})
      .from(serviceProofsTable).where(eq(serviceProofsTable.serviceId,d.serviceId));
    const offers=await db.select({applicantId:applicationsTable.applicantId,message:applicationsTable.message,
      proposedPoints:applicationsTable.proposedPoints}).from(applicationsTable)
      .where(and(eq(applicationsTable.serviceId,d.serviceId),eq(applicationsTable.status,"accepted")));
    return {...d,service,proofs,acceptedOffer:offers[0]??null};
  }));
  return res.json(detailed);
});
router.post("/:id/resolve",async(req,res)=>{
  const user=await getSessionUser(req);if(!user||!isAdmin(user))return res.status(403).json({error:"forbidden"});
  const parsed=z.object({decision:z.enum(["refund","release"]),note:z.string().trim().min(20).max(2000)}).safeParse(req.body);
  const disputeId=Number(req.params.id);
  if(!parsed.success||!Number.isSafeInteger(disputeId)||disputeId<=0)return res.status(400).json({error:"invalid_resolution"});
  try{
    await db.transaction(async tx=>{
      // Identify service first, lock service then dispute in the same order as completion.
      const [previous]=await tx.select().from(disputesTable).where(eq(disputesTable.id,disputeId));
      if(!previous)throw new WorkflowError(404,"not_found","النزاع غير موجود");
      const [service]=await tx.select().from(servicesTable).where(eq(servicesTable.id,previous.serviceId)).for("update");
      const [dispute]=await tx.select().from(disputesTable).where(eq(disputesTable.id,disputeId)).for("update");
      if(!service||!dispute||dispute.status!=="open"||service.status!=="in_progress"||!service.escrowActive||!service.providerId)
        throw new WorkflowError(409,"invalid_state","تعذّر تسوية نزاع تمت معالجته أو خدمة مغلقة");
      for(const id of [service.requesterId,service.providerId].sort((a,b)=>a-b))
        await tx.select({id:usersTable.id}).from(usersTable).where(eq(usersTable.id,id)).for("update");
      const [requester]=await tx.select().from(usersTable).where(eq(usersTable.id,service.requesterId));
      const [provider]=await tx.select().from(usersTable).where(eq(usersTable.id,service.providerId));
      if(!requester||!provider)throw new WorkflowError(409,"missing_user","تعذر قراءة حساب الطرفين");
      const total=service.pointsPrice+(service.bonusEscrowActive?service.urgencyBonus:0);
      if(parsed.data.decision==="refund"){
        const points=requester.points+total;
        await tx.update(usersTable).set({points,updatedAt:new Date()}).where(eq(usersTable.id,requester.id));
        await tx.insert(transactionsTable).values({userId:requester.id,type:"escrow_released",amount:total,balanceAfter:points,
          description:`تسوية نزاع: استرداد الضمان للطلب ${service.id}`,serviceId:service.id});
        await tx.update(servicesTable).set({status:"cancelled",escrowActive:false,bonusEscrowActive:false,updatedAt:new Date()}).where(eq(servicesTable.id,service.id));
      }else{
        const points=provider.points+total,given=provider.totalServicesGiven+1;
        await tx.update(usersTable).set({points,totalServicesGiven:given,level:calculateLevel(given),updatedAt:new Date()}).where(eq(usersTable.id,provider.id));
        await tx.update(usersTable).set({totalServicesReceived:requester.totalServicesReceived+1,updatedAt:new Date()}).where(eq(usersTable.id,requester.id));
        await tx.insert(transactionsTable).values({userId:provider.id,type:"escrow_released",amount:total,balanceAfter:points,
          description:`تسوية نزاع: صرف الضمان للطلب ${service.id}`,serviceId:service.id});
        await tx.update(servicesTable).set({status:"completed",escrowActive:false,bonusEscrowActive:false,updatedAt:new Date()}).where(eq(servicesTable.id,service.id));
        await tx.insert(activityFeedTable).values({message:`تم إنجاز خدمة في تصنيف ${service.category}`,category:service.category});
      }
      await tx.update(disputesTable).set({status:parsed.data.decision==="refund"?"refunded":"released",
        resolvedBy:user.id,resolutionNote:parsed.data.note,resolvedAt:new Date()}).where(eq(disputesTable.id,dispute.id));
      await tx.insert(notificationsTable).values([service.requesterId,service.providerId].map(userId=>({userId,type:"service_completed" as const,
        title:"تم حسم النزاع",message:parsed.data.decision==="refund"?"أُعيد الضمان لصاحب الطلب":"صُرف الضمان لمقدم الخدمة",serviceId:service.id})));
    });
    return res.json({success:true});
  }catch(err){const e=workflowFailure(err);return res.status(e.status).json({error:e.error,message:e.message});}
});
export default router;

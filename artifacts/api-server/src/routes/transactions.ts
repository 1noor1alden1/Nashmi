import { Router } from "express";
import { db, transactionsTable, usersTable, servicesTable, notificationsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { WorkflowError, workflowFailure } from "../lib/workflow.js";
import { getSessionUser } from "../lib/auth.js";
import { calculateLevel, calculateTrustScore } from "../lib/service-utils.js";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const user = await getSessionUser(req);
    if (!user) return res.status(401).json({ error: "unauthorized", message: "يجب تسجيل الدخول" });

    const transactions = await db
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
      .limit(50);

    return res.json(transactions.map(t => ({
      id: t.id,
      type: t.type,
      amount: t.amount,
      balanceAfter: t.balanceAfter,
      description: t.description,
      serviceId: t.serviceId,
      serviceTitle: t.serviceTitle,
      createdAt: t.createdAt.toISOString(),
    })));
  } catch (err) {
    console.error("Transactions error:", err);
    return res.status(500).json({ error: "server_error", message: "حدث خطأ في الخادم" });
  }
});

router.post("/loan", async (req,res)=>{
  try {
    const user=await getSessionUser(req);
    if(!user) return res.status(401).json({error:"unauthorized"});
    const {amount,reason}=req.body;
    if(!Number.isInteger(amount)||amount<1||amount>50||typeof reason!=="string"||reason.trim().length<5||reason.length>500) return res.status(400).json({error:"invalid_amount",message:"القرض 1 إلى 50 نقطة، مع سبب واضح",granted:false});
    const newBalance=await db.transaction(async(tx)=>{
      const [account]=await tx.select().from(usersTable).where(eq(usersTable.id,user.id)).for("update");
      if(!account) throw new WorkflowError(404,"not_found","المستخدم غير موجود");
      if(account.loanBalance>0) throw new WorkflowError(409,"existing_loan","يجب سداد القرض السابق");
      const requiredTrust=amount>35?70:amount>20?55:40;
      if(account.trustScore<requiredTrust) throw new WorkflowError(403,"low_trust",`تحتاج ثقة ${requiredTrust} للحصول على القرض`);
      const balance=account.points+amount;
      await tx.update(usersTable).set({points:balance,loanBalance:amount,trustScore:calculateTrustScore(account.averageRating,account.totalServicesGiven,amount,account.withdrawalPenalties),updatedAt:new Date()}).where(eq(usersTable.id,user.id));
      await tx.insert(transactionsTable).values({userId:user.id,type:"loan_given",amount,balanceAfter:balance,description:`قرض اجتماعي: ${reason.trim()}`,serviceId:null});
      await tx.insert(notificationsTable).values({userId:user.id,type:"loan_granted",title:"تم منح القرض",message:`حصلت على قرض ${amount} نقطة. عليك سداده`,serviceId:null});
      return balance;
    });
    return res.json({granted:true,amount,newBalance,message:"تم منح القرض بنجاح"});
  }catch(err){const e=workflowFailure(err);return res.status(e.status).json({error:e.error,message:e.message,granted:false});}
});

router.post("/loan/repay",async(req,res)=>{
  try{
    const user=await getSessionUser(req);
    if(!user) return res.status(401).json({error:"unauthorized"});
    const requested=req.body?.amount;
    if(!Number.isInteger(requested)||requested<=0) return res.status(400).json({error:"invalid_amount"});
    const result=await db.transaction(async(tx)=>{
      const [account]=await tx.select().from(usersTable).where(eq(usersTable.id,user.id)).for("update");
      if(!account||account.loanBalance<=0) throw new WorkflowError(409,"no_loan","لا يوجد قرض للسداد");
      if(requested>account.loanBalance||requested>account.points) throw new WorkflowError(400,"insufficient_points","المبلغ أكبر من القرض أو الرصيد المتاح");
      const balance=account.points-requested,loanBalance=account.loanBalance-requested;
      await tx.update(usersTable).set({points:balance,loanBalance,trustScore:calculateTrustScore(account.averageRating,account.totalServicesGiven,loanBalance,account.withdrawalPenalties),updatedAt:new Date()}).where(eq(usersTable.id,user.id));
      await tx.insert(transactionsTable).values({userId:user.id,type:"loan_repaid",amount:-requested,balanceAfter:balance,description:"سداد قرض اجتماعي",serviceId:null});
      return {newBalance:balance,loanBalance};
    });
    return res.json({success:true,...result});
  }catch(err){const e=workflowFailure(err);return res.status(e.status).json({error:e.error,message:e.message});}
});

export default router;

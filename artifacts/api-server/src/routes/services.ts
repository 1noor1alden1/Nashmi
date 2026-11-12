import { Router } from "express";
import { analyzeNSSS, nsssDraftSchema, signNSSS, verifyNSSS } from "../lib/nsss.js";
import {
  db, usersTable, servicesTable, applicationsTable,
  transactionsTable, notificationsTable, reviewsTable, serviceProofsTable, serviceMatchesTable, disputesTable, savedSearchesTable
} from "@workspace/db";
import { eq, and, or, desc, ilike, sql, ne, inArray } from "drizzle-orm";
import { getSessionUser } from "../lib/auth.js";
import { calculateLevel } from "../lib/service-utils.js";
import { WorkflowError, workflowFailure } from "../lib/workflow.js";
import { URGENCY_POLICY, rankProviders, semanticScores, lexicalScore } from "../lib/matching.js";

import { z } from "zod/v4";
import { activityFeedTable } from "@workspace/db";

const router = Router();

const createServiceSchema = z.object({
  title: z.string().trim().min(5).max(120),
  description: z.string().trim().min(20).max(5000),
  category: z.enum(["برمجة", "تصميم", "ترجمة", "شرح دروس", "تحرير", "أبحاث", "أخرى"]),
  requiredSkills: z.array(z.string().trim().min(2).max(60)).max(20).default([]),
  urgency: z.enum(["low", "medium", "high"]),
  deadline: z.string().datetime({ offset: true }),
  offersDeadline: z.string().datetime({ offset: true }),
  restrictToUniversity: z.boolean().optional().default(false),
  restrictToMajor: z.boolean().optional().default(false),

});

function allowedToSeeRestricted(service: {restrictToUniversity:boolean; restrictToMajor:boolean; requesterId:number; requesterUniversity:string|null; requesterMajor:string|null}, user: {id:number;university:string|null;major:string|null}|null) {
  if (service.requesterId === user?.id) return true;
  if (!user && (service.restrictToUniversity || service.restrictToMajor)) return false;
  if (service.restrictToUniversity && (!service.requesterUniversity || service.requesterUniversity !== user?.university)) return false;
  if (service.restrictToMajor && (!service.requesterMajor || service.requesterMajor !== user?.major)) return false;
  return true;
}


router.get("/", async (req, res) => {
  try {
    const { category, search, university, urgency } = req.query;
    const offset=Math.max(0,Math.min(50000,Number(req.query.offset)||0));
    const pageLimit=Math.max(1,Math.min(50,Number(req.query.limit)||50));
    const currentUser = await getSessionUser(req);

    let query = db
      .select({
        id: servicesTable.id,
        title: servicesTable.title,
        description: servicesTable.description,
        category: servicesTable.category,
        requiredSkills: servicesTable.requiredSkills,
        urgencyBonus: servicesTable.urgencyBonus,
        urgency: servicesTable.urgency,
        status: servicesTable.status,
        pointsPrice: servicesTable.pointsPrice,
        deadline: servicesTable.deadline,
        offersDeadline: servicesTable.offersDeadline,
        restrictToUniversity: servicesTable.restrictToUniversity,
        restrictToMajor: servicesTable.restrictToMajor,
        requesterId: servicesTable.requesterId,
        providerId: servicesTable.providerId,
        createdAt: servicesTable.createdAt,
        requesterName: usersTable.name,
        requesterLevel: usersTable.level,
        requesterTrustScore:usersTable.trustScore,
        requesterServicesGiven:usersTable.totalServicesGiven,
        requesterUniversity: usersTable.university,
        requesterMajor: usersTable.major,
      })
      .from(servicesTable)
      .leftJoin(usersTable, eq(servicesTable.requesterId, usersTable.id))
      .$dynamic();

    const conditions = [eq(servicesTable.status, "open")];
    // Restriction flags are access rules, not merely frontend filters.
    if (currentUser) {
      conditions.push(or(eq(servicesTable.requesterId, currentUser.id), eq(servicesTable.restrictToUniversity, false), and(eq(usersTable.university, currentUser.university || ""), sql`${usersTable.university} IS NOT NULL`))!);
      conditions.push(or(eq(servicesTable.requesterId, currentUser.id), eq(servicesTable.restrictToMajor, false), and(eq(usersTable.major, currentUser.major || ""), sql`${usersTable.major} IS NOT NULL`))!);
    } else {
      conditions.push(eq(servicesTable.restrictToUniversity, false));
      conditions.push(eq(servicesTable.restrictToMajor, false));
    }


    if (category && typeof category === "string") {
      conditions.push(eq(servicesTable.category, category));
    }
    if (search && typeof search === "string") {
      conditions.push(
        or(
          ilike(servicesTable.title, `%${search}%`),
          ilike(servicesTable.description, `%${search}%`)
        )!
      );
    }
    if (urgency && typeof urgency === "string") {
      conditions.push(eq(servicesTable.urgency, urgency as "low" | "medium" | "high"));
    }
    if (university && typeof university === "string" && currentUser) {
      conditions.push(eq(usersTable.university, currentUser.university || ""));
    }

    const services = await query
      .where(and(...conditions))
      .orderBy(desc(servicesTable.createdAt))
      .limit(pageLimit)
      .offset(offset);

    // Get applicant counts
    const serviceIds = services.map(s => s.id);
    const applicantCounts = serviceIds.length > 0
      ? await db
          .select({
            serviceId: applicationsTable.serviceId,
            count: sql<number>`count(*)`,
          })
          .from(applicationsTable)
          .where(and(
            sql`${applicationsTable.serviceId} = ANY(${sql.raw("ARRAY[" + serviceIds.join(",") + "]::int[]")})`,
            eq(applicationsTable.status, "pending")
          ))
          .groupBy(applicationsTable.serviceId)
      : [];

    const countMap: Record<number, number> = {};
    applicantCounts.forEach(a => { countMap[a.serviceId] = Number(a.count); });

    return res.json(services.map(s => ({
      id: s.id,
      title: s.title,
      description: s.description,
      category: s.category,
      requiredSkills: s.requiredSkills,
      urgencyBonus: s.urgencyBonus,
      urgency: s.urgency,
      status: s.status,
      pointsPrice: s.pointsPrice,
      deadline: s.deadline?.toISOString() || null,
      offersDeadline: s.offersDeadline?.toISOString() || null,
      restrictToUniversity: s.restrictToUniversity,
      restrictToMajor: s.restrictToMajor,
      requesterId: s.requesterId,
      requesterName: s.requesterName || "مستخدم",
      requesterLevel: s.requesterLevel || "مستجد",
      requesterTrustScore:s.requesterTrustScore,
      requesterServicesGiven:s.requesterServicesGiven,
      providerId: s.providerId,
      providerName: null,
      applicantsCount: countMap[s.id] || 0,
      createdAt: s.createdAt.toISOString(),
    })));
  } catch (err) {
    console.error("List services error:", err);
    return res.status(500).json({ error: "server_error", message: "حدث خطأ في الخادم" });
  }
});

// Preview the exact text the user will approve. Rate limit this route at your reverse proxy.
router.post("/analyze-draft", async (req, res) => {
  const user = await getSessionUser(req);
  if (!user) return res.status(401).json({error:"unauthorized"});
  const parsed=nsssDraftSchema.safeParse(req.body);
  if(!parsed.success) return res.status(400).json({error:"invalid_input",details:parsed.error.issues});
  try {
    const analysis=await analyzeNSSS(parsed.data);
    return res.json({...analysis,approvalToken:signNSSS(user.id,analysis)});
  } catch(err) {
    console.error("NSSS analysis unavailable:", err);
    return res.status(503).json({error:"nsss_unavailable",message:"تعذّر فحص النص الآن. يمكنك الاحتفاظ به وإعادة المحاولة لاحقًا."});
  }
});

router.post("/", async (req, res) => {
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return res.status(401).json({ error: "unauthorized", message: "يجب تسجيل الدخول أولاً" });
    }

    const validation = createServiceSchema.safeParse(req.body);
    if (!validation.success) return res.status(400).json({ error: "invalid_input", message: "تفاصيل الطلب غير صالحة", details: validation.error.issues });
    const { title, description, category, requiredSkills, urgency, deadline, offersDeadline, restrictToUniversity, restrictToMajor } = validation.data;
    const rawTitle = req.body.originalTitle;
    const rawDescription = req.body.originalDescription;
    const approvalToken = req.body.nsssApprovalToken;
    if(typeof rawTitle !== "string" || typeof rawDescription !== "string" ||
       typeof approvalToken !== "string" || !verifyNSSS(user.id, rawTitle, rawDescription, title, description, approvalToken)) {
      return res.status(400).json({error:"nsss_approval_required",message:"افحص الطلب ووافق على النص المقترح قبل النشر"});
    }
    // Re-run mandatory moderation, even if the user submits a valid signed preview.
    let canonicalConcepts:string[]=[];
    let suggestedCategory:string|null=null;let suggestedSkills:string[]=[];
    try {
      const current=await analyzeNSSS({title:rawTitle,description:rawDescription,category});
      if(!current.publishable || !current.suggested || current.suggested.title !== title || current.suggested.description !== description)
        return res.status(422).json({error:"nsss_recheck_required",message:"تغيّرت نتيجة الفحص، أعد تحليل الطلب"});
      canonicalConcepts=current.canonical_concepts;
      suggestedCategory=current.suggested_category??null;
      suggestedSkills=current.suggested_skills??[];
    } catch(err) { return res.status(503).json({error:"nsss_unavailable",message:"فحص المحتوى غير متاح حاليًا"}); }
    const parsedDeadline = deadline ? new Date(deadline) : null;
    if (parsedDeadline && parsedDeadline <= new Date()) return res.status(400).json({ error: "invalid_deadline", message: "موعد التسليم يجب أن يكون في المستقبل" });
    if (restrictToUniversity && !user.university || restrictToMajor && !user.major) return res.status(400).json({ error: "missing_profile", message: "أكمل الجامعة والتخصص أولاً قبل تقييد الطلب" });

    const parsedOffersDeadline = new Date(offersDeadline);
    if (!Number.isFinite(parsedOffersDeadline.getTime()) || parsedOffersDeadline <= new Date() || !parsedDeadline || parsedOffersDeadline >= parsedDeadline)
      return res.status(400).json({ error:"invalid_offers_deadline", message:"آخر موعد للعروض يجب أن يكون قبل موعد إنجاز الخدمة وفي المستقبل" });

    const policy=URGENCY_POLICY[urgency];
    // Compute candidates before publication. Fail closed if candidate dispatch cannot
    // be prepared, rather than publishing a "notified" request with no notifications.
    let ranked:Awaited<ReturnType<typeof rankProviders>>;
    try{
      ranked=await rankProviders({category,requiredSkills,requesterId:user.id,
        restrictToUniversity:!!restrictToUniversity,restrictToMajor:!!restrictToMajor,urgency},user);
    }catch(err){console.error("Match preparation error:",err);return res.status(503).json({error:"matching_unavailable",message:"تعذر تجهيز التوصيات الآن؛ حاول لاحقًا"});}
    let subscribers:number[]=[];
    try{
      const saved=await db.select({userId:savedSearchesTable.userId,query:savedSearchesTable.query,
        category:savedSearchesTable.category,university:usersTable.university,major:usersTable.major})
        .from(savedSearchesTable).innerJoin(usersTable,eq(savedSearchesTable.userId,usersTable.id)).limit(3000);
      const targets=new Set(ranked.map(r=>r.userId));
      for(const s of saved){
        if(s.userId===user.id||targets.has(s.userId))continue;
        if(restrictToUniversity&&(!user.university||s.university!==user.university))continue;
        if(restrictToMajor&&(!user.major||s.major!==user.major))continue;
        if(s.category&&s.category!==category)continue;
        if(lexicalScore(s.query,`${title} ${description} ${requiredSkills.join(" ")}`)<.60)continue;
        targets.add(s.userId);subscribers.push(s.userId);
        if(subscribers.length>=50)break;
      }
    }catch(err){console.error("Saved search dispatch preparation error:",err);
      return res.status(503).json({error:"search_notifications_unavailable",message:"تعذر تجهيز إشعارات البحث المحفوظ"});}
    let service:typeof servicesTable.$inferSelect;
    try{
      service=await db.transaction(async tx=>{
        // Lock requester so concurrent publications cannot spend the same points.
        const [locked]=await tx.select().from(usersTable).where(eq(usersTable.id,user.id)).for("update");
        if(!locked||locked.points<policy.bonus)throw new WorkflowError(409,"insufficient_points","رصيدك لا يكفي لحجز مكافأة الاستعجال");
        const [created]=await tx.insert(servicesTable).values({
          title,description,originalTitle:rawTitle,originalDescription:rawDescription,
          canonicalConcepts:JSON.stringify(canonicalConcepts),category,requiredSkills:[...new Set(requiredSkills)],
          categorySuggestion:suggestedCategory,skillSuggestions:suggestedSkills,urgency,
          urgencyBonus:policy.bonus,bonusEscrowActive:policy.bonus>0,
          pointsPrice:0,deadline:parsedDeadline,offersDeadline:parsedOffersDeadline,
          restrictToUniversity:!!restrictToUniversity,restrictToMajor:!!restrictToMajor,requesterId:user.id,
        }).returning();
        if(policy.bonus>0){
          const balance=locked.points-policy.bonus;
          await tx.update(usersTable).set({points:balance,updatedAt:new Date()}).where(eq(usersTable.id,user.id));
          await tx.insert(transactionsTable).values({userId:user.id,type:"escrow_locked",amount:-policy.bonus,
            balanceAfter:balance,description:`حجز مكافأة استعجال للطلب \"${title}\"`,serviceId:created.id});
        }
        await tx.insert(notificationsTable).values({userId:user.id,type:"service_match",title:"تم نشر طلبك بنجاح",
          message:`طلبك \"${title}\" منشور الآن، وتستطيع استقبال عروض الطلاب`,serviceId:created.id});
        if(subscribers.length){
          await tx.insert(notificationsTable).values(subscribers.map(userId=>({userId,type:"service_match" as const,
            title:"طلب جديد يطابق بحثك المحفوظ",message:`${title}`,serviceId:created.id})));
        }
        if(ranked.length){
          await tx.insert(serviceMatchesTable).values(ranked.map(x=>({serviceId:created.id,userId:x.userId,
            rank:x.rank,score:x.score,explanation:x.reason})));
          await tx.insert(notificationsTable).values(ranked.map(x=>({userId:x.userId,type:"service_match" as const,
            title:"طلب مناسب لمهاراتك",message:`${title} — ${x.reason}`,serviceId:created.id})));
        }
        return created;
      });
    }catch(err){const e=workflowFailure(err);return res.status(e.status).json({error:e.error,message:e.message});}
    return res.status(201).json({
      id: service.id,
      title: service.title,
      description: service.description,
      category: service.category,
      urgency: service.urgency,
      urgencyBonus: service.urgencyBonus,
      requiredSkills: service.requiredSkills,
      status: service.status,
      pointsPrice: service.pointsPrice,
      offersDeadline: service.offersDeadline?.toISOString() || null,
      deadline: service.deadline?.toISOString() || null,
      restrictToUniversity: service.restrictToUniversity,
      restrictToMajor: service.restrictToMajor,
      requesterId: service.requesterId,
      requesterName: user.name,
      requesterLevel: user.level,
      providerId: null,
      providerName: null,
      applicantsCount: 0,
      createdAt: service.createdAt.toISOString(),
    });
  } catch (err) {
    console.error("Create service error:", err);
    return res.status(500).json({ error: "server_error", message: "حدث خطأ في الخادم" });
  }
});

// Personalized feed: the snapshot selected on publication (not all visible services).
router.get("/recommended/me",async(req,res)=>{
  try{
    const user=await getSessionUser(req);if(!user)return res.status(401).json({error:"unauthorized"});
    const rows=await db.select({id:servicesTable.id,title:servicesTable.title,description:servicesTable.description,
      category:servicesTable.category,requiredSkills:servicesTable.requiredSkills,urgency:servicesTable.urgency,
      urgencyBonus:servicesTable.urgencyBonus,deadline:servicesTable.deadline,offersDeadline:servicesTable.offersDeadline,
      createdAt:servicesTable.createdAt,requesterId:servicesTable.requesterId,restrictToUniversity:servicesTable.restrictToUniversity,
      restrictToMajor:servicesTable.restrictToMajor,requesterName:usersTable.name,requesterLevel:usersTable.level,
      requesterUniversity:usersTable.university,requesterMajor:usersTable.major,
      rank:serviceMatchesTable.rank,matchScore:serviceMatchesTable.score,matchExplanation:serviceMatchesTable.explanation})
      .from(serviceMatchesTable).innerJoin(servicesTable,eq(servicesTable.id,serviceMatchesTable.serviceId))
      .innerJoin(usersTable,eq(usersTable.id,servicesTable.requesterId))
      .where(and(eq(serviceMatchesTable.userId,user.id),eq(servicesTable.status,"open")))
      .orderBy(desc(servicesTable.createdAt)).limit(50);
    return res.json(rows.filter(s=>allowedToSeeRestricted(s,user)&&(!s.offersDeadline||s.offersDeadline>new Date())).map(s=>({...s,pointsPrice:0,applicantsCount:0,status:"open",providerId:null,providerName:null,
      deadline:s.deadline?.toISOString()??null,offersDeadline:s.offersDeadline?.toISOString()??null,createdAt:s.createdAt.toISOString()})));
  }catch(err){console.error("Recommended error:",err);return res.status(500).json({error:"server_error"});}
});

// Hybrid search: semantic E5 reranking when ML service is up; bounded lexical fallback.
router.get("/search/smart",async(req,res)=>{
  try{
    const user=await getSessionUser(req);if(!user)return res.status(401).json({error:"unauthorized"});
    const q=typeof req.query.q==="string"?req.query.q.trim().slice(0,200):"";
    if(q.length<2)return res.status(400).json({error:"invalid_query",message:"اكتب كلمتين أو أكثر للبحث"});
    const category=typeof req.query.category==="string"?req.query.category:"";
    const urgency=typeof req.query.urgency==="string"?req.query.urgency:"";
    const rows=await db.select({id:servicesTable.id,title:servicesTable.title,description:servicesTable.description,
      category:servicesTable.category,requiredSkills:servicesTable.requiredSkills,urgency:servicesTable.urgency,
      urgencyBonus:servicesTable.urgencyBonus,status:servicesTable.status,pointsPrice:servicesTable.pointsPrice,
      deadline:servicesTable.deadline,offersDeadline:servicesTable.offersDeadline,createdAt:servicesTable.createdAt,
      requesterId:servicesTable.requesterId,providerId:servicesTable.providerId,
      restrictToUniversity:servicesTable.restrictToUniversity,restrictToMajor:servicesTable.restrictToMajor,
      requesterName:usersTable.name,requesterLevel:usersTable.level,
      requesterUniversity:usersTable.university,requesterMajor:usersTable.major})
      .from(servicesTable).innerJoin(usersTable,eq(usersTable.id,servicesTable.requesterId))
      .where(eq(servicesTable.status,"open")).orderBy(desc(servicesTable.createdAt)).limit(150);
    const visible=rows.filter(x=>x.requesterId!==user.id&&allowedToSeeRestricted(x,user)&&
      (!x.offersDeadline||x.offersDeadline>new Date())&&(!category||x.category===category)&&(!urgency||x.urgency===urgency));
    const texts=visible.map(x=>`${x.title} ${x.description} ${x.requiredSkills.join(" ")} ${x.category}`);
    const semantic=await semanticScores(q,texts);
    const hasSemantic=semantic!==null&&semantic.length===texts.length&&texts.length>0;
    const ranked=visible.map((x,i)=>{
      const lexical=lexicalScore(q,texts[i]);
      const semanticNormalized=hasSemantic?Math.max(0,Math.min(1,(semantic![i]+1)/2)):0;
      return {...x,relevance:Math.round(100*(hasSemantic?(.70*semanticNormalized+.30*lexical):lexical)),
        searchMethod:hasSemantic?"hybrid-e5-keywords":"lexical-fallback"};
    }).filter(x=>x.relevance>=(hasSemantic?35:15)).sort((a,b)=>b.relevance-a.relevance||b.createdAt.getTime()-a.createdAt.getTime()).slice(0,50);
    return res.json({method:hasSemantic?"hybrid-e5-keywords":"lexical-fallback",items:ranked.map(x=>({...x,
      deadline:x.deadline?.toISOString()??null,offersDeadline:x.offersDeadline?.toISOString()??null,
      createdAt:x.createdAt.toISOString(),applicantsCount:0,providerName:null}))});
  }catch(err){console.error("Search error:",err);return res.status(500).json({error:"server_error"});}
});

router.get("/:id/matches",async(req,res)=>{
  try{
    const user=await getSessionUser(req);if(!user)return res.status(401).json({error:"unauthorized"});
    const id=Number(req.params.id);if(!Number.isSafeInteger(id)||id<=0)return res.status(400).json({error:"invalid_id"});
    const [service]=await db.select().from(servicesTable).where(eq(servicesTable.id,id));
    if(!service)return res.status(404).json({error:"not_found"});
    if(service.requesterId!==user.id)return res.status(403).json({error:"forbidden"});
    const matches=await db.select({userId:serviceMatchesTable.userId,name:usersTable.name,rank:serviceMatchesTable.rank,
      score:serviceMatchesTable.score,explanation:serviceMatchesTable.explanation})
      .from(serviceMatchesTable).innerJoin(usersTable,eq(serviceMatchesTable.userId,usersTable.id))
      .where(eq(serviceMatchesTable.serviceId,id)).orderBy(serviceMatchesTable.rank);
    return res.json({candidates:matches,algorithm:"skills-experience-availability-fairness-v2",isMachineLearning:false,
      warning:"الدرجة معيار ترتيب، وليست احتمال نجاح"});
  }catch(err){console.error("Matches error:",err);return res.status(500).json({error:"server_error"});}
});

router.get("/:id", async (req, res) => {
  try {
    const currentUser = await getSessionUser(req);
    if (!currentUser) return res.status(401).json({error:"unauthorized", message:"يجب تسجيل الدخول"});
    const serviceId = parseInt(req.params.id);

    const [serviceRow] = await db
      .select({
        id: servicesTable.id,
        title: servicesTable.title,
        description: servicesTable.description,
        category: servicesTable.category,
        requiredSkills: servicesTable.requiredSkills,
        urgencyBonus: servicesTable.urgencyBonus,
        urgency: servicesTable.urgency,
        status: servicesTable.status,
        pointsPrice: servicesTable.pointsPrice,
        deadline: servicesTable.deadline,
        offersDeadline: servicesTable.offersDeadline,
        restrictToUniversity: servicesTable.restrictToUniversity,
        restrictToMajor: servicesTable.restrictToMajor,
        requesterId: servicesTable.requesterId,
        providerId: servicesTable.providerId,
        createdAt: servicesTable.createdAt,
        requesterName: usersTable.name,
        requesterLevel: usersTable.level,
        requesterTrustScore:usersTable.trustScore,
        requesterServicesGiven:usersTable.totalServicesGiven,
        requesterUniversity: usersTable.university,
        requesterMajor: usersTable.major,
      })
      .from(servicesTable)
      .leftJoin(usersTable, eq(servicesTable.requesterId, usersTable.id))
      .where(eq(servicesTable.id, serviceId))
      .limit(1);

    if (!serviceRow) {
      return res.status(404).json({ error: "not_found", message: "الخدمة غير موجودة" });
    }

    if (!allowedToSeeRestricted(serviceRow, currentUser)) return res.status(403).json({error:"forbidden", message:"هذا الطلب مقيد بالدائرة الموثوقة"});

    // Only the requester may see applicant identities and private messages.
    const applicantRows = serviceRow.requesterId === currentUser.id ? await db
      .select({
        userId: applicationsTable.applicantId,
        message: applicationsTable.message,
        proposedPoints:applicationsTable.proposedPoints,
        promisedDelivery:applicationsTable.promisedDelivery,
        appliedAt: applicationsTable.createdAt,
        name: usersTable.name,
        level: usersTable.level,
        trustScore: usersTable.trustScore,
        averageRating: usersTable.averageRating,
        totalServicesGiven:usersTable.totalServicesGiven,
        status: applicationsTable.status,
      })
      .from(applicationsTable)
      .leftJoin(usersTable, eq(applicationsTable.applicantId, usersTable.id))
      .where(eq(applicationsTable.serviceId, serviceId))
      .orderBy(desc(usersTable.trustScore))
      .limit(100) : await db.select({ userId:applicationsTable.applicantId, message:applicationsTable.message, proposedPoints:applicationsTable.proposedPoints, promisedDelivery:applicationsTable.promisedDelivery, appliedAt:applicationsTable.createdAt, name:usersTable.name, level:usersTable.level, trustScore:usersTable.trustScore, averageRating:usersTable.averageRating, totalServicesGiven:usersTable.totalServicesGiven, status:applicationsTable.status }).from(applicationsTable).leftJoin(usersTable,eq(applicationsTable.applicantId,usersTable.id)).where(and(eq(applicationsTable.serviceId,serviceId),eq(applicationsTable.applicantId,currentUser.id))).limit(1);

    // Reputation is computed from verified REQUESTER -> PROVIDER reviews of completed jobs.
    // Never interpret this index as the probability of success.
    const providerRatingRows = serviceRow.requesterId === currentUser.id && applicantRows.length
      ? await db.select({ providerId:reviewsTable.revieweeId, score:reviewsTable.averageRating })
          .from(reviewsTable).innerJoin(servicesTable,eq(reviewsTable.serviceId,servicesTable.id))
          .where(and(eq(reviewsTable.reviewerId,servicesTable.requesterId),eq(reviewsTable.revieweeId,servicesTable.providerId),eq(servicesTable.status,"completed")))
      : [];
    const ratingsByProvider = new Map<number,number[]>();
    for(const row of providerRatingRows){const list=ratingsByProvider.get(row.providerId)||[];list.push(row.score);ratingsByProvider.set(row.providerId,list);}
    const reputation=(id:number,legacy:number|null|undefined)=>{
      if(serviceRow.requesterId!==currentUser.id) return legacy ?? 70;
      const rows=ratingsByProvider.get(id)||[];
      return rows.length ? Math.round(100*(rows.reduce((sum,r)=>sum+r/5,0)+3.5)/(rows.length+5)) : 70;
    };

    // Get reviews
    const reviewRows = await db
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

    return res.json({
      id: serviceRow.id,
      title: serviceRow.title,
      description: serviceRow.description,
      category: serviceRow.category,
      requiredSkills: serviceRow.requiredSkills,
      urgencyBonus: serviceRow.urgencyBonus,
      urgency: serviceRow.urgency,
      status: serviceRow.status,
      pointsPrice: serviceRow.pointsPrice,
      deadline: serviceRow.deadline?.toISOString() || null,
      offersDeadline: serviceRow.offersDeadline?.toISOString() || null,
      restrictToUniversity: serviceRow.restrictToUniversity,
      restrictToMajor: serviceRow.restrictToMajor,
      requesterId: serviceRow.requesterId,
      requesterName: serviceRow.requesterName,
      requesterLevel: serviceRow.requesterLevel,
      requesterTrustScore:serviceRow.requesterTrustScore,
      requesterServicesGiven:serviceRow.requesterServicesGiven,
      requesterUniversity: serviceRow.requesterUniversity,
      providerId: serviceRow.providerId,
      providerName: null,
      applicants: applicantRows.map(a => ({
        userId: a.userId,
        name: a.name || "مستخدم",
        level: a.level || "مستجد",
        trustScore: reputation(a.userId,a.trustScore),
        reputationReviews:ratingsByProvider.get(a.userId)?.length ?? 0,
        completedServices:a.totalServicesGiven ?? 0,
        proposedPoints:a.proposedPoints,
        promisedDelivery:a.promisedDelivery?.toISOString() || null,
        averageRating: a.averageRating,
        message: a.message,
        appliedAt: a.appliedAt.toISOString(),
      })),
      reviews: reviewRows.map(r => ({
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
      })),
      createdAt: serviceRow.createdAt.toISOString(),
    });
  } catch (err) {
    console.error("Get service error:", err);
    return res.status(500).json({ error: "server_error", message: "حدث خطأ في الخادم" });
  }
});

router.post("/:id/apply", async (req, res) => {
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return res.status(401).json({ error: "unauthorized", message: "يجب تسجيل الدخول أولاً" });
    }

    const serviceId = parseInt(req.params.id);
    const proposal = z.object({message:z.string().trim().min(20).max(1500),proposedPoints:z.number().int().min(1).max(100000),promisedDelivery:z.string().datetime({offset:true})}).safeParse(req.body);
    if(!proposal.success) return res.status(400).json({error:"invalid_offer",message:"أدخل النقاط وخطة التنفيذ وموعد التسليم"});
    const {message,proposedPoints,promisedDelivery}=proposal.data;
    const deliveryDate=new Date(promisedDelivery);
    if(!Number.isFinite(deliveryDate.getTime()) || deliveryDate <= new Date()) return res.status(400).json({error:"invalid_delivery"});

    const [service] = await db.select().from(servicesTable).where(eq(servicesTable.id, serviceId)).limit(1);
    if (!service) return res.status(404).json({ error: "not_found", message: "الخدمة غير موجودة" });
    if (service.requesterId === user.id) return res.status(400).json({ error: "own_service", message: "لا يمكنك التقديم على طلبك الخاص" });
    if (service.status !== "open") return res.status(400).json({ error: "not_open", message: "هذا الطلب لم يعد متاحاً" });
    if(service.offersDeadline && service.offersDeadline <= new Date()) return res.status(409).json({error:"offers_closed",message:"انتهى موعد استقبال العروض"});
    const [owner] = await db.select({ university: usersTable.university, major: usersTable.major }).from(usersTable).where(eq(usersTable.id, service.requesterId));
    if (!allowedToSeeRestricted({ ...service, requesterUniversity: owner?.university || null, requesterMajor: owner?.major || null }, user)) return res.status(403).json({error:"forbidden",message:"الدائرة الموثوقة تمنع هذا التقديم"});
    if(service.deadline && deliveryDate > service.deadline) return res.status(400).json({error:"delivery_too_late",message:"موعدك يتجاوز الموعد المطلوب"});

    const existing = await db.select().from(applicationsTable)
      .where(and(eq(applicationsTable.serviceId, serviceId), eq(applicationsTable.applicantId, user.id)))
      .limit(1);
    if (existing.length > 0) return res.status(400).json({ error: "already_applied", message: "لقد قدمت على هذا الطلب مسبقاً" });

    await db.insert(applicationsTable).values({
      serviceId,
      applicantId: user.id,
      message, proposedPoints, promisedDelivery:deliveryDate,
    });

    // Notify requester
    await db.insert(notificationsTable).values({
      userId: service.requesterId,
      type: "service_match",
      title: "تقديم جديد على طلبك",
      message: `${user.name} تقدّم لتقديم خدمة "${service.title}"`,
      serviceId,
    });

    return res.json({ message: "تم تقديم طلبك بنجاح! سيتواصل معك صاحب الطلب قريباً", success: true });
  } catch (err) {
    console.error("Apply error:", err);
    return res.status(500).json({ error: "server_error", message: "حدث خطأ في الخادم" });
  }
});

// The same student may revise their ONE offer until the offers deadline.
router.patch("/:id/offer",async(req,res)=>{
  try {
    const user=await getSessionUser(req);
    if(!user) return res.status(401).json({error:"unauthorized"});
    const serviceId=Number(req.params.id);
    if(!Number.isSafeInteger(serviceId)||serviceId<=0) return res.status(400).json({error:"invalid_id"});
    const validation=z.object({message:z.string().trim().min(20).max(1500),proposedPoints:z.number().int().min(1).max(100000),promisedDelivery:z.string().datetime({offset:true})}).safeParse(req.body);
    if(!validation.success) return res.status(400).json({error:"invalid_offer"});
    const delivery=new Date(validation.data.promisedDelivery);
    await db.transaction(async tx=>{
      const [service]=await tx.select().from(servicesTable).where(eq(servicesTable.id,serviceId)).for("update");
      if(!service||service.status!=="open") throw new WorkflowError(409,"not_open","لم يعد الطلب مفتوحًا");
      if(service.requesterId===user.id) throw new WorkflowError(403,"forbidden","لا يمكنك تقديم عرض لنفسك");
      if(service.offersDeadline && service.offersDeadline<=new Date()) throw new WorkflowError(409,"offers_closed","انتهى موعد استقبال العروض");
      if(!Number.isFinite(delivery.getTime())||delivery<=new Date()||(service.deadline&&delivery>service.deadline)) throw new WorkflowError(400,"invalid_delivery","موعد التسليم غير صالح");
      const [offer]=await tx.select().from(applicationsTable).where(and(eq(applicationsTable.serviceId,serviceId),eq(applicationsTable.applicantId,user.id),eq(applicationsTable.status,"pending")));
      if(!offer) throw new WorkflowError(404,"no_offer","ليس لديك عرض قابل للتعديل");
      await tx.update(applicationsTable).set({message:validation.data.message,proposedPoints:validation.data.proposedPoints,promisedDelivery:delivery}).where(eq(applicationsTable.id,offer.id));
    });
    return res.json({success:true,message:"تم تحديث العرض"});
  }catch(err){const e=workflowFailure(err);return res.status(e.status).json({error:e.error,message:e.message});}
});

router.post("/:id/accept/:applicantId", async (req, res) => {
  try {
    const user = await getSessionUser(req);
    if (!user) return res.status(401).json({ error: "unauthorized", message: "يجب تسجيل الدخول" });
    const serviceId = Number(req.params.id), applicantId = Number(req.params.applicantId);
    if (!Number.isSafeInteger(serviceId) || !Number.isSafeInteger(applicantId) || applicantId <= 0) return res.status(400).json({error:"invalid_id"});
    await db.transaction(async (tx) => {
      // Lock the service first. Every state transition uses this same lock.
      const [service] = await tx.select().from(servicesTable).where(eq(servicesTable.id, serviceId)).for("update");
      if (!service) throw new WorkflowError(404, "not_found", "الخدمة غير موجودة");
      if (service.requesterId !== user.id) throw new WorkflowError(403, "forbidden", "ليس لديك صلاحية");
      if (service.status !== "open") throw new WorkflowError(409, "not_open", "تم قبول هذا الطلب أو إغلاقه مسبقًا");
      if (applicantId === user.id) throw new WorkflowError(400, "own_service", "لا يمكنك قبول نفسك");
      const [application] = await tx.select().from(applicationsTable).where(and(eq(applicationsTable.serviceId, serviceId), eq(applicationsTable.applicantId, applicantId), eq(applicationsTable.status, "pending")));
      if (!application) throw new WorkflowError(400, "not_applicant", "هذا المستخدم لم يتقدم على الطلب");
      if(!application.proposedPoints || !application.promisedDelivery) throw new WorkflowError(409,"legacy_application","هذا طلب قديم بدون سعر وموعد؛ يجب تقديم عرض جديد");
      const agreedPoints=application.proposedPoints;
      await tx.select({id:usersTable.id}).from(usersTable).where(eq(usersTable.id, user.id)).for("update");
      const [requester] = await tx.select().from(usersTable).where(eq(usersTable.id, user.id));
      if (!requester || requester.points < agreedPoints) throw new WorkflowError(400, "insufficient_points", "النقاط غير كافية");
      const newBalance = requester.points - agreedPoints;
      await tx.update(usersTable).set({points:newBalance,updatedAt:new Date()}).where(eq(usersTable.id,user.id));
      await tx.insert(transactionsTable).values({userId:user.id,type:"escrow_locked",amount:-agreedPoints,balanceAfter:newBalance,description:`حجز نقاط لخدمة "${service.title}"`,serviceId});
      await tx.update(servicesTable).set({status:"in_progress",providerId:applicantId,pointsPrice:agreedPoints,escrowActive:true,updatedAt:new Date()}).where(eq(servicesTable.id,serviceId));
      await tx.update(applicationsTable).set({status:"rejected"}).where(and(eq(applicationsTable.serviceId,serviceId),ne(applicationsTable.applicantId,applicantId)));
      await tx.update(applicationsTable).set({status:"accepted"}).where(eq(applicationsTable.id,application.id));
      await tx.insert(notificationsTable).values({userId:applicantId,type:"service_accepted",title:"تم قبول طلبك!",message:`تم قبولك لتقديم خدمة "${service.title}". النقاط محفوظة حتى الإكمال`,serviceId});
    });
    return res.json({message:"تم قبول المتقدم وحجز النقاط",success:true});
  } catch (err) {
    console.error("Accept error:",err);
    const e=workflowFailure(err);return res.status(e.status).json({error:e.error,message:e.message});
  }
});

router.post("/:id/complete", async (req, res) => {
  try {
    const user = await getSessionUser(req);
    if (!user) return res.status(401).json({error:"unauthorized",message:"يجب تسجيل الدخول"});
    const serviceId=Number(req.params.id);
    if (!Number.isSafeInteger(serviceId)) return res.status(400).json({error:"invalid_id"});
    await db.transaction(async (tx) => {
      const [service] = await tx.select().from(servicesTable).where(eq(servicesTable.id,serviceId)).for("update");
      if (!service) throw new WorkflowError(404,"not_found","الخدمة غير موجودة");
      if (service.requesterId !== user.id) throw new WorkflowError(403,"forbidden","ليس لديك صلاحية");
      if (service.status !== "in_progress" || !service.escrowActive || !service.providerId) throw new WorkflowError(409,"not_in_progress","الخدمة ليست قيد التنفيذ أو الضمان غير نشط");
      const [activeDispute]=await tx.select({id:disputesTable.id}).from(disputesTable)
        .where(and(eq(disputesTable.serviceId,serviceId),eq(disputesTable.status,"open")));
      if(activeDispute)throw new WorkflowError(409,"dispute_open","لا يمكن تحرير الضمان حتى تسوية النزاع");
      // Require a submitted proof. Gemini is advisory, not an automatic release authority.
      const proofs = await tx.select({id:serviceProofsTable.id}).from(serviceProofsTable).where(eq(serviceProofsTable.serviceId,serviceId)).limit(1);
      if (!proofs.length) throw new WorkflowError(409,"proof_required","يجب تقديم وصف الإنجاز قبل تأكيد الخدمة");
      for (const id of [service.requesterId, service.providerId].sort((a,b)=>a-b)) await tx.select({id:usersTable.id}).from(usersTable).where(eq(usersTable.id,id)).for("update");
      const [provider] = await tx.select().from(usersTable).where(eq(usersTable.id,service.providerId));
      const [requester] = await tx.select().from(usersTable).where(eq(usersTable.id,service.requesterId));
      if (!provider || !requester) throw new WorkflowError(409,"missing_user","حساب أحد الطرفين غير موجود");
      const payout=service.pointsPrice+(service.bonusEscrowActive?service.urgencyBonus:0);
      const newBalance=provider.points+payout;
      const servicesGiven=provider.totalServicesGiven+1;
      await tx.update(usersTable).set({points:newBalance,totalServicesGiven:servicesGiven,level:calculateLevel(servicesGiven),updatedAt:new Date()}).where(eq(usersTable.id,provider.id));
      await tx.insert(transactionsTable).values({userId:provider.id,type:"escrow_released",amount:payout,balanceAfter:newBalance,description:`إنجاز خدمة "${service.title}"`,serviceId});
      await tx.update(usersTable).set({totalServicesReceived:requester.totalServicesReceived+1,updatedAt:new Date()}).where(eq(usersTable.id,requester.id));
      await tx.update(servicesTable).set({status:"completed",escrowActive:false,bonusEscrowActive:false,updatedAt:new Date()}).where(eq(servicesTable.id,serviceId));
      await tx.insert(notificationsTable).values({userId:provider.id,type:"service_completed",title:"تم اعتماد الخدمة!",message:`تم تحويل ${payout} نقطة شاملًا مكافأة الاستعجال بعد تأكيد صاحب الطلب`,serviceId});
      // No service title in public activity to preserve privacy.
      await tx.insert(activityFeedTable).values({message:`تم إنجاز خدمة في تصنيف ${service.category}`,category:service.category});
    });
    return res.json({message:"تم إنهاء الخدمة بنجاح",success:true});
  } catch(err) {
    console.error("Complete error:",err);
    const e=workflowFailure(err);return res.status(e.status).json({error:e.error,message:e.message});
  }
});

router.post("/:id/cancel", async (req, res) => {
  try {
    const user=await getSessionUser(req);
    if (!user) return res.status(401).json({error:"unauthorized",message:"يجب تسجيل الدخول"});
    const serviceId=Number(req.params.id);
    if (!Number.isSafeInteger(serviceId)) return res.status(400).json({error:"invalid_id"});
    await db.transaction(async (tx) => {
      const [service]=await tx.select().from(servicesTable).where(eq(servicesTable.id,serviceId)).for("update");
      if (!service) throw new WorkflowError(404,"not_found","الخدمة غير موجودة");
      if (service.requesterId!==user.id && service.providerId!==user.id) throw new WorkflowError(403,"forbidden","ليس لديك صلاحية");
      if (service.status==="completed" || service.status==="cancelled") throw new WorkflowError(409,"closed_service","لا يمكن إلغاء خدمة منتهية");
      if (service.status==="open") {
        if(service.requesterId!==user.id) throw new WorkflowError(403,"forbidden","ليس لديك صلاحية");
        if(service.bonusEscrowActive&&service.urgencyBonus>0){
          const [owner]=await tx.select().from(usersTable).where(eq(usersTable.id,user.id)).for("update");
          if(!owner)throw new WorkflowError(404,"missing_user","المستخدم غير موجود");
          const balance=owner.points+service.urgencyBonus;
          await tx.update(usersTable).set({points:balance,updatedAt:new Date()}).where(eq(usersTable.id,user.id));
          await tx.insert(transactionsTable).values({userId:user.id,type:"escrow_released",amount:service.urgencyBonus,
            balanceAfter:balance,description:`استرداد مكافأة استعجال ملغاة للطلب \"${service.title}\"`,serviceId});
        }
        await tx.update(servicesTable).set({status:"cancelled",bonusEscrowActive:false,updatedAt:new Date()}).where(eq(servicesTable.id,serviceId));
        return;
      }
      if(service.status!=="in_progress" || !service.escrowActive || !service.providerId) throw new WorkflowError(409,"invalid_state","حالة خدمة غير صالحة");
      const [activeDispute]=await tx.select({id:disputesTable.id}).from(disputesTable)
        .where(and(eq(disputesTable.serviceId,serviceId),eq(disputesTable.status,"open")));
      if(activeDispute)throw new WorkflowError(409,"dispute_open","يجب تسوية النزاع أولًا");
      // Requesters cannot unilaterally revoke work after a provider has started.
      if(service.requesterId===user.id) throw new WorkflowError(409,"dispute_required","لا يمكن إلغاء خدمة قيد التنفيذ من طرف واحد. تواصل مع المزود أو مسؤول التجربة");
      for(const id of [service.requesterId,service.providerId].sort((a,b)=>a-b)) await tx.select({id:usersTable.id}).from(usersTable).where(eq(usersTable.id,id)).for("update");
      const [requester]=await tx.select().from(usersTable).where(eq(usersTable.id,service.requesterId));
      const [provider]=await tx.select().from(usersTable).where(eq(usersTable.id,service.providerId));
      if(!requester || !provider) throw new WorkflowError(409,"missing_user","حساب غير موجود");
      const refundBalance=requester.points+service.pointsPrice;
      await tx.update(usersTable).set({points:refundBalance,updatedAt:new Date()}).where(eq(usersTable.id,requester.id));
      await tx.insert(transactionsTable).values({userId:requester.id,type:"escrow_released",amount:service.pointsPrice,balanceAfter:refundBalance,description:`استرداد ضمان خدمة "${service.title}"`,serviceId});
      const hoursUntil=service.deadline?(service.deadline.getTime()-Date.now())/3600000:Infinity;
      if(hoursUntil<=24) {
        const requestedPenalty=Math.round(service.pointsPrice*0.2);
        const actualPenalty=Math.min(provider.points,requestedPenalty);
        const penalties=provider.withdrawalPenalties+1;
        await tx.update(usersTable).set({points:provider.points-actualPenalty,withdrawalPenalties:penalties,updatedAt:new Date()}).where(eq(usersTable.id,provider.id));
        if(actualPenalty>0) await tx.insert(transactionsTable).values({userId:provider.id,type:"penalty_deducted",amount:-actualPenalty,balanceAfter:provider.points-actualPenalty,description:`عقوبة انسحاب متأخر من خدمة "${service.title}"`,serviceId});
      }
      await tx.update(servicesTable).set({status:"open",providerId:null,escrowActive:false,updatedAt:new Date()}).where(eq(servicesTable.id,serviceId));
      await tx.update(applicationsTable).set({status:"rejected"}).where(and(eq(applicationsTable.serviceId,serviceId),eq(applicationsTable.applicantId,provider.id)));
      await tx.insert(notificationsTable).values({userId:requester.id,type:"service_match",title:"انسحب مقدم الخدمة",message:"أصبح طلبك متاحًا للتقديم مجددًا",serviceId});
    });
    return res.json({message:"تم التعامل مع الانسحاب وحالة النقاط",success:true});
  } catch(err) {
    console.error("Cancel error:",err);
    const e=workflowFailure(err);return res.status(e.status).json({error:e.error,message:e.message});
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const user = await getSessionUser(req);
    if (!user) return res.status(401).json({ error: "unauthorized", message: "يجب تسجيل الدخول" });

    const serviceId = parseInt(req.params.id);
    const [service] = await db.select().from(servicesTable).where(eq(servicesTable.id, serviceId)).limit(1);
    if (!service) return res.status(404).json({ error: "not_found", message: "الخدمة غير موجودة" });
    if (service.requesterId !== user.id) return res.status(403).json({ error: "forbidden", message: "ليس لديك صلاحية" });

    if (service.status !== "open") return res.status(409).json({error:"not_open", message:"لا يمكن تعديل الخدمة بعد بدء التنفيذ"});
    if ((typeof req.body.title !== "undefined" && (typeof req.body.title !== "string" || req.body.title.trim().length < 5 || req.body.title.length > 120)) || (typeof req.body.description !== "undefined" && (typeof req.body.description !== "string" || req.body.description.trim().length < 20 || req.body.description.length > 5000))) return res.status(400).json({error:"invalid_input"});
    const { title, description } = req.body;
    const updates: Partial<typeof servicesTable.$inferInsert> = { updatedAt: new Date() };
    if(title !== undefined || description !== undefined) {
      const existingOffers=await db.select({id:applicationsTable.id}).from(applicationsTable).where(eq(applicationsTable.serviceId,serviceId)).limit(1);
      if(existingOffers.length) return res.status(409).json({error:"offers_exist",message:"لا يمكن تغيير تفاصيل الطلب بعد استقبال العروض"});
      const rawTitle=req.body.originalTitle, rawDescription=req.body.originalDescription, approval=req.body.nsssApprovalToken;
      const newTitle=title || service.title, newDescription=description || service.description;
      if(typeof rawTitle!=="string" || typeof rawDescription!=="string" || typeof approval!=="string" ||
        !verifyNSSS(user.id,rawTitle,rawDescription,newTitle,newDescription,approval))
        return res.status(400).json({error:"nsss_approval_required"});
      try {
        const current=await analyzeNSSS({title:rawTitle,description:rawDescription,category:service.category});
        if(!current.publishable || !current.suggested || current.suggested.title!==newTitle || current.suggested.description!==newDescription)
          return res.status(422).json({error:"nsss_recheck_required"});
        updates.originalTitle=rawTitle;
        updates.originalDescription=rawDescription;
        updates.canonicalConcepts=JSON.stringify(current.canonical_concepts);
      } catch {return res.status(503).json({error:"nsss_unavailable"});}
    }
    if (title) updates.title = title;
    if (description) {
      const apps = await db.select({id:applicationsTable.id}).from(applicationsTable).where(eq(applicationsTable.serviceId,serviceId)).limit(1);
      if(apps.length) return res.status(409).json({error:"applications_exist",message:"لا يمكن تغيير نطاق الخدمة بعد وصول التقديمات"});
      updates.description = description;
    }

    const [updated] = await db.update(servicesTable).set(updates).where(eq(servicesTable.id, serviceId)).returning();

    return res.json({
      id: updated.id,
      title: updated.title,
      description: updated.description,
      category: updated.category,
      urgency: updated.urgency,
      status: updated.status,
      pointsPrice: updated.pointsPrice,
      deadline: updated.deadline?.toISOString() || null,
      restrictToUniversity: updated.restrictToUniversity,
      restrictToMajor: updated.restrictToMajor,
      requesterId: updated.requesterId,
      requesterName: user.name,
      requesterLevel: user.level,
      providerId: updated.providerId,
      providerName: null,
      applicantsCount: 0,
      createdAt: updated.createdAt.toISOString(),
    });
  } catch (err) {
    console.error("Update service error:", err);
    return res.status(500).json({ error: "server_error", message: "حدث خطأ في الخادم" });
  }
});

export default router;

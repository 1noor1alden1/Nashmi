import { Router } from "express";
import { db, usersTable, servicesTable, reviewsTable } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod/v4";
import { getSessionUser } from "../lib/auth.js";

const router=Router();
const skill=z.object({name:z.string().trim().min(2).max(60),level:z.enum(["beginner","intermediate","advanced"]),activity:z.enum(["teach","build","both"])});
const portfolio=z.object({title:z.string().trim().min(3).max(100),description:z.string().trim().max(500),
  url:z.string().url().max(500).refine(s=>s.startsWith("https://"),"استخدم روابط HTTPS فقط")});
const schema=z.object({bio:z.string().trim().max(2000),skillProfiles:z.array(skill).max(30),
  availability:z.enum(["available","limited","unavailable"]),capacity:z.number().int().min(0).max(10),
  portfolio:z.array(portfolio).max(8)});

router.get("/me",async(req,res)=>{
  const user=await getSessionUser(req);if(!user)return res.status(401).json({error:"unauthorized"});
  return res.json({bio:user.bio??"",skillProfiles:user.skillProfiles??[],skillTags:user.skillTags,
    availability:user.availability,capacity:user.capacity,portfolio:user.portfolio??[]});
});
router.patch("/me",async(req,res)=>{
  try{
    const user=await getSessionUser(req);if(!user)return res.status(401).json({error:"unauthorized"});
    const parsed=schema.safeParse(req.body);if(!parsed.success)return res.status(400).json({error:"invalid_profile",details:parsed.error.issues});
    const skills=parsed.data.skillProfiles;
    const distinct=new Set(skills.map(s=>s.name.normalize("NFKC").trim().toLowerCase()));
    if(distinct.size!==skills.length)return res.status(400).json({error:"duplicate_skills"});
    const tags=skills.map(s=>s.name);
    await db.update(usersTable).set({...parsed.data,skillTags:tags,skillsText:tags.join(", "),updatedAt:new Date()}).where(eq(usersTable.id,user.id));
    return res.json({success:true,message:"تم حفظ المهارات والمعلومات التي راجعتها"});
  }catch(err){console.error("Profile update error:",err);return res.status(500).json({error:"server_error"});}
});
router.post("/suggest-skills",async(req,res)=>{
  const user=await getSessionUser(req);if(!user)return res.status(401).json({error:"unauthorized"});
  const input=z.object({bio:z.string().trim().min(10).max(2000)}).safeParse(req.body);
  if(!input.success)return res.status(400).json({error:"invalid_bio"});
  const base=process.env.NSSS_SERVICE_URL||process.env.ML_SERVICE_URL||"http://127.0.0.1:8001";
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
  try{
    const response=await fetch(`${base.replace(/\/$/,"")}/v1/skills/extract`,{
      method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(input.data),signal:controller.signal});
    if(!response.ok)throw new Error("ML unavailable");
    const data=await response.json() as {skills:string[],method:string};
    return res.json({skills:Array.isArray(data.skills)?data.skills.slice(0,30):[],method:data.method,requiresUserConfirmation:true});
  }catch{return res.status(503).json({error:"skills_unavailable",message:"الاقتراحات غير متاحة حاليًا؛ أضف مهاراتك يدويًا"});}
  finally{clearTimeout(timer);}
});
router.get("/me/reputation",async(req,res)=>{
  try{
    const user=await getSessionUser(req);if(!user)return res.status(401).json({error:"unauthorized"});
    const records=await db.select({category:servicesTable.category,count:sql<number>`count(distinct ${servicesTable.id})`,
      avgRating:sql<number|null>`avg(${reviewsTable.averageRating})`})
      .from(servicesTable).leftJoin(reviewsTable,and(eq(reviewsTable.serviceId,servicesTable.id),eq(reviewsTable.revieweeId,user.id)))
      .where(and(eq(servicesTable.status,"completed"),eq(servicesTable.providerId,user.id)))
      .groupBy(servicesTable.category);
    return res.json(records.map(r=>({category:r.category,completed:Number(r.count),avgRating:r.avgRating===null?null:Number(r.avgRating)})));
  }catch(err){console.error("Reputation breakdown error:",err);return res.status(500).json({error:"server_error"});}
});
export default router;

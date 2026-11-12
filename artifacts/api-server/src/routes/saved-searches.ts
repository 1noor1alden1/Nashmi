import { Router } from "express";
import {db,savedSearchesTable} from "@workspace/db";
import {and,eq,desc,sql} from "drizzle-orm";
import {getSessionUser} from "../lib/auth.js";
import {z} from "zod/v4";
const router=Router();
const body=z.object({query:z.string().trim().min(2).max(180),category:z.enum(["","برمجة","تصميم","ترجمة","شرح دروس","تحرير","أبحاث","أخرى"]).default("")});
router.get("/",async(req,res)=>{
  try{const user=await getSessionUser(req);if(!user)return res.status(401).json({error:"unauthorized"});
    const saved=await db.select().from(savedSearchesTable).where(eq(savedSearchesTable.userId,user.id)).orderBy(desc(savedSearchesTable.createdAt));
    return res.json(saved);
  }catch{return res.status(500).json({error:"server_error"});}
});
router.post("/",async(req,res)=>{
  try{const user=await getSessionUser(req);if(!user)return res.status(401).json({error:"unauthorized"});
    const parsed=body.safeParse(req.body);if(!parsed.success)return res.status(400).json({error:"invalid_search"});
    const count=await db.select({count:sql<number>`count(*)`}).from(savedSearchesTable).where(eq(savedSearchesTable.userId,user.id));
    if(Number(count[0]?.count??0)>=10)return res.status(409).json({error:"limit_reached",message:"الحد الأقصى 10 عمليات بحث محفوظة"});
    const [saved]=await db.insert(savedSearchesTable).values({userId:user.id,query:parsed.data.query,category:parsed.data.category})
      .onConflictDoNothing().returning();
    return res.status(saved?201:409).json(saved||{error:"already_saved",message:"البحث محفوظ مسبقًا"});
  }catch{return res.status(500).json({error:"server_error"});}
});
router.delete("/:id",async(req,res)=>{
  try{const user=await getSessionUser(req);if(!user)return res.status(401).json({error:"unauthorized"});
    const id=Number(req.params.id);if(!Number.isSafeInteger(id)||id<=0)return res.status(400).json({error:"invalid_id"});
    const [removed]=await db.delete(savedSearchesTable).where(and(eq(savedSearchesTable.id,id),eq(savedSearchesTable.userId,user.id))).returning();
    if(!removed)return res.status(404).json({error:"not_found"});return res.json({success:true});
  }catch{return res.status(500).json({error:"server_error"});}
});
export default router;

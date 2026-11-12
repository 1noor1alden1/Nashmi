import { db, usersTable, servicesTable, notificationsTable } from "@workspace/db";
import { and, eq, ne, desc, inArray, sql } from "drizzle-orm";

export type ProfileSkill = {name:string;level:"beginner"|"intermediate"|"advanced";activity:"teach"|"build"|"both"};
type Candidate = typeof usersTable.$inferSelect;
export type RequestSkillContext = {category:string;requiredSkills:string[];requesterId:number;restrictToUniversity:boolean;restrictToMajor:boolean;urgency:"low"|"medium"|"high";};
export const URGENCY_POLICY = {low:{limit:10,bonus:0},medium:{limit:15,bonus:5},high:{limit:25,bonus:10}} as const;

function normalize(s:string){return s.normalize("NFKC").toLocaleLowerCase().replace(/[\u064b-\u065fـ]/g,"").replace(/[أإآ]/g,"ا").replace(/ى/g,"ي").trim();}
function overlap(a:string,b:string){const x=normalize(a),y=normalize(b);return x===y || (x.length>=4&&y.length>=4&&(x.includes(y)||y.includes(x)));}
export function lexicalScore(query:string, text:string){
  const terms=normalize(query).split(/[^\p{L}\p{N}+#]+/u).filter(t=>t.length>=2);
  if(!terms.length)return 0;
  const hay=normalize(text);
  return terms.filter(w=>hay.includes(w)).length/terms.length;
}
const isTeaching=(category:string)=>category==="شرح دروس";
function matchScore(required:string[],user:Candidate,profile:ProfileSkill[],category:string,categoryCompleted:number,contacted:number){
  const skills=profile.length?profile:user.skillTags.map(name=>({name,level:"intermediate" as const,activity:"both" as const}));
  const matching=required.flatMap(r=>skills.filter(s=>overlap(s.name,r)&&(!isTeaching(category)||s.activity!=="build"))).map(s=>s.name);
  const unique=[...new Set(matching)];
  const coverage=required.length?Math.min(1,unique.length/required.length):0;
  const level=unique.length?skills.filter(s=>unique.some(n=>n===s.name)).reduce((v,s)=>v+(s.level==="advanced"?1:s.level==="intermediate"?.7:.4),0)/unique.length:0;
  const experience=Math.min(1,categoryCompleted/5);
  const quality=Math.min(1,Math.max(0,(user.averageRating??3.5)/5));
  const available=user.availability==="available"?1:user.availability==="limited"?.45:0;
  // 65% relevant skill coverage and self-reported level; past-category work
  // and availability are separate from a student's global score.
  const raw=(coverage*.52+level*.13+experience*.14+quality*.11+available*.10);
  // New qualified students receive mild exposure correction, never a mandatory quota.
  const fairness=contacted===0?.06:Math.max(-.08, .035-.025*contacted);
  const score=Math.round(100*Math.max(0,Math.min(1,raw+fairness)));
  return {score,matchedSkills:unique.slice(0,8),reason:unique.length?`مهارات مناسبة: ${unique.slice(0,3).join("، ")}`:"لا توجد مهارات مطابقة"};
}

export async function rankProviders(context:RequestSkillContext,owner:Candidate){
  // Avoid claiming the entire university is searched when a candidate cap applies.
  const candidates=await db.select().from(usersTable).where(ne(usersTable.id,context.requesterId)).limit(5000);
  const qualified=candidates.filter(c=>c.availability!=="unavailable"&&c.capacity>0&&
    (!context.restrictToUniversity||(!!owner.university&&c.university===owner.university))&&
    (!context.restrictToMajor||(!!owner.major&&c.major===owner.major)));
  if(!qualified.length || !context.requiredSkills.length) return [];
  const ids=qualified.map(c=>c.id);
  const activeJobs=await db.select({providerId:servicesTable.providerId,count:sql<number>`count(*)`})
    .from(servicesTable).where(and(eq(servicesTable.status,"in_progress"),inArray(servicesTable.providerId,ids)))
    .groupBy(servicesTable.providerId);
  const loads=new Map(activeJobs.map(x=>[x.providerId,Number(x.count)]));
  const eligible=qualified.filter(c=>(loads.get(c.id)??0)<c.capacity);
  if(!eligible.length)return [];
  const completed=await db.select({providerId:servicesTable.providerId,count:sql<number>`count(*)`})
    .from(servicesTable).where(and(eq(servicesTable.status,"completed"),eq(servicesTable.category,context.category),inArray(servicesTable.providerId,ids)))
    .groupBy(servicesTable.providerId);
  const contacted=await db.select({userId:notificationsTable.userId,count:sql<number>`count(*)`})
    .from(notificationsTable).where(and(eq(notificationsTable.type,"service_match"),inArray(notificationsTable.userId,ids),sql`${notificationsTable.createdAt} > now() - interval '7 days'`))
    .groupBy(notificationsTable.userId);
  const counts=new Map(completed.map(x=>[x.providerId,Number(x.count)]));
  const exposures=new Map(contacted.map(x=>[x.userId,Number(x.count)]));
  const ranking=eligible.map(c=>{
    const result=matchScore(context.requiredSkills,c,c.skillProfiles??[],context.category,counts.get(c.id)??0,exposures.get(c.id)??0);
    return {userId:c.id,name:c.name,...result};
  }).filter(x=>x.matchedSkills.length>0 && x.score>=28).sort((a,b)=>b.score-a.score||a.userId-b.userId);
  return ranking.slice(0,URGENCY_POLICY[context.urgency].limit).map((x,index)=>({...x,rank:index+1}));
}

export async function semanticScores(query:string,documents:string[]):Promise<number[]|null>{
  if(!documents.length)return [];
  const base=process.env.NSSS_SERVICE_URL||process.env.ML_SERVICE_URL||"http://127.0.0.1:8001";
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),4500);
  try{
    const response=await fetch(`${base.replace(/\/$/,"")}/v1/semantic-search/rank`,{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({query,documents}),signal:controller.signal});
    if(!response.ok)return null;
    const data=await response.json() as {scores?:number[]};
    return Array.isArray(data.scores)&&data.scores.length===documents.length&&data.scores.every(x=>Number.isFinite(x))?data.scores:null;
  }catch{return null;}finally{clearTimeout(timer);}
}

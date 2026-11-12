import { useGetMe } from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, Button, Input, Textarea } from "@/components/ui";
import { useEffect, useState } from "react";
import { Sparkles, Plus, Trash2, ShieldCheck } from "lucide-react";

type Skill={name:string;level:"beginner"|"intermediate"|"advanced";activity:"teach"|"build"|"both"};
type Work={title:string;url:string;description:string};
type Profile={bio:string;skillProfiles:Skill[];availability:"available"|"limited"|"unavailable";capacity:number;portfolio:Work[]};
async function api(url:string,init?:RequestInit){const r=await fetch(url,{credentials:"include",...init,headers:{"Content-Type":"application/json",...init?.headers}});
  const body=await r.json();if(!r.ok)throw new Error(body.message||"فشلت العملية");return body;}
export default function ProfilePage(){
  const {data:user}=useGetMe();const client=useQueryClient();const [,navigate]=useLocation();
  const {data,refetch}=useQuery<Profile>({queryKey:["my-skill-profile"],queryFn:()=>api("/api/profile-intelligence/me")});
  const {data:reputation}=useQuery<{category:string;completed:number;avgRating:number|null}[]>({queryKey:["my-skill-reputation"],queryFn:()=>api("/api/profile-intelligence/me/reputation")});
  const [form,setForm]=useState<Profile>({bio:"",skillProfiles:[],availability:"available",capacity:2,portfolio:[]});
  const [newSkill,setNewSkill]=useState(""),[newWork,setNewWork]=useState<Work>({title:"",url:"",description:""});
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(""),[suggestions,setSuggestions]=useState<string[]>([]);
  useEffect(()=>{if(data)setForm({bio:data.bio,skillProfiles:data.skillProfiles,availability:data.availability,capacity:data.capacity,portfolio:data.portfolio});},[data]);
  function addSkill(name:string){const n=name.trim();if(n.length<2||n.length>60||form.skillProfiles.length>=30||form.skillProfiles.some(x=>x.name.toLowerCase()===n.toLowerCase()))return;
    setForm(f=>({...f,skillProfiles:[...f.skillProfiles,{name:n,level:"intermediate",activity:"both"}]}));setNewSkill("");setSuggestions(v=>v.filter(x=>x!==name));}
  async function save(){setBusy(true);setMessage("");try{await api("/api/profile-intelligence/me",{method:"PATCH",body:JSON.stringify(form)});
    setMessage("تم حفظ ملفك والمهارات التي راجعتها");await refetch();await client.invalidateQueries({queryKey:["/api/auth/me"]});}
    catch(e){setMessage(e instanceof Error?e.message:"تعذر الحفظ")}finally{setBusy(false)}}
  async function analyze(){setBusy(true);setMessage("");try{
    const result=await api("/api/profile-intelligence/suggest-skills",{method:"POST",body:JSON.stringify({bio:form.bio})});
    setSuggestions((result.skills as string[]).filter(x=>!form.skillProfiles.some(s=>s.name.toLowerCase()===x.toLowerCase())));
  }catch(e){setMessage(e instanceof Error?e.message:"تعذر التحليل")}finally{setBusy(false)}}
  async function logout(){setBusy(true);try{await api("/api/auth/logout",{method:"POST"});client.clear();navigate("/auth");}catch{setMessage("تعذر تسجيل الخروج")}finally{setBusy(false)}}
  return <div className="max-w-4xl mx-auto py-7 space-y-6" dir="rtl">
    <div><h1 className="text-3xl font-black">ملفك المهاري</h1><p className="text-muted-foreground">مهارات تعلنها وتؤكدها بنفسك، وسجل أعمال موثّق منفصل من الخدمات المكتملة.</p></div>
    <Card className="p-6 space-y-3"><h2 className="text-xl font-bold">الحساب</h2>
      <p><strong>الاسم:</strong> {user?.name} · <strong>الجامعة:</strong> {user?.university||"غير محددة"}</p>
      <p><strong>التخصص:</strong> {user?.major||"غير محدد"} · <strong>الرصيد:</strong> {user?.points} نقطة</p>
      <p className="text-sm text-muted-foreground">التحقق من ملكية البريد الجامعي غير مفعل حتى الآن.</p>
    </Card>
    <Card className="p-6 space-y-4"><h2 className="text-xl font-bold flex gap-2 items-center"><Sparkles className="w-5 h-5"/>نبذتك ومهاراتك</h2>
      <Textarea value={form.bio} onChange={e=>setForm(f=>({...f,bio:e.target.value}))} placeholder="مثال: أدرس علوم الحاسوب وأستطيع شرح Python وAlgorithms..." className="min-h-28"/>
      <Button type="button" variant="outline" onClick={analyze} disabled={busy||form.bio.trim().length<10}>اقتراح مهارات من النبذة</Button>
      {!!suggestions.length&&<div className="rounded-xl border p-3 space-y-2"><p className="text-sm">اقتراحات تحتاج موافقتك — اضغط لإضافة المهارة:</p>
        <div className="flex flex-wrap gap-2">{suggestions.map(name=><Button key={name} type="button" variant="outline" onClick={()=>addSkill(name)}>+ {name}</Button>)}</div></div>}
      <div className="flex gap-2"><Input value={newSkill} placeholder="مهارة جديدة" onChange={e=>setNewSkill(e.target.value)}/>
        <Button type="button" variant="outline" onClick={()=>addSkill(newSkill)}><Plus className="w-4 h-4 ml-1"/>إضافة</Button></div>
      {form.skillProfiles.map((skill,i)=><div className="flex flex-wrap gap-2 items-center border rounded-xl p-3" key={i}>
        <span dir="auto" className="font-semibold ml-auto">{skill.name}</span>
        <select className="rounded-md border p-2 text-sm" aria-label={`مستوى ${skill.name}`} value={skill.level}
          onChange={e=>setForm(f=>({...f,skillProfiles:f.skillProfiles.map((x,j)=>j===i?{...x,level:e.target.value as Skill["level"]}:x)}))}>
          <option value="beginner">مبتدئ</option><option value="intermediate">متوسط</option><option value="advanced">متقدم</option></select>
        <select className="rounded-md border p-2 text-sm" aria-label={`نوع العمل في ${skill.name}`} value={skill.activity}
          onChange={e=>setForm(f=>({...f,skillProfiles:f.skillProfiles.map((x,j)=>j===i?{...x,activity:e.target.value as Skill["activity"]}:x)}))}>
          <option value="both">تنفيذ وشرح</option><option value="teach">شرح</option><option value="build">تنفيذ</option></select>
        <button type="button" aria-label={`حذف ${skill.name}`} onClick={()=>setForm(f=>({...f,skillProfiles:f.skillProfiles.filter((_,j)=>j!==i)}))}><Trash2 className="w-4 h-4 text-red-600"/></button>
      </div>)}
      <p className="text-xs text-muted-foreground">المستوى الذي تحدده غير موثّق تلقائيًا. لا نعامل ادعاء الخبرة على أنه تقييم من عملاء سابقين.</p>
    </Card>
    <Card className="p-6 space-y-3"><h2 className="font-bold text-xl">التوفر والقدرة الاستيعابية</h2>
      <select className="w-full border rounded-lg p-3" value={form.availability} onChange={e=>setForm(f=>({...f,availability:e.target.value as Profile["availability"]}))}>
        <option value="available">متاح لاستقبال الطلبات</option><option value="limited">مشغول جزئيًا</option><option value="unavailable">غير متاح حاليًا</option></select>
      <label className="block text-sm">أقصى عدد خدمات أستطيع تنفيذها في الوقت نفسه<Input type="number" min={0} max={10} value={form.capacity} onChange={e=>setForm(f=>({...f,capacity:Number(e.target.value)}))}/></label>
    </Card>
    <Card className="p-6 space-y-3"><h2 className="font-bold text-xl">معرض الأعمال (روابط HTTPS فقط)</h2>
      {form.portfolio.map((p,i)=><div key={i} className="rounded-xl border p-3 flex gap-2 justify-between"><div className="min-w-0"><a className="font-bold text-primary underline" href={p.url} rel="noopener noreferrer" target="_blank">{p.title}</a><p className="text-sm">{p.description}</p></div>
        <button type="button" aria-label="حذف العمل" onClick={()=>setForm(f=>({...f,portfolio:f.portfolio.filter((_,j)=>j!==i)}))}><Trash2 className="w-4 h-4 text-red-600"/></button></div>)}
      <div className="grid md:grid-cols-2 gap-2"><Input placeholder="عنوان العمل" value={newWork.title} onChange={e=>setNewWork(f=>({...f,title:e.target.value}))}/>
        <Input placeholder="https://example.com/work" dir="ltr" value={newWork.url} onChange={e=>setNewWork(f=>({...f,url:e.target.value}))}/></div>
      <Input placeholder="وصف مختصر" value={newWork.description} onChange={e=>setNewWork(f=>({...f,description:e.target.value}))}/>
      <Button variant="outline" type="button" onClick={()=>{if(newWork.title.trim().length>=3&&newWork.url.startsWith("https://")&&form.portfolio.length<8){setForm(f=>({...f,portfolio:[...f.portfolio,newWork]}));setNewWork({title:"",url:"",description:""});}}}>إضافة عمل</Button>
    </Card>
    <Card className="p-6 space-y-3"><h2 className="text-xl font-bold"><ShieldCheck className="w-5 h-5 inline ml-2"/>سجل الإنجاز حسب المجال</h2>
      {reputation?.length?reputation.map(r=><div key={r.category} className="flex justify-between border-b pb-2"><span>{r.category}</span><span className="text-sm">{r.completed} مكتملة · {r.avgRating===null?"دون تقييم":`${r.avgRating.toFixed(1)} / 5`}</span></div>):<p className="text-sm text-muted-foreground">لم تنجز خدمات بعد. تستطيع الحصول على فرص جديدة بإكمال مهارات ملفك.</p>}
    </Card>
    {message&&<p role="status" className="text-sm text-primary">{message}</p>}
    <div className="flex gap-3"><Button onClick={save} disabled={busy} className="flex-1">حفظ الملف الشخصي</Button><Button onClick={logout} variant="outline" disabled={busy}>تسجيل الخروج</Button></div>
  </div>;
}

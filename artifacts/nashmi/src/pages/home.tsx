import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ServiceCard } from "@/components/service-card";
import { Input, Button, LoadingScreen } from "@/components/ui";
import { Search, Sparkles, Compass, ShieldCheck, Filter } from "lucide-react";
import { CATEGORIES } from "@/lib/utils";
import { LiveActivityFeed } from "@/components/activity-feed";

type MarketService={id:number;title:string;description:string;category:string;urgency:string;requiredSkills?:string[];
  urgencyBonus?:number;matchScore?:number;matchExplanation?:string;relevance?:number;[key:string]:unknown};
async function getJson(url:string){const r=await fetch(url,{credentials:"include"});const json=await r.json();if(!r.ok)throw new Error(json.message||"تعذر جلب الطلبات");return json;}
export default function HomePage(){
  const [section,setSection]=useState<"all"|"mine">("all");
  const [text,setText]=useState(""),[search,setSearch]=useState(""),[category,setCategory]=useState("");
  const [urgency,setUrgency]=useState(""),[trustedOnly,setTrustedOnly]=useState(false),[page,setPage]=useState(0);
  const all=useQuery<MarketService[]>({queryKey:["published-services",page],
    queryFn:()=>getJson(`/api/services?limit=50&offset=${page*50}`)});
  const recommended=useQuery<MarketService[]>({queryKey:["smart-recommended"],queryFn:()=>getJson("/api/services/recommended/me")});
  const saved=useQuery<Array<{id:number;query:string;category:string}>>({queryKey:["saved-searches"],queryFn:()=>getJson("/api/saved-searches")});
  const [saveMessage,setSaveMessage]=useState("");
  async function saveSearch(){
    if(search.length<2)return;setSaveMessage("");
    try{const r=await fetch("/api/saved-searches",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({query:search,category})});const d=await r.json();if(!r.ok)throw new Error(d.message||"تعذر حفظ البحث");
      setSaveMessage("تم حفظ البحث؛ ستتلقى إشعارًا عن طلبات جديدة مطابقة بالكلمات");saved.refetch();
    }catch(e){setSaveMessage(e instanceof Error?e.message:"تعذر الحفظ");}
  }
  async function removeSaved(id:number){
    const r=await fetch(`/api/saved-searches/${id}`,{method:"DELETE",credentials:"include"});
    if(r.ok){saved.refetch();setSaveMessage("تم إلغاء البحث المحفوظ");}
  }
  const smart=useQuery<{method:string;items:MarketService[]}>({queryKey:["smart-search",search,category,urgency],
    queryFn:()=>getJson(`/api/services/search/smart?q=${encodeURIComponent(search)}&category=${encodeURIComponent(category)}&urgency=${encodeURIComponent(urgency)}`),
    enabled:search.length>=2});
  const base=(section==="mine"?recommended.data:all.data) as MarketService[]|undefined;
  const shown=search.length>=2?smart.data?.items:base?.filter(s=>(!category||s.category===category)&&(!urgency||s.urgency===urgency)&&(!trustedOnly||Boolean(s.restrictToUniversity)));
  const busy=search.length>=2?smart.isLoading:section==="mine"?recommended.isLoading:all.isLoading;
  const error=search.length>=2?smart.error:section==="mine"?recommended.error:all.error;
  return <div className="space-y-8" dir="rtl">
    <div className="relative rounded-3xl overflow-hidden bg-primary p-8 md:p-12 text-white shadow-xl">
      <div className="relative z-10 max-w-2xl space-y-4"><h1 className="text-3xl md:text-4xl font-black">اكتشف الفزعات المناسبة لمهاراتك</h1>
        <p className="text-white/85">ابحث عن طلبات الطلاب وقدّم عرضك بالنقاط. تظهر جميع الطلبات المسموح بها في «الخدمات المنشورة».</p>
        <form className="flex gap-2 bg-white rounded-2xl p-2" onSubmit={e=>{e.preventDefault();setSearch(text.trim());setSection("all");}}>
          <Input dir="auto" value={text} onChange={e=>{setText(e.target.value);if(!e.target.value.trim())setSearch("");}}
            placeholder="مثال: شرح خوارزميات أو React Native" className="text-foreground border-0 flex-1"/>
          <Button type="submit" disabled={text.trim().length<2}><Search className="w-4 h-4 ml-1"/>بحث ذكي</Button>
        </form>
        <p className="text-xs text-white/70">يستخدم البحث تطابق الكلمات والمعنى إذا كانت خدمة E5 متاحة.</p>
      </div></div>
    <div className="flex flex-wrap gap-3">
      <Button variant={section==="all"?"default":"outline"} onClick={()=>{setSection("all");setSearch("");setText("");}}><Compass className="w-4 h-4 ml-2"/>الخدمات المنشورة</Button>
      <Button variant={section==="mine"?"default":"outline"} onClick={()=>{setSection("mine");setSearch("");setText("");}}><Sparkles className="w-4 h-4 ml-2"/>الطلبات المتاحة بناءً على مهاراتك</Button>
    </div>
    <div className="flex flex-col lg:flex-row gap-7">
      <aside className="w-full lg:w-64 shrink-0 space-y-4">
        <div className="bg-card rounded-2xl p-5 border space-y-3"><h3 className="font-bold flex items-center gap-2"><Filter className="w-4 h-4"/>تصفية النتائج</h3>
          <label className="block text-sm">التصنيف<select className="w-full border rounded-xl p-3 mt-2 bg-background" value={category} onChange={e=>setCategory(e.target.value)}>
            <option value="">جميع التصنيفات</option>{CATEGORIES.map(x=><option key={x.id} value={x.id}>{x.id}</option>)}</select></label>
          <label className="block text-sm">الاستعجال<select className="w-full border rounded-xl p-3 mt-2 bg-background" value={urgency} onChange={e=>setUrgency(e.target.value)}>
            <option value="">الكل</option><option value="low">عادي</option><option value="medium">متوسط</option><option value="high">عاجل</option></select></label>
          {!search&&<label className="flex gap-2 items-center text-sm"><input type="checkbox" checked={trustedOnly} onChange={e=>setTrustedOnly(e.target.checked)}/>
            <ShieldCheck className="w-4 h-4"/>طلبات محصورة بالجامعة</label>}
        </div><LiveActivityFeed/>
      </aside>
      <div className="flex-1 space-y-5 min-w-0">
        <div className="flex flex-wrap justify-between gap-2 items-center"><h2 className="text-2xl font-black">{search?`نتائج البحث عن «${search}»`:section==="mine"?"الطلبات المتاحة بناءً على مهاراتك":"الخدمات المنشورة"}</h2>
          <span className="text-sm text-muted-foreground">{shown?.length??0} طلب</span></div>
        {search&&<div className="rounded-xl border bg-card p-3 space-y-2">
          <p className="text-xs text-muted-foreground">طريقة البحث: {smart.data?.method==="hybrid-e5-keywords"?"دلالي + كلمات":"بحث بالكلمات (النموذج الدلالي غير متاح)"}</p>
          <Button variant="outline" size="sm" onClick={saveSearch}>حفظ هذا البحث والتنبيه للطلبات الجديدة</Button>
          {saveMessage&&<p role="status" className="text-xs text-primary">{saveMessage}</p>}
        </div>}
        {!!saved.data?.length&&<div className="rounded-xl border p-3 space-y-2">
          <p className="text-sm font-bold">عمليات البحث المحفوظة</p><div className="flex flex-wrap gap-2">{saved.data.map(x=><span key={x.id} className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs">
            <button type="button" onClick={()=>{setText(x.query);setSearch(x.query);setCategory(x.category);setSection("all");}}>{x.query}{x.category?` · ${x.category}`:""}</button>
            <button type="button" aria-label={`إلغاء حفظ ${x.query}`} onClick={()=>removeSaved(x.id)}>×</button></span>)}</div></div>}
        {section==="mine"&&!search&&<p className="text-sm text-muted-foreground">هذه الطلبات التي جرى ترشيحك لها عند نشرها. أكمل ملف مهاراتك وحدد توفرّك لتحسين الترشيحات الجديدة.</p>}
        {busy?<LoadingScreen/>:error?<div role="alert" className="rounded-xl bg-red-50 p-5 text-red-800">تعذر تحميل النتائج؛ حاول إعادة فتح الصفحة.</div>:
          !shown?.length?<div className="text-center py-16 border border-dashed rounded-3xl bg-card"><h3 className="font-bold text-lg">لا توجد طلبات مطابقة الآن</h3>
            <p className="text-muted-foreground mt-2">جرّب تغيير المرشحات أو إضافة مهاراتك في الملف الشخصي.</p></div>:
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">{shown.map(s=><div key={s.id} className="space-y-2">
            {typeof s.matchScore==="number"&&<div className="text-sm rounded-lg bg-emerald-50 p-2 text-emerald-900">
              <strong>ملاءمة الترتيب {Math.round(s.matchScore)}/100</strong><div>{s.matchExplanation}</div></div>}
            {typeof s.relevance==="number"&&<p className="text-xs text-primary">صلة البحث: {s.relevance}/100 (مؤشر ترتيب)</p>}
            {Boolean(s.urgencyBonus)&&<p className="text-xs font-bold text-orange-700">مكافأة إنجاز إضافية: {s.urgencyBonus} نقاط</p>}
            <ServiceCard service={s as any}/>
          </div>)}</div>}
        {!search&&section==="all"&&<div className="flex justify-between items-center gap-2 pt-4">
          <Button variant="outline" disabled={page===0} onClick={()=>setPage(p=>Math.max(0,p-1))}>السابق</Button>
          <span className="text-sm text-muted-foreground">الصفحة {page+1}</span>
          <Button variant="outline" disabled={(all.data?.length??0)<50} onClick={()=>setPage(p=>p+1)}>التالي</Button>
        </div>}
      </div>
    </div>
  </div>;
}

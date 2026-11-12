import { useLocation } from "wouter";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useCreateService } from "@workspace/api-client-react";
import { Input, Button, Label, Card, Textarea } from "@/components/ui";
import { CATEGORIES } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { ShieldCheck, Sparkles, ArrowRight, X, Plus, Info } from "lucide-react";

const schema=z.object({title:z.string().trim().min(5).max(120),description:z.string().trim().min(20).max(5000),
  category:z.string().min(1,"اختر التصنيف"),urgency:z.enum(["low","medium","high"]),
  restrictToUniversity:z.boolean().default(false),restrictToMajor:z.boolean().default(false),
  deadline:z.string().min(1,"حدد موعد التسليم"),offersDeadline:z.string().min(1,"حدد موعد استقبال العروض")});
type Data=z.infer<typeof schema>;
type Preview={original:{title:string;description:string};suggested:{title:string;description:string}|null;
  issues:{code:string;message:string}[];canonical_concepts:string[];publishable:boolean;approvalToken:string|null;
  suggested_category?:string;suggested_skills?:string[];needs_category_review?:boolean;category_method?:string;skills_method?:string};
const options=[{id:"low" as const,label:"عادي",count:10,points:0},{id:"medium" as const,label:"متوسط",count:15,points:5},
  {id:"high" as const,label:"عاجل",count:25,points:10}];

export default function CreateServicePage(){
  const [,navigate]=useLocation();const [stage,setStage]=useState<"write"|"review">("write");
  const [preview,setPreview]=useState<Preview|null>(null),[approved,setApproved]=useState(false);
  const [analyzing,setAnalyzing]=useState(false),[error,setError]=useState("");
  const [requiredSkills,setRequiredSkills]=useState<string[]>([]),[newSkill,setNewSkill]=useState("");
  const form=useForm<Data>({resolver:zodResolver(schema),defaultValues:{urgency:"low",category:"",restrictToMajor:false,restrictToUniversity:false}});
  const urgency=form.watch("urgency")||"low",choice=options.find(x=>x.id===urgency)!;
  const {mutate:create,isPending}=useCreateService({mutation:{
    onSuccess:data=>{toast({title:"تم نشر طلبك بنجاح",description:"ظهرت الخدمة في الطلبات المنشورة وأُرسلت إشعارات للمطابقين",variant:"success"});navigate(`/services/${data.id}`);},
    onError:e=>toast({title:"تعذر نشر الطلب",description:e.message,variant:"destructive"})}});
  const invalidate=()=>{setApproved(false);setPreview(null);setStage("write");};

  async function continueToReview(){
    const title=form.getValues("title"),description=form.getValues("description");
    setApproved(false);setError("");
    if(!title||title.trim().length<5||title.length>120||!description||description.trim().length<20||description.length>5000){
      setError("أدخل عنوانًا من 5–120 حرفًا ووصفًا من 20–5000 حرف أولًا.");return;
    }
    setAnalyzing(true);
    try{
      const response=await fetch("/api/services/analyze-draft",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({title,description})});
      const data=await response.json();
      if(!response.ok)throw new Error(data.message||"خدمة تحليل النص غير متاحة حاليًا");
      setPreview(data);setRequiredSkills([...new Set((data.suggested_skills||[]) as string[])]);
      form.setValue("category",CATEGORIES.some(x=>x.id===data.suggested_category)?data.suggested_category:"أخرى");
      setStage("review");
    }catch(e){setError(e instanceof Error?e.message:"تعذر تحليل النص")}
    finally{setAnalyzing(false)}
  }
  function acceptWording(){
    if(!preview?.suggested||!preview.publishable)return;
    form.setValue("title",preview.suggested.title,{shouldValidate:true});
    form.setValue("description",preview.suggested.description,{shouldValidate:true});
    setApproved(true);
  }
  function addSkill(){const name=newSkill.trim();if(name.length<2||name.length>60)return;
    if(!requiredSkills.some(s=>s.toLowerCase()===name.toLowerCase())&&requiredSkills.length<20)setRequiredSkills(s=>[...s,name]);setNewSkill("");}
  function publish(data:Data){
    if(stage!=="review"||!approved||!preview?.publishable||!preview.suggested||!preview.approvalToken||
      data.title!==preview.suggested.title||data.description!==preview.suggested.description){
      toast({title:"يجب تحليل الطلب والموافقة على الصياغة أولًا",variant:"destructive"});return;
    }
    const deadline=new Date(data.deadline),offersDeadline=new Date(data.offersDeadline);
    if(!Number.isFinite(deadline.getTime())||!Number.isFinite(offersDeadline.getTime())||
      offersDeadline<=new Date()||offersDeadline>=deadline){toast({title:"تأكد من تواريخ العروض والتسليم",variant:"destructive"});return;}
    create({data:{...data,requiredSkills,deadline:deadline.toISOString(),offersDeadline:offersDeadline.toISOString(),
      originalTitle:preview.original.title,originalDescription:preview.original.description,nsssApprovalToken:preview.approvalToken} as any});
  }
  return <div className="max-w-3xl mx-auto py-8 space-y-6" dir="rtl">
    <div className="text-center"><h1 className="text-3xl font-black text-primary">اطلب فزعة جديدة</h1>
      <p className="text-muted-foreground mt-2">اكتب طلبك، راجع تصنيف الذكاء الاصطناعي والمهارات، ثم انشر مناقصتك بالنقاط.</p></div>
    <div className="flex items-center gap-3 text-sm font-bold"><span className={stage==="write"?"text-primary":"text-emerald-700"}>① العنوان والوصف</span>
      <div className="flex-1 h-px bg-border"/><span className={stage==="review"?"text-primary":"text-muted-foreground"}>② المراجعة والنشر</span></div>
    <Card className="p-6 md:p-9 rounded-3xl shadow-lg">
      <form onSubmit={form.handleSubmit(publish)} className="space-y-6">
        {stage==="write"?<>
          <div className="space-y-2"><Label>عنوان الطلب</Label><Input {...form.register("title",{onChange:invalidate})}
            placeholder="مثال: أحتاج شرح خوارزميات الفرز باستخدام Python"/>
            <p className="text-xs text-muted-foreground">اشرح المطلوب بكلماتك، ولا حاجة لاختيار التصنيف بنفسك.</p></div>
          <div className="space-y-2"><Label>الوصف التفصيلي</Label><Textarea className="min-h-40" {...form.register("description",{onChange:invalidate})}
            placeholder="اذكر موضوع الخدمة والمهارات والمخرجات التي تتوقعها..."/></div>
          {error&&<p role="alert" className="text-sm text-red-600">{error}</p>}
          <Button type="button" className="w-full" onClick={continueToReview} disabled={analyzing}>
            <Sparkles className="h-4 w-4 ml-2"/>{analyzing?"جارٍ تحليل طلبك...":"متابعة وتحليل الطلب"}</Button>
        </>:<>
          <div className="rounded-xl p-4 border bg-primary/5 space-y-2">
            <h2 className="font-bold flex gap-2 items-center"><Sparkles className="w-4 h-4"/>نتائج تحليل الطلب</h2>
            <p className="text-xs text-muted-foreground">اقتراحات تلقائية قابلة للتصحيح، وليست شهادة بملاءمة الخدمة أو مهارات مقدمها.</p>
            {preview?.issues.map((issue,i)=><p className="text-sm text-amber-800" key={i}>{issue.message}</p>)}
            {preview?.needs_category_review&&<p className="text-sm text-amber-800">التصنيف غير مؤكد؛ تحقق منه يدويًا.</p>}
            {preview?.suggested&&<div className="text-sm space-y-1"><p><strong>العنوان بعد فحص NSSS:</strong> {preview.suggested.title}</p>
              <p><strong>الوصف المقترح:</strong> {preview.suggested.description}</p></div>}
            {preview?.publishable?<Button type="button" variant={approved?"secondary":"outline"} onClick={acceptWording}>
              {approved?"✓ وافقت على النص المقترح":"أوافق على النص المقترح"}</Button>:
              <p className="text-red-600 text-sm">تحتاج الصياغة إلى تعديل قبل النشر. ارجع وعدّل الوصف.</p>}
          </div>
          <section className="space-y-3"><h3 className="font-bold">التصنيف المقترح — يمكنك تصحيحه</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">{CATEGORIES.map(cat=><label key={cat.id} className="cursor-pointer">
              <input type="radio" value={cat.id} {...form.register("category")} className="peer sr-only"/>
              <div className="p-3 border rounded-xl text-sm text-center peer-checked:border-primary peer-checked:bg-primary/10">{cat.icon} {cat.id}</div>
            </label>)}</div></section>
          <section className="space-y-3"><h3 className="font-bold">المهارات المطلوبة — راجعها وعدّلها</h3>
            <div className="flex flex-wrap gap-2">{requiredSkills.map(skill=><span key={skill} className="flex items-center gap-1 bg-primary/10 border border-primary/10 rounded-full px-3 py-1 text-sm">
              <span dir="auto">{skill}</span><button type="button" aria-label={`إزالة ${skill}`} onClick={()=>setRequiredSkills(s=>s.filter(x=>x!==skill))}><X className="w-3 h-3"/></button></span>)}</div>
            <div className="flex gap-2"><Input value={newSkill} onChange={e=>setNewSkill(e.target.value)} placeholder="أضف مهارة مثل Data Structures" onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();addSkill();}}}/>
              <Button type="button" variant="outline" onClick={addSkill}><Plus className="w-4 h-4"/> إضافة</Button></div>
            <p className="text-xs text-muted-foreground">تستخدم المهارات التي تؤكدها لاختيار مقدمي الخدمة. إذا لم توجد مهارات، يظهر الطلب للجميع دون إشعارات مخصصة.</p>
          </section>
          <section className="space-y-3"><h3 className="font-bold">مستوى الاستعجال</h3>
            <div className="grid grid-cols-3 gap-2">{options.map(option=><label key={option.id} className="cursor-pointer">
              <input type="radio" value={option.id} {...form.register("urgency")} className="peer sr-only"/>
              <div className="rounded-xl border p-3 text-center peer-checked:border-primary peer-checked:bg-primary/10 space-y-1">
                <p className="font-bold">{option.label}</p><p className="text-xs">حتى {option.count} مرشحًا</p><p className="text-sm">+{option.points} نقاط</p></div></label>)}</div>
            <p className="text-xs text-muted-foreground"><ShieldCheck className="w-4 h-4 inline ml-1"/>ستُحجز {choice.points} نقاط عند النشر وتُصرف بعد تأكيد الإنجاز، وتُسترد عند إلغاء الطلب المفتوح. سعر الخدمة يحدده العرض المقبول لاحقًا.</p>
          </section>
          <section className="space-y-2"><h3 className="font-bold">دوائر الثقة</h3>
            <label className="flex gap-2 items-center text-sm"><input type="checkbox" {...form.register("restrictToUniversity")}/> حصر الطلب داخل جامعتي</label>
            <label className="flex gap-2 items-center text-sm"><input type="checkbox" {...form.register("restrictToMajor")}/> حصر الطلب داخل تخصصي</label></section>
          <section className="space-y-3"><h3 className="font-bold">مواعيد الطلب</h3>
            <div className="grid sm:grid-cols-2 gap-3"><label className="text-sm space-y-2">آخر موعد لاستقبال العروض<Input type="datetime-local" {...form.register("offersDeadline")}/></label>
              <label className="text-sm space-y-2">آخر موعد لتسليم الخدمة<Input type="datetime-local" {...form.register("deadline")}/></label></div></section>
          <div className="flex gap-3"><Button type="button" variant="outline" onClick={()=>{setStage("write");setApproved(false);}}>تعديل النص <ArrowRight className="w-4 h-4 mr-1"/></Button>
            <Button type="submit" className="flex-1" disabled={!approved||!preview?.publishable||isPending} isLoading={isPending}>انشر الطلب واحجز المكافأة</Button></div>
        </>}
      </form>
    </Card>
  </div>;
}

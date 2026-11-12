import {useQuery,useQueryClient} from "@tanstack/react-query";
import {useState} from "react";
import {Card,Button,Textarea} from "@/components/ui";

type Dispute={id:number;serviceId:number;openedBy:number;reason:string;createdAt:string;
  service?:{title:string;description:string;category:string;pointsPrice:number;urgencyBonus:number};
  proofs?:{proofType:string;proofContent:string;aiAnalysis?:string;createdAt:string}[];
  acceptedOffer?:{message:string;proposedPoints:number}|null;};
async function request(path:string,options?:RequestInit){const response=await fetch(path,{credentials:"include",...options,
  headers:{"Content-Type":"application/json",...options?.headers}});const result=await response.json();
  if(!response.ok)throw new Error(response.status===403?"لا تملك صلاحية إدارة النزاعات":result.message||"حدث خطأ");return result;}
export default function AdminDisputesPage(){
  const queryClient=useQueryClient();const [notes,setNotes]=useState<Record<number,string>>({});
  const [busy,setBusy]=useState<number|null>(null),[message,setMessage]=useState("");
  const query=useQuery<Dispute[]>({queryKey:["admin-disputes"],queryFn:()=>request("/api/disputes/admin/pending"),retry:false});
  async function resolve(d:Dispute,decision:"refund"|"release"){
    if((notes[d.id]||"").trim().length<20){setMessage("اكتب سبب قرار الإدارة في 20 حرفًا على الأقل");return;}
    if(!window.confirm(decision==="refund"?"تأكيد استرداد النقاط لصاحب الطلب؟":"تأكيد تحويل الضمان لمقدم الخدمة؟"))return;
    setBusy(d.id);setMessage("");
    try{await request(`/api/disputes/${d.id}/resolve`,{method:"POST",body:JSON.stringify({decision,note:notes[d.id]})});
      setMessage("تم تسجيل التسوية وتحويل النقاط في معاملة واحدة");queryClient.invalidateQueries({queryKey:["admin-disputes"]});}
    catch(e){setMessage(e instanceof Error?e.message:"تعذر الحسم")}finally{setBusy(null)}
  }
  return <div className="max-w-4xl mx-auto py-8 space-y-5" dir="rtl">
    <h1 className="text-3xl font-black">مراجعة نزاعات الضمان</h1><p className="text-sm text-muted-foreground">الإجراءات المالية مخصصة لمسؤول محدد ومحقق في قاعدة البيانات. راجع السجلات والأدلة قبل أي قرار.</p>
    {query.isLoading?<p>جارٍ التحميل...</p>:query.error?<p role="alert" className="text-red-700">{query.error instanceof Error?query.error.message:"تعذر التحميل"}</p>:
      !query.data?.length?<p>لا توجد نزاعات معلقة.</p>:query.data.map(d=><Card key={d.id} className="p-6 space-y-3">
        <div className="font-bold">نزاع #{d.id} · الخدمة #{d.serviceId}</div>
        <p className="text-sm"><strong>سبب النزاع:</strong> {d.reason}</p>
        {d.service&&<div className="border rounded-lg p-3 space-y-1 text-sm"><p className="font-bold">{d.service.title}</p><p>{d.service.description}</p>
          <p><strong>النقاط المحجوزة:</strong> {d.service.pointsPrice} قيمة العرض + {d.service.urgencyBonus} مكافأة (إذا كانت مفعّلة)</p></div>}
        {d.acceptedOffer&&<p className="text-sm"><strong>خطة العرض المقبول:</strong> {d.acceptedOffer.message}</p>}
        {d.proofs?.map((p,i)=><div key={i} className="p-3 border rounded-lg text-sm space-y-1">
          <p className="font-bold">إثبات #{i+1} · {p.proofType}</p><p>{p.proofContent}</p>
          <p className="text-xs text-muted-foreground">تقييم الآلة استشاري: {p.aiAnalysis||"غير متاح"}</p></div>)}
        <p className="text-xs text-muted-foreground">قُدم بتاريخ {new Date(d.createdAt).toLocaleString("ar-JO")}</p>
        <Textarea value={notes[d.id]||""} onChange={e=>setNotes(n=>({...n,[d.id]:e.target.value}))} placeholder="سجل سبب قرارك والوثائق التي راجعتها..."/>
        <div className="flex flex-wrap gap-2"><Button type="button" disabled={busy===d.id} variant="outline" onClick={()=>resolve(d,"refund")}>استرداد الضمان لصاحب الطلب</Button>
          <Button type="button" disabled={busy===d.id} onClick={()=>resolve(d,"release")}>صرف الضمان لمقدم الخدمة</Button></div>
      </Card>)}
    {message&&<p role="status" className="text-sm text-primary">{message}</p>}
  </div>;
}

import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { 
  useGetService, 
  useGetMe,
  useAcceptApplicant,
  useCompleteService
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, Button, Badge, Avatar, Modal, Textarea, LoadingScreen } from "@/components/ui";
import { URGENCY_LABELS, formatDateAr, cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { CheckCircle2, Clock, MessageSquare, Star, Sparkles, AlertCircle, Upload, Brain, ShieldCheck } from "lucide-react";

export default function ServiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const serviceId = parseInt(id, 10);
  const queryClient = useQueryClient();
  
  const { data: me } = useGetMe();
  const { data: service, isLoading: svcLoading } = useGetService(serviceId);
  
  const [recommendations,setRecommendations]=useState<Array<{userId:number;name:string;explanation:string;score:number;rank:number}>>([]);
  useEffect(()=>{
    if(!service||!me||service.requesterId!==me.id||service.status!=="open")return;
    fetch(`/api/services/${serviceId}/matches`,{credentials:"include"}).then(r=>r.ok?r.json():null)
      .then(body=>{if(body?.candidates)setRecommendations(body.candidates);}).catch(()=>{});
  },[serviceId,service?.requesterId,service?.status,me?.id]);
  const [applyModalOpen, setApplyModalOpen] = useState(false);
  const [applyMessage, setApplyMessage] = useState("");
  const [offerPoints,setOfferPoints]=useState("");
  const [offerDelivery,setOfferDelivery]=useState("");
  const [offerSubmitting,setOfferSubmitting]=useState(false);
  const [proofModalOpen, setProofModalOpen] = useState(false);
  const [disputeReason,setDisputeReason]=useState("");
  const [disputeStatus,setDisputeStatus]=useState<string|null>(null);
  const [disputeBusy,setDisputeBusy]=useState(false);
  useEffect(()=>{
    if(!service||!me||(me.id!==service.requesterId&&me.id!==service.providerId))return;
    fetch(`/api/disputes/${serviceId}`,{credentials:"include"}).then(r=>r.ok?r.json():null)
      .then(d=>setDisputeStatus(d?.status??null)).catch(()=>{});
  },[serviceId,service?.status,me?.id]);
  async function raiseDispute(){
    if(disputeReason.trim().length<15){toast({title:"اشرح المشكلة في 15 حرفًا على الأقل",variant:"destructive"});return;}
    setDisputeBusy(true);
    try{const r=await fetch('/api/disputes',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({serviceId,reason:disputeReason})});const d=await r.json();if(!r.ok)throw new Error(d.message||'تعذر فتح النزاع');
      setDisputeStatus('open');setDisputeReason('');toast({title:'تم فتح النزاع وتجميد النقاط لحين المراجعة',variant:'success'});
    }catch(e){toast({title:e instanceof Error?e.message:'خطأ',variant:'destructive'});}finally{setDisputeBusy(false)}
  }
  const [proofContent, setProofContent] = useState("");
  const [proofType, setProofType] = useState("نص وصفي");
  const [proofResult, setProofResult] = useState<{
    isVerified: boolean;
    aiRelevanceScore: number;
    aiAnalysis: string;
    message: string;
  } | null>(null);
  const [submittingProof, setSubmittingProof] = useState(false);

  async function submitOffer(){
    const points=Number(offerPoints), delivery=new Date(offerDelivery);
    if(!Number.isSafeInteger(points)||points<1||!applyMessage.trim()||applyMessage.trim().length<20 || !Number.isFinite(delivery.getTime())){
      toast({title:"أدخل سعرًا صحيحًا ورسالة لا تقل عن 20 حرفًا وموعد تسليم",variant:"destructive"});return;
    }
    setOfferSubmitting(true);
    try {
      const editing=Boolean(service?.applicants?.some(a=>a.userId===me?.id));
      const response=await fetch(`/api/services/${serviceId}/${editing?'offer':'apply'}`,{method:editing?"PATCH":"POST",headers:{"Content-Type":"application/json"},credentials:"include",body:JSON.stringify({proposedPoints:points,promisedDelivery:delivery.toISOString(),message:applyMessage})});
      const result=await response.json();
      if(!response.ok) throw new Error(result.message||"تعذّر تقديم العرض");
      toast({title:"تم تقديم عرضك بالنقاط!",variant:"success"});
      setApplyModalOpen(false);
      queryClient.invalidateQueries({queryKey:[`/api/services/${serviceId}`]});
    }catch(err){toast({title:err instanceof Error?err.message:"حدث خطأ",variant:"destructive"});}
    finally{setOfferSubmitting(false);}
  }

  const acceptMutation = useAcceptApplicant({
    mutation: {
      onSuccess: () => {
        toast({ title: "تم قبول الفزعة وحجز النقاط بنجاح", variant: "success" });
        queryClient.invalidateQueries({ queryKey: [`/api/services/${serviceId}`] });
        queryClient.invalidateQueries({ queryKey: [`/api/auth/me`] });
      }
    }
  });

  const completeMutation = useCompleteService({
    mutation: {
      onSuccess: () => {
        toast({ title: "تم إكمال الفزعة وتحويل النقاط!", variant: "success" });
        queryClient.invalidateQueries({ queryKey: [`/api/services/${serviceId}`] });
        queryClient.invalidateQueries({ queryKey: [`/api/auth/me`] });
      }
    }
  });

  async function submitProof() {
    if (!proofContent.trim()) return;
    setSubmittingProof(true);
    try {
      const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
      const res = await fetch(`${BASE}/api/proofs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ serviceId, proofType, proofContent }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "فشل إرسال الإثبات");
      setProofResult(data);
    } catch (err: any) {
      toast({ title: "خطأ في الإرسال", description: err.message, variant: "destructive" });
    } finally {
      setSubmittingProof(false);
    }
  }

  if (svcLoading || !service || !me) return <LoadingScreen />;

  const isRequester = me.id === service.requesterId;
  const isProvider = me.id === service.providerId;
  const hasApplied = service.applicants?.some(a => a.userId === me.id);

  const statusColors = {
    open: "bg-blue-100 text-blue-700",
    in_progress: "bg-orange-100 text-orange-700",
    completed: "bg-emerald-100 text-emerald-700",
    cancelled: "bg-gray-100 text-gray-700"
  } as const;

  const statusLabels = {
    open: "مفتوح للفزعة",
    in_progress: "قيد التنفيذ",
    completed: "مكتمل",
    cancelled: "ملغي"
  };

  return (
    <div className="max-w-5xl mx-auto py-6 space-y-8">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row gap-8">
        <div className="flex-1 space-y-6">
          <div className="flex items-center gap-3">
            <span className={cn("px-3 py-1 rounded-full text-sm font-bold", statusColors[service.status])}>
              {statusLabels[service.status]}
            </span>
            <Badge variant={service.urgency === 'high' ? 'destructive' : service.urgency === 'medium' ? 'warning' : 'success'}>
              {URGENCY_LABELS[service.urgency]}
            </Badge>
            <span className="text-muted-foreground text-sm flex items-center gap-1">
              <Clock className="w-4 h-4" /> {formatDateAr(service.createdAt)}
            </span>
          </div>

          <h1 className="text-3xl md:text-4xl font-black text-foreground leading-tight">
            {service.title}
          </h1>

          <Card className="p-6 text-lg leading-relaxed shadow-sm">
            {service.description}
          </Card>

          <div className="p-3 rounded-xl bg-blue-50 text-sm space-y-1">
            {((service as any).requiredSkills??[]).length>0 && <p><strong>المهارات المطلوبة:</strong> {(service as any).requiredSkills.join("، ")}</p>}
            {(service as any).urgencyBonus>0 && <p><strong>مكافأة الاستعجال:</strong> {(service as any).urgencyBonus} نقاط إضافية عند الإنجاز (محجوزة مسبقًا)</p>}
            <p>آخر موعد لإنجاز الخدمة: {service.deadline ? new Date(service.deadline).toLocaleString("ar-JO") : "غير محدد"}</p>
            <p>آخر موعد لاستقبال العروض: {(service as any).offersDeadline ? new Date((service as any).offersDeadline).toLocaleString("ar-JO") : "غير محدد (طلب قديم)"}</p>
          </div>
          {/* Requester Info */}
          <div className="flex items-center gap-4 bg-muted/30 p-4 rounded-2xl border border-border/50">
            <Avatar fallback={service.requesterName || "?"} className="w-14 h-14 text-xl" />
            <div>
              <p className="text-sm text-muted-foreground font-bold mb-1">صاحب الطلب</p>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg">{service.requesterName}</span>
                <Badge variant="outline" className="bg-white">{service.requesterLevel}</Badge>
                <span className="text-xs font-semibold">السمعة: {(service as any).requesterTrustScore ?? 'غير متاحة'}/100</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action / Price Sidebar */}
        <div className="w-full md:w-80 shrink-0 space-y-6">
          <Card className="p-6 border-secondary/30 bg-gradient-to-br from-yellow-50 to-white shadow-xl text-center">
            <h3 className="text-sm font-bold text-muted-foreground mb-4">السعر بالنقاط</h3>
            <div className="text-5xl font-black text-secondary mb-2 drop-shadow-sm">
              {service.status === "open" && service.pointsPrice === 0 ? "بانتظار العروض" : service.pointsPrice}
            </div>
            <p className="text-lg font-bold text-yellow-700 mb-6">{service.status === "open" && service.pointsPrice === 0 ? "لا يوجد سعر مسبق" : "نقطة"}</p>
            
            <p className="text-xs text-muted-foreground mb-5">مقدمو الخدمة يرسلون عروضهم، وصاحب الطلب يختار وفق السعر والسمعة وخطة التنفيذ.</p>

            {service.status === 'open' && !isRequester && (
              hasApplied ? (
                <div className="space-y-2">
                  <div className="bg-emerald-100 text-emerald-700 p-3 rounded-xl font-bold flex items-center justify-center gap-2">
                    <CheckCircle2 className="w-5 h-5" /> تم تقديم عرضك
                  </div>
                  <Button variant="outline" size="sm" className="w-full" onClick={()=>{
                    const own=service.applicants?.find(a=>a.userId===me.id) as any;
                    setApplyMessage(own?.message||'');setOfferPoints(String(own?.proposedPoints||''));
                    setOfferDelivery(own?.promisedDelivery?new Date(own.promisedDelivery).toISOString().slice(0,16):'');
                    setApplyModalOpen(true);
                  }}>تعديل عرضك</Button>
                </div>
              ) : (
                <Button size="lg" className="w-full text-lg" onClick={() => setApplyModalOpen(true)}>
                  أنا أقدر أفزع!
                </Button>
              )
            )}

            {service.status === 'in_progress' && isRequester && (
              <div className="space-y-4">
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-800 text-sm font-semibold">
                  النظام حجز {service.pointsPrice} نقطة قيمة العرض، إضافة إلى {((service as any).urgencyBonus??0)} نقاط مكافأة الاستعجال التي حُجزت عند النشر.
                </div>
                {disputeStatus==='open'&&<p className="text-sm text-red-700">نزاع مفتوح: لا يمكن تحويل النقاط قبل قرار الإدارة.</p>}
                <Button size="lg" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => completeMutation.mutate({ id: serviceId })} isLoading={completeMutation.isPending} disabled={disputeStatus==='open'}>
                  تأكيد إنجاز المهمة
                </Button>
              </div>
            )}

            {service.status === 'in_progress' && isProvider && (
              <div className="space-y-3">
                <div className="p-3 bg-orange-50 border border-orange-200 rounded-xl text-orange-800 font-bold text-sm">
                  أنت تقوم بتنفيذ هذه الخدمة. تواصل مع صاحب الطلب لإنجازها.
                </div>
                <Button
                  size="lg"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={() => setProofModalOpen(true)}
                >
                  <Upload className="w-5 h-5 ml-2" />
                  رفع إثبات الإنجاز
                </Button>
                <p className="text-xs text-center text-muted-foreground">
                  الذكاء الاصطناعي سيتحقق من صلة إنجازك بالطلب
                </p>
              </div>
            )}
          </Card>
        </div>
      </div>

      {service.status==='in_progress'&&(isRequester||isProvider)&&<Card className="p-5 space-y-3">
        <h3 className="font-bold">حل الخلافات</h3>
        {disputeStatus==='open'?<p className="text-red-700 text-sm">نزاع قائم؛ النقاط محجوزة حتى يراجعها مسؤول مخوّل.</p>:
        disputeStatus?<p className="text-sm">حالة النزاع السابق: {disputeStatus}</p>:<>
        <p className="text-sm text-muted-foreground">حاول حل المشكلة مباشرة أولًا. إذا تعذر، افتح نزاعًا مع شرح السبب. لا تُحوّل النقاط لطرف واحد حتى قرار الإدارة.</p>
        <Textarea value={disputeReason} onChange={e=>setDisputeReason(e.target.value)} placeholder="اكتب تفاصيل الخلاف وما حاولت فعله..." />
        <Button variant="outline" type="button" disabled={disputeBusy||disputeReason.trim().length<15} onClick={raiseDispute}>فتح نزاع وتجميد الضمان</Button></>}
      </Card>}

      {/* Applicants Section (For Requester) */}
      {isRequester && service.status === 'open' && (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-primary" />
            العروض المقدمة لفزعتك ({service.applicants?.length || 0})
          </h2>
          
          {!service.applicants?.length ? (
            <Card className="p-12 text-center text-muted-foreground border-dashed">
              لم يتقدم أحد بعد. الخدمة ظاهرة في السوق، وتُرسل إشعارات مبدئية لأصحاب المهارات المتطابقة.
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {service.applicants.map(app => (
                <Card key={app.userId} className="p-5 flex flex-col hover:border-primary/50 transition-colors">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <Avatar fallback={app.name} />
                      <div>
                        <h4 className="font-bold">{app.name}</h4>
                        <div className="flex items-center gap-2 text-xs font-semibold">
                          <span className="text-primary">{app.level}</span>
                          <span className="flex items-center text-yellow-600"><Star className="w-3 h-3 fill-current ml-0.5" /> {app.averageRating || 'جديد'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-center bg-muted/50 rounded-lg px-2 py-1">
                      <p className="text-[10px] text-muted-foreground font-bold">مؤشر الثقة</p>
                      <p className={cn("font-black", app.trustScore > 80 ? "text-emerald-600" : "text-orange-500")}>{Math.round(app.trustScore)}/100</p>
                    </div>
                  </div>
                  
                  <div className="rounded-lg border bg-yellow-50 p-3 mb-3 text-sm">
                    <strong>العرض: {(app as any).proposedPoints ?? "غير محدد"} نقطة</strong>
                    <p className="text-xs">الإجمالي للمقدم بعد الإنجاز: {Number((app as any).proposedPoints??0)+Number((service as any).urgencyBonus??0)} نقطة</p>
                    <p>التسليم: {(app as any).promisedDelivery ? new Date((app as any).promisedDelivery).toLocaleString("ar-JO") : "غير محدد"}</p>
                    <p className="text-xs text-muted-foreground">تقييمات موثقة: {(app as any).reputationReviews ?? 0} · خدمات مكتملة: {(app as any).completedServices ?? 0} — {((app as any).reputationReviews ?? 0)<3?"سجل تقييمات محدود":"راجع التقييمات والسجل"}</p>
                  </div>
                  {app.message && (
                    <div className="bg-muted/30 p-3 rounded-lg text-sm mb-4 italic border-r-2 border-primary">
                      "{app.message}"
                    </div>
                  )}

                  <Button 
                    className="mt-auto w-full" 
                    variant="outline"
                    onClick={() => acceptMutation.mutate({ id: serviceId, applicantId: app.userId })}
                    isLoading={acceptMutation.isPending}
                    disabled={!(app as any).proposedPoints || !(app as any).promisedDelivery}
                  >
                    قبول وبدء التنفيذ
                  </Button>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Proof Submission Modal */}
      {service?.requesterId===me?.id && recommendations.length>0 && <div className="rounded-xl border bg-white p-5 my-6">
        <h3 className="font-bold mb-2">الطلاب الذين وصلتهم التوصية ({recommendations.length})</h3>
        <p className="text-xs text-muted-foreground mb-3">الترتيب يستند إلى تطابق المهارات والسجل والتوفر وعدالة التعرض. الدرجات ليست احتمالات نجاح.</p>
        {recommendations.map(candidate=><p key={candidate.userId} className="py-1 text-sm">{candidate.rank}. {candidate.name} — {candidate.explanation} · ترتيب {candidate.score}/100</p>)}
      </div>}
      <Modal isOpen={proofModalOpen} onClose={() => { setProofModalOpen(false); setProofResult(null); }} title="رفع إثبات الإنجاز">
        <div className="space-y-5">
          {!proofResult ? (
            <>
              <div className="flex gap-3 p-4 bg-blue-50 text-blue-800 rounded-xl">
                <Brain className="w-6 h-6 shrink-0" />
                <p className="text-sm font-semibold leading-relaxed">
                  الذكاء الاصطناعي سيحلل إنجازك ويتحقق من ارتباطه بوصف الطلب. كلما كان وصفك دقيقاً كلما ارتفعت درجة التحقق.
                </p>
              </div>

              <div>
                <label className="block text-sm font-bold mb-2">نوع الإثبات</label>
                <div className="flex gap-2 flex-wrap">
                  {["نص وصفي", "رابط عمل", "نتائج وأرقام", "خطوات تفصيلية"].map(t => (
                    <button
                      key={t}
                      onClick={() => setProofType(t)}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-sm font-bold border transition-colors",
                        proofType === t ? "bg-primary text-white border-primary" : "border-border hover:bg-muted"
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold mb-2">وصف الإنجاز</label>
                <Textarea
                  placeholder="صف ما أنجزته بالتفصيل. كيف نفذت المهمة؟ ما هي النتائج التي توصلت إليها؟..."
                  value={proofContent}
                  onChange={e => setProofContent(e.target.value)}
                  className="h-36"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {proofContent.length} حرف — يُنصح بـ 100 حرف على الأقل للحصول على تحقق أفضل
                </p>
              </div>

              <Button
                className="w-full"
                onClick={submitProof}
                disabled={submittingProof || proofContent.length < 20}
                isLoading={submittingProof}
              >
                <Upload className="w-4 h-4 ml-2" />
                {submittingProof ? "الذكاء الاصطناعي يحلل إنجازك..." : "إرسال للتحقق الذكي"}
              </Button>
            </>
          ) : (
            <div className="space-y-4">
              <div className={cn(
                "p-4 rounded-2xl text-center",
                proofResult.isVerified ? "bg-emerald-50 border border-emerald-200" : "bg-orange-50 border border-orange-200"
              )}>
                <div className="text-4xl mb-2">{proofResult.isVerified ? "✅" : "⚠️"}</div>
                <p className="font-black text-lg">{proofResult.isVerified ? "تم التأكيد بشريًا" : "بانتظار مراجعة صاحب الطلب"}</p>
              </div>

              <div className="bg-card rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-muted-foreground">درجة المطابقة</span>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-28 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn("h-full rounded-full", proofResult.aiRelevanceScore >= 60 ? "bg-emerald-500" : "bg-orange-500")}
                        style={{ width: `${proofResult.aiRelevanceScore}%` }}
                      />
                    </div>
                    <span className="font-black text-primary">{proofResult.aiRelevanceScore}%</span>
                  </div>
                </div>

                <div className="border-t pt-3">
                  <p className="text-xs font-bold text-muted-foreground mb-1 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> تحليل الذكاء الاصطناعي:
                  </p>
                  <p className="text-sm leading-relaxed">{proofResult.aiAnalysis}</p>
                </div>
              </div>

              <p className="text-xs text-center text-muted-foreground">{proofResult.message}</p>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => { setProofResult(null); setProofContent(""); }}
              >
                تعديل الإثبات
              </Button>
            </div>
          )}
        </div>
      </Modal>

      <Modal isOpen={applyModalOpen} onClose={() => setApplyModalOpen(false)} title="تقديم الفزعة">
        <div className="space-y-6">
          <div className="flex gap-4 p-4 bg-blue-50 text-blue-800 rounded-xl">
            <AlertCircle className="w-6 h-6 shrink-0" />
            <p className="text-sm font-semibold leading-relaxed">
              بتقديمك لهذه الفزعة، أنت تؤكد قدرتك على إنجازها بالوقت المحدد. سيتم تقييمك بناءً على جودة العمل والتزامك.
            </p>
          </div>
          <div>
            <label className="block text-sm font-bold mb-2">لماذا أنت مناسب؟ وما خطة التنفيذ؟</label>
            <Textarea 
              placeholder="اشرح خبرتك وخطوات تنفيذ الخدمة (20 حرفًا على الأقل)..." 
              value={applyMessage} 
              onChange={e => setApplyMessage(e.target.value)}
              className="h-24"
            />
          </div>
          <label className="block text-sm font-bold">النقاط المطلوبة
            <input className="mt-2 w-full border rounded-lg p-3" type="number" min="1" step="1" value={offerPoints} onChange={e=>setOfferPoints(e.target.value)} placeholder="مثال: 35" />
          </label>
          <label className="block text-sm font-bold">موعد التسليم الذي تلتزم به
            <input className="mt-2 w-full border rounded-lg p-3" type="datetime-local" value={offerDelivery} onChange={e=>setOfferDelivery(e.target.value)} />
          </label>
          <Button
            className="w-full text-lg"
            onClick={submitOffer}
            isLoading={offerSubmitting}
          >
            تأكيد التقديم
          </Button>
        </div>
      </Modal>
    </div>
  );
}

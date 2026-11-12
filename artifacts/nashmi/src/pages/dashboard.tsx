import { useState } from "react";
import { useGetDashboardStats, useRequestLoan } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, Button, Badge, Modal, Input, Textarea, LoadingScreen } from "@/components/ui";
import { toast } from "@/hooks/use-toast";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Trophy, TrendingUp, HandHeart, Coins, ShieldCheck, AlertCircle } from "lucide-react";
import { formatDateAr } from "@/lib/utils";

export default function DashboardPage() {
  const { data: stats, isLoading } = useGetDashboardStats();
  const queryClient = useQueryClient();
  const [loanModalOpen, setLoanModalOpen] = useState(false);
  
  const [loanAmount, setLoanAmount] = useState("50");
  const [loanReason, setLoanReason] = useState("");

  const loanMutation = useRequestLoan({
    mutation: {
      onSuccess: (res) => {
        toast({ title: res.message, variant: "success" });
        setLoanModalOpen(false);
        queryClient.invalidateQueries({ queryKey: [`/api/dashboard/stats`] });
        queryClient.invalidateQueries({ queryKey: [`/api/auth/me`] });
      },
      onError: (err) => {
        toast({ title: "عذراً", description: err.message, variant: "destructive" });
      }
    }
  });

  if (isLoading || !stats) return <LoadingScreen />;

  return (
    <div className="space-y-8 pb-12">
      <h1 className="text-3xl font-black text-foreground">لوحة التحكم</h1>

      {/* Top Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Points Card */}
        <Card className="p-6 bg-gradient-to-br from-primary to-[#093540] text-white border-0 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-20"><Coins className="w-32 h-32" /></div>
          <div className="relative z-10 flex flex-col h-full">
            <h3 className="text-lg font-medium opacity-90 mb-2">رصيد النقاط</h3>
            <div className="text-5xl font-black text-secondary mb-1 drop-shadow-sm">{stats.points}</div>
            <p className="text-sm opacity-80 mb-6">يمكنك استخدامها لطلب الفزعات</p>
            
            <div className="mt-auto flex gap-3">
              <Button className="flex-1 bg-white/10 hover:bg-white/20 border-0 text-white shadow-none" onClick={() => setLoanModalOpen(true)}>
                طلب قرض نقاط
              </Button>
            </div>
            {stats.loanBalance > 0 && (
              <p className="text-xs text-red-300 mt-3 font-bold bg-black/20 p-2 rounded-lg inline-block">
                عليك سداد {stats.loanBalance} نقطة مستحقة
              </p>
            )}
          </div>
        </Card>

        {/* Level & Trust Card */}
        <Card className="p-6 border-border/50 shadow-md flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-muted-foreground">مستواك الحالي</h3>
              <Badge variant="outline" className="bg-primary/5 text-primary text-sm px-3 py-1 border-primary/20">
                {stats.level}
              </Badge>
            </div>
            
            <div className="space-y-2 mb-6">
              <div className="flex justify-between text-sm font-bold">
                <span>التقدم للمستوى القادم</span>
                <span className="text-primary">{stats.nextLevelProgress}%</span>
              </div>
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-primary to-secondary transition-all" style={{ width: `${stats.nextLevelProgress}%` }} />
              </div>
            </div>
          </div>

          <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center gap-4">
            <div className="p-3 bg-white rounded-full shadow-sm text-emerald-600"><ShieldCheck className="w-6 h-6" /></div>
            <div>
              <p className="text-xs text-emerald-800 font-bold mb-1">مؤشر الثقة</p>
              <div className="flex items-end gap-1">
                <span className="text-2xl font-black text-emerald-600">{stats.trustScore}</span>
                <span className="text-sm font-bold text-emerald-600/60 pb-1">/ 100</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Impact Card */}
        <Card className="p-6 border-border/50 shadow-md">
          <h3 className="text-lg font-bold text-muted-foreground mb-6">الأثر الاجتماعي</h3>
          
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="p-4 bg-muted/30 rounded-2xl text-center border border-border/50">
              <div className="mx-auto w-10 h-10 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-2">
                <HandHeart className="w-5 h-5" />
              </div>
              <div className="text-2xl font-black text-foreground">{stats.totalServicesGiven}</div>
              <div className="text-xs font-bold text-muted-foreground">فزعة قدمتها</div>
            </div>
            <div className="p-4 bg-muted/30 rounded-2xl text-center border border-border/50">
              <div className="mx-auto w-10 h-10 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mb-2">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div className="text-2xl font-black text-foreground">{stats.totalServicesReceived}</div>
              <div className="text-xs font-bold text-muted-foreground">فزعة طلبتها</div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {stats.topSkills.map(skill => (
              <Badge key={skill} variant="secondary" className="bg-yellow-100 text-yellow-800">{skill}</Badge>
            ))}
          </div>
        </Card>
      </div>

      {/* Chart Section */}
      <Card className="p-6 border-border/50 shadow-md">
        <div className="flex items-center gap-3 mb-8">
          <Trophy className="w-6 h-6 text-secondary" />
          <h2 className="text-xl font-bold">تاريخ تحصيل النقاط</h2>
        </div>
        <div className="h-72 w-full" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={stats.pointsHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorPoints" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(191, 72%, 21%)" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(191, 72%, 21%)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
              <Tooltip 
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }}
                itemStyle={{ color: 'hsl(191, 72%, 21%)', fontWeight: 'bold' }}
              />
              <Area type="monotone" dataKey="points" name="النقاط" stroke="hsl(191, 72%, 21%)" strokeWidth={3} fillOpacity={1} fill="url(#colorPoints)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Transactions */}
      <div>
        <h2 className="text-xl font-bold mb-4">آخر العمليات</h2>
        <div className="space-y-3">
          {!stats.recentTransactions?.length ? (
            <p className="text-muted-foreground text-sm text-center p-8 bg-card rounded-2xl">لا توجد عمليات سابقة</p>
          ) : (
            stats.recentTransactions.map((tx) => {
              const isPositive = ['earned', 'loan_given', 'escrow_released', 'bonus'].includes(tx.type);
              return (
                <div key={tx.id} className="bg-card p-4 rounded-2xl border border-border/50 shadow-sm flex items-center justify-between hover:bg-muted/20 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={cn("w-10 h-10 rounded-full flex items-center justify-center font-black text-lg", isPositive ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600")}>
                      {isPositive ? '+' : '-'}
                    </div>
                    <div>
                      <p className="font-bold text-sm mb-1">{tx.description}</p>
                      <p className="text-xs text-muted-foreground">{formatDateAr(tx.createdAt)}</p>
                    </div>
                  </div>
                  <div className="text-left" dir="ltr">
                    <p className={cn("font-black text-lg", isPositive ? "text-emerald-600" : "text-red-600")}>
                      {isPositive ? '+' : '-'}{tx.amount}
                    </p>
                    <p className="text-[10px] font-bold text-muted-foreground">الرصيد: {tx.balanceAfter}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Loan Modal */}
      <Modal isOpen={loanModalOpen} onClose={() => setLoanModalOpen(false)} title="قرض النقاط (Social Credit)">
        <div className="space-y-6">
          <div className="flex gap-4 p-4 bg-primary/5 text-primary rounded-xl">
             <AlertCircle className="w-6 h-6 shrink-0" />
             <p className="text-sm font-semibold leading-relaxed">
               يسمح لك نظام نشمي باقتراض النقاط لطلب خدمة مستعجلة، ويتم تحديد سقف القرض بناءً على <strong>مؤشر الثقة</strong> الخاص بك.
             </p>
          </div>
          
          <div className="space-y-2">
            <label className="font-bold text-sm">المبلغ المطلوب (الحد الأقصى 50)</label>
            <Input 
              type="number" 
              min="1" 
              max="50" 
              value={loanAmount} 
              onChange={e => setLoanAmount(e.target.value)} 
              className="text-2xl font-black h-16 text-center text-secondary"
            />
          </div>

          <div className="space-y-2">
            <label className="font-bold text-sm">سبب الاستعجال</label>
            <Textarea 
              placeholder="مثال: لدي امتحان غداً وأحتاج ملخص ضروري..." 
              value={loanReason}
              onChange={e => setLoanReason(e.target.value)}
            />
          </div>

          <Button 
            className="w-full text-lg h-14" 
            onClick={() => loanMutation.mutate({ data: { amount: parseInt(loanAmount, 10), reason: loanReason } })}
            isLoading={loanMutation.isPending}
          >
            تأكيد طلب القرض
          </Button>
        </div>
      </Modal>

    </div>
  );
}

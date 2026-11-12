import { useGetLeaderboard } from "@workspace/api-client-react";
import { Card, Avatar, LoadingScreen, Badge } from "@/components/ui";
import { Trophy, Star, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export default function LeaderboardPage() {
  const { data: leaderboard, isLoading } = useGetLeaderboard();

  if (isLoading) return <LoadingScreen />;

  return (
    <div className="max-w-4xl mx-auto py-8 space-y-8">
      <div className="text-center mb-12">
        <div className="inline-flex items-center justify-center p-4 bg-yellow-100 text-yellow-600 rounded-full mb-4">
          <Trophy className="w-10 h-10" />
        </div>
        <h1 className="text-4xl font-black text-foreground mb-4">لوحة الشرف للنشامى</h1>
        <p className="text-lg text-muted-foreground font-medium max-w-xl mx-auto">
          أكثر الطلاب تقديماً للفزعات وأعلاهم ثقة وتقييماً على مستوى الجامعات. هل ستكون منهم؟
        </p>
      </div>

      <div className="space-y-4">
        {leaderboard?.map((entry, index) => {
          const isTop3 = index < 3;
          const ranks = ["🥇", "🥈", "🥉"];
          
          return (
            <Card 
              key={entry.userId} 
              className={cn(
                "p-4 md:p-6 flex items-center justify-between transition-all duration-300 hover:scale-[1.01]",
                index === 0 ? "bg-gradient-to-r from-yellow-50 to-amber-100 border-yellow-300 shadow-yellow-200/50 shadow-xl scale-105 my-8 relative overflow-hidden" : 
                index === 1 ? "bg-slate-50 border-slate-200" : 
                index === 2 ? "bg-orange-50 border-orange-200" : "bg-card"
              )}
            >
              {index === 0 && <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-300/30 rounded-bl-full -z-0" />}
              
              <div className="flex items-center gap-4 md:gap-6 relative z-10">
                <div className={cn("w-12 h-12 flex items-center justify-center font-black text-2xl shrink-0", isTop3 ? "" : "text-muted-foreground")}>
                  {isTop3 ? ranks[index] : `#${entry.rank}`}
                </div>
                
                <Avatar fallback={entry.name} className={cn("w-14 h-14", index === 0 ? "w-16 h-16 ring-4 ring-yellow-400 ring-offset-4" : "")} />
                
                <div>
                  <h3 className={cn("font-bold", index === 0 ? "text-xl text-yellow-900" : "text-lg")}>
                    {entry.name}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <Badge variant={index === 0 ? "secondary" : "outline"} className={index === 0 ? "shadow-sm" : ""}>
                      {entry.level}
                    </Badge>
                    {entry.university && <span className="text-xs font-semibold text-muted-foreground">{entry.university}</span>}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-6 relative z-10">
                <div className="hidden sm:flex flex-col items-center">
                  <span className="text-xs font-bold text-muted-foreground mb-1">الفزعات</span>
                  <span className="font-black text-lg">{entry.totalServicesGiven}</span>
                </div>
                <div className="hidden sm:flex flex-col items-center">
                  <span className="text-xs font-bold text-muted-foreground mb-1">التقييم</span>
                  <span className="font-black text-lg text-yellow-600 flex items-center"><Star className="w-4 h-4 fill-current mr-0.5"/> {entry.averageRating || '-'}</span>
                </div>
                <div className="flex flex-col items-center p-2 bg-white/60 rounded-xl shadow-sm border border-border/50">
                  <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-1 mb-0.5"><ShieldCheck className="w-3 h-3"/> الثقة</span>
                  <span className="font-black text-xl text-emerald-600">{entry.trustScore}</span>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

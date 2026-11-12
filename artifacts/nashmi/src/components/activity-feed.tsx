import { useEffect, useState } from "react";
import { Activity, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface ActivityItem {
  id: number;
  message: string;
  category: string | null;
  createdAt: string;
}

const categoryIcons: Record<string, string> = {
  "برمجة": "💻",
  "تصميم": "🎨",
  "ترجمة": "🌐",
  "شرح دروس": "📚",
  "أبحاث": "🔬",
  "تحرير": "✏️",
  "أخرى": "⭐",
};

export function LiveActivityFeed() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [isNew, setIsNew] = useState<number | null>(null);

  async function fetchActivity() {
    try {
      const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
      const res = await fetch(`${BASE}/api/activity`);
      if (!res.ok) return;
      const data: ActivityItem[] = await res.json();
      setActivities(prev => {
        if (prev.length > 0 && data[0]?.id !== prev[0]?.id && data.length > 0) {
          setIsNew(data[0].id);
          setTimeout(() => setIsNew(null), 2000);
        }
        return data;
      });
    } catch {}
  }

  useEffect(() => {
    fetchActivity();
    const interval = setInterval(fetchActivity, 15000);
    return () => clearInterval(interval);
  }, []);

  if (!activities.length) return null;

  return (
    <div className="bg-card rounded-2xl p-5 shadow-sm border border-border/50">
      <div className="flex items-center gap-2 mb-4">
        <div className="relative">
          <Activity className="w-5 h-5 text-primary" />
          <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        </div>
        <h3 className="font-bold text-sm">نبض المنصة الآن</h3>
      </div>

      <div className="space-y-3">
        {activities.slice(0, 6).map((item, i) => (
          <div
            key={item.id}
            className={cn(
              "flex items-start gap-2 p-2 rounded-xl transition-all duration-500 text-xs",
              i === 0 ? "bg-primary/5 border border-primary/20" : "border border-transparent",
              isNew === item.id ? "bg-emerald-50 border-emerald-300 scale-[1.02]" : ""
            )}
          >
            <span className="text-base shrink-0 mt-0.5">
              {categoryIcons[item.category || ""] || "⭐"}
            </span>
            <p className="text-muted-foreground leading-relaxed font-medium">
              {item.message}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <Zap className="w-3 h-3 text-yellow-500" />
        <span>يتجدد كل 15 ثانية</span>
      </div>
    </div>
  );
}

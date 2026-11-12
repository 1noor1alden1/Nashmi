import { Link } from "wouter";
import { Service } from "@workspace/api-client-react";
import { Card, Badge, Avatar } from "./ui";
import { cn, URGENCY_LABELS, formatRelativeAr, CATEGORIES } from "@/lib/utils";
import { MapPin, Users, ChevronLeft, ShieldCheck } from "lucide-react";

export function ServiceCard({ service }: { service: Service }) {
  const categoryInfo = CATEGORIES.find(c => c.id === service.category) || CATEGORIES[CATEGORIES.length - 1];
  
  const urgencyColors = {
    high: "destructive",
    medium: "warning",
    low: "success"
  } as const;

  return (
    <Link href={`/services/${service.id}`}>
      <Card className="group hover:-translate-y-1 hover:shadow-xl hover:border-primary/30 transition-all duration-300 cursor-pointer h-full flex flex-col relative overflow-hidden">
        {/* Glow effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        
        <div className="p-5 flex-1 flex flex-col relative z-10">
          <div className="flex justify-between items-start mb-4 gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary/10 text-2xl flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
                {categoryInfo.icon}
              </div>
              <div>
                <Badge variant={urgencyColors[service.urgency]} className="mb-1.5 px-2 py-0.5 text-[10px]">
                  {URGENCY_LABELS[service.urgency]}
                </Badge>
                <h3 className="font-bold text-lg leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                  {service.title}
                </h3>
              </div>
            </div>
            
            <div className="flex flex-col items-center bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-1.5 min-w-[64px] shrink-0">
              <span className="text-yellow-700 font-black text-sm">{service.pointsPrice === 0 ? "عروض الطلاب" : `${service.pointsPrice} نقطة`}</span>
            </div>
          </div>

          <p className="text-muted-foreground text-sm line-clamp-2 mb-6 flex-1">
            {service.description}
          </p>

          <div className="mt-auto pt-4 border-t border-border/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Avatar fallback={service.requesterName} className="w-8 h-8 text-xs" />
              <div className="flex flex-col">
                <span className="text-xs font-bold text-foreground">{service.requesterName}</span>
                <span className="text-[10px] font-semibold text-primary">{service.requesterLevel} · السمعة: {(service as any).requesterTrustScore ?? '—'}/100</span>
              </div>
            </div>

            <div className="flex items-center gap-3 text-muted-foreground text-xs font-semibold">
              {(service.restrictToUniversity || service.restrictToMajor) && (
                <div className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md" title="دائرة موثوقة">
                  <ShieldCheck className="w-3.5 h-3.5" />
                </div>
              )}
              {service.applicantsCount > 0 && (
                <div className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  <span>{service.applicantsCount}</span>
                </div>
              )}
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </div>
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}

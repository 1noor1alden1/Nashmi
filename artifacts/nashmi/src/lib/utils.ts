import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatDistanceToNow, format } from "date-fns";
import { ar } from "date-fns/locale";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRelativeAr(dateString: string) {
  try {
    return formatDistanceToNow(new Date(dateString), { addSuffix: true, locale: ar });
  } catch {
    return "مؤخراً";
  }
}

export function formatDateAr(dateString: string) {
  try {
    return format(new Date(dateString), "dd MMMM yyyy", { locale: ar });
  } catch {
    return dateString;
  }
}

export const URGENCY_LABELS = {
  low: "عادي",
  medium: "متوسط",
  high: "عاجل",
} as const;

export const CATEGORIES = [
  { id: "برمجة", icon: "💻" },
  { id: "تصميم", icon: "🎨" },
  { id: "ترجمة", icon: "🌐" },
  { id: "شرح دروس", icon: "📚" },
  { id: "تحرير", icon: "✍️" },
  { id: "أبحاث", icon: "🔬" },
  { id: "أخرى", icon: "⭐" }
];

import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle2, AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export function Toaster() {
  const { toasts, dismiss } = useToast();

  return (
    <div className="fixed top-4 left-4 z-[100] flex flex-col gap-3 w-full max-w-sm pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, x: -50, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
            className={cn(
              "pointer-events-auto flex items-start gap-3 p-4 rounded-xl shadow-lg border backdrop-blur-md",
              toast.variant === "destructive" 
                ? "bg-red-50/90 border-red-200 text-red-900" 
                : toast.variant === "success"
                ? "bg-emerald-50/90 border-emerald-200 text-emerald-900"
                : "bg-white/90 border-border text-foreground"
            )}
          >
            <div className="shrink-0 mt-0.5">
              {toast.variant === "destructive" ? (
                <AlertCircle className="w-5 h-5 text-red-500" />
              ) : toast.variant === "success" ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              ) : (
                <Info className="w-5 h-5 text-primary" />
              )}
            </div>
            <div className="flex-1 space-y-1">
              <h3 className="font-bold text-sm">{toast.title}</h3>
              {toast.description && (
                <p className="text-sm opacity-90 leading-relaxed">{toast.description}</p>
              )}
            </div>
            <button
              onClick={() => dismiss(toast.id)}
              className="shrink-0 rounded-md p-1 hover:bg-black/5 transition-colors"
            >
              <X className="w-4 h-4 opacity-50 hover:opacity-100" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

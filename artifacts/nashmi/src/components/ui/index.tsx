import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// --- BUTTON ---
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "secondary" | "outline" | "ghost" | "destructive";
  size?: "sm" | "default" | "lg" | "icon";
  isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", isLoading, children, disabled, ...props }, ref) => {
    const variants = {
      default: "bg-gradient-to-r from-primary to-primary/90 text-primary-foreground shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5 border border-primary/20",
      secondary: "bg-gradient-to-r from-secondary to-yellow-400 text-secondary-foreground shadow-lg shadow-secondary/25 hover:shadow-xl hover:shadow-secondary/30 hover:-translate-y-0.5 border border-secondary/20 font-bold",
      outline: "border-2 border-primary/20 bg-transparent text-primary hover:bg-primary/5 hover:border-primary/40",
      ghost: "bg-transparent text-foreground hover:bg-black/5",
      destructive: "bg-gradient-to-r from-destructive to-red-500 text-white shadow-lg shadow-red-500/25 hover:shadow-xl hover:-translate-y-0.5",
    };
    const sizes = {
      sm: "h-9 px-4 text-sm rounded-lg",
      default: "h-12 px-6 py-2 rounded-xl font-semibold",
      lg: "h-14 px-8 text-lg rounded-2xl font-bold",
      icon: "h-12 w-12 rounded-xl flex items-center justify-center",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          "inline-flex items-center justify-center gap-2 whitespace-nowrap transition-all duration-300 ease-out active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 disabled:scale-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20",
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {isLoading && <Loader2 className="h-5 w-5 animate-spin" />}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";

// --- CARD ---
export const Card = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("rounded-2xl border border-border/50 bg-card text-card-foreground shadow-lg shadow-black/[0.03] overflow-hidden", className)} {...props} />
  )
);
Card.displayName = "Card";

export const CardHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
);
export const CardTitle = ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h3 className={cn("text-xl font-bold leading-none tracking-tight", className)} {...props} />
);
export const CardContent = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("p-6 pt-0", className)} {...props} />
);

// --- INPUT & TEXTAREA ---
export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "flex h-12 w-full rounded-xl border-2 border-border/50 bg-background/50 px-4 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-50 transition-all",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "flex min-h-[100px] w-full rounded-xl border-2 border-border/50 bg-background/50 px-4 py-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-50 transition-all resize-y",
        className
      )}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";

export const Label = forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label ref={ref} className={cn("text-sm font-bold leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-foreground/80 block mb-2", className)} {...props} />
  )
);
Label.displayName = "Label";

// --- BADGE ---
export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "outline" | "destructive" | "success" | "warning";
}
export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const variants = {
    default: "border-transparent bg-primary/10 text-primary hover:bg-primary/20",
    secondary: "border-transparent bg-secondary text-secondary-foreground",
    destructive: "border-transparent bg-red-100 text-red-700 hover:bg-red-200",
    success: "border-transparent bg-emerald-100 text-emerald-700 hover:bg-emerald-200",
    warning: "border-transparent bg-orange-100 text-orange-700 hover:bg-orange-200",
    outline: "text-foreground border-border",
  };
  return (
    <div className={cn("inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold transition-colors", variants[variant], className)} {...props} />
  );
}

// --- MODAL ---
export function Modal({ isOpen, onClose, title, children }: { isOpen: boolean, onClose: () => void, title?: string, children: React.ReactNode }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-card w-full max-w-lg rounded-3xl shadow-2xl border border-border pointer-events-auto overflow-hidden flex flex-col max-h-[90vh]"
            >
              {title && (
                <div className="px-6 py-4 border-b bg-muted/30 flex items-center justify-between">
                  <h2 className="text-xl font-bold">{title}</h2>
                  <button onClick={onClose} className="p-2 hover:bg-black/5 rounded-full transition-colors">
                    <Loader2 className="w-5 h-5 opacity-0 hidden" /> {/* spacer */}
                    <span className="sr-only">Close</span>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinelinejoin="round" className="opacity-50 hover:opacity-100"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                  </button>
                </div>
              )}
              <div className="p-6 overflow-y-auto">
                {children}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

export function LoadingScreen() {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background">
      <motion.div 
        animate={{ rotate: 360 }} 
        transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
        className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full mb-4"
      />
      <p className="text-lg font-bold text-primary animate-pulse">جاري التحميل يا نشمي...</p>
    </div>
  );
}

export function Avatar({ fallback, className }: { fallback: string, className?: string }) {
  return (
    <div className={cn("h-10 w-10 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-white font-bold shadow-md border-2 border-white", className)}>
      {fallback.substring(0, 2)}
    </div>
  );
}

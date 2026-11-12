import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { motion } from "framer-motion";
import { useLogin, useRegister, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Input, Button, Label, Card } from "@/components/ui";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, CheckCircle2 } from "lucide-react";

const loginSchema = z.object({
  email: z.string().email("البريد الإلكتروني غير صحيح"),
  password: z.string().min(6, "كلمة المرور 6 أحرف على الأقل"),
});

const registerSchema = loginSchema.extend({
  password:z.string().min(10,"كلمة المرور 10 أحرف على الأقل"),
  name: z.string().min(2, "الاسم مطلوب"),
  university: z.string().optional(),
  major: z.string().optional(),
  skills: z.string().optional(),
  inviteCode:z.string().optional(),
});

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const loginMutation = useLogin({
    mutation: {
      onSuccess: () => {
        toast({ title: "أهلاً بك يا نشمي!", variant: "success" });
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        setLocation("/");
      },
      onError: (err) => {
        toast({ title: "فشل الدخول", description: err.message, variant: "destructive" });
      }
    }
  });

  const registerMutation = useRegister({
    mutation: {
      onSuccess: () => {
        toast({ title: "تم إنشاء الحساب بنجاح! حصلت على 100 نقطة فزعة.", variant: "success" });
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        setLocation("/");
      },
      onError: (err) => {
        toast({ title: "فشل التسجيل", description: err.message, variant: "destructive" });
      }
    }
  });

  const loginForm = useForm<z.infer<typeof loginSchema>>({ resolver: zodResolver(loginSchema) });
  const registerForm = useForm<z.infer<typeof registerSchema>>({ resolver: zodResolver(registerSchema) });

  const onLogin = (data: z.infer<typeof loginSchema>) => loginMutation.mutate({ data });
  const onRegister = (data: z.infer<typeof registerSchema>) => registerMutation.mutate({ data: data as any });

  return (
    <div className="min-h-screen flex bg-background font-sans rtl">
      <div className="flex-1 flex flex-col justify-center py-12 px-4 sm:px-6 lg:flex-none lg:px-20 xl:px-24">
        <div className="mx-auto w-full max-w-sm lg:w-96">
          
          <div className="mb-10 text-center lg:text-start">
            <div className="flex items-center justify-center lg:justify-start gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg">
                <span className="text-2xl font-black text-white">ن</span>
              </div>
              <h1 className="text-4xl font-black text-primary">نشمي</h1>
            </div>
            <h2 className="text-3xl font-extrabold text-foreground tracking-tight">
              {isLogin ? "مرحباً بعودتك" : "كن نشمياً معنا"}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground font-medium">
              {isLogin ? "سجل دخولك لتطلب أو تقدم الفزعة" : "سجل في تجربة نشمي المغلقة برمز دعوة"}
            </p>
          </div>

          <Card className="p-8 border-border/50 shadow-2xl shadow-primary/5 rounded-[2rem]">
            {isLogin ? (
              <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-6">
                <div>
                  <Label>البريد الجامعي / الإلكتروني</Label>
                  <Input {...loginForm.register("email")} placeholder="name@university.edu" dir="ltr" className="text-left" />
                  {loginForm.formState.errors.email && <p className="text-red-500 text-xs mt-1">{loginForm.formState.errors.email.message}</p>}
                </div>
                <div>
                  <Label>كلمة المرور</Label>
                  <Input type="password" {...loginForm.register("password")} placeholder="••••••••" dir="ltr" className="text-left" />
                </div>
                <Button type="submit" className="w-full" isLoading={loginMutation.isPending}>
                  دخول
                  <ArrowLeft className="w-5 h-5 mr-2" />
                </Button>
              </form>
            ) : (
              <form onSubmit={registerForm.handleSubmit(onRegister)} className="space-y-5">
                <div>
                  <Label>الاسم الكامل</Label>
                  <Input {...registerForm.register("name")} placeholder="نشمي الأردني" />
                </div>
                <div>
                  <Label>البريد الجامعي</Label>
                  <Input {...registerForm.register("email")} placeholder="name@university.edu" dir="ltr" className="text-left" />
                </div>
                <div>
                  <Label>كلمة المرور</Label>
                  <Input type="password" {...registerForm.register("password")} placeholder="••••••••" dir="ltr" className="text-left" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>الجامعة</Label>
                    <Input {...registerForm.register("university")} placeholder="مثال: الأردنية" />
                  </div>
                  <div>
                    <Label>التخصص</Label>
                    <Input {...registerForm.register("major")} placeholder="علم حاسوب" />
                  </div>
                </div>
                <div><Label>رمز دعوة التجربة (إذا طُلب منك)</Label>
                  <Input {...registerForm.register("inviteCode")} placeholder="رمز الدعوة" /></div>
                <div>
                  <Label>مهاراتك (اكتبها بحرية، سنقوم بتصنيفها ذكياً)</Label>
                  <Input {...registerForm.register("skills")} placeholder="أجيد برمجة المواقع، والتصميم بالفوتوشوب..." />
                </div>
                <Button type="submit" className="w-full" isLoading={registerMutation.isPending}>
                  إنشاء حساب
                </Button>
              </form>
            )}

            <div className="mt-8 text-center">
              <button
                onClick={() => setIsLogin(!isLogin)}
                className="text-sm font-bold text-primary hover:text-primary/80 transition-colors"
              >
                {isLogin ? "لا تملك حساباً؟ سجل الآن" : "لديك حساب؟ سجل الدخول"}
              </button>
            </div>
          </Card>
          
          {!isLogin && (
             <div className="mt-6 flex items-center justify-center gap-2 text-sm text-emerald-600 font-bold bg-emerald-50 py-3 px-4 rounded-xl">
               <CheckCircle2 className="w-5 h-5" />
               ستحصل على 100 نقطة فزعة بمجرد التسجيل
             </div>
          )}

        </div>
      </div>
      
      {/* Right side background (RTL so it's on left visually) */}
      <div className="hidden lg:block relative w-0 flex-1 bg-primary overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-primary/90 to-primary/40 z-10 Mix-blend-multiply" />
        <img
          className="absolute inset-0 h-full w-full object-cover opacity-60"
          src={`${import.meta.env.BASE_URL}images/auth-bg.png`}
          alt="University life"
        />
        <div className="absolute inset-0 z-20 flex flex-col justify-end p-24 text-white">
          <h2 className="text-5xl font-black mb-6 leading-tight">فزعة النشامى...<br/><span className="text-secondary">اقتصاد تشاركي</span> ذكي</h2>
          <p className="text-xl font-medium opacity-90 max-w-lg leading-relaxed">
            منصة تجمع طلاب الجامعات لتبادل المهارات والخدمات باستخدام نظام النقاط. اطلب ما ينقصك، وقدم ما تتقنه.
          </p>
        </div>
      </div>
    </div>
  );
}


import { useLocation } from "wouter";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useCreateService } from "@workspace/api-client-react";
import { Input, Button, Label, Card, Textarea } from "@/components/ui";
import { CATEGORIES } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import {
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Pencil,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

const schema = z.object({
  title: z.string().trim().min(5, "العنوان يجب أن يكون 5 أحرف على الأقل").max(120),
  description: z.string().trim().min(20, "الوصف يجب أن يكون 20 حرفًا على الأقل").max(5000),
  category: z.string().min(1, "اختر التصنيف"),
  urgency: z.enum(["low", "medium", "high"]),
  restrictToUniversity: z.boolean().default(false),
  restrictToMajor: z.boolean().default(false),
  deadline: z.string().min(1, "حدد موعد إنجاز الخدمة"),
  offersDeadline: z.string().min(1, "حدد آخر موعد لاستقبال العروض"),
});

type FormValues = z.infer<typeof schema>;

type Preview = {
  status: string;
  original: {
    title: string;
    description: string;
  };
  suggested: {
    title: string;
    description: string;
  } | null;
  issues: {
    code: string;
    message: string;
  }[];
  canonical_concepts: string[];
  publishable: boolean;
  approvalToken: string | null;
  suggested_category?: string;
  suggested_skills?: string[];
};

type Stage = "write" | "review" | "details";

export default function CreateServicePage() {
  const [, setLocation] = useLocation();

  const [stage, setStage] = useState<Stage>("write");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [approved, setApproved] = useState(false);
  const [needsRecheck, setNeedsRecheck] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState("");

  const requestId = useRef(0);

  const { mutate: create, isPending } = useCreateService({
    mutation: {
      onSuccess: (data) => {
        toast({
          title: "تم نشر طلب الفزعة!",
          description: "أصبح بإمكان الطلاب تقديم عروضهم بالنقاط.",
          variant: "success",
        });
        setLocation(`/services/${data.id}`);
      },
      onError: (err) => {
        toast({
          title: "تعذّر النشر",
          description: err.message,
          variant: "destructive",
        });
      },
    },
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      description: "",
      category: "",
      urgency: "medium",
      restrictToUniversity: false,
      restrictToMajor: false,
      deadline: "",
      offersDeadline: "",
    },
  });

  // Any edit invalidates the previous scan.
  function invalidateScan() {
    requestId.current += 1;
    setPreview(null);
    setApproved(false);
    setNeedsRecheck(true);
    setAnalyzeError("");
    setAnalyzing(false);
  }

  function editText(
    field: "title" | "description",
    value: string
  ) {
    form.setValue(field, value, {
      shouldValidate: true,
      shouldDirty: true,
    });

    invalidateScan();
  }

  // Run the existing Python NSSS + Gemini pipeline.
  async function analyze() {
    const title = form.getValues("title").trim();
    const description = form.getValues("description").trim();
    const category = form.getValues("category");

    if (title.length < 5 || description.length < 20 || !category) {
      setAnalyzeError(
        "اكتب عنوانًا ووصفًا واضحين واختر التصنيف قبل الفحص."
      );
      return;
    }

    const id = ++requestId.current;

    setApproved(false);
    setPreview(null);
    setAnalyzeError("");
    setAnalyzing(true);

    try {
      const response = await fetch("/api/services/analyze-draft", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          description,
          category,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message || "تعذّر فحص الطلب حاليًا."
        );
      }

      // Ignore an old response if the user edited the text.
      if (id !== requestId.current) return;

      const next = result as Preview;

      setPreview(next);
      setNeedsRecheck(false);
      setStage("review");

      if (next.publishable && next.suggested) {
        form.setValue("title", next.suggested.title, {
          shouldValidate: true,
        });

        form.setValue(
          "description",
          next.suggested.description,
          {
            shouldValidate: true,
          }
        );
      }
    } catch (err) {
      if (id === requestId.current) {
        setAnalyzeError(
          err instanceof Error
            ? err.message
            : "تعذّر فحص الطلب."
        );
      }
    } finally {
      if (id === requestId.current) {
        setAnalyzing(false);
      }
    }
  }

  function acceptSuggestion() {
    if (
      !preview?.publishable ||
      !preview.suggested ||
      !preview.approvalToken ||
      needsRecheck
    ) {
      return;
    }

    const sameTitle =
      form.getValues("title") === preview.suggested.title;

    const sameDescription =
      form.getValues("description") ===
      preview.suggested.description;

    if (!sameTitle || !sameDescription) {
      invalidateScan();
      return;
    }

    setApproved(true);
    setStage("details");
  }

  function publish(data: FormValues) {
    if (
      !approved ||
      !preview?.publishable ||
      !preview.suggested ||
      !preview.approvalToken ||
      needsRecheck ||
      data.title !== preview.suggested.title ||
      data.description !== preview.suggested.description
    ) {
      toast({
        title: "يجب إعادة فحص النص واعتماده قبل النشر",
        variant: "destructive",
      });

      setStage("review");
      return;
    }

    const deadline = new Date(data.deadline);
    const offersDeadline = new Date(data.offersDeadline);

    if (
      !Number.isFinite(deadline.getTime()) ||
      !Number.isFinite(offersDeadline.getTime()) ||
      offersDeadline <= new Date() ||
      offersDeadline >= deadline
    ) {
      toast({
        title:
          "يجب أن تنتهي العروض قبل موعد إنجاز الخدمة، وأن تكون المواعيد مستقبلية",
        variant: "destructive",
      });
      return;
    }

    create({
      data: {
        ...data,
        deadline: deadline.toISOString(),
        offersDeadline: offersDeadline.toISOString(),
        originalTitle: preview.original.title,
        originalDescription: preview.original.description,
        nsssApprovalToken: preview.approvalToken,
      } as any,
    });
  }

  return (
    <div className="max-w-3xl mx-auto py-8" dir="rtl">
      <div className="mb-7 text-center">
        <h1 className="text-3xl font-black text-primary mb-2">
          اطلب فزعة جديدة
        </h1>

        <p className="text-muted-foreground">
          اكتب طلبك، وافق على صياغته بعد فحص NSSS،
          ثم حدد مواعيد المناقصة.
        </p>
      </div>

      {/* Progress steps */}
      <div className="mb-6 grid grid-cols-3 gap-2 text-center text-sm font-bold">
        {(
          [
            ["write", "1. كتابة الطلب"],
            ["review", "2. فحص NSSS"],
            ["details", "3. تفاصيل النشر"],
          ] as const
        ).map(([key, label]) => (
          <div
            key={key}
            className={`rounded-xl px-2 py-3 border ${
              stage === key
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground"
            }`}
          >
            {label}
          </div>
        ))}
      </div>

      <Card className="p-5 md:p-9 shadow-xl rounded-3xl border-primary/10">
        <form
          onSubmit={form.handleSubmit(publish)}
          className="space-y-7"
        >
          {/* STEP 1: WRITE */}
          {stage === "write" && (
            <>
              <div className="space-y-3">
                <Label>عنوان الطلب</Label>

                <Input
                  value={form.watch("title")}
                  onChange={(e) =>
                    editText("title", e.target.value)
                  }
                  placeholder="مثال: أحتاج مساعدة في مادة الخوارزميات"
                />

                {form.formState.errors.title && (
                  <p className="text-red-600 text-xs">
                    {form.formState.errors.title.message}
                  </p>
                )}

                <Label>الوصف التفصيلي</Label>

                <Textarea
                  value={form.watch("description")}
                  onChange={(e) =>
                    editText("description", e.target.value)
                  }
                  className="min-h-32"
                  placeholder="اشرح الخدمة المطلوبة بالتفصيل..."
                />

                {form.formState.errors.description && (
                  <p className="text-red-600 text-xs">
                    {form.formState.errors.description.message}
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <Label>التصنيف</Label>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {CATEGORIES.map((cat) => (
                    <label
                      key={cat.id}
                      className="cursor-pointer"
                    >
                      <input
                        type="radio"
                        className="peer sr-only"
                        name="request-category"
                        checked={
                          form.watch("category") === cat.id
                        }
                        onChange={() => {
                          form.setValue("category", cat.id, {
                            shouldValidate: true,
                          });
                          invalidateScan();
                        }}
                      />

                      <div className="border-2 rounded-xl p-3 text-sm text-center font-bold peer-checked:border-primary peer-checked:bg-primary/10">
                        {cat.icon} {cat.id}
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {analyzeError && (
                <p
                  role="alert"
                  className="text-red-600 text-sm"
                >
                  {analyzeError}
                </p>
              )}

              <Button
                type="button"
                className="w-full"
                onClick={analyze}
                disabled={analyzing}
              >
                <Sparkles className="w-4 h-4 ml-2" />
                {analyzing
                  ? "جارٍ فحص الطلب..."
                  : "التحقق من الطلب"}
              </Button>
            </>
          )}

          {/* STEP 2: NSSS REVIEW */}
          {stage === "review" && (
            <>
              <div className="space-y-2">
                <h2 className="font-bold text-xl flex gap-2 items-center">
                  <Sparkles className="w-5 h-5" />
                  مراجعة NSSS
                </h2>

                <p className="text-sm text-muted-foreground">
                  اضغط على أي نص لتعديله. أي تغيير
                  يستلزم إعادة الفحص قبل الموافقة.
                </p>
              </div>

              {preview?.issues &&
                preview.issues.length > 0 && (
                  <div className="rounded-xl border border-amber-400/50 p-4 space-y-2">
                    <p className="font-bold flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      ملاحظات الفحص
                    </p>

                    {preview.issues.map((item, i) => (
                      <p
                        key={`${item.code}-${i}`}
                        className="text-sm"
                      >
                        {item.message}
                      </p>
                    ))}
                  </div>
                )}

              {preview &&
                !preview.publishable &&
                preview.issues.length === 0 && (
                  <p className="text-red-600 text-sm">
                    لم يجتز النص الفحص. عدّله ثم أعد المحاولة.
                  </p>
                )}

              <div className="space-y-3">
                <Label>
                  العنوان{" "}
                  {preview?.publishable
                    ? "المقترح"
                    : "الذي يحتاج إلى تعديل"}
                </Label>

                <div className="relative">
                  <Input
                    value={form.watch("title")}
                    onChange={(e) =>
                      editText("title", e.target.value)
                    }
                    className="pl-10"
                  />

                  <Pencil className="w-4 h-4 absolute left-3 top-3 text-muted-foreground pointer-events-none" />
                </div>

                <Label>
                  الوصف{" "}
                  {preview?.publishable
                    ? "المقترح"
                    : "الذي يحتاج إلى تعديل"}
                </Label>

                <div className="relative">
                  <Textarea
                    value={form.watch("description")}
                    onChange={(e) =>
                      editText("description", e.target.value)
                    }
                    className="min-h-32 pl-10"
                  />

                  <Pencil className="w-4 h-4 absolute left-3 top-3 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              {preview?.publishable &&
                preview.canonical_concepts.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    المفاهيم:{" "}
                    {preview.canonical_concepts.join("، ")}
                  </p>
                )}

              {needsRecheck && (
                <p className="text-amber-700 text-sm font-semibold">
                  تم تعديل النص؛ يلزم إجراء فحص جديد.
                </p>
              )}

              {analyzeError && (
                <p
                  role="alert"
                  className="text-red-600 text-sm"
                >
                  {analyzeError}
                </p>
              )}

              {preview?.publishable &&
              preview.suggested &&
              preview.approvalToken &&
              !needsRecheck ? (
                <Button
                  type="button"
                  className="w-full"
                  onClick={acceptSuggestion}
                >
                  <CheckCircle2 className="w-4 h-4 ml-2" />
                  أوافق على النص المقترح وأتابع
                </Button>
              ) : (
                <Button
                  type="button"
                  className="w-full"
                  onClick={analyze}
                  disabled={analyzing}
                >
                  {analyzing
                    ? "جارٍ إعادة الفحص..."
                    : "إعادة فحص النص"}
                </Button>
              )}

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => setStage("write")}
              >
                رجوع
              </Button>
            </>
          )}

          {/* STEP 3: PUBLISH DETAILS */}
          {stage === "details" && (
            <>
              <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-4 space-y-2">
                <p className="font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5" />
                  تمت الموافقة على صياغة الطلب
                </p>

                <p className="text-sm font-semibold">
                  {form.getValues("title")}
                </p>

                <p className="text-sm text-muted-foreground">
                  {form.getValues("description")}
                </p>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setApproved(false);
                    setStage("review");
                  }}
                >
                  تعديل النص (يتطلب إعادة فحص إذا تغيّر)
                </Button>
              </div>

              <div className="space-y-3">
                <h2 className="font-bold text-lg">
                  مواعيد الطلب
                </h2>

                <p className="text-sm text-muted-foreground">
                  يجب أن ينتهي استقبال العروض قبل
                  الموعد النهائي للخدمة.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>
                      آخر موعد لاستقبال العروض
                    </Label>

                    <Input
                      type="datetime-local"
                      {...form.register("offersDeadline")}
                    />

                    {form.formState.errors.offersDeadline && (
                      <p className="text-red-600 text-xs">
                        {
                          form.formState.errors.offersDeadline
                            .message
                        }
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>
                      آخر موعد لإنجاز الخدمة
                    </Label>

                    <Input
                      type="datetime-local"
                      {...form.register("deadline")}
                    />

                    {form.formState.errors.deadline && (
                      <p className="text-red-600 text-xs">
                        {form.formState.errors.deadline.message}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <Label>مدى الاستعجال</Label>

                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      ["low", "عادي"],
                      ["medium", "متوسط"],
                      ["high", "عاجل"],
                    ] as const
                  ).map(([value, label]) => (
                    <label
                      key={value}
                      className="cursor-pointer"
                    >
                      <input
                        type="radio"
                        className="peer sr-only"
                        value={value}
                        {...form.register("urgency")}
                      />

                      <div className="rounded-xl border-2 p-3 text-center text-sm font-bold peer-checked:border-primary peer-checked:bg-primary/10">
                        {label}
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-3 bg-muted/30 rounded-2xl border p-4">
                <h2 className="font-bold flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5" />
                  دوائر الثقة
                </h2>

                <label className="flex items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    {...form.register("restrictToUniversity")}
                  />
                  حصر الطلب داخل جامعتي فقط
                </label>

                <label className="flex items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    {...form.register("restrictToMajor")}
                  />
                  حصر الطلب داخل تخصصي فقط
                </label>
              </div>

              <p className="text-sm text-muted-foreground">
                سيتقدم مقدمو الخدمات بعروضهم بالنقاط،
                وأنت تختار العرض المناسب. لا يوجد تسعير آلي.
              </p>

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStage("review")}
                >
                  <ArrowRight className="w-4 h-4 ml-1" />
                  رجوع
                </Button>

                <Button
                  type="submit"
                  className="flex-1"
                  disabled={
                    isPending ||
                    !approved ||
                    needsRecheck
                  }
                  isLoading={isPending}
                >
                  انشر طلب الفزعة
                </Button>
              </div>
            </>
          )}
        </form>
      </Card>
    </div>
  );
}


import {
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { z } from "zod/v4";

// ============================================================
// 1. INPUT VALIDATION
// ============================================================

export const nsssDraftSchema = z.object({
  title: z.string().trim().min(5).max(120),
  description: z.string().trim().min(20).max(5000),
  category: z.string().max(100).optional(),
});

const issueSchema = z.object({
  code: z.string(),
  message: z.string(),
});

// Preserve the Python classification and skills fields.
export const nsssResultSchema = z.object({
  status: z.string(),
  publishable: z.boolean(),

  original: z.object({
    title: z.string(),
    description: z.string(),
  }),

  suggested: z.object({
    title: z.string(),
    description: z.string(),
  }).nullable(),

  canonical_concepts: z.array(z.string()),
  issues: z.array(issueSchema),

  model_status: z.record(z.string(), z.string()),

  suggested_category: z.string().optional(),
  suggested_skills: z.array(z.string()).optional(),
  needs_category_review: z.boolean().optional(),
  category_method: z.string().optional(),
  skills_method: z.string().optional(),
});

export type NSSSResult = z.infer<
  typeof nsssResultSchema
>;

type NSSSDraft = z.infer<typeof nsssDraftSchema>;

// ============================================================
// 2. GEMINI OUTPUT
// ============================================================

const geminiResultSchema = z.object({
  verdict: z.enum([
    "approved",
    "offensive",
    "random_text",
    "not_a_request",
    "unrelated_description",
    "insufficient_details",
  ]),

  reason: z.string(),

  suggested_title: z.string(),
  suggested_description: z.string(),
});

// ============================================================
// 3. CONFIGURATION
// ============================================================

const secret =
  process.env.NSSS_APPROVAL_SECRET ||
  randomBytes(32).toString("hex");

const pythonBase =
  process.env.NSSS_SERVICE_URL ||
  process.env.ML_SERVICE_URL ||
  "http://127.0.0.1:8001";

const geminiModel =
  process.env.NSSS_GEMINI_MODEL ||
  "gemini-3.1-flash-lite";

// Read the API key when Gemini is called.
function getGeminiKey(): string {
  const key =
    process.env.AI_INTEGRATIONS_GEMINI_API_KEY ||
    process.env.GEMINI_API_KEY;

  if (!key) {
    throw new Error(
      "NSSS Gemini API key is missing"
    );
  }

  return key;
}

// ============================================================
// 4. PYTHON NSSS
// HAYAA + E5 + RapidFuzz + Canonical Dictionary
// ============================================================

async function analyzeWithPython(
  input: NSSSDraft
): Promise<NSSSResult> {
  console.log(
    "[NSSS] Starting Python analysis..."
  );

  const controller = new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    Number(
      process.env.NSSS_TIMEOUT_MS || 180000
    )
  );

  try {
    const response = await fetch(
      `${pythonBase.replace(/\/$/, "")}/v1/semantic-services/analyze`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
        signal: controller.signal,
      }
    );

    if (!response.ok) {
      throw new Error(
        `NSSS Python HTTP ${response.status}`
      );
    }

    const result = nsssResultSchema.parse(
      await response.json()
    );

    console.log(
      "[NSSS] Python completed:",
      result.model_status
    );

    return result;
  } catch (error) {
    console.error(
      "[NSSS] Python analysis failed:",
      error
    );

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

// ============================================================
// 5. ORIGINAL GEMINI PROMPT
// ============================================================

const GEMINI_INSTRUCTIONS = `
أنت مراجع جودة ومحتوى لمنصة "نشمي"، وهي منصة لطلب الخدمات بين طلّاب الجامعات في الأردن.

ستستقبل عنوان طلب ووصفه وتصنيفه.

مهمتك:

1. افحص العنوان والوصف بحثًا عن الشتائم والإهانات والإساءة الموجهة للأشخاص أو المجموعات.
   لا تعتبر مجرد ذكر كلمة مسيئة ضمن سياق تعليمي إساءة تلقائيًا؛ افهم السياق.

2. تحقق أن العنوان والوصف نصوص مفهومة وليست أحرفًا عشوائية أو كلمات بلا معنى.

3. تحقق أن العنوان يشير إلى طلب خدمة حقيقي يمكن لطالب آخر تقديمها.

4. تحقق أن الوصف مرتبط بالعنوان.

5. تحقق أن الوصف يحتوي معلومات كافية لفهم المطلوب.
   إذا كانت التفاصيل الأساسية ناقصة، اطلب توضيحًا.

6. صحح الأخطاء الإملائية والمصطلحات الواضحة بالاعتماد على السياق.
   مثال: "بدي شرح القورثم" أو "بدي شرح الغورثم"
   تصبح "أحتاج إلى شرح الخوارزميات".

7. أعد صياغة العنوان والوصف بلغة عربية واضحة وطبيعية،
   مع الحفاظ على نية المستخدم.
   لا تضف متطلبات أو تفاصيل لم يذكرها المستخدم.

8. لا تغيّر التصنيف ولا تخترع سعرًا أو نقاطًا.

اختر verdict واحدًا فقط من:

approved
offensive
random_text
not_a_request
unrelated_description
insufficient_details

إذا كان النص صالحًا بعد تصحيح الصياغة، استخدم approved.

إذا كان غير صالح، أرجع سببًا واضحًا بالعربية.

أرجع JSON فقط بهذا الشكل:

{
  "verdict": "approved",
  "reason": "النص واضح ومناسب",
  "suggested_title": "العنوان المقترح",
  "suggested_description": "الوصف المقترح"
}
`;

// ============================================================
// 6. GEMINI ANALYSIS
// ============================================================

async function analyzeWithGemini(
  input: NSSSDraft
) {
  const key = getGeminiKey();

  console.log(
    "[NSSS] Starting Gemini analysis..."
  );

  const controller = new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    45000
  );

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiModel)}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": key,
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [
              {
                text: GEMINI_INSTRUCTIONS,
              },
            ],
          },

          contents: [
            {
              role: "user",
              parts: [
                {
                  text: JSON.stringify(input),
                },
              ],
            },
          ],

          generationConfig: {
            temperature: 0,
            responseMimeType:
              "application/json",
          },
        }),

        signal: controller.signal,
      }
    );

    if (!response.ok) {
      const details = await response
        .text()
        .catch(() => "");

      throw new Error(
        `Gemini HTTP ${response.status}: ${details.slice(0, 400)}`
      );
    }

    const data = (await response.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{
            text?: string;
          }>;
        };
      }>;
    };

    const text = data.candidates?.[0]
      ?.content?.parts
      ?.map((part) => part.text || "")
      .join("");

    if (!text) {
      throw new Error(
        "Gemini returned an empty response"
      );
    }

    const parsed = geminiResultSchema.parse(
      JSON.parse(text)
    );

    console.log(
      "[NSSS] Gemini completed. Verdict:",
      parsed.verdict
    );

    return parsed;
  } catch (error) {
    console.error(
      "[NSSS] Gemini analysis failed:",
      error
    );

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

// ============================================================
// 7. MAIN NSSS PIPELINE
// ============================================================

export async function analyzeNSSS(
  input: NSSSDraft
): Promise<NSSSResult> {
  const draft = nsssDraftSchema.parse(input);

  // STEP 1: Mandatory Python screening.
  const pythonResult =
    await analyzeWithPython(draft);

  // Never let Gemini override a Python rejection.
  if (
    !pythonResult.publishable ||
    !pythonResult.suggested
  ) {
    console.log(
      "[NSSS] Rejected by Python."
    );

    return {
      ...pythonResult,
      model_status: {
        ...pythonResult.model_status,
        gemini: "skipped_python_rejected",
      },
    };
  }

  // STEP 2: Mandatory Gemini validation.
  const geminiResult =
    await analyzeWithGemini(draft);

  // Gemini must explicitly approve.
  if (
    geminiResult.verdict !== "approved"
  ) {
    console.log(
      "[NSSS] Rejected by Gemini:",
      geminiResult.reason
    );

    return {
      ...pythonResult,

      status: "rejected",
      publishable: false,
      suggested: null,

      issues: [
        ...pythonResult.issues,
        {
          code:
            `gemini_${geminiResult.verdict}`,
          message:
            geminiResult.reason.trim() ||
            "يرجى توضيح الطلب وإعادة فحصه.",
        },
      ],

      model_status: {
        ...pythonResult.model_status,
        gemini: "rejected",
      },
    };
  }

  // STEP 3: Validate Gemini's suggested text.
  const suggestedTitle =
    geminiResult.suggested_title.trim();

  const suggestedDescription =
    geminiResult.suggested_description.trim();

  const suggestionValidation =
    nsssDraftSchema.safeParse({
      title: suggestedTitle,
      description: suggestedDescription,
      category: draft.category,
    });

  if (!suggestionValidation.success) {
    return {
      ...pythonResult,

      status: "needs_revision",
      publishable: false,
      suggested: null,

      issues: [
        ...pythonResult.issues,
        {
          code: "gemini_invalid_suggestion",
          message:
            "الصياغة المقترحة غير مكتملة. يرجى تعديل الطلب وإعادة الفحص.",
        },
      ],

      model_status: {
        ...pythonResult.model_status,
        gemini: "invalid_suggestion",
      },
    };
  }

  // STEP 4: Preserve Python skills and classification.
  return {
    ...pythonResult,

    status: "needs_confirmation",
    publishable: true,

    suggested: {
      title: suggestedTitle,
      description: suggestedDescription,
    },

    model_status: {
      ...pythonResult.model_status,
      gemini: "completed",
    },
  };
}

// ============================================================
// 8. APPROVAL SECURITY
// ============================================================

// One valid approval per user per API process.
// Valid for 15 minutes.
const APPROVAL_TTL_MS =
  15 * 60 * 1000;

type ApprovedDraft = {
  signature: string;
  category: string;

  originalTitle: string;
  originalDescription: string;

  publicTitle: string;
  publicDescription: string;

  canonicalConcepts: string[];

  expiresAt: number;
};

const latestApprovals =
  new Map<number, ApprovedDraft>();

function approvalPayload(
  userId: number,
  category: string,

  originalTitle: string,
  originalDescription: string,

  publicTitle: string,
  publicDescription: string,

  expiresAt: number
) {
  return JSON.stringify([
    userId,
    category,
    originalTitle,
    originalDescription,
    publicTitle,
    publicDescription,
    expiresAt,
  ]);
}

// ============================================================
// 9. INVALIDATE APPROVAL
// ============================================================

export function clearNSSSApproval(
  userId: number
): void {
  latestApprovals.delete(userId);
}

// ============================================================
// 10. SIGN SUCCESSFUL REVIEW
// ============================================================

export function signNSSS(
  userId: number,
  result: NSSSResult,
  category = ""
): string | null {
  // A new result invalidates any earlier scan.
  latestApprovals.delete(userId);

  if (
    !result.publishable ||
    !result.suggested ||
    result.model_status.gemini !== "completed" ||
    result.model_status.toxicity !== "completed" ||
    result.model_status.semantic !== "completed"
  ) {
    return null;
  }

  const expiresAt =
    Date.now() + APPROVAL_TTL_MS;

  const signature = createHmac(
    "sha256",
    secret
  )
    .update(
      approvalPayload(
        userId,
        category,

        result.original.title,
        result.original.description,

        result.suggested.title,
        result.suggested.description,

        expiresAt
      )
    )
    .digest("hex");

  latestApprovals.set(userId, {
    signature,
    category,

    originalTitle:
      result.original.title,

    originalDescription:
      result.original.description,

    publicTitle:
      result.suggested.title,

    publicDescription:
      result.suggested.description,

    canonicalConcepts: [
      ...result.canonical_concepts,
    ],

    expiresAt,
  });

  return signature;
}

// ============================================================
// 11. VERIFY BEFORE PUBLISHING
// ============================================================

export function verifyNSSS(
  userId: number,

  rawTitle: string,
  rawDescription: string,

  publicTitle: string,
  publicDescription: string,

  signature: string,
  category = ""
): string[] | null {
  if (
    !/^[a-f0-9]{64}$/.test(signature)
  ) {
    return null;
  }

  const saved =
    latestApprovals.get(userId);

  if (!saved) {
    return null;
  }

  if (
    Date.now() > saved.expiresAt
  ) {
    latestApprovals.delete(userId);
    return null;
  }

  // Any text or category change invalidates approval.
  if (
    saved.category !== category ||
    saved.originalTitle !== rawTitle ||
    saved.originalDescription !== rawDescription ||
    saved.publicTitle !== publicTitle ||
    saved.publicDescription !== publicDescription
  ) {
    return null;
  }

  const expected = createHmac(
    "sha256",
    secret
  )
    .update(
      approvalPayload(
        userId,
        category,

        rawTitle,
        rawDescription,

        publicTitle,
        publicDescription,

        saved.expiresAt
      )
    )
    .digest();

  const received =
    Buffer.from(signature, "hex");

  if (
    received.length !== expected.length ||
    !timingSafeEqual(
      expected,
      received
    )
  ) {
    return null;
  }

  return [
    ...saved.canonicalConcepts,
  ];
}

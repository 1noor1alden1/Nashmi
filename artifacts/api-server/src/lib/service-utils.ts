// General platform helpers retained after retiring automated price estimation.
import { ai } from "@workspace/integrations-gemini-ai";

export async function verifyProofWithAI(
  serviceDescription: string,
  proofContent: string,
  proofType: string
): Promise<{ relevanceScore: number; analysis: string; isValid: boolean }> {
  try {
    const prompt = `أنت نظام تحقق ذكي للتأكد من إنجاز الخدمات الأكاديمية.

وصف الخدمة المطلوبة:
"${serviceDescription}"

الإنجاز المقدم (${proofType}):
"${proofContent}"

قيّم مدى صلة الإنجاز بالطلب من 0 إلى 100، وحدد:
- هل الإنجاز ذو صلة حقيقية بالطلب؟
- هل يبدو عملاً فعلياً وليس محتوى عشوائياً؟

أجب بصيغة JSON فقط:
{"relevanceScore": <0-100>, "analysis": "<تحليل مختصر بالعربية>", "isValid": <true/false>}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { maxOutputTokens: 300, responseMimeType: "application/json" },
    });

    const text = response.text ?? '{"relevanceScore": 50, "analysis": "لا يمكن التحقق", "isValid": false}';
    const cleaned = text.replace(/```json\n?|\n?```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    return {
      relevanceScore: typeof parsed.relevanceScore === "number" && Number.isFinite(parsed.relevanceScore) ? Math.max(0, Math.min(100, parsed.relevanceScore)) : 0,
      analysis: parsed.analysis || "لا يمكن التحقق",
      isValid: typeof parsed.relevanceScore === "number" && Number.isFinite(parsed.relevanceScore) && parsed.relevanceScore >= 60,
    };
  } catch {
    return { relevanceScore: 0, analysis: "فشل التحقق التلقائي", isValid: false };
  }
}

export async function findSemanticSkillMatches(
  requestDescription: string,
  category: string
): Promise<string[]> {
  try {
    const prompt = `أنت خبير في تصنيف المهارات.

الطلب: "${requestDescription}" (تصنيف: ${category})

ما هي المهارات والتخصصات القريبة معنوياً من هذا الطلب؟
مثال: إذا طلب شخص "Data Science"، المهارات القريبة هي: Python, R, إحصاء, رياضيات, تحليل بيانات

أجب بصيغة JSON فقط - قائمة كلمات عربية أو إنجليزية:
{"skills": ["مهارة1", "مهارة2", "مهارة3", "مهارة4", "مهارة5"]}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { maxOutputTokens: 200, responseMimeType: "application/json" },
    });

    const text = response.text ?? '{"skills": []}';
    const cleaned = text.replace(/```json\n?|\n?```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return parsed.skills || [];
  } catch {
    return [];
  }
}

export function parseSkillTags(skillsText: string): string[] {
  if (!skillsText) return [];

  const skillKeywords = [
    "برمجة", "تصميم", "ترجمة", "شرح", "تحرير", "أبحاث",
    "جافاسكريبت", "بايثون", "Python", "JavaScript", "React", "Node",
    "HTML", "CSS", "Java", "C++", "Swift", "Flutter", "Dart",
    "تصوير", "فيديو", "مونتاج", "Photoshop", "Figma", "Illustrator",
    "إنجليزي", "عربي", "فرنسي",
    "رياضيات", "فيزياء", "كيمياء", "أحياء", "إحصاء",
    "محاسبة", "اقتصاد", "إدارة", "تسويق", "قانون", "طب", "هندسة",
    "Data Science", "Machine Learning", "AI", "ذكاء اصطناعي",
    "كتابة", "صحافة", "رسم", "موسيقى",
  ];

  const tags = new Set<string>();
  skillKeywords.forEach(k => {
    if (skillsText.toLowerCase().includes(k.toLowerCase())) tags.add(k);
  });

  const words = skillsText.split(/[\s,،.]+/);
  words.forEach(w => { if (w.length > 2 && w.length < 20) tags.add(w.trim()); });

  return Array.from(tags).slice(0, 10);
}

export function calculateLevel(totalServicesGiven: number): "مستجد" | "فزّاع" | "حكيم" {
  if (totalServicesGiven >= 15) return "حكيم";
  if (totalServicesGiven >= 5) return "فزّاع";
  return "مستجد";
}

export function calculateTrustScore(
  averageRating: number | null,
  totalServices: number,
  loanBalance: number,
  withdrawalPenalties: number = 0
): number {
  let score = 50;
  if (averageRating) score += (averageRating - 3) * 10;
  score += Math.min(totalServices * 2, 30);
  score -= loanBalance * 0.5;
  score -= withdrawalPenalties * 8; // كل انسحاب يخصم 8 نقاط ثقة
  return Math.max(0, Math.min(100, parseFloat(score.toFixed(1))));
}

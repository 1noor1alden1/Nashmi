import { db, skillsTable, activityFeedTable } from "@workspace/db";

const skills = [
  // برمجة
  { name: "برمجة", parent: null, category: "تقنية", aliases: ["coding", "programming"], relatedSkills: ["Python", "JavaScript", "Java"], difficultyLevel: 5 },
  { name: "Python", parent: "برمجة", category: "تقنية", aliases: ["بايثون", "py"], relatedSkills: ["Data Science", "ذكاء اصطناعي", "تعلم آلي"], difficultyLevel: 4 },
  { name: "JavaScript", parent: "برمجة", category: "تقنية", aliases: ["جافاسكريبت", "JS"], relatedSkills: ["React", "Node.js", "TypeScript"], difficultyLevel: 4 },
  { name: "React", parent: "JavaScript", category: "تقنية", aliases: ["ريآكت", "ReactJS"], relatedSkills: ["JavaScript", "TypeScript", "Next.js"], difficultyLevel: 5 },
  { name: "Node.js", parent: "JavaScript", category: "تقنية", aliases: ["nodejs", "node"], relatedSkills: ["JavaScript", "Express", "APIs"], difficultyLevel: 5 },
  { name: "Java", parent: "برمجة", category: "تقنية", aliases: ["جافا"], relatedSkills: ["Spring", "Android", "OOP"], difficultyLevel: 5 },
  { name: "C++", parent: "برمجة", category: "تقنية", aliases: ["سي بلس بلس", "cpp"], relatedSkills: ["C", "هندسة حاسوب", "تحسين خوارزميات"], difficultyLevel: 7 },
  { name: "Swift", parent: "برمجة", category: "تقنية", aliases: ["سويفت", "iOS"], relatedSkills: ["iOS", "Xcode", "Flutter"], difficultyLevel: 6 },
  { name: "Flutter", parent: "برمجة", category: "تقنية", aliases: ["فلاتر", "Dart"], relatedSkills: ["Dart", "iOS", "Android", "تطبيقات موبايل"], difficultyLevel: 5 },
  { name: "Data Science", parent: "برمجة", category: "تقنية", aliases: ["علم البيانات", "data science"], relatedSkills: ["Python", "إحصاء", "تعلم آلي", "R"], difficultyLevel: 7 },
  { name: "تعلم آلي", parent: "Data Science", category: "تقنية", aliases: ["Machine Learning", "ML", "التعلم الآلي"], relatedSkills: ["Python", "ذكاء اصطناعي", "إحصاء"], difficultyLevel: 8 },
  { name: "ذكاء اصطناعي", parent: "تعلم آلي", category: "تقنية", aliases: ["AI", "Artificial Intelligence"], relatedSkills: ["تعلم آلي", "Python", "رياضيات"], difficultyLevel: 9 },
  // تصميم
  { name: "تصميم", parent: null, category: "إبداعي", aliases: ["design", "ديزاين"], relatedSkills: ["Figma", "Photoshop", "UI/UX"], difficultyLevel: 4 },
  { name: "Figma", parent: "تصميم", category: "إبداعي", aliases: ["فيجما", "UI Design"], relatedSkills: ["تصميم", "UI/UX", "Prototyping"], difficultyLevel: 4 },
  { name: "Photoshop", parent: "تصميم", category: "إبداعي", aliases: ["فوتوشوب", "PS"], relatedSkills: ["تصميم", "Illustrator", "تصوير"], difficultyLevel: 5 },
  { name: "UI/UX", parent: "تصميم", category: "إبداعي", aliases: ["user experience", "تجربة مستخدم"], relatedSkills: ["Figma", "تصميم", "أبحاث مستخدم"], difficultyLevel: 6 },
  { name: "تصوير", parent: "تصميم", category: "إبداعي", aliases: ["photography", "فوتوغرافي"], relatedSkills: ["فيديو", "مونتاج", "Lightroom"], difficultyLevel: 4 },
  { name: "مونتاج", parent: "تصوير", category: "إبداعي", aliases: ["video editing", "تحرير فيديو"], relatedSkills: ["تصوير", "Premiere Pro", "After Effects"], difficultyLevel: 5 },
  // ترجمة
  { name: "ترجمة", parent: null, category: "لغوي", aliases: ["translation"], relatedSkills: ["إنجليزي", "عربي", "تحرير"], difficultyLevel: 4 },
  { name: "إنجليزي", parent: "ترجمة", category: "لغوي", aliases: ["English", "اللغة الإنجليزية"], relatedSkills: ["ترجمة", "كتابة", "IELTS"], difficultyLevel: 4 },
  { name: "فرنسي", parent: "ترجمة", category: "لغوي", aliases: ["French", "اللغة الفرنسية"], relatedSkills: ["ترجمة", "لغات أوروبية"], difficultyLevel: 5 },
  // شرح دروس
  { name: "شرح دروس", parent: null, category: "أكاديمي", aliases: ["tutoring", "تدريس", "دروس خصوصية"], relatedSkills: ["رياضيات", "فيزياء", "كيمياء"], difficultyLevel: 3 },
  { name: "رياضيات", parent: "شرح دروس", category: "أكاديمي", aliases: ["math", "حساب", "جبر"], relatedSkills: ["إحصاء", "فيزياء", "تفاضل وتكامل"], difficultyLevel: 6 },
  { name: "فيزياء", parent: "شرح دروس", category: "أكاديمي", aliases: ["physics"], relatedSkills: ["رياضيات", "كيمياء", "هندسة"], difficultyLevel: 7 },
  { name: "كيمياء", parent: "شرح دروس", category: "أكاديمي", aliases: ["chemistry"], relatedSkills: ["فيزياء", "أحياء", "طب"], difficultyLevel: 6 },
  { name: "إحصاء", parent: "رياضيات", category: "أكاديمي", aliases: ["statistics", "إحصاء وتحليل"], relatedSkills: ["Data Science", "رياضيات", "SPSS"], difficultyLevel: 6 },
  // أبحاث
  { name: "أبحاث", parent: null, category: "أكاديمي", aliases: ["research", "بحث علمي"], relatedSkills: ["كتابة", "ترجمة", "إحصاء"], difficultyLevel: 5 },
  { name: "كتابة", parent: "أبحاث", category: "أكاديمي", aliases: ["writing", "تأليف", "تحرير محتوى"], relatedSkills: ["أبحاث", "ترجمة", "صحافة"], difficultyLevel: 3 },
  // أعمال
  { name: "محاسبة", parent: null, category: "أعمال", aliases: ["accounting", "حسابات"], relatedSkills: ["اقتصاد", "إدارة", "Excel"], difficultyLevel: 5 },
  { name: "تسويق", parent: null, category: "أعمال", aliases: ["marketing", "ديجيتال ماركتينج"], relatedSkills: ["إدارة", "تصميم", "كتابة"], difficultyLevel: 4 },
  { name: "قانون", parent: null, category: "أعمال", aliases: ["law", "فقه"], relatedSkills: ["أبحاث", "كتابة"], difficultyLevel: 7 },
];

const activityEntries = [
  { message: "نشمي أنجز خدمة شرح مادة Python لطالب في جامعة الملك سعود", category: "برمجة" },
  { message: "تبادل مهاري: تصميم شعار مقابل ترجمة بحث علمي", category: "تصميم" },
  { message: "نشمي أنجز 3 خدمات اليوم وارتقى لمستوى فزّاع!", category: "شرح دروس" },
  { message: "طالبة من جامعة الملك عبدالعزيز نشرت طلب مساعدة في Data Science", category: "برمجة" },
  { message: "تم تسليم مشروع Flutter بنجاح مقابل 35 نقطة", category: "برمجة" },
  { message: "نشمي أنجز ترجمة بحث من 20 صفحة في يوم واحد", category: "ترجمة" },
  { message: "شرح مادة إحصاء لمجموعة طلاب: 5 طلاب استفادوا", category: "شرح دروس" },
];

async function seedSkills() {
  console.log("🌱 Seeding skills taxonomy...");

  await db.delete(skillsTable);

  for (const skill of skills) {
    await db.insert(skillsTable).values(skill).onConflictDoNothing();
  }

  console.log(`✅ Seeded ${skills.length} skills`);

  // Seed activity feed
  console.log("🌱 Seeding activity feed...");
  await db.delete(activityFeedTable);

  for (const entry of activityEntries) {
    await db.insert(activityFeedTable).values(entry);
  }

  console.log(`✅ Seeded ${activityEntries.length} activity entries`);
}

seedSkills()
  .then(() => { console.log("Done!"); process.exit(0); })
  .catch(err => { console.error("Error:", err); process.exit(1); });

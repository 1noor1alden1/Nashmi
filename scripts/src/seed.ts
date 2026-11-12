import { db, usersTable, servicesTable, applicationsTable, transactionsTable, notificationsTable } from "@workspace/db";
import crypto from "crypto";

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + "nashmi_salt_2024").digest("hex");
}

async function seed() {
  console.log("🌱 Seeding Nashmi database...");

  // Create sample users
  const users = await db.insert(usersTable).values([
    {
      name: "محمد العتيبي",
      email: "m.otaibi@ksu.edu.sa",
      passwordHash: hashPassword("password123"),
      university: "جامعة الملك سعود",
      major: "علوم الحاسب",
      bio: "مطور Full Stack بخبرة 3 سنوات، متخصص في React وNode.js",
      skillsText: "برمجة React Node.js Python تصميم واجهات",
      skillTags: ["برمجة", "React", "Node.js", "Python"],
      points: 240,
      level: "فزّاع" as const,
      trustScore: 78,
      totalServicesGiven: 8,
      totalServicesReceived: 3,
      averageRating: 4.7,
      isVerified: true,
    },
    {
      name: "سارة القحطاني",
      email: "s.qahtani@ksu.edu.sa",
      passwordHash: hashPassword("password123"),
      university: "جامعة الملك سعود",
      major: "التصميم الجرافيكي",
      bio: "مصممة جرافيك ومتخصصة في هوية الشركات والـ UI/UX",
      skillsText: "تصميم Figma Photoshop Illustrator هوية بصرية",
      skillTags: ["تصميم", "Figma", "UI/UX"],
      points: 180,
      level: "فزّاع" as const,
      trustScore: 85,
      totalServicesGiven: 12,
      totalServicesReceived: 5,
      averageRating: 4.9,
      isVerified: true,
    },
    {
      name: "عبدالله الدوسري",
      email: "a.dosari@kau.edu.sa",
      passwordHash: hashPassword("password123"),
      university: "جامعة الملك عبدالعزيز",
      major: "اللغة الإنجليزية",
      bio: "متخصص في الترجمة الأكاديمية والتحرير الإنجليزي",
      skillsText: "ترجمة إنجليزي عربي تحرير أبحاث أكاديمية",
      skillTags: ["ترجمة", "تحرير", "أبحاث"],
      points: 320,
      level: "حكيم" as const,
      trustScore: 92,
      totalServicesGiven: 20,
      totalServicesReceived: 8,
      averageRating: 4.8,
      isVerified: true,
    },
    {
      name: "نورة السبيعي",
      email: "noura@gmail.com",
      passwordHash: hashPassword("password123"),
      university: "جامعة الإمام",
      major: "رياضيات",
      bio: "طالبة دكتوراه في الرياضيات، أساعد في شرح المواد العلمية",
      skillsText: "شرح دروس رياضيات فيزياء إحصاء",
      skillTags: ["شرح دروس", "رياضيات", "إحصاء"],
      points: 95,
      level: "مستجد" as const,
      trustScore: 60,
      totalServicesGiven: 2,
      totalServicesReceived: 1,
      averageRating: 4.5,
      isVerified: false,
    },
    {
      name: "فيصل الحربي",
      email: "faisal@kfu.edu.sa",
      passwordHash: hashPassword("password123"),
      university: "جامعة الملك فهد",
      major: "هندسة الحاسب",
      bio: "مهندس حاسب مهتم بالأنظمة المدمجة والذكاء الاصطناعي",
      skillsText: "برمجة C++ Python Arduino ذكاء اصطناعي",
      skillTags: ["برمجة", "C++", "Python", "AI"],
      points: 150,
      level: "مستجد" as const,
      trustScore: 55,
      totalServicesGiven: 3,
      totalServicesReceived: 2,
      averageRating: 4.2,
      isVerified: true,
    },
  ]).returning();

  console.log(`✅ Created ${users.length} users`);

  // Create sample services
  const services = await db.insert(servicesTable).values([
    {
      title: "تصميم شعار احترافي لمشروع تخرجي",
      description: "أحتاج تصميم شعار عصري ومميز لمشروع تخرجي في علوم الحاسب. الشعار يجب أن يعكس الابتكار والتقنية. مرفق ملف المتطلبات التفصيلية.",
      category: "تصميم",
      urgency: "medium" as const,
      pointsPrice: 35,
      restrictToUniversity: false,
      restrictToMajor: false,
      requesterId: users[0].id,
      status: "open" as const,
    },
    {
      title: "شرح مادة خوارزميات وهياكل البيانات",
      description: "أحتاج مساعدة في فهم خوارزميات الفرز والبحث والأشجار. مستوى ثالث علوم حاسب. أفضل جلسة أونلاين مدتها ساعتين.",
      category: "شرح دروس",
      urgency: "high" as const,
      pointsPrice: 28,
      restrictToUniversity: true,
      restrictToMajor: false,
      requesterId: users[3].id,
      status: "open" as const,
    },
    {
      title: "ترجمة ورقة بحثية من الإنجليزية إلى العربية",
      description: "ورقة بحثية في مجال الذكاء الاصطناعي، عدد الصفحات 15. أحتاج ترجمة دقيقة تحافظ على المصطلحات التقنية.",
      category: "ترجمة",
      urgency: "low" as const,
      pointsPrice: 22,
      restrictToUniversity: false,
      restrictToMajor: false,
      requesterId: users[0].id,
      status: "in_progress" as const,
      providerId: users[2].id,
      escrowActive: true,
    },
    {
      title: "مراجعة وتحرير بحث تخرج",
      description: "بحث تخرج في التسويق الرقمي، 40 صفحة. أحتاج مراجعة لغوية وأسلوبية شاملة مع اقتراحات للتحسين.",
      category: "تحرير",
      urgency: "medium" as const,
      pointsPrice: 30,
      restrictToUniversity: false,
      restrictToMajor: false,
      requesterId: users[4].id,
      status: "open" as const,
    },
    {
      title: "برمجة موقع إلكتروني بسيط",
      description: "أحتاج موقع بسيط لمعرض أعمالي الشخصي باستخدام HTML, CSS, JavaScript. التصميم موجود، فقط أحتاج التنفيذ.",
      category: "برمجة",
      urgency: "low" as const,
      pointsPrice: 45,
      restrictToUniversity: false,
      restrictToMajor: false,
      requesterId: users[1].id,
      status: "open" as const,
    },
    {
      title: "إنشاء عروض تقديمية احترافية",
      description: "أحتاج تحويل 3 ملفات PDF لأبحاث إلى عروض PowerPoint احترافية وجذابة لمؤتمر أكاديمي.",
      category: "تصميم",
      urgency: "high" as const,
      pointsPrice: 25,
      restrictToUniversity: false,
      restrictToMajor: false,
      requesterId: users[3].id,
      status: "completed" as const,
      providerId: users[1].id,
    },
  ]).returning();

  console.log(`✅ Created ${services.length} services`);

  // Create applications
  await db.insert(applicationsTable).values([
    {
      serviceId: services[0].id,
      applicantId: users[1].id,
      message: "أنا مصممة متخصصة في هوية الشركات وشعارات المشاريع التقنية، أستطيع تقديم 3 مقترحات مختلفة خلال 3 أيام",
      status: "pending" as const,
    },
    {
      serviceId: services[0].id,
      applicantId: users[4].id,
      message: "عندي خبرة في تصميم الشعارات للمشاريع التقنية، سأقدم نماذج أولية خلال يوم واحد",
      status: "pending" as const,
    },
    {
      serviceId: services[1].id,
      applicantId: users[0].id,
      message: "درست الخوارزميات بدرجة A+ وأستطيع شرحها بأسلوب مبسط مع أمثلة عملية",
      status: "pending" as const,
    },
    {
      serviceId: services[3].id,
      applicantId: users[2].id,
      message: "متخصص في التحرير الأكاديمي وراجعت أكثر من 50 بحث تخرج",
      status: "pending" as const,
    },
  ]);

  console.log("✅ Created applications");

  // Create transactions
  await db.insert(transactionsTable).values([
    {
      userId: users[0].id,
      type: "bonus" as const,
      amount: 100,
      balanceAfter: 100,
      description: "رصيد ترحيبي عند التسجيل في نشمي 🎉",
    },
    {
      userId: users[0].id,
      type: "earned" as const,
      amount: 35,
      balanceAfter: 135,
      description: "أجر خدمة: شرح مادة الخوارزميات",
    },
    {
      userId: users[0].id,
      type: "earned" as const,
      amount: 45,
      balanceAfter: 180,
      description: "أجر خدمة: برمجة تطبيق موبايل",
    },
    {
      userId: users[0].id,
      type: "earned" as const,
      amount: 60,
      balanceAfter: 240,
      description: "أجر خدمة: تطوير API للمشروع",
    },
    {
      userId: users[1].id,
      type: "bonus" as const,
      amount: 100,
      balanceAfter: 100,
      description: "رصيد ترحيبي عند التسجيل في نشمي 🎉",
    },
    {
      userId: users[1].id,
      type: "earned" as const,
      amount: 80,
      balanceAfter: 180,
      description: "أجر خدمات تصميم متعددة",
    },
  ]);

  console.log("✅ Created transactions");

  // Create notifications
  await db.insert(notificationsTable).values([
    {
      userId: users[0].id,
      type: "service_match" as const,
      title: "مطابقة جديدة!",
      message: "وجدنا نشمياً يتقن ما تحتاجه. تحقق من طلبك",
      serviceId: services[0].id,
      isRead: false,
    },
    {
      userId: users[0].id,
      type: "exam_alert" as const,
      title: "تنبيه: موسم الاختبارات قادم",
      message: "بناءً على التقويم الأكاديمي، الاختبارات النهائية خلال 3 أسابيع. تزداد الطلبات في هذا الموسم!",
      isRead: false,
    },
    {
      userId: users[1].id,
      type: "service_accepted" as const,
      title: "تم قبول طلبك!",
      message: "تهانينا! تم قبولك لتقديم خدمة تصميم الشعار",
      serviceId: services[0].id,
      isRead: false,
    },
  ]);

  console.log("✅ Created notifications");
  console.log("\n🎉 Seeding complete! Test accounts:");
  console.log("   Email: m.otaibi@ksu.edu.sa | Password: password123 (فزّاع - 240 نقطة)");
  console.log("   Email: s.qahtani@ksu.edu.sa | Password: password123 (فزّاع - 180 نقطة)");
  console.log("   Email: a.dosari@kau.edu.sa | Password: password123 (حكيم - 320 نقطة)");
  console.log("   Email: noura@gmail.com | Password: password123 (مستجد - 95 نقطة)");
}

seed().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });

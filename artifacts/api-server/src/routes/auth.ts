import { Router } from "express";
import { db, usersTable, sessionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  createSession,
  deleteSession,
  getSessionUser,
  hashPassword,
  verifyPassword,
  formatUser,
} from "../lib/auth.js";
import { parseSkillTags } from "../lib/service-utils.js";
import { z } from "zod/v4";

const router = Router();

const registerSchema=z.object({
  name:z.string().trim().min(2).max(80),
  email:z.email().max(254).transform(v=>v.toLowerCase()),
  password:z.string().min(10).max(128),
  university:z.string().max(120).optional(),major:z.string().max(120).optional(),
  bio:z.string().max(1000).optional(),skills:z.string().max(1500).optional(),
  inviteCode:z.string().max(100).optional(),
});
const loginSchema=z.object({email:z.email(),password:z.string().min(1)});
// Small in-memory throttle for a single API instance; use Redis / proxy for multi-instance production.
const attempts = new Map<string,{count:number,until:number}>();
function rateLimit(key:string,limit=8,windowMs=15*60*1000):boolean {
  const now=Date.now();const previous=attempts.get(key);
  if(!previous || previous.until<now){attempts.set(key,{count:1,until:now+windowMs});return true;}
  previous.count++;return previous.count<=limit;
}


router.post("/register", async (req, res) => {
  try {
    if(!rateLimit(`register:${req.ip}`,5)) return res.status(429).json({error:"rate_limited",message:"حاول لاحقًا"});
    const validated=registerSchema.safeParse(req.body);
    if(!validated.success) return res.status(400).json({error:"invalid_input",message:"تحقق من الاسم والبريد وكلمة المرور (10 أحرف على الأقل)"});
    const {name,email,password,university,major,bio,skills,inviteCode}=validated.data;
    // Pilot-only deployments should configure PILOT_INVITE_CODE. Open registration is disabled in production.
    const expected=process.env.PILOT_INVITE_CODE;
    if(process.env.NODE_ENV==="production" && !expected) return res.status(503).json({error:"registration_disabled",message:"التسجيل غير متاح حتى تفعيل دعوات التجربة"});
    if(expected && inviteCode!==expected) return res.status(403).json({error:"invite_required",message:"رمز الدعوة غير صالح"});

    const existing = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (existing.length > 0) {
      return res.status(400).json({ error: "email_taken", message: "البريد الإلكتروني مستخدم بالفعل" });
    }

    const skillTags = parseSkillTags(skills || "");
    // A domain suffix is not email ownership verification.
    const isVerified = false;

    const [user] = await db.insert(usersTable).values({
      name,
      email,
      passwordHash: hashPassword(password),
      university: university || null,
      major: major || null,
      bio: bio || null,
      skillsText: skills || null,
      skillTags,
      points: 100,
      isVerified,
    }).returning();

    const token = await createSession(user.id);
    res.cookie("nashmi_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: "lax",
    });

    return res.status(201).json({ user: formatUser(user), message: "مرحباً بك في نشمي! حصلت على 100 نقطة ابتدائية 🎉" });
  } catch (err) {
    console.error("Register error:", err);
    return res.status(500).json({ error: "server_error", message: "حدث خطأ في الخادم" });
  }
});

router.post("/login", async (req, res) => {
  try {
    if(!rateLimit(`login:${req.ip}`,12)) return res.status(429).json({error:"rate_limited",message:"محاولات كثيرة، حاول لاحقًا"});
    const validated=loginSchema.safeParse(req.body);
    if(!validated.success) return res.status(400).json({error:"invalid_input",message:"البريد الإلكتروني وكلمة المرور مطلوبان"});
    const {email,password}=validated.data;

    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (!user || !verifyPassword(password,user.passwordHash)) {
      return res.status(401).json({ error: "invalid_credentials", message: "البريد الإلكتروني أو كلمة المرور غير صحيحة" });
    }
    if(!user.passwordHash.startsWith("scrypt:")) await db.update(usersTable).set({passwordHash:hashPassword(password)}).where(eq(usersTable.id,user.id));

    const token = await createSession(user.id);
    res.cookie("nashmi_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: "lax",
    });

    return res.json({ user: formatUser(user), message: "أهلاً وسهلاً يا نشمي!" });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "server_error", message: "حدث خطأ في الخادم" });
  }
});

router.post("/logout", async (req, res) => {
  try {
    await deleteSession(req);
    res.clearCookie("nashmi_session");
    return res.json({ message: "تم تسجيل الخروج بنجاح", success: true });
  } catch (err) {
    console.error("Logout error:", err);
    return res.status(500).json({ error: "server_error", message: "حدث خطأ في الخادم" });
  }
});

router.get("/me", async (req, res) => {
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return res.status(401).json({ error: "unauthorized", message: "يجب تسجيل الدخول أولاً" });
    }
    return res.json(formatUser(user));
  } catch (err) {
    console.error("Me error:", err);
    return res.status(500).json({ error: "server_error", message: "حدث خطأ في الخادم" });
  }
});

export default router;

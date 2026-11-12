import { db, sessionsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { Request } from "express";
import crypto from "crypto";

export async function createSession(userId: number): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await db.insert(sessionsTable).values({ userId, token, expiresAt });
  return token;
}

export async function getSessionUser(req: Request) {
  const token = req.cookies?.["nashmi_session"];
  if (!token) return null;

  const [session] = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.token, token))
    .limit(1);

  if (!session || session.expiresAt < new Date()) return null;

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, session.userId))
    .limit(1);

  return user || null;
}

export async function deleteSession(req: Request): Promise<void> {
  const token = req.cookies?.["nashmi_session"];
  if (token) {
    await db.delete(sessionsTable).where(eq(sessionsTable.token, token));
  }
}

// Each new password receives its own random salt and memory-hard scrypt hash.
// Legacy SHA-256 hashes are accepted ONLY to migrate existing development accounts.
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64);
  return `scrypt:${salt}:${derived.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  if (stored.startsWith("scrypt:")) {
    const parts = stored.split(":");
    if (parts.length !== 3 || !/^[0-9a-f]{32}$/.test(parts[1]) || !/^[0-9a-f]{128}$/.test(parts[2])) return false;
    const computed = crypto.scryptSync(password, parts[1], 64);
    return crypto.timingSafeEqual(computed, Buffer.from(parts[2], "hex"));
  }
  // This legacy comparison permits an upgrade without knowing users' passwords.
  const legacy = crypto.createHash("sha256").update(password + "nashmi_salt_2024").digest("hex");
  if (!/^[0-9a-f]{64}$/.test(stored)) return false;
  return crypto.timingSafeEqual(Buffer.from(legacy,"hex"),Buffer.from(stored,"hex"));
}

export function formatUser(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    university: user.university,
    major: user.major,
    bio: user.bio,
    skillTags: user.skillTags || [],
    skillProfiles: user.skillProfiles || [],
    availability: user.availability,
    capacity: user.capacity,
    points: user.points,
    loanBalance: user.loanBalance,
    level: user.level,
    trustScore: user.trustScore,
    totalServicesGiven: user.totalServicesGiven,
    totalServicesReceived: user.totalServicesReceived,
    averageRating: user.averageRating,
    isVerified: user.isVerified,
    createdAt: user.createdAt.toISOString(),
  };
}

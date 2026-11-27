// Сэтгэлийн Одод — нэвтрэлт / сесс / эрх.
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { db } from './db';
import { sessions, users } from './schema';
import type { Role } from '../../shared/src/types';

/** req.user-д хавсаргадаг нэвтэрсэн хэрэглэгчийн мэдээлэл (нууц үггүй). */
export interface AuthUser {
  id: number;
  name: string;
  username: string;
  role: Role;
  createdAt: Date;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/** Шинэ сесс үүсгэж токен буцаана. */
export async function createSession(userId: number): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex');
  await db.insert(sessions).values({ token, userId });
  return token;
}

export async function deleteSession(token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.token, token));
}

function readBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  return token ? token : null;
}

/** Нэвтэрсэн хэрэглэгчийг ачаалж req.user-д хавсаргана. */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = readBearerToken(req);
  if (!token) {
    res.status(401).json({ error: 'Нэвтрэх шаардлагатай байна' });
    return;
  }
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      username: users.username,
      role: users.role,
      createdAt: users.createdAt,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.token, token))
    .limit(1);
  const row = rows[0];
  if (!row) {
    res.status(401).json({ error: 'Сесс хүчингүй болсон байна. Дахин нэвтэрнэ үү' });
    return;
  }
  req.user = { ...row, role: row.role as Role };
  next();
}

/** Токен байвал хэрэглэгчийг хавсаргана, байхгүй бол зүгээр өнгөрнө (нийтийн жагсаалтад). */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const token = readBearerToken(req);
  if (!token) {
    next();
    return;
  }
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      username: users.username,
      role: users.role,
      createdAt: users.createdAt,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.token, token))
    .limit(1);
  const row = rows[0];
  if (row) req.user = { ...row, role: row.role as Role };
  next();
}

/** Зөвхөн админ. requireAuth-ийн дараа залгана. */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Нэвтрэх шаардлагатай байна' });
    return;
  }
  if (req.user.role !== 'admin') {
    res.status(403).json({ error: 'Энэ үйлдлийг зөвхөн админ хийх боломжтой' });
    return;
  }
  next();
}

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const USERNAME_RE = /^[A-Za-z0-9._-]+$/;

/**
 * Хэрэглэгч бүртгэнэ. Хүснэгтийн АНХНЫ хэрэглэгч 'admin', дараагийнх нь 'member' болно.
 * Эрх дээшлүүлэх (role-promotion) үйлдэл хаана ч байхгүй — админ нь зөвхөн энэ дүрмээр үүснэ.
 */
export async function registerUser(
  name: string,
  username: string,
  password: string,
): Promise<AuthUser> {
  const cleanName = (name ?? '').trim();
  const cleanUsername = (username ?? '').trim();
  if (cleanName.length < 1 || cleanName.length > 60) {
    throw new HttpError(400, 'Нэр 1–60 тэмдэгт байх ёстой');
  }
  if (cleanUsername.length < 3 || cleanUsername.length > 30 || !USERNAME_RE.test(cleanUsername)) {
    throw new HttpError(
      400,
      'Нэвтрэх нэр 3–30 тэмдэгт байх ба зөвхөн үсэг, тоо, цэг, доогуур зураас, зураас агуулна',
    );
  }
  if (!password || password.length < 4) {
    throw new HttpError(400, 'Нууц үг хамгийн багадаа 4 тэмдэгт байх ёстой');
  }

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, cleanUsername))
    .limit(1);
  if (existing.length > 0) {
    throw new HttpError(409, 'Энэ нэвтрэх нэр аль хэдийн бүртгэгдсэн байна');
  }

  const all = await db.select({ id: users.id }).from(users).limit(1);
  const role: Role = all.length === 0 ? 'admin' : 'member';

  const passwordHash = await hashPassword(password);
  const inserted = await db
    .insert(users)
    .values({ name: cleanName, username: cleanUsername, passwordHash, role })
    .returning({ id: users.id, name: users.name, username: users.username, role: users.role, createdAt: users.createdAt });
  const row = inserted[0];
  return { ...row, role: row.role as Role };
}

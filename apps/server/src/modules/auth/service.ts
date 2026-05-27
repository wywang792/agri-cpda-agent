import { db } from '../../db/index.js';
import { users } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import 'dotenv/config';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

export async function register(
  username: string, password: string, role: 'buyer' | 'supplier', marketId: string
) {
  const existing = await db.select().from(users).where(eq(users.username, username)).limit(1);
  if (existing.length > 0) throw new Error('Username already exists');

  const passwordHash = await bcrypt.hash(password, 10);
  const [user] = await db.insert(users)
    .values({ username, passwordHash, role, marketId })
    .returning();

  const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
  return { token, user: { id: user.id, username: user.username, role: user.role, marketId: user.marketId, createdAt: user.createdAt } };
}

export async function login(username: string, password: string) {
  const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);
  if (!user) throw new Error('Invalid credentials');

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new Error('Invalid credentials');

  const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
  return { token, user: { id: user.id, username: user.username, role: user.role, marketId: user.marketId, createdAt: user.createdAt } };
}

export function verifyToken(token: string) {
  return jwt.verify(token, JWT_SECRET) as { userId: string; role: string };
}

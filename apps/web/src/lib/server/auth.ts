import crypto from 'node:crypto';
import { prisma } from './prisma';

export const SESSION_COOKIE_NAME = 'updatepilot_session';
export const SESSION_DURATION_MS = 8 * 60 * 60 * 1000; // 8 hours

export const hashSecret = (value: string) =>
  crypto.createHash('sha256').update(value).digest('hex');

export const sameSecret = (left: string, right: string) => {
  try {
    return crypto.timingSafeEqual(
      Buffer.from(hashSecret(left)),
      Buffer.from(hashSecret(right))
    );
  } catch {
    return false;
  }
};

const getSecretKey = () =>
  process.env.SESSION_SECRET || 'updatepilot_super_secure_session_secret_at_least_32_chars_long';

const sign = (data: string, key: string) =>
  crypto.createHmac('sha256', key).update(data).digest('hex');

export function createSessionToken(userId: string): string {
  const key = getSecretKey();
  const expires = String(Date.now() + SESSION_DURATION_MS);
  const data = `${userId}:${expires}`;
  const signature = sign(data, key);
  return `${userId}.${expires}.${signature}`;
}

export function verifySessionToken(token: string): string | null {
  if (!token) return null;
  const parts = token.split('.');
  const key = getSecretKey();

  if (parts.length === 3) {
    const [userId, expires, signature] = parts;
    if (
      /^\d{13}$/.test(expires) &&
      Number(expires) > Date.now() &&
      signature &&
      sameSecret(signature, sign(`${userId}:${expires}`, key))
    ) {
      return userId;
    }
  } else if (parts.length === 2) {
    const [expires, signature] = parts;
    if (
      /^\d{13}$/.test(expires) &&
      Number(expires) > Date.now() &&
      signature &&
      sameSecret(signature, sign(expires, key))
    ) {
      return 'admin';
    }
  }

  return null;
}

export function extractSessionCookie(req: Request): string | null {
  const cookieHeader = req.headers.get('cookie');
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(';').map(c => c.trim());
  const found = cookies.find(c => c.startsWith(`${SESSION_COOKIE_NAME}=`));
  if (!found) return null;
  return decodeURIComponent(found.slice(SESSION_COOKIE_NAME.length + 1));
}

export function getAuthUserId(req: Request): string | null {
  const cookie = extractSessionCookie(req);
  if (!cookie) return null;
  return verifySessionToken(cookie);
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, key] = stored.split(':');
  if (!salt || !key) return false;
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(key, 'hex'));
}

export function generatePairingCode(): string {
  const code = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `UP-${code.slice(0, 4)}-${code.slice(4)}`;
}

export async function authenticateAgentToken(authHeader: string | null) {
  if (!authHeader) return null;
  const token = authHeader.match(/^Bearer (up_tok_[a-f0-9]{64})$/)?.[1];
  if (!token) return null;
  const hashed = hashSecret(token);
  return prisma.device.findFirst({
    where: { token: hashed, status: { not: 'unpaired' } },
    select: { id: true, ownerId: true, name: true, status: true },
  });
}

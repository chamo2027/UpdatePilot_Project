import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { Router, Response } from 'express';

export const hashSecret = (value: string) => createHash('sha256').update(value).digest('hex');
export const sameSecret = (left: string, right: string) =>
  timingSafeEqual(Buffer.from(hashSecret(left)), Buffer.from(hashSecret(right)));

export const cookieName = 'updatepilot_session';
export const sessionDuration = 8 * 60 * 60 * 1000;

export const dashboardOrigin = () => {
  const raw = (process.env.DASHBOARD_ORIGIN || 'http://localhost:3000').trim().replace(/\/$/, '');
  return raw.startsWith('http://') || raw.startsWith('https://') ? raw : `https://${raw}`;
};

export const cookieOptions = (origin?: string) => ({
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: origin?.startsWith('https://') || dashboardOrigin().startsWith('https://'),
  path: '/api/v1',
});

const sign = (data: string, key: string) => createHmac('sha256', key).update(data).digest('hex');

export const setSessionCookie = (res: Response, userId: string, origin?: string) => {
  const key = process.env.SESSION_SECRET || 'updatepilot_super_secure_session_secret_at_least_32_chars_long';
  const expires = String(Date.now() + sessionDuration);
  const data = `${userId}:${expires}`;
  const signature = sign(data, key);
  const token = `${userId}.${expires}.${signature}`;
  res.cookie(cookieName, token, { ...cookieOptions(origin), maxAge: sessionDuration });
};

export const clearSessionCookie = (res: Response, origin?: string) => {
  res.clearCookie(cookieName, cookieOptions(origin));
};

export const isAllowedOrigin = (origin?: string) => {
  if (!origin) return true;
  const clean = origin.trim().replace(/\/$/, '');
  const expected = dashboardOrigin();
  if (clean === expected) return true;
  if (clean.endsWith('.trycloudflare.com') || clean.endsWith('.loca.lt')) {
    return true;
  }
  if (expected.endsWith('.vercel.app') && clean.endsWith('.vercel.app')) {
    return true;
  }
  return false;
};

export function protectDashboard(router: Router) {
  let failures = 0;
  let retryAfter = 0;

  // Legacy single-password login endpoint
  router.post('/session', (req, res) => {
    const origin = req.get('origin')?.replace(/\/$/, '');
    if (origin && !isAllowedOrigin(origin)) return res.sendStatus(403);
    const password = process.env.DASHBOARD_PASSWORD;
    const key = process.env.SESSION_SECRET;
    if (!password || password.length < 12 || !key || key.length < 32) {
      return res.status(503).json({ error: 'Set DASHBOARD_PASSWORD and SESSION_SECRET in the server environment.' });
    }
    if (Date.now() >= retryAfter) {
      failures = 0;
      retryAfter = Date.now() + 60_000;
    }
    if (failures >= 8) return res.status(429).json({ error: 'Too many attempts. Try again in a minute.' });
    if (typeof req.body?.password !== 'string' || !sameSecret(req.body.password, password)) {
      failures++;
      return res.status(401).json({ error: 'Incorrect dashboard password.' });
    }
    failures = 0;
    setSessionCookie(res, 'admin', origin);
    return res.json({ success: true });
  });

  // Authentication & session validation middleware
  router.use((req, res, next) => {
    if (
      req.path === '/openapi.json' ||
      req.path.startsWith('/agent/') ||
      req.path.startsWith('/auth/register') ||
      req.path.startsWith('/auth/login') ||
      req.path.startsWith('/install-agent') ||
      (req.method === 'POST' && req.path === '/devices/pair')
    ) {
      return next();
    }

    const cookie = req.get('cookie')?.split(';').map(value => value.trim())
      .find(value => value.startsWith(cookieName + '='))?.slice(cookieName.length + 1);

    if (!cookie) {
      return res.status(401).json({ error: 'Sign in to UpdatePilot.' });
    }

    const parts = cookie.split('.');
    const key = process.env.SESSION_SECRET || 'updatepilot_super_secure_session_secret_at_least_32_chars_long';

    let resolvedUserId: string | null = null;

    if (parts.length === 3) {
      const [userId, expires, signature] = parts;
      if (
        /^\d{13}$/.test(expires) &&
        Number(expires) > Date.now() &&
        signature &&
        sameSecret(signature, sign(`${userId}:${expires}`, key))
      ) {
        resolvedUserId = userId;
      }
    } else if (parts.length === 2) {
      const [expires, signature] = parts;
      if (
        /^\d{13}$/.test(expires) &&
        Number(expires) > Date.now() &&
        signature &&
        sameSecret(signature, sign(expires, key))
      ) {
        resolvedUserId = 'admin';
      }
    }

    if (!resolvedUserId) {
      return res.status(401).json({ error: 'Sign in to UpdatePilot.' });
    }

    res.locals.userId = resolvedUserId;

    const origin = req.get('origin')?.replace(/\/$/, '');
    if (!['GET', 'HEAD'].includes(req.method) && origin && !isAllowedOrigin(origin)) {
      return res.status(403).json({ error: 'Request must come from the dashboard.' });
    }
    return next();
  });

  router.get('/session', (_req, res) => res.json({ success: true, userId: res.locals.userId }));
  router.delete('/session', (req, res) => {
    const origin = req.get('origin')?.replace(/\/$/, '');
    clearSessionCookie(res, origin);
    return res.json({ success: true });
  });
}

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createAuthServer, serializeSetCookie, resolveNeonAuthLogging } from '@neondatabase/auth/server';
import { accessStore, type Identity } from './accessStore.js';

export class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }
export function settings() {
  const baseUrl = process.env.NEON_AUTH_BASE_URL;
  const cookieSecret = process.env.NEON_AUTH_COOKIE_SECRET;
  const origin = process.env.APP_ORIGIN;
  if (!baseUrl || !cookieSecret || cookieSecret.length < 32 || !origin || !process.env.DATABASE_URL) throw new ApiError(503, 'La sauvegarde en ligne n’est pas encore configurée.');
  if (new URL(baseUrl).protocol !== 'https:' || (new URL(origin).protocol !== 'https:' && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))) throw new ApiError(503, 'Configuration du serveur invalide.');
  return { baseUrl, cookieSecret, origin: new URL(origin).origin };
}
export function privateResponse(res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store, private'); res.setHeader('Vary', 'Cookie, Origin');
  res.setHeader('X-Content-Type-Options', 'nosniff');
}
export function assertSameOrigin(req: VercelRequest, expected: string) {
  if (req.headers.origin !== expected || req.headers['x-training-client'] !== '1') throw new ApiError(403, 'Requête non autorisée.');
}
export async function requireIdentity(req: VercelRequest, res: VercelResponse):Promise<Identity> {
  const config = settings();
  const auth = createAuthServer({ ...config, sameSite: 'strict', sessionDataTtl: 60,
    log: resolveNeonAuthLogging({ logLevel: 'silent' }),
    context: () => ({
      getCookies: () => req.headers.cookie ?? '',
      getHeader: name => { const value = req.headers[name.toLowerCase()]; return typeof value === 'string' ? value : null; },
      getOrigin: () => config.origin, getFramework: () => 'vercel',
      setCookie: (name, value, options) => {
        const existing = res.getHeader('Set-Cookie');
        const cookies = existing ? (Array.isArray(existing) ? existing.map(String) : [String(existing)]) : [];
        res.setHeader('Set-Cookie', [...cookies, serializeSetCookie({ name, value, ...options, httpOnly: true })]);
      },
    }),
  });
  const session = await auth.getSession({});
  if (session.error || !session.data?.user?.id) throw new ApiError(401, 'Reconnecte-toi pour sauvegarder.');
  return { id:session.data.user.id,email:session.data.user.email,sessionId:session.data.session.id };
}
export async function requireUser(req:VercelRequest,res:VercelResponse) {
  const user=await requireIdentity(req,res);
  const access=await accessStore(process.env.DATABASE_URL!).read(user.id);
  if(access?.status!=='approved') throw new ApiError(403,'Ton accès n’est pas autorisé. Consulte ta demande de connexion.');
  return user.id;
}
export function sendError(res: VercelResponse, error: unknown) {
  const status = error instanceof ApiError ? error.status : 500;
  res.status(status).json({ error: error instanceof ApiError ? error.message : 'Service temporairement indisponible. Tes données locales sont conservées.' });
}

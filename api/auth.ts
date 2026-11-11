import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleAuthProxyRequest, resolveNeonAuthLogging } from '@neondatabase/auth/server';
import { ApiError, assertSameOrigin, privateResponse, sendError, settings } from '../server/security.js';
import { accessStore } from '../server/accessStore.js';
import { notifyAdministrator } from '../server/accessPolicy.js';

const paths = new Map([
  ['get-session', 'GET'], ['sign-in/email', 'POST'], ['sign-up/email', 'POST'],
  ['sign-out', 'POST'], ['request-password-reset', 'POST'], ['reset-password', 'POST'],
  ['verify-email', 'GET'], ['send-verification-email', 'POST'],
]);
export default async function handler(req: VercelRequest, res: VercelResponse) {
  privateResponse(res);
  try {
    const config = settings();
    const path = Array.isArray(req.query.path) ? req.query.path.join('/') : String(req.query.path ?? '');
    if (!paths.has(path) || paths.get(path) !== req.method) throw new ApiError(404, 'Route inconnue.');
    if (req.method === 'POST') assertSameOrigin(req, config.origin);
    if (Number(req.headers['content-length'] ?? 0) > 16_384 || JSON.stringify(req.body ?? {}).length > 16_384) throw new ApiError(413, 'Requête trop volumineuse.');
    const url = new URL(req.url ?? '/', config.origin);
    const headers = new Headers({ origin: config.origin, 'x-neon-auth-proxy': 'vercel' });
    if (req.headers.cookie) headers.set('cookie', req.headers.cookie);
    if (req.method === 'POST') headers.set('content-type', 'application/json');
    const body = req.method === 'POST' ? { ...req.body } : undefined;
    // Pas de redirection arbitraire vers un site fourni par le client.
    if (body) for (const key of ['callbackURL', 'redirectTo', 'errorCallbackURL']) if (body[key] && new URL(body[key], config.origin).origin !== config.origin) throw new ApiError(400, 'Redirection invalide.');
    const response = await handleAuthProxyRequest({ ...config, path, sameSite: 'strict', sessionDataTtl: 60,
      request: new Request(url, { method: req.method, headers, body: body ? JSON.stringify(body) : undefined }),
      log: resolveNeonAuthLogging({ logLevel: 'silent' }),
    });
    const cookies = response.headers.getSetCookie();
    if (cookies.length) res.setHeader('Set-Cookie', cookies);
    const location = response.headers.get('location');
    if (location) {
      if (new URL(location, config.origin).origin !== config.origin) throw new ApiError(400, 'Redirection invalide.');
      res.setHeader('Location', location);
    }
    res.setHeader('Content-Type', response.headers.get('content-type') ?? 'application/json');
    const result=await response.text();
    // L'identité vient exclusivement de Neon, jamais de l'e-mail fourni par le navigateur.
    if(response.ok&&['sign-up/email','sign-in/email','get-session'].includes(path)&&process.env.ADMIN_USER_ID) {
      const data=JSON.parse(result);
      if(typeof data.user?.id==='string'&&typeof data.user?.email==='string') {
        const store=accessStore(process.env.DATABASE_URL!);
        const request=await store.ensure({id:data.user.id,email:data.user.email});
        if(request.created&&!request.admin) await notifyAdministrator(store);
      }
    }
    return res.status(response.status).send(result);
  } catch (error) {
    // Ne journaliser ni message, ni URL, ni identifiant ou secret du compte.
    if (!(error instanceof ApiError)) console.error('Auth proxy failure', error instanceof Error ? {
      name: error.name,
      frames: error.stack?.split('\n').slice(1, 5).map(line => line.replace(/https?:\/\/\S+/g, '[url]')),
    } : { name: 'UnknownError' });
    return sendError(res, error);
  }
}

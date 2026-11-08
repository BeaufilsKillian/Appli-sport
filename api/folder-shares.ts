import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ApiError, assertSameOrigin, privateResponse, requireUser, sendError, settings } from '../server/security.js';
import { folderShareStore } from '../server/folderShareStore.js';
import { parseSharedFolder } from '../server/folderSharing.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  privateResponse(res);
  try {
    if (!['GET','POST'].includes(req.method ?? '')) throw new ApiError(405,'Méthode non autorisée.');
    if (req.method === 'POST') assertSameOrigin(req, settings().origin);
    const owner = await requireUser(req,res);
    if (req.headers['x-training-owner'] !== owner) throw new ApiError(403,'Le compte a changé. Reconnecte-toi.');
    const store = folderShareStore(process.env.DATABASE_URL!);
    const code = req.method === 'GET' ? req.query.code : req.body?.code;
    if (code !== undefined && (typeof code !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(code))) throw new ApiError(400,'Lien de partage invalide.');
    if (req.method === 'GET') {
      if (code) {
        const preview = await store.preview(owner, String(code));
        if (!preview) throw new ApiError(404,'Lien invalide, expiré ou déjà utilisé.');
        return res.json(preview);
      }
      if (typeof req.query.folder !== 'string' || req.query.folder.length>200) throw new ApiError(400,'Dossier invalide.');
      return res.json({ shares: await store.list(owner,req.query.folder) });
    }
    if (Number(req.headers['content-length'] ?? 0)>600_000 || JSON.stringify(req.body ?? {}).length>600_000) throw new ApiError(413,'Dossier trop volumineux.');
    if (req.body?.action === 'create') {
      let payload;
      try { payload = parseSharedFolder(req.body.folder); } catch (error) { throw new ApiError(400,error instanceof Error ? error.message : 'Dossier invalide.'); }
      const share = await store.create(owner,payload);
      if (!share) throw new ApiError(429,'Dix partages maximum sur sept jours. Réessaie plus tard.');
      return res.json(share);
    }
    if (req.body?.action === 'claim' && code) {
      const share = await store.claim(owner,String(code));
      if (!share) throw new ApiError(404,'Lien invalide, expiré ou déjà utilisé.');
      return res.json(share);
    }
    if (req.body?.action === 'revoke' && typeof req.body.id === 'string' && /^[a-f0-9-]{36}$/i.test(req.body.id)) {
      if (!await store.revoke(owner,req.body.id)) throw new ApiError(404,'Partage introuvable ou déjà utilisé.');
      return res.json({ revoked: true });
    }
    throw new ApiError(400,'Action invalide.');
  } catch (error) { return sendError(res,error); }
}

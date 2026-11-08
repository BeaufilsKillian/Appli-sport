import type { VercelRequest, VercelResponse } from '@vercel/node';
import { MAX_BACKUP_BYTES, parseBackup } from '../src/backup.js';
import { ApiError, assertSameOrigin, privateResponse, requireUser, sendError, settings } from '../server/security.js';
import { backupStore } from '../server/backupStore.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  privateResponse(res);
  try {
    if (req.method !== 'GET' && req.method !== 'POST') throw new ApiError(405, 'Méthode non autorisée.');
    const config = settings();
    if (req.method === 'POST') assertSameOrigin(req, config.origin);
    const owner = await requireUser(req, res); // Jamais issu du corps de la requête.
    if (req.headers['x-training-owner'] !== owner) throw new ApiError(403, 'Le compte a changé. Reviens à ton compte avant de sauvegarder.');
    const store = backupStore(process.env.DATABASE_URL!);
    if (req.method === 'GET') {
      const raw = req.query.revision;
      const revision = raw === undefined ? undefined : Number(raw);
      if (revision !== undefined && (!Number.isSafeInteger(revision) || revision < 1)) throw new ApiError(400, 'Version invalide.');
      const knownRaw = req.query.knownVersion;
      const knownVersion = knownRaw === undefined ? undefined : Number(knownRaw);
      if (knownVersion !== undefined && (!Number.isSafeInteger(knownVersion) || knownVersion < 1 || revision !== undefined)) throw new ApiError(400, 'Version connue invalide.');
      return res.json(await store.get(owner, revision, knownVersion));
    }
    if (Number(req.headers['content-length'] ?? 0) > MAX_BACKUP_BYTES + 1024) throw new ApiError(413, 'Sauvegarde trop volumineuse.');
    const baseVersion = req.body?.baseVersion;
    if (!Number.isSafeInteger(baseVersion) || baseVersion < 0) throw new ApiError(400, 'Version invalide.');
    let payload;
    try { payload = parseBackup(req.body?.data); } catch (error) { throw new ApiError(400, error instanceof Error ? error.message : 'Sauvegarde invalide.'); }
    const saved = await store.save(owner, baseVersion, payload);
    if (!saved) throw new ApiError(409, 'Une copie plus récente existe. Choisis celle à conserver.');
    return res.json(saved);
  } catch (error) { return sendError(res, error); }
}

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { privateResponse, settings } from '../server/security.js';
export default function handler(req: VercelRequest, res: VercelResponse) {
  privateResponse(res);
  if (req.method !== 'GET') return res.status(405).end();
  try { settings(); return res.json({ cloud: true }); } catch { return res.json({ cloud: false }); }
}

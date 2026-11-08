import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import type { SharedFolder } from '../src/folderSharing.js';

export const shareTokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
export function folderShareStore(connection: string) {
  const sql = neon(connection);
  return {
    async create(owner: string, payload: SharedFolder) {
      const token = randomBytes(32).toString('base64url'), id = randomUUID();
      const results = await sql.transaction([
        sql`SELECT pg_advisory_xact_lock(hashtext(${owner}))`,
        sql`DELETE FROM training_folder_shares WHERE owner_id=${owner} AND expires_at<now()`,
        sql`INSERT INTO training_folder_shares(id, owner_id, token_hash, folder_id, folder_name, payload)
          SELECT ${id}::uuid, ${owner}, ${shareTokenHash(token)}, ${String(payload.folders[0].id)}, ${String(payload.folders[0].name)}, ${JSON.stringify(payload)}::jsonb
          WHERE (SELECT count(*) FROM training_folder_shares WHERE owner_id=${owner})<10
          RETURNING id, expires_at`,
      ]);
      const row = results[2][0];
      return row ? { ...row, token } : null;
    },
    async list(owner: string, folderId: string) {
      return sql`SELECT id, created_at, expires_at, revoked, claimed_at FROM training_folder_shares WHERE owner_id=${owner} AND folder_id=${folderId} AND expires_at>now() ORDER BY created_at DESC LIMIT 10`;
    },
    async preview(owner: string, token: string) {
      const rows = await sql`SELECT id, folder_name AS name, expires_at,
        jsonb_array_length(payload->'templates') AS templates, jsonb_array_length(payload->'template_exercises') AS exercises
        FROM training_folder_shares WHERE token_hash=${shareTokenHash(token)} AND NOT revoked AND expires_at>now() AND (claimed_by IS NULL OR claimed_by=${owner})`;
      return rows[0] ?? null;
    },
    async claim(owner: string, token: string) {
      const rows = await sql`UPDATE training_folder_shares SET claimed_by=${owner}, claimed_at=coalesce(claimed_at,now())
        WHERE token_hash=${shareTokenHash(token)} AND NOT revoked AND expires_at>now() AND (claimed_by IS NULL OR claimed_by=${owner}) RETURNING id,payload`;
      return rows[0] ?? null;
    },
    async revoke(owner: string, id: string) {
      const rows = await sql`UPDATE training_folder_shares SET revoked=true WHERE id=${id}::uuid AND owner_id=${owner} AND claimed_by IS NULL RETURNING id`;
      return rows.length > 0;
    },
  };
}

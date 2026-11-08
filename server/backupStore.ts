import { neon } from '@neondatabase/serverless';
import type { Backup } from '../src/backup.js';

export function backupStore(connectionString: string) {
  const sql = neon(connectionString);
  return {
    async get(owner: string, revision?: number, knownVersion?: number) {
      const rows = revision === undefined
        ? await sql`SELECT revision, CASE WHEN revision = ${knownVersion ?? -1} THEN NULL ELSE payload END AS payload, created_at FROM training_backups WHERE owner_id = ${owner} ORDER BY revision DESC LIMIT 1`
        : await sql`SELECT revision, payload, created_at FROM training_backups WHERE owner_id = ${owner} AND revision = ${revision} LIMIT 1`;
      const versions = await sql`SELECT revision, created_at FROM training_backups WHERE owner_id = ${owner} ORDER BY revision DESC LIMIT 10`;
      return { latest: rows[0] ?? null, versions };
    },
    async save(owner: string, baseVersion: number, payload: Backup) {
      // Compare-and-swap atomique : un autre appareil ne peut pas être écrasé silencieusement.
      const [saved] = await sql.transaction([
        sql`WITH created AS (
          INSERT INTO training_heads (owner_id, revision) SELECT ${owner}, 1 WHERE ${baseVersion} = 0
          ON CONFLICT (owner_id) DO NOTHING
          RETURNING revision
        ), advanced AS (
          UPDATE training_heads SET revision = revision + 1
          WHERE owner_id = ${owner} AND revision = ${baseVersion} AND ${baseVersion} > 0
          RETURNING revision
        ), next AS (
          SELECT revision FROM created UNION ALL SELECT revision FROM advanced
        ), saved AS (
          INSERT INTO training_backups (owner_id, revision, payload)
          SELECT ${owner}, revision, ${JSON.stringify(payload)}::jsonb FROM next
          RETURNING revision, created_at
        ) SELECT * FROM saved`,
        sql`DELETE FROM training_backups WHERE owner_id = ${owner} AND revision NOT IN (
          SELECT revision FROM training_backups WHERE owner_id = ${owner} ORDER BY revision DESC LIMIT 10
        )`,
      ]);
      return saved[0] ?? null;
    },
  };
}

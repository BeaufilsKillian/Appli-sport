import fs from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';

try {
  const envIndex = process.argv.indexOf('--env');
  process.loadEnvFile(envIndex >= 0 ? process.argv[envIndex + 1] : '.env.local');
  const connection = process.env.DATABASE_URL_UNPOOLED;
  if (!connection || new URL(connection).hostname.includes('-pooler')) throw Error('Connexion directe de migration manquante.');
  const sql = neon(connection);
  const shares = process.argv.includes('--folder-shares');
  const access = process.argv.includes('--access');
  const nutrition = process.argv.includes('--nutrition');
  const source = await fs.readFile(new URL(nutrition?'../migrations/004_nutrition.sql':access?'../migrations/003_access_control.sql':shares ? '../migrations/002_folder_shares.sql' : '../migrations/001_backups.sql', import.meta.url), 'utf8');
  const statements = source.split(';').map(value => value.trim()).filter(value => value && !/^(BEGIN|COMMIT)$/i.test(value));
  await sql.transaction(statements.map(query => sql.query(query)));
  const rows = nutrition ? await sql`SELECT count(*)::int AS tables FROM pg_tables WHERE schemaname='public' AND tablename IN ('training_nutrition','training_nutrition_heads') AND rowsecurity` : access ? await sql`SELECT count(*)::int AS tables FROM pg_tables WHERE schemaname='public' AND tablename IN ('training_access','training_admin_sessions','training_admin_attempts','training_admin_push') AND rowsecurity` : shares ? await sql`SELECT count(*)::int AS tables FROM pg_tables WHERE schemaname='public' AND tablename='training_folder_shares' AND rowsecurity` : await sql`SELECT count(*)::int AS tables FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('training_heads', 'training_backups') AND rowsecurity`;
  if (rows[0].tables !== (access ? 4 : shares ? 1 : 2)) throw Error('Vérification de migration échouée.');
  if(nutrition){console.log('Migration OK : deux tables nutrition privées, protection RLS activée.');process.exit(0);}
  if(access){console.log('Migration OK : quatre tables de contrôle d’accès protégées par RLS.');process.exit(0);}
  console.log(shares ? 'Migration OK : partage de dossiers, protection RLS activée.' : 'Migration OK : deux tables de sauvegarde, protection RLS activée.');
} catch (error) {
  console.error(String(error.message).replace(/postgres(?:ql)?:\/\/\S+/g, '[connexion masquée]'));
  process.exitCode = 1;
}

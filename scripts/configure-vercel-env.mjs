import fs from 'node:fs';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

process.loadEnvFile('.env.local');
const origin = process.argv[2];
if (!origin || new URL(origin).protocol !== 'https:' || new URL(origin).origin !== origin) throw Error('Indiquer l’origine HTTPS de production.');
const secret = process.env.NEON_AUTH_COOKIE_SECRET || crypto.randomBytes(32).toString('hex');
let env = fs.readFileSync('.env.local', 'utf8');
for (const [key, value] of Object.entries({ APP_ORIGIN: origin, NEON_AUTH_COOKIE_SECRET: secret })) {
  env = env.replace(new RegExp(`^${key}=.*\\r?\\n?`, 'm'), '');
  env += `\n${key}=${JSON.stringify(value)}\n`;
  process.env[key] = value;
}
fs.writeFileSync('.env.local', env);
const keys = ['DATABASE_URL', 'NEON_AUTH_BASE_URL', 'NEON_AUTH_COOKIE_SECRET', 'APP_ORIGIN'];
for (const key of keys) {
  if (!process.env[key]) throw Error(`Variable manquante : ${key}`);
  const args = ['vercel@latest', 'env', 'add', key, '--environment', 'production', '--sensitive', '--yes', '--scope', 'overblast2'];
  const result = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', args, { shell: process.platform === 'win32', input: process.env[key], encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) {
    let output = (result.stderr || result.stdout || 'Configuration refusée.');
    for (const name of keys) if (process.env[name]) output = output.replaceAll(process.env[name], '[valeur masquée]');
    throw Error(output);
  }
  console.log(`${key} : enregistré comme secret Vercel Production.`);
}

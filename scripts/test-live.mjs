import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';

const origin = process.argv[2];
if (!origin || new URL(origin).origin !== origin) throw Error('Adresse de déploiement requise.');
const cookies = new Map();
async function call(path, body, extra = {}) {
  const response = await fetch(origin + path, { method: body === undefined ? 'GET' : 'POST', redirect: 'manual',
    headers: { Origin: origin, 'X-Training-Client': '1', Cookie: [...cookies].map(([key, value]) => `${key}=${value}`).join('; '), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...extra },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(30_000) });
  for (const header of response.headers.getSetCookie()) {
    const part = header.split(';')[0], split = part.indexOf('=');
    if (part.slice(split + 1)) cookies.set(part.slice(0, split), part.slice(split + 1)); else cookies.delete(part.slice(0, split));
  }
  const text = await response.text();
  let data; try { data = JSON.parse(text); } catch { data = { error: text.slice(0, 200) }; }
  return { status: response.status, data, cache: response.headers.get('cache-control') };
}
const email = `codex-e2e-${Date.now()}@example.com`, password = crypto.randomBytes(24).toString('base64url');
try {
  assert.equal((await call('/api/config')).data.cloud, true, 'configuration Neon active');
  assert.equal((await call('/api/backups', undefined, { 'X-Training-Owner': 'absent' })).status, 401, 'refus sans session');
  const signup = await call('/api/auth/sign-up/email', { email, password, name: 'Test technique temporaire' });
  assert.equal(signup.status, 200, `Inscription : HTTP ${signup.status}, ${signup.data.message ?? signup.data.error ?? 'réponse inattendue'}`);
  const id = signup.data.user?.id; assert.ok(id, 'identifiant du compte');
  const accounts = JSON.parse(await fs.readFile('.expo/live-test-accounts.json', 'utf8').catch(() => '[]'));
  accounts.push({ id, email, createdAt: new Date().toISOString() });
  await fs.writeFile('.expo/live-test-accounts.json', JSON.stringify(accounts));
  if (process.argv.includes('--browser')) await fs.writeFile('.expo/live-test-credentials.json', JSON.stringify({ id, email, password }));
  assert.equal((await call('/api/auth/get-session')).data.user?.id, id, 'session après inscription');
  console.log('OK en ligne : inscription et session Neon.');
  const owner = { 'X-Training-Owner': id };
  const backup = { format: 'training-programme-backup', schema: 8, exported_at: new Date().toISOString(), folders: [{ id: 'e2e-folder', name: 'Test technique temporaire', created_at: Date.now() }], templates: [], template_exercises: [], sessions: [], session_exercises: [], logged_sets: [], settings: [], exercise_maxes: [], custom_exercises: [] };
  const ranges = process.argv.includes('--rep-bounds');
  if (ranges) {
    backup.schema = 9;
    backup.templates = [{ id: 'e2e-template', title: 'Plage de test', category: 'Perso', created_at: Date.now(), folder_id: 'e2e-folder' }];
    backup.template_exercises = [{ template_id: 'e2e-template', exercise_id: 'bench', position: 0, planned_sets: 3, planned_reps: 8, planned_reps_min: 8, planned_reps_max: 12, rest_seconds: 120, to_failure: 0, failure_rep_guide: 10, superset_group: 0, dropset: 0, notes: '' }];
  }
  const first = await call('/api/backups', { baseVersion: 0, data: backup }, owner);
  assert.equal(first.status, 200, `Sauvegarde : ${JSON.stringify(first.data)}`); assert.equal(first.data.revision, 1);
  const read = await call('/api/backups', undefined, owner);
  assert.equal(read.data.latest.payload.folders[0].name, backup.folders[0].name); assert.match(read.cache, /no-store/);
  assert.equal((await call('/api/backups', { baseVersion: 0, data: backup }, owner)).status, 409, 'conflit refusé');
  assert.equal((await call('/api/backups', undefined, { 'X-Training-Owner': 'another-user' })).status, 403, 'autre compte refusé');
  assert.equal((await call('/api/backups', { baseVersion: 1, data: backup }, { ...owner, Origin: 'https://example.invalid' })).status, 403, 'origine étrangère refusée');
  backup.folders[0].name = 'Version suivante';
  if (ranges) { backup.template_exercises[0].planned_reps_min = null; backup.template_exercises[0].planned_reps = 12; }
  assert.equal((await call('/api/backups', { baseVersion: 1, data: backup }, owner)).data.revision, 2);
  const old = await call('/api/backups?revision=1', undefined, owner);
  assert.equal(old.data.latest.payload.folders[0].name, 'Test technique temporaire');
  assert.equal(old.data.versions.length, 2);
  if (ranges) {
    assert.equal(old.data.latest.payload.schema, 9);
    assert.equal(old.data.latest.payload.template_exercises[0].planned_reps_min, 8);
    assert.equal(old.data.latest.payload.template_exercises[0].planned_reps_max, 12);
    const latest = await call('/api/backups', undefined, owner);
    assert.equal(latest.data.latest.payload.template_exercises[0].planned_reps_min, null);
    assert.equal(latest.data.latest.payload.template_exercises[0].planned_reps_max, 12);
    console.log('OK en ligne : plage 8–12 et maximum seul conservés dans Neon et les anciennes versions.');
  }
  console.log('OK en ligne : écriture/lecture PostgreSQL, historique restaurable, conflit, isolation et origine.');
  assert.equal((await call('/api/auth/sign-out', {})).status, 200);
  assert.equal((await call('/api/backups', undefined, owner)).status, 401, 'refus après déconnexion');
  const signin = await call('/api/auth/sign-in/email', { email, password });
  assert.equal(signin.status, 200, `Connexion : HTTP ${signin.status}, ${signin.data.message ?? signin.data.error ?? 'réponse inattendue'}`);
  assert.equal((await call('/api/auth/get-session')).data.user?.id, id);
  assert.equal((await call('/api/backups', undefined, owner)).data.latest.revision, 2, 'sauvegarde après reconnexion');
  await call('/api/auth/sign-out', {});
  console.log('OK en ligne : déconnexion, reconnexion et récupération de la sauvegarde.');
} catch (error) { console.error(error.message); process.exitCode = 1; }

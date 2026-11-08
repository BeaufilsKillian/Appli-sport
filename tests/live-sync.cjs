const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const initSqlJs = require('sql.js');
const { load, device } = require('./sync.cjs');
const { synchronize, combineCopies } = load('src/web/synchronize.ts');
const d = load('src/db.ts');
const origin = process.argv[2];
if (!origin || new URL(origin).origin !== origin) throw Error('Origine requise.');
const cookies = new Map();
async function call(path, body, extra = {}) {
  const response = await fetch(origin + path, { method: body === undefined ? 'GET' : 'POST',
    headers: { Origin: origin, 'X-Training-Client': '1', Cookie: [...cookies].map(([key, value]) => key + '=' + value).join('; '), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...extra },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(30_000) });
  for (const header of response.headers.getSetCookie()) {
    const pair = header.split(';')[0], index = pair.indexOf('=');
    if (pair.slice(index + 1)) cookies.set(pair.slice(0, index), pair.slice(index + 1)); else cookies.delete(pair.slice(0, index));
  }
  const data = await response.json();
  if (!response.ok) throw Error('HTTP ' + response.status + ' : ' + (data.message ?? data.error ?? 'Erreur'));
  return data;
}
(async () => {
  const email = 'codex-e2e-' + Date.now() + '@example.com';
  const signup = await call('/api/auth/sign-up/email', { name: 'Test synchro deux appareils', email, password: crypto.randomBytes(24).toString('base64url') });
  const id = signup.user.id;
  const accounts = fs.existsSync('.expo/live-test-accounts.json') ? JSON.parse(fs.readFileSync('.expo/live-test-accounts.json')) : [];
  accounts.push({ id, email, createdAt: new Date().toISOString() });
  fs.writeFileSync('.expo/live-test-accounts.json', JSON.stringify(accounts));
  const headers = { 'X-Training-Owner': id };
  const transport = { get: () => call('/api/backups', undefined, headers), save: (baseVersion, data) => call('/api/backups', { baseVersion, data }, headers) };
  const engine = await initSqlJs(), phone = await device(engine), pc = await device(engine);
  const sync = target => synchronize(target.db, transport, () => true);
  try {
    for (let i = 0; i < 12; i++) await pc.db.withExclusiveTransactionAsync(d.initDatabase);
    const folder = await d.createFolder(phone.db, 'Téléphone');
    await d.createTemplate(phone.db, 'Séance téléphone 1', folder);
    await sync(phone); assert.ok((await sync(pc)).restored);
    assert.equal((await d.fetchOverview(pc.db)).templates.length, 1);
    await d.createTemplate(phone.db, 'Séance téléphone 2', folder);
    await sync(phone); assert.ok((await sync(pc)).restored);
    assert.equal((await d.fetchOverview(pc.db)).templates.length, 2);
    await pc.reopen(true);
    await d.createFolder(phone.db, 'Ajout après réouverture');
    await sync(phone); assert.ok((await sync(pc)).restored);
    await d.createFolder(pc.db, 'Ajout depuis le PC'); await sync(pc);
    assert.ok((await sync(phone)).restored);
    assert.ok((await d.fetchOverview(phone.db)).folders.some(row => row.name === 'Ajout depuis le PC'));
    const version = (await transport.get()).latest.revision;
    await phone.reopen(); await pc.reopen(); await sync(phone); await sync(pc);
    assert.equal((await transport.get()).latest.revision, version, 'aucune sauvegarde supplémentaire à la simple ouverture');
    await d.createFolder(pc.db, 'Création PC hors ligne');
    await d.createFolder(phone.db, 'Création téléphone hors ligne');
    await d.saveSettings(phone.db, { ...(await d.getSettings(phone.db)), username: 'Profil téléphone de test', age: '32' });
    await sync(phone);
    assert.match((await sync(pc)).status, /deux appareils/);
    const combined = await combineCopies(pc.db, transport, () => true);
    assert.equal(combined.status, 'Sauvegardé en ligne');
    assert.equal((await d.getSettings(pc.db)).username, 'Profil téléphone de test');
    await sync(phone);
    assert.ok((await d.fetchOverview(phone.db)).folders.some(row => row.name === 'Création PC hors ligne'));
    assert.ok((await d.fetchOverview(pc.db)).folders.some(row => row.name === 'Création téléphone hors ligne'));
    console.log('OK réel : réunion explicite de copies divergentes, dossiers des deux appareils conservés et informations du profil récupérées.');
    console.log('OK réel Vercel/Neon : téléphone → PC déjà ouvert, nouveaux ajouts sans déconnexion, ancienne copie réouverte, PC → téléphone, absence de copies inutiles.');
  } finally { await phone.db.close(); await pc.db.close(); await call('/api/auth/sign-out', {}); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { PGlite } = require('@electric-sql/pglite');
const initSqlJs = require('sql.js');
const cache = new Map();
function load(file, mocks = {}) {
  const absolute = path.resolve(file);
  if (cache.has(absolute)) return cache.get(absolute).exports;
  const mod = { exports: {} }; cache.set(absolute, mod);
  const js = ts.transpileModule(fs.readFileSync(absolute, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  new Function('module', 'exports', 'require', js)(mod, mod.exports, name => {
    if (mocks[name] || mocks[name.replace(/\.js$/, '')]) return mocks[name] || mocks[name.replace(/\.js$/, '')];
    if (name.startsWith('.')) return load(path.resolve(path.dirname(absolute), name.replace(/\.js$/, '')) + '.ts', mocks);
    return require(name);
  });
  return mod.exports;
}
(async () => {
  const { LocalDatabase, indexedPersistence } = load('src/web/localDatabase.ts');
  const d = load('src/db.ts');
  const { parseBackup } = load('src/backup.ts');
  const engine = await initSqlJs();
  let stored, fail = false;
  const persistence = { read: async () => stored, write: async state => { if (fail) throw Error('disque plein'); stored = structuredClone(state); } };
  const db = new LocalDatabase(engine, persistence);
  await db.withExclusiveTransactionAsync(d.initDatabase);
  const folder = await d.createFolder(db, 'Test hors ligne');
  const templateId = await d.createTemplate(db, 'Push', folder);
  await d.addExercise(db, templateId, 'bench');
  let overview = await d.fetchOverview(db);
  const started = await d.startSelectedSession(db, overview.templates[0], overview.templateExercises, []);
  await d.updateLoggedSet(db, { ...started.sets[0], weight: 42.5, reps: 11, completed: 1 });
  const saved = await db.snapshot(); assert.equal(saved.data.logged_sets[0].weight, 42.5);
  const reopened = new LocalDatabase(engine, persistence, stored);
  assert.equal((await d.fetchOverview(reopened)).activeSets[0].reps, 11, 'données conservées après fermeture');
  fail = true;
  await assert.rejects(d.createFolder(db, 'ne doit pas exister'), /plein/);
  assert.equal((await d.fetchOverview(db)).folders.length, 1, 'échec IndexedDB : rollback en mémoire aussi'); fail = false;
  let resume;
  const gate = new Promise(resolve => { resume = resolve; });
  const tx = db.withExclusiveTransactionAsync(async handle => { await handle.runAsync('INSERT INTO folders VALUES (?,?,?)', 'transaction', 'Transaction', 1); await gate; throw Error('annuler'); });
  const outside = d.createFolder(db, 'Hors transaction'); resume();
  await assert.rejects(tx, /annuler/); await outside;
  assert.equal((await db.getAllAsync('SELECT * FROM folders WHERE id = ?', 'transaction')).length, 0);
  assert.equal((await d.fetchOverview(db)).folders.length, 2, 'écriture extérieure exclue du rollback');
  const beforeRestore = await db.snapshot();
  await assert.rejects(db.restore({ ...saved.data, sessions: [] }), /manquante/);
  assert.deepEqual((await db.snapshot()).data.folders, beforeRestore.data.folders);
  await assert.rejects(db.restore(saved.data, 2, -100), /changé/);
  await db.restore(saved.data, 7, db.meta.revision);
  assert.equal(db.meta.syncedRevision, db.meta.revision); assert.equal(db.meta.remoteVersion, 7);
  const ranged = await db.snapshot();
  ranged.data.template_exercises[0].planned_reps_min = null;
  ranged.data.template_exercises[0].planned_reps_max = 12;
  ranged.data.template_exercises[0].planned_reps = 12;
  await db.restore(ranged.data, 7, db.meta.revision);
  await db.withExclusiveTransactionAsync(d.initDatabase);
  const afterRangeRestore = await db.snapshot();
  assert.equal(afterRangeRestore.data.template_exercises[0].planned_reps_min, null);
  assert.equal(afterRangeRestore.data.template_exercises[0].planned_reps_max, 12);
  const capturedRevision = db.meta.revision;
  await d.createFolder(db, 'Après sauvegarde'); await db.acknowledge(8, capturedRevision);
  assert.ok(db.meta.revision > db.meta.syncedRevision, 'une sauvegarde en vol ne marque pas les nouvelles modifications comme envoyées');
  assert.throws(() => parseBackup({ ...saved.data, logged_sets: [{ ...saved.data.logged_sets[0], weight: -1 }] }), /invalide/);

  // Le vrai IndexedDB simulé vérifie séparation des comptes et rétention des copies.
  global.indexedDB = require('fake-indexeddb').indexedDB;
  const a = indexedPersistence('alice'), b = indexedPersistence('bob');
  for (let revision = 1; revision <= 12; revision++) await a.write({ ...stored, revision }, true);
  assert.equal((await a.read()).revision, 12); assert.equal(await b.read(), undefined);

  // Exécute la migration PostgreSQL et les vraies requêtes paramétrées dans PGlite.
  const pg = new PGlite(); await pg.exec(fs.readFileSync('migrations/001_backups.sql', 'utf8'));
  function sql(strings, ...params) { return { text: strings.reduce((s, part, index) => s + (index ? '$' + index : '') + part, ''), params, then(resolve, reject) { return pg.query(this.text, this.params).then(result => result.rows).then(resolve, reject); } }; }
  sql.transaction = queries => pg.transaction(async handle => { const output = []; for (const q of queries) output.push((await handle.query(q.text, q.params)).rows); return output; });
  const { backupStore } = load('server/backupStore.ts', { '@neondatabase/serverless': { neon: () => sql } });
  const store = backupStore('mock');
  assert.equal((await store.save('alice', 0, saved.data)).revision, 1);
  assert.equal(await store.save('alice', 0, saved.data), null, 'version périmée refusée');
  assert.equal((await store.save('alice', 1, saved.data)).revision, 2);
  assert.equal((await store.get('bob')).latest, null, 'isolation des comptes');
  assert.equal((await store.get('alice', 1)).latest.revision, 1, 'restauration d’une ancienne copie');
  for (let version = 2; version < 13; version++) await store.save('alice', version, saved.data);
  assert.equal((await store.get('alice')).versions.length, 10);
  const light = await store.get('alice', undefined, 13);
  assert.equal(light.latest.revision, 13);
  assert.equal(light.latest.payload, null, 'aucun JSON transféré depuis PostgreSQL si la version est inchangée');
  assert.ok((await store.get('alice', undefined, 12)).latest.payload, 'une version différente renvoie toutes les données');
  assert.equal((await store.get('bob', undefined, 13)).latest, null, 'version connue sans accès à un autre compte');
  assert.equal((await store.get('alice', 1)).latest, null, 'rétention des dix dernières copies');
  assert.equal(await store.save('absent', 8, saved.data), null, 'aucun compte créé avec une version initiale invalide');
  assert.equal((await pg.query('SELECT * FROM training_heads WHERE owner_id=$1', ['absent'])).rows.length, 0);

  const { assertSameOrigin, ApiError } = load('server/security.ts', { '@neondatabase/auth/server': { createAuthServer: () => ({}), serializeSetCookie: () => '', resolveNeonAuthLogging: () => ({}) } });
  assert.throws(() => assertSameOrigin({ headers: { origin: 'https://evil.invalid', 'x-training-client': '1' } }, 'https://app.invalid'), ApiError);
  assertSameOrigin({ headers: { origin: 'https://app.invalid', 'x-training-client': '1' } }, 'https://app.invalid');
  // Le handler ne fait jamais confiance à l'identifiant envoyé par le navigateur.
  const security = { ApiError, assertSameOrigin, privateResponse: () => {}, settings: () => ({ origin: 'https://app.invalid', baseUrl: 'https://auth.invalid', cookieSecret: 'x'.repeat(40) }),
    requireUser: async req => { if (!req.headers.cookie) throw new ApiError(401, 'Session absente'); return 'alice'; },
    sendError: (res, error) => res.status(error.status ?? 500).json({ error: error.message }) };
  const { default: handler } = load('api/backups.ts', { '../server/security': security, '../server/backupStore': { backupStore: () => store } });
  function response() { return { code: 200, headers: {}, setHeader(key, value) { this.headers[key] = value; }, status(code) { this.code = code; return this; }, json(value) { this.value = value; return this; }, send(value) { this.value = value; return this; } }; }
  let res = response(); await handler({ method: 'GET', query: {}, headers: { 'x-training-owner': 'alice' } }, res); assert.equal(res.code, 401);
  res = response(); await handler({ method: 'GET', query: {}, headers: { cookie: 'verified', 'x-training-owner': 'bob' } }, res); assert.equal(res.code, 403);
  res = response(); await handler({ method: 'GET', query: {}, headers: { cookie: 'verified', 'x-training-owner': 'alice' } }, res); assert.equal(res.value.latest.revision, 13);
  res = response(); await handler({ method: 'GET', query: { knownVersion: '13' }, headers: { cookie: 'verified', 'x-training-owner': 'alice' } }, res); assert.equal(res.value.latest.payload, null);
  res = response(); await handler({ method: 'GET', query: { knownVersion: '-1' }, headers: { cookie: 'verified', 'x-training-owner': 'alice' } }, res); assert.equal(res.code, 400);
  res = response(); await handler({ method: 'POST', query: {}, body: {}, headers: { cookie: 'verified', origin: 'https://evil.invalid', 'x-training-client': '1', 'x-training-owner': 'alice' } }, res); assert.equal(res.code, 403);
  let forwarded;
  const { default: authHandler } = load('api/auth.ts', { '../server/security': security, '@neondatabase/auth/server': { resolveNeonAuthLogging: () => ({}), handleAuthProxyRequest: async config => { forwarded = config; return new Response(JSON.stringify({ user: { id: 'alice' } }), { headers: { 'Content-Type': 'application/json', 'Set-Cookie': 'session=opaque; HttpOnly; Secure; SameSite=Strict' } }); } } });
  res = response(); await authHandler({ method: 'GET', url: '/api/auth/get-session', query: { path: 'get-session' }, headers: {} }, res); assert.equal(res.code, 200); assert.equal(forwarded.path, 'get-session'); assert.ok(res.headers['Set-Cookie'][0].includes('HttpOnly'));
  forwarded = undefined; res = response(); await authHandler({ method: 'POST', url: '/api/auth/sign-in/email', query: { path: 'sign-in/email' }, body: { callbackURL: 'https://evil.invalid' }, headers: { origin: 'https://app.invalid', 'x-training-client': '1' } }, res); assert.equal(res.code, 400); assert.equal(forwarded, undefined);
  res = response(); await authHandler({ method: 'GET', query: { path: 'admin/delete-user' }, headers: {} }, res); assert.equal(res.code, 404);
  // Une erreur d'observation ne transforme pas un commit réussi en rollback mémoire.
  const unsubscribe = db.subscribe(() => { throw Error('observateur'); });
  await d.createFolder(db, 'Commit protégé'); unsubscribe();
  assert.ok((await db.snapshot()).data.folders.some(row => row.name === 'Commit protégé'));
  await pg.close(); await db.close(); await reopened.close();
  console.log('OK PWA : persistance/rechargement, rollback disque plein, transactions isolées, import validé, conflits, comptes séparés, PostgreSQL, rétention et contrôle d’origine.');
})().catch(error => { console.error(error); process.exitCode = 1; });

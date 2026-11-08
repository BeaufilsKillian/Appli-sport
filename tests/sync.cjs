const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const initSqlJs = require('sql.js');
const cache = new Map();
function load(file) {
  const absolute = path.resolve(file);
  if (cache.has(absolute)) return cache.get(absolute).exports;
  const mod = { exports: {} }; cache.set(absolute, mod);
  const js = ts.transpileModule(fs.readFileSync(absolute, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  new Function('module', 'exports', 'require', js)(mod, mod.exports, name => name.startsWith('.') ? load(path.resolve(path.dirname(absolute), name.replace(/\.js$/, '')) + '.ts') : require(name));
  return mod.exports;
}
const { LocalDatabase } = load('src/web/localDatabase.ts');
const { synchronize, combineCopies } = load('src/web/synchronize.ts');
const { backupFingerprint } = load('src/web/backupFingerprint.ts');
const d = load('src/db.ts');
async function device(engine) {
  let stored;
  const copies = new Map();
  const persistence = {
    read: async () => structuredClone(stored), readCopy: async revision => structuredClone(copies.get(revision)),
    write: async (state, keep) => { stored = structuredClone(state); if (keep) copies.set(state.revision, structuredClone(state)); },
  };
  let db = new LocalDatabase(engine, persistence);
  await db.withExclusiveTransactionAsync(d.initDatabase);
  return {
    get db() { return db; }, get stored() { return stored; }, copies,
    async reopen(legacy = false) {
      await db.close();
      if (legacy) delete stored.syncedFingerprint;
      db = new LocalDatabase(engine, persistence, stored);
      await db.recoverSyncBaseline(); await db.withExclusiveTransactionAsync(d.initDatabase);
    },
  };
}
function cloud() {
  let latest = null; const versions = [];
  return {
    get latest() { return latest; },
    async get() { return structuredClone({ latest, versions }); },
    async save(base, data) {
      assert.equal(base, latest?.revision ?? 0, 'CAS');
      latest = { revision: base + 1, payload: structuredClone(data), created_at: new Date().toISOString() };
      versions.unshift({ revision: latest.revision, created_at: latest.created_at });
      return { revision: latest.revision };
    },
  };
}
async function localTests() {
  const engine = await initSqlJs();
  const phone = await device(engine), pc = await device(engine), server = cloud();
  const sync = (target, busy = false, transport = server) => synchronize(target.db, transport, () => !busy);
  for (let i = 0; i < 15; i++) await pc.db.withExclusiveTransactionAsync(d.initDatabase);
  assert.equal((await sync(pc)).status, 'Prêt à synchroniser'); assert.equal(server.latest, null, 'pas de copies vides répétées');
  const folder = await d.createFolder(phone.db, 'Téléphone');
  await d.createTemplate(phone.db, 'Push', folder);
  await sync(phone);
  assert.ok((await sync(pc)).restored, 'PC déjà ouvert plusieurs fois : télécharger les données du téléphone');
  assert.equal((await d.fetchOverview(pc.db)).templates[0].title, 'Push');
  await pc.reopen();
  await d.createFolder(phone.db, 'Ajout après connexion PC'); await sync(phone);
  assert.ok((await sync(pc)).restored, 'deuxième modification du téléphone récupérée sans nouvelle connexion');
  const { createBackupTransport } = load('src/web/backupTransport.ts');
  let downloads = 0, checks = 0;
  const transport = createBackupTransport(async (url, body, headers) => {
    assert.equal(headers['X-Training-Owner'], 'alice');
    if (body) return server.save(body.baseVersion, body.data);
    const response = await server.get(); checks++;
    const known = new URL(url, 'https://app.invalid').searchParams.get('knownVersion');
    if (response.latest && known === String(response.latest.revision)) response.latest.payload = null;
    else downloads++;
    return response;
  }, 'alice');
  await synchronize(pc.db, transport, () => true);
  for (let i = 0; i < 20; i++) await synchronize(pc.db, transport, () => true);
  assert.equal(downloads, 1, 'vingt vérifications sans retélécharger la sauvegarde');
  assert.equal(checks, 21);
  await d.createFolder(phone.db, 'Nouvelle version après vérifications légères'); await sync(phone);
  assert.ok((await synchronize(pc.db, transport, () => true)).restored);
  assert.equal(downloads, 2, 'modification distante téléchargée immédiatement');
  const bobTransport = createBackupTransport(async (url, body, headers) => {
    assert.equal(url, '/api/backups', 'un autre compte repart sans version en cache');
    assert.equal(headers['X-Training-Owner'], 'bob');
    return { latest: null, versions: [] };
  }, 'bob');
  assert.equal((await bobTransport.get()).latest, null);
  const invalidTransport = createBackupTransport(async () => ({ latest: { revision: 99, payload: null, created_at: '' }, versions: [] }), 'alice');
  await assert.rejects(invalidTransport.get(), /incohérente/, 'ne jamais substituer une copie absente à une réponse partielle invalide');
  const currentVersion = server.latest.revision;
  await d.saveSettings(pc.db, await d.getSettings(pc.db));
  await sync(pc); assert.equal(server.latest.revision, currentVersion, 'pas de nouvelle sauvegarde pour les valeurs implicites');
  await pc.reopen(true); // Ancienne version sans empreinte, copies IndexedDB toujours présentes.
  await d.createFolder(phone.db, 'Après réouverture'); await sync(phone);
  assert.ok((await sync(pc)).restored, 'récupération de la référence de synchronisation dans une ancienne copie locale');
  await d.createFolder(phone.db, 'Saisie en cours'); await sync(phone);
  assert.match((await sync(pc, true)).status, /ferme la saisie/);
  assert.ok(!(await d.fetchOverview(pc.db)).folders.some(row => row.name === 'Saisie en cours'));
  assert.ok((await sync(pc)).restored);
  await d.createFolder(pc.db, 'Modification PC hors ligne');
  await d.createFolder(phone.db, 'Modification téléphone hors ligne');
  await d.saveSettings(phone.db, { ...(await d.getSettings(phone.db)), username: 'Profil téléphone', age: '32', weight: '75' });
  await sync(phone);
  const conflict = await sync(pc);
  assert.match(conflict.status, /deux appareils/); assert.equal(conflict.restored, false);
  assert.ok((await d.fetchOverview(pc.db)).folders.some(row => row.name === 'Modification PC hors ligne'));
  assert.ok(server.latest.payload.folders.some(row => row.name === 'Modification téléphone hors ligne'));
  assert.ok(!server.latest.payload.folders.some(row => row.name === 'Modification PC hors ligne'));

  const combined = await combineCopies(pc.db, server, () => true);
  assert.equal(combined.status, 'Sauvegardé en ligne');
  const combinedOverview = await d.fetchOverview(pc.db);
  assert.ok(combinedOverview.folders.some(row => row.name === 'Modification PC hors ligne'));
  assert.ok(combinedOverview.folders.some(row => row.name === 'Modification téléphone hors ligne'));
  assert.equal((await d.getSettings(pc.db)).username, 'Profil téléphone', 'préserver les informations réelles plutôt que les valeurs implicites du PC');
  await sync(phone);
  assert.ok((await d.fetchOverview(phone.db)).folders.some(row => row.name === 'Modification PC hors ligne'));
  await d.renameFolder(pc.db, folder, 'Nom choisi sur PC');
  await d.renameFolder(phone.db, folder, 'Nom choisi sur téléphone'); await sync(phone);
  await assert.rejects(combineCopies(pc.db, server, () => true), /même élément/);
  assert.equal((await pc.db.getFirstAsync('SELECT name FROM folders WHERE id=?', folder)).name, 'Nom choisi sur PC');
  assert.equal(server.latest.payload.folders.find(row => row.id === folder).name, 'Nom choisi sur téléphone');

  const deleting = await device(engine), deletionCloud = cloud();
  const deletedId = await d.createFolder(deleting.db, 'Suppression volontaire');
  await sync(deleting, false, deletionCloud);
  await deleting.db.runAsync('DELETE FROM folders WHERE id=?', deletedId);
  await sync(deleting, false, deletionCloud);
  assert.equal(deletionCloud.latest.payload.folders.length, 0, 'ne pas annuler une suppression locale en récupérant la copie ancienne');

  const inflight = await device(engine), inflightCloud = cloud();
  await d.createFolder(inflight.db, 'Avant envoi');
  await sync(inflight, false, { get: () => inflightCloud.get(), save: async (base, data) => {
    await d.createFolder(inflight.db, 'Pendant envoi'); return inflightCloud.save(base, data);
  } });
  assert.ok(inflight.db.meta.revision > inflight.db.meta.syncedRevision);
  await sync(inflight, false, inflightCloud);
  assert.equal(inflightCloud.latest.payload.folders.length, 2, 'écritures pendant une sauvegarde conservées');

  const guard = await device(engine);
  let calls = 0;
  await assert.rejects(synchronize(guard.db, server, () => ++calls === 1), /saisie en cours/);
  assert.equal((await d.fetchOverview(guard.db)).folders.length, 0, 'formulaire ouvert pendant le téléchargement : aucun remplacement');
  const before = (await phone.db.snapshot()).data;
  const shuffled = structuredClone(before); shuffled.exported_at = '2000-01-01'; shuffled.folders.reverse();
  assert.equal(await backupFingerprint(before), await backupFingerprint(shuffled), 'ordre SQL et date d’export ignorés');
  for (const target of [phone, pc, deleting, inflight, guard]) await target.db.close();
  console.log('OK synchro : deux appareils, copie vide déjà ouverte, retour au premier plan, réouverture ancienne version, valeurs inchangées, formulaires protégés, conflit conservé, suppression et écritures pendant envoi.');
}
module.exports = { load, device, localTests };
if (require.main === module) localTests().catch(error => { console.error(error); process.exitCode = 1; });

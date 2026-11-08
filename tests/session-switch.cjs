// SQLite en mémoire et contrôles de confirmation simulés : aucune donnée iPhone.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { DatabaseSync } = require('node:sqlite');
const root = path.resolve(__dirname, '..');
function compile(source) {
  return ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
}
const mod = { exports: {} };
new Function('module', 'exports', 'require', compile(fs.readFileSync(path.join(root, 'src/db.ts'), 'utf8')))(mod, mod.exports, require);
const d = mod.exports;
const conn = new DatabaseSync(':memory:');
const db = {
  execAsync: async sql => conn.exec(sql),
  runAsync: async (sql, ...args) => conn.prepare(sql).run(...args),
  getFirstAsync: async (sql, ...args) => conn.prepare(sql).get(...args) ?? null,
  getAllAsync: async (sql, ...args) => conn.prepare(sql).all(...args),
  withExclusiveTransactionAsync: async fn => {
    conn.exec('BEGIN');
    try { await fn(db); conn.exec('COMMIT'); } catch (e) { conn.exec('ROLLBACK'); throw e; }
  },
};
function count(sql) { return conn.prepare(sql).get().n; }
(async () => {
  await d.initDatabase(db);
  const push = { id: 'push', title: 'Push', folder_id: null };
  const gg = { id: 'gg', title: 'Gg', folder_id: null };
  const plans = [{ exercise_id: 'bench', position: 0, planned_sets: 2, planned_reps: 8, rest_seconds: 90 }];
  let first = await d.startSelectedSession(db, push, plans, []);
  const resumed = await d.startSelectedSession(db, push, [], []);
  assert.equal(resumed.session.id, first.session.id, 'reprise du même modèle même si modifié ensuite');
  await assert.rejects(d.startSelectedSession(db, gg, plans, []), /changé/);
  await assert.rejects(d.startSelectedSession(db, gg, plans, [], { id: first.session.id, allowDiscard: false }), /confirmé/);
  assert.equal(count('SELECT COUNT(*) n FROM sessions'), 1);
  const replacement = await d.startSelectedSession(db, gg, plans, [], { id: first.session.id, allowDiscard: true });
  assert.equal(replacement.session.template_id, 'gg');
  assert.equal(count('SELECT COUNT(*) n FROM sessions'), 1, 'séance sans série validée supprimée après accord');
  await d.updateLoggedSet(db, { ...replacement.sets[0], weight: 42.5, completed: 1 });
  const next = await d.startSelectedSession(db, push, plans, [], { id: replacement.session.id, allowDiscard: false });
  assert.equal(count('SELECT COUNT(*) n FROM sessions WHERE finished_at IS NOT NULL'), 1);
  const history = await db.getFirstAsync('SELECT * FROM logged_sets WHERE id = ?', replacement.sets[0].id);
  assert.equal(history.weight, 42.5, 'performance préservée');
  const before = JSON.stringify(await d.exportAllData(db));
  await assert.rejects(d.startSelectedSession(db, gg, [], [], { id: next.session.id, allowDiscard: true }), /exercice/);
  const originalRun = db.runAsync;
  db.runAsync = async (sql, ...args) => {
    if (sql.startsWith('INSERT INTO logged_sets')) throw Error('échec simulé');
    return originalRun(sql, ...args);
  };
  await assert.rejects(d.startSelectedSession(db, gg, plans, [], { id: next.session.id, allowDiscard: true }), /simulé/);
  db.runAsync = originalRun;
  const after = await d.exportAllData(db);
  const beforeData = JSON.parse(before); delete beforeData.exported_at; delete after.exported_at;
  assert.deepEqual(JSON.parse(JSON.stringify(after)), beforeData, 'rollback intégral après échec de création');

  // Exécute le vrai gestionnaire du bouton avec Alert et état React simulés.
  const app = fs.readFileSync(path.join(root, 'App.tsx'), 'utf8');
  const handler = app.slice(app.indexOf('  async function beginWorkout('), app.indexOf('  function askFinishWorkout('));
  function ui(active, completed = 0) {
    const state = { page: 'template', alerts: [], calls: 0, startingWorkout: { current: false } };
    const values = {
      active, activeComplete: completed, startingWorkout: state.startingWorkout,
      relations: [{ ...plans[0], template_id: gg.id }], db, exerciseMaxes: [],
      Alert: { alert: (...args) => state.alerts.push(args) },
      setPage: page => { state.page = page; },
      safe: async fn => fn(),
      startSelectedSession: async () => { state.calls++; return { session: gg, sets: [], sessionExercises: [] }; },
      setActive: () => {}, setActiveSets: () => {}, setActiveSessionExercises: () => {},
      setExerciseIndex: () => {}, setRestEndsAt: () => {}, setRestSeconds: () => {}, setRestPaused: () => {},
      refresh: async () => {},
    };
    state.begin = new Function(...Object.keys(values), compile(handler) + '\nreturn beginWorkout;')(...Object.values(values));
    return state;
  }
  let u = ui({ ...push, template_id: 'push', template_title: 'Push' });
  await u.begin(gg); await u.begin(gg);
  assert.equal(u.alerts.length, 1, 'double appui ignoré pendant le choix');
  u.alerts[0][2][0].onPress();
  assert.equal(u.calls, 0, 'annuler ne lance ni ne remplace');
  await u.begin(gg); u.alerts[1][2][1].onPress();
  assert.equal(u.page, 'workout'); assert.equal(u.calls, 0, 'reprise explicite ancienne');
  u = ui({ ...push, template_id: 'push', template_title: 'Push' });
  await u.begin(gg); u.alerts[0][2][2].onPress();
  assert.match(u.alerts[1][1], /saisies non validées/);
  assert.equal(u.calls, 0, 'deuxième confirmation avant suppression');
  u.alerts[1][2][1].onPress(); await new Promise(resolve => setImmediate(resolve));
  assert.equal(u.calls, 1); assert.equal(u.page, 'workout');
  u = ui(null); await Promise.all([u.begin(gg), u.begin(gg)]);
  assert.equal(u.calls, 1, 'double lancement ignoré');
  u = ui({ ...push, template_id: 'push', template_title: 'Push' }, 1);
  await u.begin(gg); u.alerts[0][2][2].onPress(); await new Promise(resolve => setImmediate(resolve));
  assert.equal(u.calls, 1, 'terminer et lancer après séries validées');
  assert.equal(u.alerts.length, 1);
  u = ui({ ...gg, template_id: 'gg' }); await u.begin(gg);
  assert.equal(u.page, 'workout'); assert.equal(u.calls, 0, 'même séance reprise');
  conn.close();
  console.log('OK : changement de séance, historique, consentement, annulation, reprise, rollback et double appui.');
})().catch(err => { console.error(err); process.exit(1); });

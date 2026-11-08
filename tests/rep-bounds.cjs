const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const {load}=require('./sync.cjs');
const d = load('src/db.ts'), { parseBackup } = load('src/backup.ts');
const raw = new DatabaseSync(':memory:');
const db = {
  execAsync: async sql => raw.exec(sql),
  runAsync: async (sql, ...args) => raw.prepare(sql).run(...args),
  getAllAsync: async (sql, ...args) => raw.prepare(sql).all(...args),
  getFirstAsync: async (sql, ...args) => raw.prepare(sql).get(...args) ?? null,
  withExclusiveTransactionAsync: async fn => { raw.exec('BEGIN'); try { const value = await fn(db); raw.exec('COMMIT'); return value; } catch (error) { raw.exec('ROLLBACK'); throw error; } },
};
(async () => {
  await d.initDatabase(db);
  const folder = await d.createFolder(db, 'Test');
  const template = await d.createTemplate(db, 'Plage', folder);
  await d.addExercise(db, template, 'bench');
  const plan = () => db.getFirstAsync('SELECT * FROM template_exercises WHERE template_id=?', template);
  assert.equal(d.repRangeLabel(await plan()), '8');
  for (const [min, max, label, target] of [[8, null, '8', 8], [null, 12, '12', 12], [8, 12, '8–12', 8], [null, null, '', 0], [10, 10, '10–10', 10]]) {
    await d.changeExercisePlan(db, template, 'bench', 3, target, 120, false, 10, 0, false, '', max, min);
    const saved = await plan();
    assert.equal(saved.planned_reps_min, min); assert.equal(saved.planned_reps_max, max);
    assert.equal(d.repRangeLabel(saved), label); assert.equal(d.repTarget(saved), target);
    const backup = parseBackup(await d.exportAllData(db));
    assert.equal(backup.schema, 11); assert.equal(backup.template_exercises[0].planned_reps_min, min); assert.equal(backup.template_exercises[0].planned_reps_max, max);
    assert.equal(parseBackup(JSON.parse(JSON.stringify(backup))).template_exercises[0].planned_reps_max, max);
    await d.initDatabase(db);
    assert.equal((await plan()).planned_reps_min, min, 'réouverture sans écraser une borne vide');
    const overview = await d.fetchOverview(db);
    const copy = await d.duplicateTemplate(db, overview.templates[0]);
    const copied = await db.getFirstAsync('SELECT * FROM template_exercises WHERE template_id=?', copy);
    assert.equal(copied.planned_reps_min, min); assert.equal(copied.planned_reps_max, max);
    const session = await d.startSession(db, overview.templates[0], [saved], []);
    assert.equal(session.sets[0].reps, target, 'saisies de séance numériques, aucune plage dans les performances réelles');
    await d.discardSession(db, session.session.id);
  }
  await assert.rejects(d.changeExercisePlan(db, template, 'bench', 3, 12, 120, false, 10, 0, false, '', 8, 12), /minimum/);
  for (const value of [0, -1, 201, 8.5, NaN]) await assert.rejects(d.changeExercisePlan(db, template, 'bench', 3, 8, 120, false, 10, 0, false, '', value, null));
  const old = await d.exportAllData(db); old.schema = 8;
  old.template_exercises = old.template_exercises.map(({ planned_reps_min, planned_reps_max, ...row }) => ({ ...row, planned_reps: 8 }));
  old.settings = old.settings.filter(row => row.key !== 'migration_rep_bounds');
  const upgraded = parseBackup(old);
  assert.equal(upgraded.schema, 11); assert.equal(upgraded.template_exercises[0].planned_reps_min, 8); assert.equal(upgraded.template_exercises[0].planned_reps_max, null);
  assert.ok(upgraded.settings.some(row => row.key === 'migration_rep_bounds'));
  const bad = structuredClone(upgraded); bad.template_exercises[0].planned_reps_max = 4;
  assert.throws(() => parseBackup(bad), /Plage/);
  raw.close();
  console.log('OK : minimum seul, maximum seul, plage, champs vides, validation, duplication, séance, réouverture et sauvegardes 8→9.');
})().catch(error => { console.error(error); process.exitCode = 1; });

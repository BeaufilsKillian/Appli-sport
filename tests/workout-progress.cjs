const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
function load(file) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const mod = { exports: {} };
  new Function('require', 'exports', 'module', output)(name => load(`src/${name.replace('./', '')}.ts`), mod.exports, mod);
  return mod.exports;
}
const { workoutProgress } = load('src/workoutProgress.ts');
const { durationLabel } = load('src/theme.ts');
const plan = (id, reps = 8, rest = 120, group = 0, position = 0) => ({ exercise_id: id, position, superset_group: group, rest_seconds: rest, target_reps: reps });
const set = (id, ordinal, completed = 0, kind = 'normal', reps = 0) => ({ exercise_id: id, ordinal, completed, set_kind: kind, reps });
assert.equal(durationLabel(0), '00:00:00');
assert.equal(durationLabel(3661.9), '01:01:01');
assert.equal(durationLabel(25 * 3600), '25:00:00');
assert.equal(workoutProgress([], []), 0);
const plans = [plan('A', 8, 120), plan('B', 20, 30, 0, 1)];
const sets = [set('A', 1), set('A', 2), set('B', 1), set('B', 2)];
assert.equal(workoutProgress(plans, sets), 0);
assert.equal(workoutProgress(plans, sets.map(s => ({ ...s, completed: 1 }))), 1);
assert.equal(workoutProgress(plans, sets.map(s => ({ ...s, completed: +(s.exercise_id === 'A') }))), 198 / 378);
assert.equal(workoutProgress(plans, [set('A', 1, 1), set('B', 1)]), 39 / 114, 'pas de repos après la dernière série');
assert.equal(workoutProgress([plan('A')], [set('A', 1, 1), set('A', 2, 0, 'drop')]), .5, 'aucun repos avant un dropset');
const superPlans = [plan('A', 8, 120, 1), plan('B', 8, 90, 1, 1)];
assert.equal(workoutProgress(superPlans, [set('A', 1, 1), set('B', 1), set('A', 2), set('B', 2)]), 39 / 276, 'pas de repos validé avant la fin du tour');
assert.equal(workoutProgress(superPlans, [set('A', 1, 1), set('B', 1, 1), set('A', 2), set('B', 2)]), 198 / 276, 'un seul repos par tour');
assert.equal(workoutProgress([plan('A', 0, 0)], [set('A', 1, 1, 'normal', 12), set('A', 2, 0, 'normal', 12)]), .5);
assert.equal(workoutProgress([plan('A', 0, 0)], [set('A', 1)]), 0, 'objectif absent sans division par zéro');

// Le chrono reste local et recalcule depuis le départ après suspension.
const app = fs.readFileSync(path.join(root, 'App.tsx'), 'utf8');
const source = app.slice(app.indexOf('function SessionClock('), app.indexOf('const volume ='));
const output = ts.transpileModule(source + '\nexport { SessionClock };', { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2020 } }).outputText;
let now = 10000, state, tick, resume, cleanup, first = true, cleared = false, removed = false;
const mod = { exports: {} };
new Function('exports', 'React', 'Text', 'useUI', 'useState', 'useEffect', 'AppState', 'Date', 'setInterval', 'clearInterval', 'durationLabel', output)(
  mod.exports, { createElement: (_tag, _props, value) => value }, 'Text', () => ({ styles: {} }),
  init => { if (state === undefined) state = init(); return [state, value => { state = value; }]; },
  effect => { if (first) { first = false; cleanup = effect(); } },
  { addEventListener: (_event, listener) => { resume = listener; return { remove: () => { removed = true; } }; } },
  { now: () => now }, callback => { tick = callback; return 1; }, () => { cleared = true; }, durationLabel,
);
const render = () => mod.exports.SessionClock({ startedAt: 10000 });
assert.equal(render(), '00:00:00');
now = 11000; tick(); assert.equal(render(), '00:00:01');
now = 3671000; resume('active'); assert.equal(render(), '01:01:01');
cleanup(); assert(cleared && removed, 'nettoyage du chrono à la sortie');
console.log('OK - chrono local, reprise, heures, progression pondérée, supersets, dropsets et objectifs absents.');

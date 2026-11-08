const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
function load(file, dependency = require) {
  const mod = { exports: {} };
  const js = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  new Function('module', 'exports', 'require', js)(mod, mod.exports, dependency);
  return mod.exports;
}
const catalogue = load('src/catalogue.ts').EXERCISES;
const manifest = require('../assets/exercise-demos/sources.json');
const demos = load('src/exerciseDemos.ts', file => {
  const absolute = path.resolve(root, 'src', file);
  const data = fs.readFileSync(absolute);
  if (file.endsWith('.gif')) assert.match(data.subarray(0, 6).toString(), /^GIF8[79]a$/);
  else assert.equal(data.subarray(1, 4).toString(), 'PNG');
  return absolute;
}).EXERCISE_DEMOS;
assert.deepEqual(Object.keys(demos).sort(), Object.keys(manifest).sort());
for (const [id, demo] of Object.entries(demos)) {
  assert.ok(catalogue.some(ex => ex.id === id), `identifiant conservé : ${id}`);
  assert.ok(demo.width > 0 && demo.height > 0 && manifest[id].frames > 1);
  assert.equal(demo.page, manifest[id].page);
  assert.equal(new URL(demo.page).hostname, 'www.docteur-fitness.com');
}
assert.notEqual(demos.bench.animation, demos.ex020.animation, 'barre et haltères ont des GIF distincts');
assert.ok(demos.squat && demos.bench && demos.legcurl && demos.latpull);
assert.equal(demos.ex087, undefined, 'pas de Z-press haltères pour un développé assis barre');

let hooks = [], cursor = 0;
const react = {
  useEffect: () => {},
  useState: initial => {
    const index = cursor++;
    if (!(index in hooks)) hooks[index] = initial;
    return [hooks[index], value => { hooks[index] = typeof value === 'function' ? value(hooks[index]) : value; }];
  },
};
const jsx = (type, props) => ({ type, props: props || {} });
const palette = { blue: '#00F', white: '#FFF', muted: '#888', surfaceRaised: '#111' };
const component = load('src/ExerciseMotion.tsx', name => {
  if (name === 'react') return react;
  if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
  if (name === 'react-native') return { Image: 'Image', View: 'View', Text: 'Text', Pressable: 'Pressable', StyleSheet: { create: x => x }, Alert: {}, Linking: {} };
  if (name === './theme') return { C: palette, LIGHT_C: palette };
  if (name === './exerciseDemos') return { EXERCISE_DEMOS: demos };
  throw Error(name);
}).ExerciseMotion;
function walk(node) {
  if (Array.isArray(node)) return node.flatMap(walk);
  if (!node || typeof node !== 'object') return [];
  if (typeof node.type === 'function') return walk(node.type(node.props));
  return [node, ...walk(node.props.children)];
}
function render(id, width) { cursor = 0; return walk(component({ exercise: catalogue.find(ex => ex.id === id), width, animate: true })); }
assert.equal(render('bench', 64).find(x => x.type === 'Image').props.source, demos.bench.poster, 'miniature fixe dans la liste');
let large = render('bench', 204);
assert.equal(large.find(x => x.type === 'Image').props.source, demos.bench.animation, 'vrai GIF dans la fiche');
large.find(x => x.type === 'Pressable' && x.props.accessibilityRole === 'button').props.onPress();
assert.equal(render('bench', 204).find(x => x.type === 'Image').props.source, demos.bench.poster);
hooks = [];
assert.equal(render('ex087', 204).some(x => x.type === 'Image'), false, 'variante absente : aucun dessin ou GIF trompeur');
hooks = [];
render('bench', 204).find(x => x.type === 'Image').props.onError();
assert.equal(render('bench', 204).some(x => x.type === 'Image'), false, 'lien de secours si le média ne charge pas');
console.log(`OK : ${Object.keys(demos).length} correspondances, fichiers GIF/PNG, variantes et affichage liste/fiche/secours.`);

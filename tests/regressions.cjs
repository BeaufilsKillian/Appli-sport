// Tests locaux : depuis le projet Expo, node tests/regressions.cjs
// Ne modifie aucune donnée du téléphone ni la base SQLite.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript'); // dépendance du template Expo TypeScript
const project=path.resolve(__dirname,'..');
let tests=0;
function check(condition,msg) {assert.ok(condition,msg);tests++;}
function syntax(file){
  const source=fs.readFileSync(path.join(project,file),'utf8');
  const report=ts.transpileModule(source,{fileName:file,reportDiagnostics:true,compilerOptions:{
    module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,
  }});
  check(!report.diagnostics.some(d=>d.category===ts.DiagnosticCategory.Error),`Syntaxe invalide : ${file}`);
  return {source,output:report.outputText};
}
const app=syntax('App.tsx').source;
const motion=syntax('src/ExerciseMotion.tsx').source;
syntax('src/db.ts');
const helper=syntax('src/supersets.ts');
// Les coordonnées SVG ont été remplacées par des GIF : tests/exercise-demos.cjs.
check(!/\bplan\?\.to_failure\s*&&\s*</.test(app),
  'Condition numérique JSX: utilisez une condition booléenne ou ternaire pour to_failure');
check(!/\bplan\?\.superset_group\s*&&\s*</.test(app),
  'Condition numérique JSX: utilisez une condition booléenne ou ternaire pour superset_group');
check(/buildWorkoutRounds\(currentBlock, inBlock\)/.test(app),'L’affichage par tour doit être conservé');
const module1={exports:{}};
new Function('module','exports',helper.output)(module1,module1.exports);
const {buildWorkoutBlocks,buildWorkoutRounds}=module1.exports;
const plans=[{exercise_id:'A',position:0,superset_group:1,rest_seconds:90},
  {exercise_id:'Solo',position:1,superset_group:0,rest_seconds:120},
  {exercise_id:'B',position:2,superset_group:1,rest_seconds:90},
  {exercise_id:'Orphelin',position:3,superset_group:2,rest_seconds:120}];
const blocks=buildWorkoutBlocks(plans);
check(JSON.stringify(blocks.map(b=>b.exerciseIds))===JSON.stringify([['A','B'],['Solo'],['Orphelin']]),
  'Les supersets non adjacents doivent être réunis; les solos restent séparés');
check(blocks[2].group===0,'Un groupe avec un seul exercice doit être un exercice simple');
const sets=[{id:'A1',exercise_id:'A',ordinal:1,set_kind:'normal'},
  {id:'A2',exercise_id:'A',ordinal:2,set_kind:'normal'},
  {id:'A3',exercise_id:'A',ordinal:3,set_kind:'drop'},
  {id:'B1',exercise_id:'B',ordinal:1,set_kind:'normal'},
  {id:'B2',exercise_id:'B',ordinal:2,set_kind:'normal'}];
const rows=buildWorkoutRounds(blocks[0],sets).map(r=>r.rows.map(x=>x.set.id));
check(JSON.stringify(rows)===JSON.stringify([['A1','B1'],['A2','B2'],['A3']]),
  'Les tours doivent alterner A/B en gardant les séries supplémentaires et dropsets');
console.log(`OK : ${tests} vérifications locales, aucune modification des données.`);

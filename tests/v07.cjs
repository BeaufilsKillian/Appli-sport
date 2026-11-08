// Exécution sur le PC : node tests/v07.cjs (aucun accès au téléphone).
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
const {DatabaseSync}=require('node:sqlite');
const base=path.resolve(__dirname,'..');
let tested=0;
const verify=(ok,msg)=>{assert.ok(ok,msg);tested++;};
function compile(file){
  const source=fs.readFileSync(path.join(base,file),'utf8');
  const r=ts.transpileModule(source,{fileName:file,reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}});
  verify(!r.diagnostics?.some(d=>d.category===ts.DiagnosticCategory.Error),`Syntaxe : ${file}`);
  return {source,js:r.outputText};
}
function load(file){const r=compile(file);return {api:require('./sync.cjs').load(path.join(base,file)),source:r.source};}
const app=compile('App.tsx').source;
const motion=compile('src/ExerciseMotion.tsx').source;
const dbs=load('src/db.ts');
compile('src/theme.ts');compile('src/technique.ts');compile('src/catalogue.ts');
verify(app.includes('label="Précédent"'),'Bouton Précédent présent');
verify(!app.includes('label="Repos"'),'Ancien bouton Repos retiré');
verify(app.includes('plan?.notes?.trim()'),'Notes visibles sur le bloc exercice');
verify(app.includes('statsScope')&&app.includes('scopeSessions'),'Filtrage stats par dossier/séance');
verify(app.includes('resetInput !== \'oui\'')&&app.includes('disabled={resetInput !== \'oui\'}'),'Confirmation exactement oui');
verify(app.includes('selectTheme(\'light\')')&&app.includes('selectTheme(\'dark\')'),'Bascule de thème');
verify(!/\bplan\?\.to_failure\s*&&\s*</.test(app),'Pas de JSX conditionnel sur SQLite 0/1');

function fakeExpoDb(){
 const conn=new DatabaseSync(':memory:');
 return {
  raw:conn,
  execAsync:async sql=>{conn.exec(sql);},
  runAsync:async (sql,...args)=>conn.prepare(sql).run(...args),
  getAllAsync:async (sql,...args)=>conn.prepare(sql).all(...args),
  getFirstAsync:async (sql,...args)=>conn.prepare(sql).get(...args)??null,
  withExclusiveTransactionAsync:async function(fn){conn.exec('BEGIN TRANSACTION');try{let result=await fn(this);conn.exec('COMMIT');return result;}catch(e){conn.exec('ROLLBACK');throw e;}}
 };
}
(async()=>{
 const d=dbs.api;
 const db=fakeExpoDb();
 await d.initDatabase(db);
 const f=await d.createFolder(db,'Cycle 1');
 const t=await d.createTemplate(db,'Push A',f);
 await d.addExercise(db,t,'bench');
 await d.changeExercisePlan(db,t,'bench',4,10,120,false,10,1,false,'Prise confortable, contrôle la descente.');
 let overview=await d.fetchOverview(db);
 verify(overview.templateExercises[0].notes==='Prise confortable, contrôle la descente.','Note enregistrée');
 await d.saveExerciseMax(db,'bench',90);
 const routine=overview.templates[0];
 const result=await d.startSession(db,routine,overview.templateExercises,overview.exerciseMaxes);
 verify(result.session.folder_id===f,'Dossier mémorisé par la séance');
 verify(result.sessionExercises[0].notes.startsWith('Prise confortable'),'Note mémorisée au début de la séance');
 await d.changeExercisePlan(db,t,'bench',4,10,120,false,10,1,false,'Nouvelle note qui ne doit pas modifier la séance déjà commencée');
 const snap=await d.fetchOverview(db);
 verify(snap.activeSessionExercises[0].notes.startsWith('Prise confortable'),'La note de la séance en cours reste inchangée');
 let blocked=false;
 try{await d.resetStatistics(db);}catch(err){blocked=/cours/.test(String(err));}
 verify(blocked,'Réinitialisation refusée pendant un entraînement actif');
 await d.finishSession(db,result.session.id);
 await d.resetStatistics(db);
 const after=await d.fetchOverview(db);
 verify(after.history.length===0 && after.historySets.length===0,'Historique réinitialisé');
 verify(after.templates.length===1&&after.folders.length===1,'Programmes et dossiers conservés');
 verify(after.templateExercises[0].notes.includes('Nouvelle note'),'Notes conservées');
 verify(after.exerciseMaxes[0].weight===90,'1RM de référence conservé');
 await d.initDatabase(db); // migration idempotente
 verify((await db.getAllAsync('PRAGMA table_info(session_exercises)')).some(c=>c.name==='notes'),'Migration idempotente');
 db.raw.close();
 console.log(`OK V0.7 : ${tested} vérifications, base locale temporaire uniquement.`);
})().catch(e=>{console.error(e);process.exit(1)});

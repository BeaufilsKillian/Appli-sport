// npx / node tests/v08.cjs : simulation locale uniquement, ne touche pas a l'iPhone.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
const {DatabaseSync}=require('node:sqlite');
const root=path.resolve(__dirname,'..');
let count=0;function check(ok,label){assert.ok(ok,label);count++;}
function load(file){
 const src=fs.readFileSync(path.join(root,file),'utf8');
 const result=ts.transpileModule(src,{fileName:file,reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}});
 check(!result.diagnostics?.some(d=>d.category===ts.DiagnosticCategory.Error),`${file} syntaxe`);
 return require('./sync.cjs').load(path.join(root,file));
}
const app=fs.readFileSync(path.join(root,'App.tsx'),'utf8');
const built=ts.transpileModule(app,{fileName:'App.tsx',reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS}});
check(!built.diagnostics?.some(d=>d.category===ts.DiagnosticCategory.Error),'UI syntaxe');
check(app.includes("page === 'assistant' ? assistantScreen()"),'Page assistant accessible');
check(app.includes('Séance suggérée (facultatif)'),'Bouton discret dossier');
check(app.includes('Proposer une séance'),'Aperçu préalable');
check(app.includes('Enregistrer ce brouillon'),'Validation explicite');
check(app.includes('Suggérer séries / reps selon mon objectif'),'Suggestion par exercice');
check(!app.includes('label="Repos"'),'Ancien bouton Repos absent');
const dbmod=load('src/db.ts');
const planner=load('src/planner.ts');
const catalogue=load('src/catalogue.ts');
function memoryDb(){
 const conn=new DatabaseSync(':memory:');
 return { raw:conn, execAsync:async q=>conn.exec(q),runAsync:async(q,...args)=>conn.prepare(q).run(...args),
 getFirstAsync:async(q,...args)=>conn.prepare(q).get(...args)??null,
 getAllAsync:async(q,...args)=>conn.prepare(q).all(...args),
 withExclusiveTransactionAsync:async function(fn){conn.exec('BEGIN TRANSACTION');try{const ret=await fn(this);conn.exec('COMMIT');return ret;}catch(e){conn.exec('ROLLBACK');throw e;}}};
}
(async()=>{
 const db=memoryDb();await dbmod.initDatabase(db);
 const prefs=await dbmod.getSettings(db);
 check(prefs.age==='' && prefs.experience==='intermediate','Defaults facultatifs');
 await dbmod.saveSettings(db,{age:'21',weight:'75',height:'181',goal:'cut',experience:'beginner'});
 check((await dbmod.getSettings(db)).goal==='cut','Preferences persistantes');
 const folder=await dbmod.createFolder(db,'Programme personnel');
 const draft=planner.generateWorkout(catalogue.EXERCISES,['Pectoraux','Biceps'],100,'cut','beginner',21);
 check(draft.items.length>=2&&draft.estimated_minutes<=100,'Proposition duree');
 const id=await dbmod.createSuggestedTemplate(db,'Pecs et biceps',folder,draft.items);
 const overview=await dbmod.fetchOverview(db);
 const saved=overview.templateExercises.filter(e=>e.template_id===id);
 check(saved.length===draft.items.length,'Chaque exercice enregistre');
 check(saved.every((s,i)=>s.exercise_id===draft.items[i].exercise_id && s.planned_sets===draft.items[i].sets && s.planned_reps===draft.items[i].reps && s.rest_seconds===draft.items[i].rest_seconds),'Series, reps et repos conformes');
 check(overview.templates.find(t=>t.id===id).folder_id===folder,'Classement dans dossier choisi');
 let errored=false;try{await dbmod.createSuggestedTemplate(db,'cassé',folder,[{exercise_id:'bench',sets:0,reps:8,rest_seconds:90}]);}catch(e){errored=true;}
 check(errored,'Validation avant sauvegarde');
 check((await dbmod.fetchOverview(db)).templates.length===1,'Transaction sans programme incomplet');
 const session=await dbmod.startSession(db,overview.templates.find(t=>t.id===id),saved,[]);
 check(session.sets.length>=draft.items.length*2,'Seance generee executable');
 await dbmod.discardSession(db,session.session.id);
 db.raw.close();
 console.log(`OK V0.8 : ${count} vérifications, sauvegarde SQL temporaire.`);
})().catch(err=>{console.error(err);process.exit(1);});

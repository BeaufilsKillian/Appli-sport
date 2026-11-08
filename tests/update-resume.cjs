const fs=require('node:fs'),ts=require('typescript'),assert=require('node:assert/strict');
const {DatabaseSync}=require('node:sqlite');
const load=(file,custom=require)=>{const m={exports:{}};new Function('module','exports','require',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(m,m.exports,custom);return m.exports;};
const d=load('src/db.ts'), {saveUpdateResume,takeUpdateResume}=load('src/updateResume.ts');
const {previousPerformance}=load('src/setInputs.ts');
const {createSetWriter}=load('src/setEditing.ts',name=>name==='./db'?d:name==='./setInputs'?{previousPerformance}:require(name));
const conn=new DatabaseSync(':memory:');
const db={execAsync:async sql=>conn.exec(sql),runAsync:async(sql,...args)=>conn.prepare(sql).run(...args),getFirstAsync:async(sql,...args)=>conn.prepare(sql).get(...args)??null,getAllAsync:async(sql,...args)=>conn.prepare(sql).all(...args),withExclusiveTransactionAsync:async fn=>{conn.exec('BEGIN');try{await fn(db);conn.exec('COMMIT');}catch(e){conn.exec('ROLLBACK');throw e;}}};
(async()=>{
await d.initDatabase(db);const folder=await d.createFolder(db,'Test'),id=await d.createTemplate(db,'Séance en cours',folder);await d.addExercise(db,id,'bench');const overview=await d.fetchOverview(db);const workout=await d.startSession(db,overview.templates[0],overview.templateExercises,[]);const set=workout.sets[0],writer=createSetWriter(db,()=>{});
const pending=writer.write(set.id,{field:'weight',text:'42,5'});await writer.flush();await saveUpdateResume(db,workout.session.id,4,true);await pending;
const before=await d.fetchOverview(db);assert.equal(before.active.id,workout.session.id);assert.equal(before.active.finished_at,null);assert.equal(before.activeSets[0].input.weight,'42,5');assert.equal(before.activeSets[0].input.reps,'');assert.equal(before.activeSets[0].completed,0);
assert.deepEqual(await takeUpdateResume(db,workout.session.id),{exerciseIndex:4,reopenWorkout:true});assert.equal(await takeUpdateResume(db,workout.session.id),null,'marqueur consommé une seule fois');
await saveUpdateResume(db,workout.session.id,2,true);assert.equal(await takeUpdateResume(db,'autre-séance'),null);
await saveUpdateResume(db,workout.session.id,2,false);assert.deepEqual(await takeUpdateResume(db,workout.session.id),{exerciseIndex:2,reopenWorkout:false});
await db.runAsync('INSERT OR REPLACE INTO settings(key,value) VALUES (?,?)','update_resume','malformed');assert.equal(await takeUpdateResume(db,workout.session.id),null);
const after=await d.fetchOverview(db);assert.equal(after.active.id,workout.session.id);assert.equal(after.active.finished_at,null);assert.deepEqual(after.activeSets,before.activeSets);
conn.close();console.log('OK mise à jour pendant séance : écritures attendues, saisie partielle conservée sans validation, même séance non terminée, exercice courant mémorisé, marqueur consommé et contrôle de l’identifiant.');
})().catch(e=>{console.error(e);process.exitCode=1;});

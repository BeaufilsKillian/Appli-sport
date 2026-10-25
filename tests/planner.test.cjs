const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
const mod=path.join(__dirname,'../src/planner.ts');
const out=ts.transpileModule(fs.readFileSync(mod,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const m={exports:{}};new Function('require','exports','module',out)(require,m.exports,m);
const {generateWorkout,proposeExercise,normalizeGoal,estimateExerciseMinutes}=m.exports;
const catalogue=fs.readFileSync(path.join(__dirname,'../src/catalogue.ts'),'utf8');
const exercises=[...catalogue.matchAll(/\{"id": "([^"]+)", "name": "([^"]+)", "muscle": "([^"]+)", "equipment": "([^"]+)", "pattern": "([^"]+)"/g)].map(x=>({id:x[1],name:x[2],muscle:x[3],pattern:x[5]}));
assert(exercises.length>240,'catalogue');
for (const minutes of [25,40,60,100,120,180]) for(const goal of ['strength','hypertrophy','endurance','cut']) {
 const p=generateWorkout(exercises,['Pectoraux','Biceps'],minutes,goal);
 assert(p.items.length>0); assert(p.estimated_minutes<=minutes,`time ${minutes} ${goal}`);
 assert(p.items.every(x=>x.sets>=2&&x.reps>=1&&x.rest_seconds>=0));
 assert.equal(new Set(p.items.map(x=>x.exercise_id)).size,p.items.length);
}
assert.equal(normalizeGoal('Sèche'),'cut');
assert.equal(normalizeGoal('Force'),'strength');
assert(proposeExercise(exercises.find(x=>x.id==='bench'),'strength','beginner',16).reps>=8);
assert.throws(()=>generateWorkout(exercises,[],100,'cut'));
assert.throws(()=>generateWorkout(exercises,['Biceps'],0,'cut'));
assert(estimateExerciseMinutes(3,8,120)>estimateExerciseMinutes(2,8,120));
console.log('OK - générateur : objectifs, âges, contraintes, catalogue et budget temps');

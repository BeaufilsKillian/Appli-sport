const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const initSqlJs=require('sql.js');
const {load,device}=require('./sync.cjs');
const core=load('src/nutrition/core.ts'),local=load('src/nutrition/store.ts'),d=load('src/db.ts');
const food={name:'Aliment de test',brand:'',barcode:'',source:'personal',sourceId:'',unit:'g',per100:{kcal:200,protein:20,carbs:10,fat:8,fiber:null}};
function cloud(){let revision=0;const rows=new Map();return {rows,async pull(after){const changes=[...rows.values()].filter(row=>row.revision>after).sort((a,b)=>a.revision-b.revision);return {changes:structuredClone(changes.slice(0,20)),cursor:changes.slice(0,20).at(-1)?.revision??after,more:changes.length>20};},async push(key,base,payload){if((rows.get(key)?.revision??0)!==base)throw Object.assign(Error('conflit'),{status:409});const row={key,revision:++revision,payload:structuredClone(payload)};rows.set(key,row);return structuredClone(row);}};}
async function tests(){
 assert.equal(core.sumNutrition([{food,amount:150}]).values.protein,30);
 assert(core.sumNutrition([{food,amount:150}]).missing.has('fiber'));
 const recipe={name:'Repas',ingredients:[{food,amount:200}],finalWeight:400};const prepared=core.recipeFood(recipe);
 assert.equal(prepared.per100.protein,10);assert.equal(core.sumNutrition([{food:prepared,amount:100}]).values.protein,10);
 assert.equal(core.sumNutrition([{food:{...food,unit:'ml'},amount:150}]).values.kcal,300,'aucune conversion ml vers g');
 for(const value of [NaN,Infinity,-1,101])assert.throws(()=>core.parseFood({...food,per100:{...food.per100,protein:value}}));
 assert.throws(()=>core.parseNutrition('entry:x',{date:'2026-02-30',slot:'Déjeuner',food,amount:100}));
 assert.throws(()=>core.parseNutrition('entry:x',{date:'2026-11-08',slot:'Déjeuner',food,amount:0}));
 assert.throws(()=>core.parseNutrition('recipe:x',{...recipe,ingredients:[{food:{...food,unit:'ml'},amount:100}]}));
 const profile={age:30,weight:80,height:180,sex:'male',activity:1.4,goal:'maintain',targetWeight:80,healthyAdult:true};
 const maintain=core.estimateGoals(profile),lose=core.estimateGoals({...profile,goal:'lose',targetWeight:75}),gain=core.estimateGoals({...profile,goal:'gain',targetWeight:85});
 assert(lose.targets.kcal<maintain.targets.kcal&&gain.targets.kcal>maintain.targets.kcal);assert.equal(maintain.targets.protein,128);assert.equal(maintain.targets.fiber,30);
 const energy=maintain.targets.protein*4+maintain.targets.carbs*4+maintain.targets.fat*9+maintain.targets.fiber*2;assert(Math.abs(energy-maintain.targets.kcal)<=2);
 assert.throws(()=>core.estimateGoals({...profile,age:17}));assert.throws(()=>core.estimateGoals({...profile,healthyAdult:false}));assert.throws(()=>core.estimateGoals({...profile,goal:'lose',targetWeight:35}));
 assert.throws(()=>core.parseNutrition('goals:current',{...maintain,targets:{...maintain.targets,kcal:800}}));
 assert.equal(core.normalizeBarcode('3017620422003'),'3017620422003');assert.equal(core.normalizeBarcode('https://example.org/01/03017620422003'),'03017620422003');
 assert.throws(()=>core.normalizeBarcode('3017620422004'));assert.throws(()=>core.normalizeBarcode('https://example.org/recipe'));
 const fromOff=core.offFood({code:'3017620422003',product_name:'Test',brands:'Marque',nutriments:{'energy_100g':418.4,proteins_100g:5,carbohydrates_100g:20,fat_100g:2}});assert(Math.abs(fromOff.per100.kcal-100)<1e-9);assert.equal(fromOff.per100.fiber,null);
 for(const unit of ['ml','cl','l'])assert.equal(core.offFood({code:'5449000000996',product_name:'Boisson',product_quantity_unit:unit,nutrition_data_per:'100g',nutriments:{'energy-kcal_100g':42.4}}).unit,'ml','la base OFF nomme aussi les valeurs des boissons _100g');
 assert.equal(core.offFood({code:'5449000000996',product_name:{main:'Drink',fr:'Boisson'},brands:['Une marque'],quantity:'1,5 L',nutriments:{}}).name,'Boisson');
 assert.equal(core.offFood({code:'5449000000996',product_name:'Boisson',quantity:'6 x 330 ml',nutriments:{}}).unit,'ml');
 assert.equal(core.offFood({code:'3017620422003',product_name:'Solide',product_quantity_unit:'g',quantity:'300 g',nutriments:{}}).unit,'g');
 const ciqual=JSON.parse(fs.readFileSync('src/nutrition/ciqual.json','utf8'));assert.equal(ciqual.length,3484);assert(ciqual.some(row=>/riz.*cuit/i.test(row[1])));assert(ciqual.some(row=>/riz.*cru/i.test(row[1])));
 const engine=await initSqlJs(),a=await device(engine),b=await device(engine),c=cloud();let scope;
 const unsub=a.db.subscribe(value=>{scope=value;});
 await local.putDocument(a.db,'food:one',food,0);assert.equal(scope,'nutrition');
 const trainingBefore=await d.exportAllData(a.db);
 await local.putDocument(a.db,'recipe:one',recipe,0);await local.putDocument(a.db,'goals:current',maintain,0);
 await local.putDocument(a.db,'entry:one',{date:'2026-11-08',slot:'Déjeuner',food:prepared,amount:150},0);
 assert.deepEqual((await d.exportAllData(a.db)).logged_sets,trainingBefore.logged_sets);
 await local.synchronizeNutrition(a.db,c);await local.synchronizeNutrition(b.db,c);
 assert.equal((await local.documents(b.db)).length,4);assert.equal(JSON.parse((await local.documents(b.db)).find(row=>row.key==='entry:one').payload).amount,150);
 await b.reopen();assert.equal((await local.documents(b.db)).length,4,'hors ligne et réouverture');
 let ar=(await local.documents(a.db)).find(row=>row.key==='food:one'),br=(await local.documents(b.db)).find(row=>row.key==='food:one');
 await local.putDocument(a.db,ar.key,{...food,name:'Version A'},ar.local_version);await local.putDocument(b.db,br.key,{...food,name:'Version B'},br.local_version);
 await local.synchronizeNutrition(a.db,c);await local.synchronizeNutrition(b.db,c);
 br=(await local.documents(b.db)).find(row=>row.key===br.key);assert(br.conflict);assert.equal(JSON.parse(br.payload).name,'Version B');assert.equal(JSON.parse(br.conflict).name,'Version A');
 await local.resolveDocument(b.db,br.key,true,br.local_version);await local.synchronizeNutrition(b.db,c);await local.synchronizeNutrition(a.db,c);assert.equal(JSON.parse((await local.documents(a.db)).find(row=>row.key===br.key).payload).name,'Version B');
 ar=(await local.documents(a.db)).find(row=>row.key==='entry:one');await local.putDocument(a.db,ar.key,null,ar.local_version);await local.synchronizeNutrition(a.db,c);await local.synchronizeNutrition(b.db,c);assert.equal((await local.documents(b.db)).find(row=>row.key===ar.key).payload,null);
 await assert.rejects(local.putDocument(a.db,'food:one',food,0),/changé/,'formulaire ancien jamais écrasé');
 const backup=await local.exportNutrition(a.db);await local.importNutrition(b.db,backup);
 const wrong=structuredClone(backup);wrong.documents.find(row=>row.key==='food:one').value.name='Différent';await assert.rejects(local.importNutrition(b.db,wrong),/refusé/);
 const pre=(await local.documents(b.db)).length;const invalid=structuredClone(backup);invalid.documents.push({key:'entry:broken',value:{}});await assert.rejects(local.importNutrition(b.db,invalid));assert.equal((await local.documents(b.db)).length,pre,'import atomique');
 // Restaurer les séances ne supprime jamais la nutrition.
 await a.db.restore(trainingBefore);assert.equal((await local.documents(a.db)).length,4);
 // Pagination : les 45 éléments sont récupérés, avec reprise du curseur.
 const many=cloud();for(let i=0;i<45;i++)await many.push('food:f'+i,0,food);const third=await device(engine);await local.synchronizeNutrition(third.db,many);assert.equal((await local.documents(third.db)).length,45);
 // Une saisie effectuée pendant l'envoi ne doit jamais être marquée sauvegardée à tort.
 let changed=false;const updating={pull:after=>c.pull(after),async push(key,base,value){const row=await c.push(key,base,value);if(!changed){changed=true;await local.putDocument(a.db,key,{...value,name:'Pendant envoi'});}return row;}};
 await local.putDocument(a.db,'food:flight',food,0);await local.synchronizeNutrition(a.db,updating);assert.equal((await local.documents(a.db)).find(row=>row.key==='food:flight').dirty,1);await local.synchronizeNutrition(a.db,c);assert.equal(c.rows.get('food:flight').payload.name,'Pendant envoi');
 unsub();await a.db.close();await b.db.close();await third.db.close();
 console.log('OK nutrition : portions, cuisson, valeurs inconnues, objectifs, codes, Ciqual, hors ligne, import/export, synchronisation, conflits, suppressions et saisies concurrentes.');
}
if(require.main===module)tests().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={food,load};

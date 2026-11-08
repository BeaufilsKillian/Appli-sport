const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const {food}=require('./nutrition.cjs');
class ApiError extends Error{constructor(status,message){super(message);this.status=status;}}
const rows=new Map();let revision=0,fetches=0;
const security={ApiError,privateResponse(res){res.setHeader('Cache-Control','no-store, private');},settings:()=>({origin:'https://app.example.test'}),assertSameOrigin(req,origin){if(req.headers.origin!==origin||req.headers['x-training-client']!=='1')throw new ApiError(403,'Origine refusée');},async requireUser(req){if(!req.headers.cookie)throw new ApiError(401,'Connexion requise');if(req.headers.cookie==='pending')throw new ApiError(403,'Attente');return req.headers.cookie;},sendError(res,error){return res.status(error.status??500).json({error:error.message});}};
const cache=new Map();function load(file){const absolute=path.resolve(file);if(cache.has(absolute))return cache.get(absolute).exports;const mod={exports:{}};cache.set(absolute,mod);const js=ts.transpileModule(fs.readFileSync(absolute,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new Function('module','exports','require',js)(mod,mod.exports,name=>{
 if(name.endsWith('/security.js'))return security;
 if(name.endsWith('/nutritionStore.js'))return {nutritionStore:()=>({pull:async(owner,after)=>({changes:[...rows.values()].filter(row=>row.owner===owner&&row.revision>after).map(({owner,...rest})=>rest),cursor:revision,more:false}),save:async(owner,key,base,payload)=>{const prior=rows.get(owner+key);if((prior?.revision??0)!==base)return null;const row={owner,key,payload,revision:++revision};rows.set(owner+key,row);return row;}})};
 return name.startsWith('.')?load(path.resolve(path.dirname(absolute),name.replace(/\.js$/,''))+'.ts'):require(name);
});return mod.exports;}
async function call(handler,owner,body,query={},headers={}){const res={statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.statusCode=code;return this;},json(data){this.data=data;return this;}};await handler({method:body===undefined?'GET':'POST',query,body,headers:{cookie:owner,'x-training-owner':owner,origin:'https://app.example.test','x-training-client':'1',...headers}},res);return res;}
(async()=>{
 const handler=load('api/nutrition.ts').default;
 assert.equal((await call(handler,'',undefined)).statusCode,401);assert.equal((await call(handler,'pending',undefined)).statusCode,403);
 assert.equal((await call(handler,'alice',{key:'food:x',base:0,value:food},{},{origin:'https://evil.test'})).statusCode,403);
 assert.equal((await call(handler,'alice',undefined,{}, {'x-training-owner':'bob'})).statusCode,403);
 assert.equal((await call(handler,'alice',{key:'food:x',base:0,value:{...food,per100:{...food.per100,fat:-1}}})).statusCode,400);
 assert.equal((await call(handler,'alice',{key:'food:x',base:0,value:food})).statusCode,200);
 assert.equal((await call(handler,'alice',{key:'food:x',base:0,value:food})).statusCode,409);
 assert.equal((await call(handler,'bob',undefined)).data.changes.length,0);
 const pulled=await call(handler,'alice',undefined);assert(pulled.headers['Cache-Control'].includes('private'));assert.equal(pulled.data.changes.length,1);
 assert.equal((await call(handler,'alice',undefined,{after:-1})).statusCode,400);
 const lookup=load('api/foods.ts').default,originalFetch=global.fetch;
 try{global.fetch=async(url,options)=>{fetches++;assert.equal(new URL(url).hostname,'world.openfoodfacts.org');assert(options.headers['User-Agent'].startsWith('TrainingProgramme/'));return {ok:true,status:200,text:async()=>JSON.stringify({product:{code:'3017620422003',product_name:'Produit test',nutriments:{'energy-kcal_100g':200,proteins_100g:20,carbohydrates_100g:10,fat_100g:8}}})};};
  assert.equal((await call(lookup,'',undefined,{barcode:'3017620422003'})).statusCode,401);assert.equal(fetches,0);
  const result=await call(lookup,'alice',undefined,{barcode:'3017620422003'});assert.equal(result.data.foods[0].per100.fiber,null);
  await call(lookup,'alice',undefined,{barcode:'3017620422003'});assert.equal(fetches,1,'cache du produit');
  assert.equal((await call(lookup,'alice',undefined,{barcode:'https://evil.test/not-food'})).statusCode,400);assert.equal(fetches,1,'un QR arbitraire ne provoque pas de requête');
  const paths=[];global.fetch=async(url)=>{paths.push(url);assert.equal(new URL(url).hostname,'search.openfoodfacts.org');assert(new URL(url).searchParams.get('fields').includes('product_quantity_unit'));return {ok:true,status:200,text:async()=>JSON.stringify({hits:[{code:'5449000000996',product_name:'Boisson',brands:['Marque'],quantity:'330 ml',nutriments:{'energy-kcal_100g':42.4}}]})};};
  const search=await call(lookup,'alice',undefined,{q:'boisson test'});assert.equal(search.statusCode,200);assert.equal(search.data.foods[0].unit,'ml');assert.equal(search.data.foods[0].brand,'Marque');assert.equal(new URL(paths[0]).pathname,'/search');
  await call(lookup,'alice',undefined,{q:'boisson test'});assert.equal(paths.length,1,'cache des recherches');
  global.fetch=async(url)=>{paths.push(url);return new URL(url).hostname==='world.openfoodfacts.org'?{ok:false,status:503}:{ok:true,status:200,text:async()=>JSON.stringify({code:'5449000000996',product_name:{fr:'Boisson de secours',main:'Drink'},brands:['Marque'],quantity:'330 ml',nutriments:{'energy-kcal_100g':42.4}})};};
  const scanned=await call(lookup,'alice',undefined,{barcode:'5449000000996'});assert.equal(scanned.statusCode,200);assert.equal(scanned.data.foods[0].name,'Boisson de secours');assert.equal(new URL(paths.at(-1)).pathname,'/document/5449000000996');
  global.fetch=async(url)=>{paths.push(url);return new URL(url).hostname==='search.openfoodfacts.org'?{ok:false,status:503}:{ok:true,status:200,text:async()=>JSON.stringify({products:[{code:'3017620422003',product_name:'Secours recherche',nutriments:{}}]})};};
  const fallback=await call(lookup,'alice',undefined,{q:'recherche secours'});assert.equal(fallback.statusCode,200);assert.equal(fallback.data.foods[0].name,'Secours recherche');assert.equal(new URL(paths.at(-1)).pathname,'/cgi/search.pl');
  for(const status of [429,403]){let calls=0;global.fetch=async()=>{calls++;return {ok:false,status};};assert.equal((await call(lookup,'alice',undefined,{q:'limite '+status})).statusCode,status===429?429:502);assert.equal(calls,1,'aucun contournement des quotas/refus');}
  let calls=0;global.fetch=async()=>{calls++;throw Error('timeout');};assert.equal((await call(lookup,'bob',undefined,{barcode:'3274080005003'})).statusCode,503);assert.equal(calls,2,'recours borné après panne réseau');
  calls=0;global.fetch=async()=>{calls++;return {ok:true,status:200,text:async()=>{if(calls===1)throw Error('body aborted');return JSON.stringify({products:[{code:'3017620422003',product_name:'Lecture rétablie',nutriments:{}}]});}};};const interrupted=await call(lookup,'bob',undefined,{q:'réponse interrompue'});assert.equal(interrupted.statusCode,200);assert.equal(interrupted.data.foods[0].name,'Lecture rétablie');assert.equal(calls,2);
 }finally{global.fetch=originalFetch;}
 if(process.argv.includes('--live')){
  cache.delete(path.resolve('api/foods.ts'));const live=load('api/foods.ts').default;
  for(const query of [{q:'flocons avoine'},{barcode:'3017620422003'},{barcode:'5449000000996'}]){
   const result=await call(live,'diagnostic-local-sans-compte',undefined,query);assert.equal(result.statusCode,200,JSON.stringify(result.data));assert(result.data.foods.length>0,'fournisseur réel sans résultat');
   if(query.barcode)assert.equal(result.data.foods[0].barcode,query.barcode);if(query.barcode==='5449000000996')assert.equal(result.data.foods[0].unit,'ml');
   console.log('OK fournisseur réel : '+JSON.stringify({query,count:result.data.foods.length,unit:result.data.foods[0].unit}));
  }
 }
 console.log('OK API nutrition : authentification, attente, origine, compte, validation, conflits, cache, source fixe et confidentialité.');
})().catch(error=>{console.error(error);process.exitCode=1;});

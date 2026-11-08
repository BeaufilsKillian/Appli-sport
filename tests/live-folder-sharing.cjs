const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const initSqlJs=require('sql.js'),{load,device}=require('./sync.cjs');
const d=load('src/db.ts'),{parseBackup}=load('src/backup.ts'),{makeSharedFolder,importSharedFolder}=load('src/folderSharing.ts');
const origin=process.argv[2];if(origin!=='https://training-programme-ten.vercel.app')throw Error('Origine de test inattendue.');
function client(){const cookies=new Map();let owner='';return{setOwner(id){owner=id},async call(path,body,extra={}){const r=await fetch(origin+path,{method:body===undefined?'GET':'POST',headers:{Origin:origin,'X-Training-Client':'1','X-Training-Owner':owner,Cookie:[...cookies].map(([k,v])=>k+'='+v).join('; '),...(body===undefined?{}:{'Content-Type':'application/json'}),...extra},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(30000)});for(const h of r.headers.getSetCookie()){const p=h.split(';')[0],i=p.indexOf('=');if(p.slice(i+1))cookies.set(p.slice(0,i),p.slice(i+1));else cookies.delete(p.slice(0,i));}return{status:r.status,data:await r.json()};}}}
(async()=>{
const accounts=[],clients=[client(),client(),client()];const stamp=Date.now();
try{
assert.equal((await client().call('/api/folder-shares?folder=test')).status,401,'connexion obligatoire');
for(let i=0;i<clients.length;i++){const email='codex-share-'+stamp+'-'+i+'@example.com';const response=await clients[i].call('/api/auth/sign-up/email',{name:'Test partage',email,password:crypto.randomBytes(24).toString('base64url')});assert(response.data.user?.id);accounts.push({id:response.data.user.id,email});clients[i].setOwner(response.data.user.id);fs.writeFileSync('.expo/folder-share-live-test-accounts.json',JSON.stringify(accounts));assert(response.status>=200&&response.status<300);}
const [a,b,c]=clients,engine=await initSqlJs(),sender=await device(engine),receiver=await device(engine);
const folder=await d.createFolder(sender.db,'Dossier partage E2E');const template=await d.createTemplate(sender.db,'Séance E2E',folder);await d.addExercise(sender.db,template,'bench');await d.changeExercisePlan(sender.db,template,'bench',3,8,120,false,10,0,false,'Consigne de test',12,8);await d.saveSettings(sender.db,{username:'Profil non partagé'});
const source=parseBackup(await d.exportAllData(sender.db));assert.equal((await a.call('/api/backups',{baseVersion:0,data:source})).status,200);
const folderData=makeSharedFolder(source,folder),created=await a.call('/api/folder-shares',{action:'create',folder:folderData});assert.equal(created.status,200);const token=created.data.token;
assert.equal((await a.call('/api/folder-shares?folder='+folder,undefined,{'X-Training-Owner':accounts[1].id})).status,403);
assert.equal((await a.call('/api/folder-shares',{action:'create',folder:folderData},{Origin:'https://other.example'})).status,403);
const preview=await b.call('/api/folder-shares?code='+token);assert.equal(preview.status,200);assert.equal(preview.data.templates,1);assert(!('payload'in preview.data));
const claim=await b.call('/api/folder-shares',{action:'claim',code:token});assert.equal(claim.status,200);assert(!JSON.stringify(claim.data.payload).includes('Profil non partagé'));
assert.equal((await c.call('/api/folder-shares',{action:'claim',code:token})).status,404);assert.equal((await b.call('/api/folder-shares',{action:'claim',code:token})).status,200);
const received=await importSharedFolder(receiver.db,claim.data.payload,claim.data.id);await d.renameFolder(receiver.db,received,'Copie indépendante E2E');const target=parseBackup(await d.exportAllData(receiver.db));assert.equal((await b.call('/api/backups',{baseVersion:0,data:target})).status,200);
const cloudA=await a.call('/api/backups'),cloudB=await b.call('/api/backups');assert.equal(cloudA.data.latest.payload.folders[0].name,'Dossier partage E2E');assert.equal(cloudB.data.latest.payload.folders[0].name,'Copie indépendante E2E');assert.equal(cloudB.data.latest.payload.template_exercises[0].planned_reps_max,12);
const unused=await a.call('/api/folder-shares',{action:'create',folder:folderData});assert.equal((await c.call('/api/folder-shares',{action:'revoke',id:unused.data.id})).status,404);assert.equal((await a.call('/api/folder-shares',{action:'revoke',id:unused.data.id})).status,200);assert.equal((await b.call('/api/folder-shares?code='+unused.data.token)).status,404);
await sender.db.close();await receiver.db.close();console.log('OK partage réel Vercel/Neon : trois comptes isolés, connexion/compte/origine contrôlés, aperçu, réception unique, réessai, import local puis sauvegarde cloud, modification indépendante, consignes/plages et révocation.');
}finally{for(const actor of clients)await actor.call('/api/auth/sign-out',{}).catch(()=>{});}
})().catch(e=>{console.error(e.message);process.exitCode=1;});

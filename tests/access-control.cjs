const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),ts=require('typescript');
const {parseEnv}=require('node:util');
process.loadEnvFile('.env.local');
const productionHost=new URL(process.env.DATABASE_URL).hostname;
const branch=parseEnv(fs.readFileSync('.expo/.env.access-test','utf8'));
assert.notEqual(new URL(branch.DATABASE_URL).hostname,productionHost,'tests exclusivement sur la branche isolée');
process.env.DATABASE_URL=branch.DATABASE_URL;
const stamp=Date.now(),adminId='codex-access-admin-'+stamp,memberId='codex-access-member-'+stamp,otherId='codex-access-other-'+stamp;
process.env.ADMIN_USER_ID=adminId;process.env.ADMIN_EMAIL='admin-access@example.com';
const password='Secondary password for isolated tests only';
const salt=crypto.randomBytes(24).toString('hex');process.env.ADMIN_PASSWORD_HASH='scrypt:'+salt+':'+crypto.scryptSync(password,salt,64).toString('hex');
process.env.APP_ORIGIN='https://app.example.test';
const actors={admin:{id:adminId,email:process.env.ADMIN_EMAIL,session:'admin-session'},member:{id:memberId,email:'member-access@example.com',session:'member-session'},other:{id:otherId,email:'other-access@example.com',session:'other-session'},renewed:{id:adminId,email:process.env.ADMIN_EMAIL,session:'renewed-session'}};
const deliveries=[];
const cache=new Map();
const sdk={
  createAuthServer:config=>({getSession:async()=>{const cookie=config.context().getCookies(),actor=Object.keys(actors).find(key=>cookie.includes('actor='+key+';'));return actor?{data:{user:{id:actors[actor].id,email:actors[actor].email},session:{id:actors[actor].session}}}:{error:{message:'absent'}};}}),
  resolveNeonAuthLogging:()=>({}),serializeSetCookie:({name,value,maxAge})=>`${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge??60}`,
};
function load(file){const absolute=path.resolve(file);if(cache.has(absolute))return cache.get(absolute).exports;const mod={exports:{}};cache.set(absolute,mod);const js=ts.transpileModule(fs.readFileSync(absolute,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;new Function('module','exports','require',js)(mod,mod.exports,name=>{
 if(name==='@neondatabase/auth/server')return sdk;
 if(name==='web-push')return {sendNotification:async(subscription,payload)=>{deliveries.push({subscription,payload:JSON.parse(payload)});}};
 return name.startsWith('.')?load(path.resolve(path.dirname(absolute),name.replace(/\.js$/,''))+'.ts'):require(name);
});return mod.exports;}
const {neon}=require('@neondatabase/serverless'),sql=neon(branch.DATABASE_URL);
const policy=load('server/accessPolicy.ts'),security=load('server/security.ts'),{accessStore}=load('server/accessStore.ts'),store=accessStore(branch.DATABASE_URL);
const accessHandler=load('api/access.ts').default,backupHandler=load('api/backups.ts').default;
async function call(actor,body,query={},cookie='',handler=accessHandler){
 const req={method:body===undefined?'GET':'POST',query,headers:{origin:process.env.APP_ORIGIN,'x-training-client':'1',cookie:actor?`actor=${actor}; ${cookie}`:'','x-training-owner':actors[actor]?.id??''},body};
 const headers=new Map();const res={statusCode:200,setHeader(k,v){headers.set(k.toLowerCase(),v);},getHeader(k){return headers.get(k.toLowerCase());},status(n){this.statusCode=n;return this;},json(data){this.data=data;return this;},send(data){this.data=data;return this;}};
 await handler(req,res);return {status:res.statusCode,data:res.data,headers};
}
async function tests(){
 assert.equal((await call('',undefined)).status,401);
 const pending=await call('member',undefined);assert.equal(pending.data.status,'pending');assert.equal(pending.data.lease,null);assert.equal(pending.data.isAdmin,false);assert.ok(!('pendingCount'in pending.data));
 assert.equal((await call('member',undefined,{},'',backupHandler)).status,403,'API privée refusée avant acceptation');
 const admin=await call('admin',undefined);assert.equal(admin.data.isAdmin,true);assert.equal(admin.data.pendingCount,1);
 assert.equal((await call('member',undefined,{view:'admin'})).status,403);
 assert.equal((await call('member',{action:'unlock',password})).status,403,'un bon mot de passe ne suffit pas sans le bon compte');
 assert.equal((await call('admin',undefined,{view:'admin'})).status,401,'mot de passe secondaire obligatoire');
 assert.equal((await call('admin',{action:'unlock',password:'wrong'})).status,403);
 const unlocked=await call('admin',{action:'unlock',password});assert.equal(unlocked.status,200);
 const setCookie=unlocked.headers.get('set-cookie').find(value=>value.startsWith(policy.ADMIN_COOKIE+'='));assert.ok(/HttpOnly/.test(setCookie)&&/Secure/.test(setCookie)&&/SameSite=Strict/.test(setCookie));const cookie=setCookie.split(';')[0];
 assert.equal((await call('renewed',undefined,{view:'admin'},cookie)).status,401,'déverrouillage lié à la session de connexion');
 assert.equal((await call('member',undefined,{view:'admin'},cookie)).status,403,'cookie secondaire d’un autre utilisateur inutilisable');
 const list=await call('admin',undefined,{view:'admin'},cookie);assert.equal(list.status,200);assert.equal(list.data.requests.length,1);assert.deepEqual(Object.keys(list.data.requests[0]).sort(),['email','id','status']);
 assert.equal((await call('admin',{action:'decide',id:memberId,decision:'approved',expectedStatus:'pending',confirmation:'oui'}, {},cookie)).status,400);
 assert.equal((await store.read(memberId)).status,'pending');
 const acceptance=await call('admin',{action:'decide',id:memberId,decision:'approved',expectedStatus:'pending',confirmation:'accepter'},{},cookie);assert.equal(acceptance.status,200);
 const approved=await call('member',undefined);assert.equal(approved.data.status,'approved');assert.equal(approved.data.isAdmin,false);
 const {verifyLease}=load('src/web/accessLease.ts');
 const now=Date.now(),verified=await verifyLease({token:approved.data.lease,lastWall:now},memberId,now);assert.equal(verified.admin,false);assert.ok(verified.expiresAt-now<=86400000);
 await assert.rejects(verifyLease({token:approved.data.lease,lastWall:now},memberId,verified.expiresAt+1),'blocage à 24 heures');
 await assert.rejects(verifyLease({token:approved.data.lease,lastWall:now+5000},memberId,now),'horloge reculée');
 await assert.rejects(verifyLease({token:approved.data.lease,lastWall:now},adminId,now),'jeton lié au compte');
 const parts=approved.data.lease.split('.');const payload=JSON.parse(Buffer.from(parts[1],'base64url'));payload.role='admin';parts[1]=Buffer.from(JSON.stringify(payload)).toString('base64url');await assert.rejects(verifyLease({token:parts.join('.'),lastWall:now},memberId,now),'rôle falsifié refusé');
 assert.equal((await call('member',undefined,{},'',backupHandler)).status,200,'fonctionnalité autorisée après acceptation');
 assert.equal((await call('admin',{action:'decide',id:memberId,decision:'denied',expectedStatus:'approved',confirmation:'refuser'},{},cookie)).status,200);
 assert.equal((await call('member',undefined,{},'',backupHandler)).status,403,'retrait contrôlé par le serveur immédiatement');
 assert.equal((await call('member',undefined)).data.status,'blocked');
 assert.ok(await verifyLease({token:approved.data.lease,lastWall:now},memberId,now),'la limite hors connexion déjà signée reste valable avant son expiration');
 const ecdh=crypto.createECDH('prime256v1');const endpoint='https://fcm.googleapis.com/fcm/send/codex-test-'+stamp;
 const subscription={endpoint,keys:{auth:crypto.randomBytes(16).toString('base64url'),p256dh:ecdh.generateKeys().toString('base64url')}};
 assert.equal(policy.validPush({...subscription,endpoint:'http://127.0.0.1/private'}),null);assert.equal(policy.validPush({...subscription,endpoint:'https://fcm.googleapis.com.attacker.example/send'}),null);
 assert.equal((await call('member',{action:'subscribe',subscription},{},cookie)).status,403);
 assert.equal((await call('admin',{action:'subscribe',subscription},{},cookie)).status,200);
 const before=deliveries.length;await call('other',undefined);assert.equal(deliveries.length,before+1,'une notification au nouvel inscrit');
 assert.equal(deliveries.at(-1).subscription.endpoint,endpoint);assert.ok(!JSON.stringify(deliveries.at(-1).payload).includes(actors.other.email),'pas d’e-mail sur l’écran verrouillé');
 assert.equal((await call('admin',{action:'decide',id:otherId,decision:'denied',expectedStatus:'pending',confirmation:'refuser'},{},cookie)).status,200);assert.equal((await call('other',undefined)).data.status,'denied');
 assert.equal((await call('admin',{action:'decide',id:adminId,decision:'denied',expectedStatus:'approved',confirmation:'refuser'},{},cookie)).status,409,'administrateur non révocable depuis l’interface');
 assert.equal((await call('admin',{action:'lock'},{},cookie)).status,200);assert.equal((await call('admin',undefined,{view:'admin'},cookie)).status,401);
 for(let i=0;i<5;i++)assert.equal((await call('admin',{action:'unlock',password:'bad'})).status,403);
 assert.equal((await call('admin',{action:'unlock',password})).status,429,'limite durable après cinq tentatives');
 const rows=await sql`SELECT count(*)::int AS count FROM pg_tables WHERE schemaname='public' AND tablename IN ('training_access','training_admin_sessions','training_admin_attempts','training_admin_push') AND rowsecurity`;assert.equal(rows[0].count,4);
 console.log('OK accès Neon isolé : attente sans API, compte administrateur unique, mot de passe secondaire et cookie de session, accepter/refuser avec confirmation, révocation serveur, signatures hors ligne/24 h/horloge, notifications réservées, anti-SSRF et limitation des tentatives.');
}
tests().finally(async()=>{
 const ids=[adminId,memberId,otherId];
 await sql.query('DELETE FROM training_admin_push WHERE user_id = ANY($1::text[])',[ids]);await sql.query('DELETE FROM training_admin_sessions WHERE user_id = ANY($1::text[])',[ids]);await sql.query('DELETE FROM training_admin_attempts WHERE user_id = ANY($1::text[])',[ids]);await sql.query('DELETE FROM training_access WHERE user_id = ANY($1::text[])',[ids]);
}).catch(error=>{console.error(String(error.message).replace(/postgres(?:ql)?:\/\/\S+/g,'[masqué]'));process.exitCode=1;});

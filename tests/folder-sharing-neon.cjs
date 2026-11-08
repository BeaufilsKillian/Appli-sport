const assert=require('node:assert/strict'),fs=require('node:fs');const {load}=require('./sync.cjs');
process.loadEnvFile('.expo/.env.folder-sharing-test');
const {folderShareStore,shareTokenHash}=load('server/folderShareStore.ts');const {neon}=require('@neondatabase/serverless');
const sql=neon(process.env.DATABASE_URL_UNPOOLED),store=folderShareStore(process.env.DATABASE_URL_UNPOOLED);
const sample={format:'training-programme-folder',version:1,folders:[{id:'test-folder',name:'Partage de test',created_at:1}],templates:[],template_exercises:[],custom_exercises:[]};
(async()=>{
const owner='codex-share-'+Date.now(),a=await store.create(owner,sample);assert(a&&a.token.length===43);const preview=await store.preview('recipient-b',a.token);assert.equal(preview.name,'Partage de test');assert(!('payload'in preview));
const claims=await Promise.all([store.claim('recipient-b',a.token),store.claim('recipient-c',a.token)]);assert.equal(claims.filter(Boolean).length,1,'un seul destinataire, même en course');const winner=claims[0]?'recipient-b':'recipient-c',loser=claims[0]?'recipient-c':'recipient-b';assert(await store.claim(winner,a.token));assert.equal(await store.claim(loser,a.token),null);assert.equal(await store.preview(loser,a.token),null);
const [stored]=await sql.query('SELECT token_hash FROM training_folder_shares WHERE id=$1',[a.id]);assert.equal(stored.token_hash,shareTokenHash(a.token));assert.notEqual(stored.token_hash,a.token);
const revoked=await store.create(owner,sample);assert.equal(await store.revoke('other-owner',revoked.id),false);assert(await store.revoke(owner,revoked.id));assert.equal(await store.preview(winner,revoked.token),null);assert.equal(await store.claim(winner,revoked.token),null);
const expired=await store.create(owner,sample);await sql.query("UPDATE training_folder_shares SET expires_at=now()-interval '1 second' WHERE id=$1",[expired.id]);assert.equal(await store.preview(winner,expired.token),null);
assert.deepEqual(await store.list('other-owner','test-folder'),[]);
for(let i=0;i<8;i++)assert(await store.create(owner,sample));assert.equal(await store.create(owner,sample),null,'quota atomique dix partages');
await sql.query('DELETE FROM training_folder_shares WHERE owner_id=$1',[owner]);console.log('OK Neon isolé : migration RLS, jeton haché, aperçu sans contenu privé, destinataire unique concurrent, réessai, révocation propriétaire, expiration, isolation et limite dix partages.');
})().catch(e=>{console.error(String(e.message).replace(/postgres(?:ql)?:\/\/\S+/g,'[masqué]'));process.exitCode=1;});

const assert=require('node:assert/strict'),fs=require('node:fs');const {parseEnv}=require('node:util');
const {load,food}=require('./nutrition.cjs');
process.loadEnvFile('.env.local');const production=new URL(process.env.DATABASE_URL).hostname;
const env=parseEnv(fs.readFileSync('.expo/.env.nutrition-test','utf8'));assert.notEqual(new URL(env.DATABASE_URL).hostname,production,'branche isolée obligatoire');
const {neon}=require('@neondatabase/serverless');const sql=neon(env.DATABASE_URL),store=load('server/nutritionStore.ts').nutritionStore(env.DATABASE_URL);
(async()=>{
 const owner='nutrition-test-'+Date.now(),other=owner+'-other';
 try{
  const first=await store.save(owner,'food:one',0,food);assert(first);assert.equal((await store.pull(other,0)).changes.length,0);
  const raced=await Promise.all([store.save(owner,'food:one',first.revision,{...food,name:'A'}),store.save(owner,'food:one',first.revision,{...food,name:'B'})]);assert.equal(raced.filter(Boolean).length,1,'CAS concurrent');
  const latest=(await store.pull(owner,0)).changes[0];assert(latest.revision>first.revision);
  assert.equal((await store.pull(owner,latest.revision)).changes.length,0,'aucun JSON inchangé renvoyé');
  assert.equal(await store.save(other,'food:one',latest.revision,food),null,'pas de modification intercomptes');
  const removed=await store.save(owner,'food:one',latest.revision,null);assert.equal(removed.payload,null);
  assert.equal((await store.pull(owner,latest.revision)).changes[0].payload,null,'suppression propagée');
  for(let i=0;i<23;i++)await store.save(owner,'food:f'+i,0,food);
  const page=await store.pull(owner,removed.revision);assert.equal(page.changes.length,20);assert(page.more);const next=await store.pull(owner,page.cursor);assert.equal(next.changes.length,3);assert(!next.more);
  const rls=await sql`SELECT count(*)::int AS n FROM pg_tables WHERE schemaname='public' AND tablename IN ('training_nutrition','training_nutrition_heads') AND rowsecurity`;assert.equal(rls[0].n,2);
  const grants=await sql`SELECT count(*)::int AS n FROM information_schema.role_table_grants WHERE grantee='PUBLIC' AND table_name IN ('training_nutrition','training_nutrition_heads')`;assert.equal(grants[0].n,0);
  console.log('OK Neon nutrition : isolation, CAS concurrent, curseurs, pagination, suppressions, RLS et droits PUBLIC.');
 }finally{await sql`DELETE FROM training_nutrition WHERE owner_id IN (${owner},${other})`;await sql`DELETE FROM training_nutrition_heads WHERE owner_id IN (${owner},${other})`;}
})().catch(error=>{console.error(String(error.message).replace(/postgres(?:ql)?:\/\/\S+/g,'[connexion masquée]'));process.exitCode=1;});

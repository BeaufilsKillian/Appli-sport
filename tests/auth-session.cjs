const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const code = ts.transpileModule(fs.readFileSync('api/auth.ts','utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const mod={exports:{}};
class ApiError extends Error {}
let payload=null, ensured=0;
const mocks={
  '@neondatabase/auth/server':{resolveNeonAuthLogging:()=>({}),handleAuthProxyRequest:async()=>new Response(JSON.stringify(payload))},
  '../server/security.js':{ApiError,settings:()=>({origin:'https://example.test'}),privateResponse:()=>{},assertSameOrigin:()=>{},sendError:()=>{throw Error('Réponse de session invalide');}},
  '../server/accessStore.js':{accessStore:()=>({ensure:async()=>{ensured++;return {created:false};}})},
  '../server/accessPolicy.js':{notifyAdministrator:async()=>{}},
};
new Function('module','exports','require',code)(mod,mod.exports,name=>{assert(name in mocks);return mocks[name];});
(async()=>{
  const previous=process.env.ADMIN_USER_ID;process.env.ADMIN_USER_ID='test-admin';
  try {
    for(const value of [null,{}, {user:{id:'test-user',email:'test@example.test'}}]) {
      payload=value;let status,body;
      const res={setHeader(){},status(n){status=n;return this;},send(text){body=JSON.parse(text);return this;}};
      await mod.exports.default({method:'GET',url:'/api/auth/get-session',query:{path:'get-session'},headers:{}},res);
      assert.equal(status,200);assert.deepEqual(body,value);
    }
    assert.equal(ensured,1,'seule une session authentifiée crée une demande d’accès');
  } finally {if(previous===undefined)delete process.env.ADMIN_USER_ID;else process.env.ADMIN_USER_ID=previous;}
  console.log('OK session absente, objet vide et session authentifiée : aucune erreur 500.');
})().catch(e=>{console.error(e);process.exitCode=1;});

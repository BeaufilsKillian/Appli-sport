const fs=require('node:fs'),ts=require('typescript'),assert=require('node:assert/strict');
let files=[],manifest=['/assets/one.webp','/assets/two.webp'];
const code=ts.transpileModule(fs.readFileSync('src/web/offlineMedia.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const mod={exports:{}};new Function('module','exports','window','caches','fetch','location',code)(mod,mod.exports,{caches:{}},{open:async name=>{assert.equal(name,'training-media-v1');return{keys:async()=>files.map(path=>({url:'https://example.test'+path}))}}},async path=>{assert.equal(path,'/offline-media.json');return{ok:true,json:async()=>manifest}},{origin:'https://example.test'});
(async()=>{
assert.equal(await mod.exports.offlineMediaInstalled(),false);files=['/assets/one.webp'];assert.equal(await mod.exports.offlineMediaInstalled(),false);files.push('/assets/two.webp');assert.equal(await mod.exports.offlineMediaInstalled(),true);
files.pop();assert.equal(await mod.exports.offlineMediaInstalled(),false,'détecter une éviction du cache');files.push('/assets/two.webp');manifest.push('/assets/new.webp');assert.equal(await mod.exports.offlineMediaInstalled(),false,'détecter une nouvelle animation à télécharger');
manifest=['//other.example/animation.webp'];await assert.rejects(mod.exports.offlineMediaInstalled(),/invalide/);
console.log('OK animations : cache vide, partiel, complet, éviction et nouvelle version ; aucun indicateur périmé.');
})().catch(e=>{console.error(e);process.exitCode=1;});

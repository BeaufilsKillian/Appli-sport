const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),crypto=require('node:crypto');
const jose=require('jose');
(async()=>{
 const {privateKey,publicKey}=crypto.generateKeyPairSync('ec',{namedCurve:'prime256v1'}),pub=publicKey.export({format:'jwk'});
 const mod={exports:{}};const js=ts.transpileModule(fs.readFileSync('src/web/accessLease.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('require','module','exports',js)(name=>name==='jose'?jose:name==='./accessPublicKey'?{accessPublicJwk:pub}:require(name),mod,mod.exports);
 const {verifyLease}=mod.exports,now=Math.floor(Date.now()/1000);
 const sign=async(role='member',seconds=86400)=>new jose.SignJWT({role}).setProtectedHeader({alg:'ES256'}).setIssuer('training-programme').setAudience('offline-access').setSubject('member').setIssuedAt(now).setExpirationTime(now+seconds).sign(privateKey);
 const token=await sign();assert.equal((await verifyLease({token,lastWall:now*1000},'member',now*1000+86399000)).admin,false);
 await assert.rejects(verifyLease({token,lastWall:now*1000},'member',(now+86400)*1000),'échéance exacte 24 h');
 await assert.rejects(verifyLease({token,lastWall:now*1000},'other',now*1000),'compte différent');
 await assert.rejects(verifyLease({token,lastWall:now*1000+10000},'member',now*1000),'recul de l’horloge');
 await assert.rejects(verifyLease({token:await sign('admin',172800),lastWall:now*1000},'member',now*1000),'durée étendue refusée');
 const parts=token.split('.');parts[1]=Buffer.from(JSON.stringify({...JSON.parse(Buffer.from(parts[1],'base64url')),role:'admin'})).toString('base64url');await assert.rejects(verifyLease({token:parts.join('.'),lastWall:now*1000},'member',now*1000),'signature indispensable');
 console.log('OK autorisation hors ligne : signature, compte, rôle, expiration exacte à 24 h, durée fixe et horloge.');
})().catch(error=>{console.error(error);process.exitCode=1;});

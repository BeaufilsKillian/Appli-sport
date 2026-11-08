import fs from 'node:fs';
import crypto from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import webpush from 'web-push';
process.loadEnvFile('.env.local');
const password=(await new Promise((resolve,reject)=>{let text='';process.stdin.setEncoding('utf8');process.stdin.on('data',part=>text+=part);process.stdin.on('end',()=>resolve(text));process.stdin.on('error',reject);})).trimEnd();
if(password.length<12) throw Error('Mot de passe administrateur requis sur entrée standard.');
const email='killianbeaufils378@gmail.com';
const sql=neon(process.env.DATABASE_URL_UNPOOLED);
const owners=await sql`SELECT id::text AS id FROM neon_auth.user WHERE lower(email)=${email}`;
if(owners.length!==1) throw Error('Le compte administrateur doit déjà exister et être unique.');
if(process.env.ADMIN_USER_ID&&process.env.ADMIN_USER_ID!==owners[0].id) throw Error('Identité administrateur différente : configuration refusée.');
const salt=crypto.randomBytes(24).toString('hex');
const hash=crypto.scryptSync(password,salt,64).toString('hex');
let privateJwk,publicJwk;
if(process.env.ACCESS_LEASE_PRIVATE_JWK){privateJwk=JSON.parse(process.env.ACCESS_LEASE_PRIVATE_JWK);publicJwk=crypto.createPublicKey(crypto.createPrivateKey({key:privateJwk,format:'jwk'})).export({format:'jwk'});}
else{const pair=crypto.generateKeyPairSync('ec',{namedCurve:'prime256v1'});privateJwk=pair.privateKey.export({format:'jwk'});publicJwk=pair.publicKey.export({format:'jwk'});}
const vapid=process.env.ADMIN_VAPID_PRIVATE_KEY?{publicKey:process.env.ADMIN_VAPID_PUBLIC_KEY,privateKey:process.env.ADMIN_VAPID_PRIVATE_KEY}:webpush.generateVAPIDKeys();
const values={ADMIN_EMAIL:email,ADMIN_USER_ID:owners[0].id,ADMIN_PASSWORD_HASH:`scrypt:${salt}:${hash}`,ACCESS_LEASE_PRIVATE_JWK:JSON.stringify(privateJwk),ADMIN_VAPID_PUBLIC_KEY:vapid.publicKey,ADMIN_VAPID_PRIVATE_KEY:vapid.privateKey};
let env=fs.readFileSync('.env.local','utf8');
for(const [key,value]of Object.entries(values)){env=env.replace(new RegExp(`^${key}=.*\\r?\\n?`,'m'),'');env+=`\n${key}=${value}\n`;}
fs.writeFileSync('.env.local',env);
fs.writeFileSync('src/web/accessPublicKey.ts',`// Clé de vérification publique uniquement. La clé privée reste sur le serveur.\nexport const accessPublicJwk = ${JSON.stringify(publicJwk)};\n`);
console.log('Identité administrateur existante liée ; empreinte du mot de passe et clés privées enregistrées localement, sans afficher leurs valeurs.');

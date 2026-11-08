import { spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
process.loadEnvFile('.env.local');
const npmCli=process.env.npm_execpath??path.join(path.dirname(process.execPath),'node_modules','npm','bin','npm-cli.js');
if(!fs.existsSync(npmCli))throw Error('Utiliser ce script avec le runtime Node/npm installé.');
for(const key of ['ADMIN_EMAIL','ADMIN_USER_ID','ADMIN_PASSWORD_HASH','ACCESS_LEASE_PRIVATE_JWK','ADMIN_VAPID_PUBLIC_KEY','ADMIN_VAPID_PRIVATE_KEY']) {
  if(!process.env[key]) throw Error('Configuration manquante : '+key);
  const result=spawnSync(process.execPath,[npmCli,'exec','--yes','--package=vercel@65.2.0','--','vercel','env','add',key,'--environment','production','--sensitive','--yes','--force','--scope','overblast2'],{input:process.env[key],encoding:'utf8',windowsHide:true});
  if(result.status!==0)throw Error('Enregistrement Vercel refusé pour '+key+' (aucune valeur affichée).');
  console.log(key+' : enregistré côté serveur pour Production.');
}

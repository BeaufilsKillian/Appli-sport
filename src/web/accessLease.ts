import { importJWK,jwtVerify } from 'jose';
import { accessPublicJwk } from './accessPublicKey';

export type Lease={token:string;lastWall:number};
export type VerifiedLease={owner:string;admin:boolean;expiresAt:number};
export async function verifyLease(stored:Lease,owner:string,now=Date.now()):Promise<VerifiedLease> {
  if(!stored||typeof stored.token!=='string'||stored.token.length>4096||!Number.isFinite(stored.lastWall)||now<stored.lastWall-1000) throw Error('Autorisation hors connexion expirée.');
  const key=await importJWK(accessPublicJwk,'ES256');
  const {payload}=await jwtVerify(stored.token,key,{algorithms:['ES256'],issuer:'training-programme',audience:'offline-access',currentDate:new Date(now),maxTokenAge:'24h'});
  if(payload.sub!==owner||!payload.exp||!payload.iat||payload.exp-payload.iat!==86400||!['admin','member'].includes(String(payload.role))) throw Error('Autorisation invalide.');
  return {owner,admin:payload.role==='admin',expiresAt:payload.exp*1000};
}
const storageKey=(owner:string)=>'training-access-lease:'+owner;
export function readLease(owner:string):Lease|null {try{return JSON.parse(localStorage.getItem(storageKey(owner))??'null');}catch{return null;}}
export function writeLease(owner:string,lease:Lease) {try{localStorage.setItem(storageKey(owner),JSON.stringify(lease));}catch{/* L'absence de stockage empêche seulement la réouverture hors connexion. */}}
export function deleteLease(owner:string) {localStorage.removeItem(storageKey(owner));}

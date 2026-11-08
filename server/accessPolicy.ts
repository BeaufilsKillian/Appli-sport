import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { importJWK, SignJWT } from 'jose';
import webpush from 'web-push';
import { accessStore, type Identity } from './accessStore.js';

export const OFFLINE_SECONDS=24*60*60;
export const ADMIN_COOKIE='__Host-training-admin';
export async function passwordMatches(value:string,encoded:string) {
  const [kind,salt,hash]=encoded.split(':');
  if(kind!=='scrypt'||!salt||!hash||!/^[a-f0-9]{128}$/.test(hash)) return false;
  const derived=await promisify(scrypt)(value,salt,64) as Buffer;
  return timingSafeEqual(derived,Buffer.from(hash,'hex'));
}
export async function createOfflineLease(user:Identity,admin:boolean,version:number) {
  if(!process.env.ACCESS_LEASE_PRIVATE_JWK) throw Error('Signature non configurée.');
  const key=await importJWK(JSON.parse(process.env.ACCESS_LEASE_PRIVATE_JWK),'ES256');
  return new SignJWT({role:admin?'admin':'member',version}).setProtectedHeader({alg:'ES256',typ:'JWT'})
    .setIssuer('training-programme').setAudience('offline-access').setSubject(user.id).setIssuedAt().setExpirationTime(`${OFFLINE_SECONDS}s`).sign(key);
}
export function adminToken(cookie:string) {
  return cookie.split(';').map(part=>part.trim()).find(part=>part.startsWith(ADMIN_COOKIE+'='))?.slice(ADMIN_COOKIE.length+1)??'';
}
export const newAdminToken=()=>randomBytes(32).toString('hex');
export function validPush(value:unknown) {
  if(!value||typeof value!=='object') return null;
  const s=value as {endpoint?:unknown;keys?:{auth?:unknown;p256dh?:unknown}};
  if(typeof s.endpoint!=='string'||s.endpoint.length>2048||typeof s.keys?.auth!=='string'||typeof s.keys?.p256dh!=='string') return null;
  const url=new URL(s.endpoint);
  const known=url.hostname==='fcm.googleapis.com'||url.hostname.endsWith('.push.apple.com')||url.hostname==='updates.push.services.mozilla.com'||url.hostname.endsWith('.notify.windows.com');
  if(url.protocol!=='https:'||url.port||url.username||url.password||!known) return null;
  if(!/^[A-Za-z0-9_-]+={0,2}$/.test(s.keys.auth)||!/^[A-Za-z0-9_-]+={0,2}$/.test(s.keys.p256dh)||Buffer.from(s.keys.auth,'base64url').length!==16||Buffer.from(s.keys.p256dh,'base64url').length!==65) return null;
  return {endpoint:s.endpoint,keys:{auth:s.keys.auth,p256dh:s.keys.p256dh}};
}
export async function notifyAdministrator(store:ReturnType<typeof accessStore>) {
  if(!process.env.ADMIN_VAPID_PUBLIC_KEY||!process.env.ADMIN_VAPID_PRIVATE_KEY) return;
  const count=await store.count();
  const subscriptions=await store.subscriptions();
  await Promise.all(subscriptions.map(async item=>{
    try {
      await webpush.sendNotification(item.subscription,JSON.stringify({type:'access-request',count,title:'Demande d’accès',body:'Une nouvelle demande attend ta décision.',url:'/?admin=1'}),{
        vapidDetails:{subject:process.env.APP_ORIGIN!,publicKey:process.env.ADMIN_VAPID_PUBLIC_KEY!,privateKey:process.env.ADMIN_VAPID_PRIVATE_KEY!},TTL:3600,timeout:7000,
      });
    }catch(error){if([404,410].includes((error as {statusCode?:number}).statusCode??0)) await store.removePush(item.endpoint_hash);}
  }));
}

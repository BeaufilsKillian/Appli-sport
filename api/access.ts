import type { VercelRequest,VercelResponse } from '@vercel/node';
import { serializeSetCookie } from '@neondatabase/auth/server';
import { ApiError,assertSameOrigin,privateResponse,requireIdentity,sendError,settings } from '../server/security.js';
import { accessStore,isAdministrator,type AccessStatus } from '../server/accessStore.js';
import { ADMIN_COOKIE,adminToken,createOfflineLease,newAdminToken,notifyAdministrator,OFFLINE_SECONDS,passwordMatches,validPush } from '../server/accessPolicy.js';

export default async function handler(req:VercelRequest,res:VercelResponse) {
  privateResponse(res);
  try {
    if(!['GET','POST'].includes(req.method??'')) throw new ApiError(405,'Méthode non autorisée.');
    const config=settings();
    if(req.method==='POST') assertSameOrigin(req,config.origin);
    if(JSON.stringify(req.body??{}).length>8192) throw new ApiError(413,'Requête trop volumineuse.');
    if(!process.env.ADMIN_USER_ID||!process.env.ADMIN_PASSWORD_HASH||!process.env.ACCESS_LEASE_PRIVATE_JWK) throw new ApiError(503,'Contrôle d’accès indisponible. Réessaie avec Internet.');
    const user=await requireIdentity(req,res),admin=isAdministrator(user),store=accessStore(process.env.DATABASE_URL!);
    const {created}=await store.ensure(user);
    if(created&&!admin) await notifyAdministrator(store);
    const token=adminToken(req.headers.cookie??'');
    const cookie=(value:string,maxAge:number)=>{
      const previous=res.getHeader('Set-Cookie');
      res.setHeader('Set-Cookie',[...(Array.isArray(previous)?previous.map(String):previous?[String(previous)]:[]),serializeSetCookie({name:ADMIN_COOKIE,value,httpOnly:true,secure:true,sameSite:'strict',path:'/',maxAge})]);
    };
    if(req.method==='GET'&&req.query.view!=='admin') {
      const access=await store.read(user.id);
      const summary=admin?await store.summary():undefined;
      const lease=access?.status==='approved'?await createOfflineLease(user,admin,access.version):null;
      return res.json({user:{id:user.id,email:user.email},status:access?.status??'pending',isAdmin:admin,lease,serverTime:Date.now(),offlineSeconds:OFFLINE_SECONDS,...(admin?{pendingCount:summary!.count,requestRevision:summary!.revision,pushPublicKey:process.env.ADMIN_VAPID_PUBLIC_KEY??''}:{})});
    }
    if(!admin) throw new ApiError(403,'Accès administrateur refusé.');
    const action=req.body?.action;
    if(req.method==='POST'&&action==='unlock') {
      if(typeof req.body.password!=='string'||req.body.password.length>256) throw new ApiError(400,'Mot de passe requis.');
      if(!(await store.attempt(user.id))) throw new ApiError(429,'Trop de tentatives. Réessaie dans 15 minutes.');
      if(!(await passwordMatches(req.body.password,process.env.ADMIN_PASSWORD_HASH))) throw new ApiError(403,'Mot de passe administrateur incorrect.');
      await store.clearAttempts(user.id);
      const fresh=newAdminToken();await store.unlock(user.id,user.sessionId,fresh);cookie(fresh,900);
      return res.json({ok:true,expiresAt:Date.now()+900_000});
    }
    if(req.method==='POST'&&action==='lock') {if(token)await store.lock(token);cookie('',0);return res.json({ok:true});}
    if(req.method==='POST'&&action==='unsubscribe') {
      if(typeof req.body.endpoint==='string'&&req.body.endpoint.length<=2048) await store.unsubscribe(user.id,req.body.endpoint);
      return res.json({ok:true});
    }
    if(!(await store.unlocked(user,token))) throw new ApiError(401,'Entre le mot de passe administrateur.');
    if(req.method==='GET'&&req.query.view==='admin') return res.json({requests:await store.list(),pendingCount:await store.count()});
    if(req.method==='POST'&&action==='decide') {
      const {id,decision,confirmation,expectedStatus}=req.body;
      if(typeof id!=='string'||id.length>100||!['approved','denied'].includes(decision)||!['pending','approved','denied','blocked'].includes(expectedStatus)) throw new ApiError(400,'Décision invalide.');
      if(confirmation!==(decision==='approved'?'accepter':'refuser')) throw new ApiError(400,'Recopie exactement accepter ou refuser.');
      if(!await store.decide(id,decision,user.id,expectedStatus as AccessStatus)) throw new ApiError(409,'Cette demande a déjà changé. Actualise la liste.');
      return res.json({ok:true,pendingCount:await store.count()});
    }
    if(req.method==='POST'&&action==='subscribe') {
      let subscription;try{subscription=validPush(req.body.subscription);}catch{subscription=null;}
      if(!subscription) throw new ApiError(400,'Abonnement de notification invalide.');
      await store.subscribe(user.id,subscription,subscription.endpoint);return res.json({ok:true});
    }
    if(req.method==='POST'&&action==='test-notification') {await notifyAdministrator(store);return res.json({ok:true});}
    throw new ApiError(400,'Action inconnue.');
  }catch(error){return sendError(res,error);}
}

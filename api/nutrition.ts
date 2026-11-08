import type { VercelRequest,VercelResponse } from '@vercel/node';
import { ApiError,assertSameOrigin,privateResponse,requireUser,sendError,settings } from '../server/security.js';
import { nutritionStore } from '../server/nutritionStore.js';
import { parseNutrition } from '../src/nutrition/core.js';
export default async function handler(req:VercelRequest,res:VercelResponse) {
  privateResponse(res);
  try {
    if(!['GET','POST'].includes(req.method??''))throw new ApiError(405,'Méthode non autorisée.');
    if(req.method==='POST')assertSameOrigin(req,settings().origin);
    const owner=await requireUser(req,res);
    if(req.headers['x-training-owner']!==owner)throw new ApiError(403,'Le compte a changé.');
    const store=nutritionStore(process.env.DATABASE_URL!);
    if(req.method==='GET') {const after=req.query.after===undefined?0:Number(req.query.after);if(!Number.isSafeInteger(after)||after<0)throw new ApiError(400,'Curseur invalide.');return res.json(await store.pull(owner,after));}
    if(!req.body||typeof req.body.key!=='string'||!Number.isSafeInteger(req.body.base)||req.body.base<0||new TextEncoder().encode(JSON.stringify(req.body)).length>65000)throw new ApiError(400,'Envoi nutritionnel invalide.');
    let payload;try{payload=parseNutrition(req.body.key,req.body.value);}catch(error){throw new ApiError(400,error instanceof Error?error.message:'Élément invalide.');}
    const saved=await store.save(owner,req.body.key,req.body.base,payload);
    if(!saved)throw new ApiError(409,'Une autre version existe, ou la limite de 50 000 éléments est atteinte. Synchronise avant de réessayer.');
    return res.json(saved);
  }catch(error){return sendError(res,error);}
}

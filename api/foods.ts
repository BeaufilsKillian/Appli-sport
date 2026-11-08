import type {VercelRequest,VercelResponse} from '@vercel/node';
import {ApiError,privateResponse,requireUser,sendError} from '../server/security.js';
import {normalizeBarcode,offFood,type Food} from '../src/nutrition/core.js';
const cache=new Map<string,{time:number;foods:Food[]}>();
const inFlight=new Map<string,Promise<Food[]>>();
const usage=new Map<string,{start:number;count:number}>();
const fields='code,product_name,product_name_fr,generic_name,brands,nutriments,nutrition_data_per,product_quantity_unit,quantity';
async function readOff(url:string):Promise<Record<string,unknown>|null> {
  let response:Response;
  try{response=await fetch(url,{headers:{'User-Agent':'TrainingProgramme/1.0 (https://training-programme-ten.vercel.app/api/guide)','Accept':'application/json'},signal:AbortSignal.timeout(10000)});}
  catch{throw new ApiError(503,'Open Food Facts ne répond pas. Réessaie plus tard ou utilise un aliment enregistré.');}
  if(response.status===404)return null;
  if(response.status===429)throw new ApiError(429,'Open Food Facts limite les recherches. Réessaie dans une minute.');
  if(!response.ok){console.warn('food_provider_unavailable',{route:new URL(url).pathname.replace(/\d+/g,':code'),status:response.status});throw new ApiError(response.status>=500?503:502,'Open Food Facts est momentanément indisponible. Tes aliments enregistrés restent utilisables.');}
  let text:string;
  try{text=await response.text();}catch{throw new ApiError(503,'La réponse d’Open Food Facts a été interrompue. Réessaie plus tard.');}
  if(text.length>2_000_000)throw new ApiError(502,'Réponse alimentaire trop volumineuse.');
  try{const value=JSON.parse(text);if(!value||typeof value!=='object'||Array.isArray(value))throw Error();return value;}
  catch{throw new ApiError(503,'Open Food Facts a renvoyé une réponse illisible. Réessaie plus tard.');}
}
export default async function handler(req:VercelRequest,res:VercelResponse) {
  privateResponse(res);
  try {
    if(req.method!=='GET')throw new ApiError(405,'Méthode non autorisée.');
    const owner=await requireUser(req,res);
    const barcode=typeof req.query.barcode==='string'?normalizeBarcode(req.query.barcode):'';
    const query=typeof req.query.q==='string'?req.query.q.trim():'';
    if(!barcode&&(query.length<2||query.length>100))throw new ApiError(400,'Recherche : 2 à 100 caractères.');
    const key=barcode?'code:'+barcode:'search:'+query.toLowerCase(),saved=cache.get(key);
    if(saved&&Date.now()-saved.time<(barcode?86400000:900000))return res.json({foods:saved.foods});
    const previous=usage.get(owner); const window=previous&&Date.now()-previous.start<60000?previous:{start:Date.now(),count:0};
    if(++window.count>8)throw new ApiError(429,'Trop de recherches. Réessaie dans une minute.');usage.set(owner,window);
    if(usage.size>1000)usage.delete(usage.keys().next().value!);
    let pending=inFlight.get(key);
    if(!pending){pending=(async()=>{
      let result:Record<string,unknown>|null,products:unknown;
      try{
        result=await readOff(barcode?`https://world.openfoodfacts.org/api/v3/product/${barcode}.json?fields=${fields}`:`https://search.openfoodfacts.org/search?q=${encodeURIComponent(query)}&langs=fr,en&page_size=20&fields=${fields}`);
        products=barcode?(result?.product?[{...result.product as object,code:barcode}]:[]):result?.hits??[];
      }catch(error){
        if(!(error instanceof ApiError)||error.status!==503)throw error;
        // Un seul recours officiel en cas de panne ; un quota ou refus n'est jamais contourné.
        result=await readOff(barcode?`https://search.openfoodfacts.org/document/${barcode}`:`https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=20&fields=${fields}`);
        products=barcode?(result?[{...result,code:barcode}]:[]):result?.products??[];
      }
      if(!Array.isArray(products))throw new ApiError(503,'Réponse alimentaire invalide. Réessaie plus tard.');
      const foods:Food[]=[];for(const product of products.slice(0,20)){try{foods.push(offFood(product));}catch{/* Une fiche invalide ne devient pas un aliment à zéro. */}}
      cache.set(key,{time:Date.now(),foods});if(cache.size>200)cache.delete(cache.keys().next().value!);return foods;
    })();inFlight.set(key,pending);}
    try{return res.json({foods:await pending});}finally{inFlight.delete(key);}
  }catch(error){if(error instanceof Error&&/code-barres|QR code/.test(error.message))return sendError(res,new ApiError(400,error.message));return sendError(res,error);}
}

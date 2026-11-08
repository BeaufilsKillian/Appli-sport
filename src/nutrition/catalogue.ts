import rows from './ciqual.json';
import type { Food } from './core';
const normalized=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const index=rows.map(row=>({row,search:normalized(String(row[1]))}));
export function searchCiqual(query:string):Food[] {
  const words=normalized(query).split(/\s+/).filter(Boolean);if(!words.length)return [];
  return index.filter(item=>words.every(word=>item.search.includes(word))).slice(0,40).map(({row})=>({name:String(row[1]),brand:'Ciqual 2025 · cru/cuit selon le nom',source:'ciqual',sourceId:String(row[0]),barcode:'',unit:'g',per100:{kcal:row[2] as number|null,protein:row[3] as number|null,carbs:row[4] as number|null,fat:row[5] as number|null,fiber:row[6] as number|null}}));
}

import type { SQLiteDatabase } from 'expo-sqlite';
import { parseNutrition, type NutritionValue } from './core';
type NutritionDatabase = {
  getAllAsync<T>(query:string,...args:(string|number|null)[]):Promise<T[]>;
  getFirstAsync<T>(query:string,...args:(string|number|null)[]):Promise<T|null>;
  runAsync(query:string,...args:(string|number|null)[]):Promise<unknown>;
  withExclusiveTransactionAsync(fn:(db:SQLiteDatabase)=>Promise<void>):Promise<void>;
};
export type Document = { key: string; payload: string | null; server_revision: number; local_version: number; dirty: number; conflict: string | null; conflict_revision: number };
export type Change = { key: string; payload: NutritionValue | null; revision: number };
export function valueOf<T extends NutritionValue>(doc: Document): T { return JSON.parse(doc.payload!) as T; }
export async function documents(db: NutritionDatabase): Promise<Document[]> { return db.getAllAsync<Document>('SELECT * FROM nutrition_documents ORDER BY key'); }
export async function putDocument(db: NutritionDatabase,key: string,input: unknown,expected?: number) {
  const value=parseNutrition(key,input), payload=value===null?null:JSON.stringify(value);
  await db.withExclusiveTransactionAsync(async tx=>{
    const row=await tx.getFirstAsync<Document>('SELECT * FROM nutrition_documents WHERE key=?',key);
    if(expected!==undefined&&(row?.local_version??0)!==expected)throw Error('Cet élément a changé sur un autre écran. Reviens à la liste avant de réessayer.');
    if(row?.conflict)throw Error('Résous le conflit de cet élément avant de le modifier.');
    await tx.runAsync(`INSERT INTO nutrition_documents (key,payload,server_revision,local_version,dirty,conflict,conflict_revision) VALUES (?,?,0,1,1,NULL,0)
      ON CONFLICT(key) DO UPDATE SET payload=excluded.payload,local_version=nutrition_documents.local_version+1,dirty=1`,key,payload);
  });
}
export async function resolveDocument(db: NutritionDatabase,key: string,keepLocal: boolean,expected: number) {
  await db.withExclusiveTransactionAsync(async tx=>{
    const row=await tx.getFirstAsync<Document>('SELECT * FROM nutrition_documents WHERE key=?',key);
    if(!row?.conflict||row.local_version!==expected)throw Error('Le conflit a changé. Recharge la liste.');
    const payload=keepLocal?row.payload:row.conflict==='null'?null:row.conflict;
    await tx.runAsync('UPDATE nutrition_documents SET payload=?,server_revision=conflict_revision,local_version=local_version+1,dirty=?,conflict=NULL,conflict_revision=0 WHERE key=?',payload,keepLocal?1:0,key);
  });
}
export async function exportNutrition(db: NutritionDatabase) {
  const rows=await documents(db);
  if(rows.some(row=>row.conflict))throw Error('Résous les conflits avant d’exporter.');
  return {format:'training-programme-nutrition',version:1,exported_at:new Date().toISOString(),sources:{ciqual:'Anses. 2025. Ciqual. https://doi.org/10.5281/zenodo.17550133',off:'Open Food Facts — ODbL. https://world.openfoodfacts.org/terms-of-use'},documents:rows.filter(row=>row.payload!==null).map(row=>({key:row.key,value:JSON.parse(row.payload!)}))};
}
export async function importNutrition(db: NutritionDatabase,input: unknown) {
  const data=input as {format?:string;version?:number;documents?:{key:string;value:unknown}[]};
  if(!data||data.format!=='training-programme-nutrition'||data.version!==1||!Array.isArray(data.documents)||data.documents.length>50000||new TextEncoder().encode(JSON.stringify(data)).length>20_000_000)throw Error('Sauvegarde nutritionnelle invalide (20 Mo maximum).');
  const seen=new Set<string>();
  const values=data.documents.map(item=>{if(!item||typeof item.key!=='string'||seen.has(item.key))throw Error('Doublon nutritionnel.');seen.add(item.key);const parsed=parseNutrition(item.key,item.value);if(parsed===null)throw Error('Élément vide.');return {key:item.key,payload:JSON.stringify(parsed)};});
  await db.withExclusiveTransactionAsync(async tx=>{
    for(const item of values) {
      const existing=await tx.getFirstAsync<Document>('SELECT * FROM nutrition_documents WHERE key=?',item.key);
      if(existing&&existing.payload!==item.payload)throw Error('Import refusé : un élément différent porte le même identifiant. Aucune donnée n’a été remplacée.');
      if(!existing)await tx.runAsync('INSERT INTO nutrition_documents (key,payload,server_revision,local_version,dirty,conflict,conflict_revision) VALUES (?,?,0,1,1,NULL,0)',item.key,item.payload);
    }
  });
}
export type Transport = { pull(after:number):Promise<{changes:Change[];cursor:number;more:boolean}>; push(key:string,base:number,value:NutritionValue|null):Promise<Change> };
export async function synchronizeNutrition(db: NutritionDatabase,transport: Transport,live=()=>true) {
  let cursor=Number((await db.getFirstAsync<{value:string}>('SELECT value FROM nutrition_meta WHERE key=?','cursor'))?.value??0);
  let more=false;
  // Pagination bornée ; les éléments suivants seront récupérés au prochain passage.
  for(let page=0;page<100&&live();page++) {
    const response=await transport.pull(cursor);
    more=response.more;
    if(!live())return;
    if(!Number.isSafeInteger(response.cursor)||response.cursor<cursor||!Array.isArray(response.changes)||response.changes.length>20)throw Error('Réponse nutritionnelle incohérente.');
    if(response.changes.length||response.cursor!==cursor)await db.withExclusiveTransactionAsync(async tx=>{
      for(const change of response.changes) {
        const value=parseNutrition(change.key,change.payload), payload=value===null?null:JSON.stringify(value);
        if(!Number.isSafeInteger(change.revision)||change.revision<=cursor||change.revision>response.cursor)throw Error('Version nutritionnelle incohérente.');
        const row=await tx.getFirstAsync<Document>('SELECT * FROM nutrition_documents WHERE key=?',change.key);
        if(row&&change.revision<=row.server_revision)continue;
        if(row?.dirty&&row.payload!==payload) {
          await tx.runAsync('UPDATE nutrition_documents SET conflict=?,conflict_revision=? WHERE key=?',JSON.stringify(value),change.revision,change.key);
        }else await tx.runAsync(`INSERT INTO nutrition_documents (key,payload,server_revision,local_version,dirty,conflict,conflict_revision) VALUES (?,?,?,1,0,NULL,0)
          ON CONFLICT(key) DO UPDATE SET payload=excluded.payload,server_revision=excluded.server_revision,local_version=nutrition_documents.local_version+1,dirty=0,conflict=NULL,conflict_revision=0`,change.key,payload,change.revision);
      }
      await tx.runAsync("INSERT OR REPLACE INTO nutrition_meta (key,value) VALUES ('cursor',?)",String(response.cursor));
    });
    cursor=response.cursor;
    if(!response.more)break;
    if(!response.changes.length)throw Error('Pagination nutritionnelle incohérente.');
  }
  const pending=await db.getAllAsync<Document>('SELECT * FROM nutrition_documents WHERE dirty=1 AND conflict IS NULL ORDER BY key LIMIT 100');
  for(const row of pending) {
    if(!live())return;
    const saved=await transport.push(row.key,row.server_revision,row.payload===null?null:JSON.parse(row.payload));
    if(!live())return;
    if(saved.key!==row.key||!Number.isSafeInteger(saved.revision)||saved.revision<=row.server_revision)throw Error('Version nutritionnelle incohérente.');
    await db.runAsync('UPDATE nutrition_documents SET server_revision=?,dirty=CASE WHEN local_version=? THEN 0 ELSE 1 END WHERE key=?',saved.revision,row.local_version,row.key);
  }
  return {more};
}

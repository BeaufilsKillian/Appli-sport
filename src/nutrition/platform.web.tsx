import React,{createContext,useContext,useEffect,useMemo,useState} from 'react';
import type {SQLiteDatabase} from 'expo-sqlite';
import {api,useWebSession} from '../web/session';
import {useAccess} from '../web/Access';
import type {LocalDatabase} from '../web/localDatabase';
import {importNutrition,synchronizeNutrition,type Transport} from './store';
import type {Food} from './core';
type Value={status:string;sync():Promise<void>;search(query:string,barcode?:boolean):Promise<Food[]>;canImport:boolean;importFile(db:SQLiteDatabase):Promise<void>};
const Context=createContext<Value|null>(null);
export function useNutritionCloud(){const value=useContext(Context);if(!value)throw Error('Nutrition non prête.');return value;}
export function NutritionSyncProvider({children,db}:{children:React.ReactNode;db:LocalDatabase}) {
  const session=useWebSession(),access=useAccess(),owner=session.user?.id??'';
  const [status,setStatus]=useState('Nutrition enregistrée sur cet appareil');
  const [syncAction,setSyncAction]=useState<{run():Promise<void>}>({run:async()=>{}});
  const transport=useMemo<Transport>(()=>({pull:after=>api(`/api/nutrition?after=${after}`,undefined,{'X-Training-Owner':owner}),push:(key,base,value)=>api('/api/nutrition',{key,base,value},{'X-Training-Owner':owner})}),[owner]);
  useEffect(()=>{
    let live=true,running=false,timer:ReturnType<typeof setTimeout>;
    const run=async()=>{
      if(!live||running||!owner||!session.authenticated||!access.canUse||!navigator.onLine)return;
      running=true;
      try{let result;try{result=await synchronizeNutrition(db,transport,()=>live);}catch(error){if((error as {status?:number}).status!==409)throw error;result=await synchronizeNutrition(db,transport,()=>live);}if(result?.more&&live)schedule(true);if(live){const counts=await db.getFirstAsync<{dirty:number;conflicts:number}>('SELECT sum(dirty) AS dirty,sum(CASE WHEN conflict IS NOT NULL THEN 1 ELSE 0 END) AS conflicts FROM nutrition_documents');setStatus(counts?.conflicts?'Nutrition : conflit à résoudre':counts?.dirty?'Nutrition : envoi en attente':'Nutrition sauvegardée en ligne');}}
      catch(error){if(live)setStatus(error instanceof Error?error.message:'Nutrition conservée sur cet appareil.');}
      finally{running=false;}
    };
    const schedule=(forced=false)=>{clearTimeout(timer);timer=setTimeout(()=>{void (async()=>{if(!live)return;if(!forced&&!await db.getFirstAsync('SELECT key FROM nutrition_documents WHERE dirty=1 AND conflict IS NULL LIMIT 1'))return;await run();})().catch(()=>{});},1500);};
    const unsubscribe=db.subscribe(scope=>{if(scope==='nutrition')schedule();});
    const visible=()=>{if(document.visibilityState==='visible')schedule(true);};
    const online=()=>schedule(true);
    queueMicrotask(()=>{if(live)setSyncAction({run});});schedule(true);
    const poll=setInterval(visible,300000);
    window.addEventListener('online',online);window.addEventListener('focus',visible);document.addEventListener('visibilitychange',visible);
    return()=>{live=false;unsubscribe();clearTimeout(timer);clearInterval(poll);window.removeEventListener('online',online);window.removeEventListener('focus',visible);document.removeEventListener('visibilitychange',visible);};
  },[db,owner,session.authenticated,access.canUse,transport]);
  return <Context.Provider value={{status,sync:syncAction.run,canImport:true,
    async search(query,barcode=false){if(!navigator.onLine)throw Error('Internet est nécessaire pour rechercher un nouveau produit emballé.');return (await api<{foods:Food[]}>(`/api/foods?${barcode?'barcode':'q'}=${encodeURIComponent(query)}`)).foods;},
    async importFile(database){
      const file=await new Promise<File|null>(resolve=>{const input=document.createElement('input');input.type='file';input.accept='.json,application/json';input.onchange=()=>resolve(input.files?.[0]??null);input.oncancel=()=>resolve(null);input.click();});
      if(!file)return;if(file.size>20_000_000)throw Error('Fichier trop volumineux (20 Mo maximum).');await importNutrition(database,JSON.parse(await file.text()));
    },
  }}>{children}</Context.Provider>;
}

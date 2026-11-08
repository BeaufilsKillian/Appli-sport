import React from 'react';
import type {Food} from './core';
import type {SQLiteDatabase} from 'expo-sqlite';
export function NutritionSyncProvider({children}:{children:React.ReactNode;db:unknown}) {return <>{children}</>;}
export function useNutritionCloud() {
  return {status:'Enregistré sur cet appareil · export nutrition disponible',canImport:false,sync:async()=>{},search:async(_query:string,_barcode=false):Promise<Food[]>=>{throw Error('La recherche des produits emballés est disponible dans la PWA.');},importFile:async(_db:SQLiteDatabase)=>{throw Error('Import disponible dans la PWA.');}};
}

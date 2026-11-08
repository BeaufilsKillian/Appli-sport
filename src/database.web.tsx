import React, { createContext, useContext, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import type { SQLiteDatabase } from 'expo-sqlite';
import { LocalDatabase } from './web/localDatabase';
import { useWebSession } from './web/session';
import { CloudPanel } from './web/CloudPanel';
import { NutritionSyncProvider } from './nutrition/platform';

const Context = createContext<LocalDatabase | null>(null);
export function useLocalDatabase() { const db = useContext(Context); if (!db) throw new Error('Base non prête.'); return db; }
export function useSQLiteContext() { return useLocalDatabase() as unknown as SQLiteDatabase; }
export function SQLiteProvider({ children, onInit }: { children: React.ReactNode; databaseName: string; onInit?: (db: SQLiteDatabase) => Promise<void> }) {
  const { owner } = useWebSession();
  const [ready, setReady] = useState<{ owner: string; db: LocalDatabase } | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true; let opened: LocalDatabase | undefined;
    queueMicrotask(() => { if (live) setError(''); });
    void LocalDatabase.open(owner).then(async db => {
      opened = db;
      if (!live) { await db.close(); return; }
      if (onInit) await db.withExclusiveTransactionAsync(onInit);
      if (live) setReady({ owner, db });
      else await db.close();
    }).catch(error => { if (opened) void opened.close(); if (live) setError(error instanceof Error ? error.message : 'Stockage indisponible. Aucune donnée n’a été effacée.'); });
    return () => { live = false; if (opened) void opened.close(); };
  }, [owner, onInit]);
  if (error || !ready || ready.owner !== owner) return <View style={{ flex: 1, backgroundColor: '#050709', alignItems: 'center', justifyContent: 'center', padding: 24 }}><Text style={{ color: 'white' }}>{error || 'Chargement…'}</Text></View>;
  return <Context.Provider value={ready.db}><NutritionSyncProvider key={owner} db={ready.db}><CloudPanel db={ready.db}>{children}</CloudPanel></NutritionSyncProvider></Context.Provider>;
}

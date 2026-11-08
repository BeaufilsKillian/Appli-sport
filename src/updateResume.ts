import type { SQLiteDatabase } from 'expo-sqlite';

const KEY = 'update_resume';
export async function saveUpdateResume(db: SQLiteDatabase, sessionId: string | null, exerciseIndex: number, reopenWorkout: boolean) {
  await db.runAsync('INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)', KEY, JSON.stringify({ sessionId, exerciseIndex, reopenWorkout }));
}
export async function takeUpdateResume(db: SQLiteDatabase, activeId?: string) {
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', KEY);
  if (!row) return null;
  await db.runAsync('DELETE FROM settings WHERE key = ?', KEY);
  try {
    const value = JSON.parse(row.value);
    if (activeId && value.sessionId === activeId && Number.isInteger(value.exerciseIndex) && value.exerciseIndex >= 0 && typeof value.reopenWorkout === 'boolean') {
      return { exerciseIndex: value.exerciseIndex as number, reopenWorkout: value.reopenWorkout as boolean };
    }
  } catch { /* La séance reste disponible depuis l'accueil. */ }
  return null;
}

import type { SQLiteDatabase } from 'expo-sqlite';
import { readSetInput, saveSetInput, updateLoggedSet, type LoggedSet, type HistorySet } from './db';
import { previousPerformance, parseSetDuration, formatSetDuration } from './setInputs';

export function parseSetValue(text: string, field: 'weight' | 'reps' | 'duration'): number | null {
  if (field === 'duration') return parseSetDuration(text);
  const normalized = text.trim().replace(',', '.');
  if (!/^\d+(?:\.\d*)?$/.test(normalized)) return null;
  const value = Number(normalized);
  if (!Number.isFinite(value) || value > Number.MAX_SAFE_INTEGER || (field === 'reps' && (!Number.isInteger(value) || value > 1000))) return null;
  return value;
}

// Les frappes et la coche partagent la même file : une réponse tardive ne peut
// pas rétablir l'ancienne charge ou annuler la validation.
export function createSetWriter(db: SQLiteDatabase, onSaved: (set: LoggedSet) => void) {
  let pending: Promise<void> = Promise.resolve();
  type Action = Partial<Pick<LoggedSet, 'weight' | 'reps' | 'rpe' | 'duration_seconds'>> | 'toggle' | { field: 'weight' | 'reps' | 'duration'; text: string };
  return {
    write(id: string, patch: Action) {
      const task = pending.then(async () => {
        let saved: LoggedSet | undefined;
        await db.withExclusiveTransactionAsync(async txn => {
          const row = await txn.getFirstAsync<LoggedSet>('SELECT * FROM logged_sets WHERE id = ?', id);
          if (!row) return;
          const timed = row.duration_seconds != null;
          const input = { ...await readSetInput(txn, row) };
          if (patch === 'toggle' && row.completed) {
            saved = { ...row, input, completed: 0 };
          } else {
            if (patch === 'toggle') {
              const history = await txn.getAllAsync<HistorySet>(`SELECT ls.*, s.started_at, s.finished_at FROM logged_sets ls JOIN sessions s ON s.id=ls.session_id WHERE ls.exercise_id=? AND ls.completed=1 AND s.finished_at IS NOT NULL`, row.exercise_id);
              const previous = previousPerformance(history, row);
              if (!input.weight.trim() && previous) input.weight = String(previous.weight).replace('.', ',');
              if (!input.reps.trim() && previous) input.reps = String(previous.reps);
              if (timed && !input.duration?.trim() && previous?.duration_seconds != null) input.duration = formatSetDuration(previous.duration_seconds);
            } else if ('field' in patch) input[patch.field] = patch.text.slice(0, 40);
            else {
              if (patch.weight !== undefined) input.weight = String(patch.weight).replace('.', ',');
              if (patch.reps !== undefined) input.reps = String(patch.reps);
              if (patch.duration_seconds != null) input.duration = formatSetDuration(patch.duration_seconds);
            }
            const weight = timed && !input.weight.trim() ? 0 : parseSetValue(input.weight, 'weight');
            const reps = timed ? 0 : parseSetValue(input.reps, 'reps');
            const duration = timed ? parseSetDuration(input.duration ?? '') : null;
            const complete = weight !== null && (timed ? duration !== null && duration > 0 : reps !== null && reps > 0);
            if (patch === 'toggle' && !complete) throw new Error(timed ? 'Renseigne la durée de cette série.' : 'Renseigne la charge et les répétitions pour cette série.');
            saved = { ...row, input, weight: weight ?? row.weight, reps: reps ?? row.reps,
              duration_seconds:timed ? duration ?? row.duration_seconds : null,
              rpe: typeof patch === 'object' && 'rpe' in patch ? patch.rpe ?? null : row.rpe,
              completed: complete ? 1 : 0 };
          }
          await updateLoggedSet(txn, saved);
          await saveSetInput(txn, id, saved.input!);
        });
        if (saved) onSaved(saved);
      });
      pending = task.catch(() => {});
      return task;
    },
    flush: () => pending,
  };
}

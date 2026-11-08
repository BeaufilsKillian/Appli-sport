import type { HistorySet, LoggedSet } from './db';

export const formatSetDuration = (seconds: number): string => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
export function parseSetDuration(text: string): number | null {
  const value = text.trim();
  if (!/^\d+(?::[0-5]\d)?$/.test(value)) return null;
  const parts = value.split(':').map(Number);
  const seconds = parts.length === 2 ? parts[0] * 60 + parts[1] : parts[0];
  return Number.isInteger(seconds) && seconds >= 0 && seconds <= 86400 ? seconds : null;
}

export function previousPerformance(history: HistorySet[], set: Pick<LoggedSet, 'exercise_id' | 'ordinal' | 'set_kind' | 'duration_seconds'>): HistorySet | null {
  const candidates = history.filter(row => row.exercise_id === set.exercise_id && row.completed === 1);
  let latest: HistorySet | undefined;
  for (const row of candidates) {
    if (!latest || row.finished_at > latest.finished_at || (row.finished_at === latest.finished_at && (row.started_at > latest.started_at || (row.started_at === latest.started_at && row.session_id > latest.session_id)))) latest = row;
  }
  if (!latest) return null;
  // Pas de record, ni de remplacement par une série d'une séance plus ancienne.
  return candidates.find(row => row.session_id === latest.session_id && row.ordinal === set.ordinal && row.set_kind === set.set_kind && (row.duration_seconds != null) === (set.duration_seconds != null)) ?? null;
}

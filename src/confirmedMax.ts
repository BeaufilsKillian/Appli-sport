import type { LoggedSet } from './db';

// Epley sans réserve supposée : retenir la performance confirmée la plus faible.
export function confirmedMax(sets: LoggedSet[], plannedSets: number, current: number): number | null {
  const normal = sets.filter(set => set.set_kind === 'normal');
  if (normal.length < Math.max(2, plannedSets) || normal.some(set => set.completed !== 1 || set.duration_seconds != null || !Number.isFinite(set.weight) || set.weight <= 0 || set.weight > 1000 || !Number.isInteger(set.reps) || set.reps < 1 || set.reps > 15)) return null;
  const estimates = normal.map(set => set.reps === 1 ? set.weight : set.weight * (1 + set.reps / 30));
  const lowest = Math.min(...estimates), highest = Math.max(...estimates);
  if (highest > lowest * 1.15) return null;
  const result = Math.floor((lowest + 1e-8) * 10) / 10;
  return result > current && result <= 1000 ? result : null;
}

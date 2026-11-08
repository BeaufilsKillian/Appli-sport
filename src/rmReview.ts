import type { ExerciseMax, HistorySet } from './db';

// Seuils de rappel produit, pas une mesure ni une modification automatique du 1RM.
export function rmReview(reference: ExerciseMax | undefined, history: HistorySet[], now: number): string | null {
  if (!reference || reference.weight <= 0) return null;
  const recent = history.filter(set => set.exercise_id === reference.exercise_id && set.completed === 1 && set.finished_at > reference.updated_at && set.finished_at <= now && set.finished_at >= now - 42 * 86400000);
  const sessions = [...new Set([...recent].sort((a,b) => b.finished_at - a.finished_at).map(set => set.session_id))].slice(0,3);
  const signals = new Set<string>();
  // Comparer uniquement des difficultés identiques, sans assimiler une série arrêtée à l'échec.
  for (const effort of [10, 9.5, 9, 8.5, 8]) {
    const estimates = sessions.map(id => {
      const eligible = recent.filter(set => set.session_id === id && set.started_at >= reference.updated_at && set.duration_seconds == null && set.set_kind === 'normal' && set.weight > 0 && Number.isInteger(set.reps) && set.reps >= 1 && set.reps <= 15 && set.rpe === effort);
      return eligible.length ? Math.max(...eligible.map(set => set.weight * (1 + (set.reps + 10 - effort) / 30))) : null;
    });
    if (estimates.length === 3 && estimates.every(value => value !== null && value >= reference.weight * 1.1)) signals.add('up');
    if (estimates.length === 3 && estimates.every(value => value !== null && value <= reference.weight * .9)) signals.add('down');
  }
  if (signals.size === 1 && signals.has('up')) return '3 séances comparables suggèrent un 1RM plus élevé.';
  if (signals.size === 1 && signals.has('down')) return '3 séances comparables suggèrent un 1RM plus bas.';
  return now - reference.updated_at >= 42 * 86400000 ? 'Référence datant de 6 semaines ou plus.' : null;
}

import { estimateSetSeconds } from './planner';
import { buildWorkoutBlocks, buildWorkoutRounds, type SessionPlan } from './supersets';
import type { LoggedSet } from './db';

// shortcut: tempo estimé comme dans l'assistant, à personnaliser si un tempo est renseigné.
export function workoutProgress(plans: (SessionPlan & { target_reps: number; planned_duration_seconds?: number | null })[], sets: LoggedSet[]): number {
  let total = 0;
  let done = 0;
  const byExercise = new Map(plans.map(plan => [plan.exercise_id, plan]));
  for (const block of buildWorkoutBlocks(plans)) {
    const rounds = buildWorkoutRounds(block, sets);
    for (const [index, round] of rounds.entries()) {
      for (const { set } of round.rows) {
        const reps = byExercise.get(set.exercise_id)?.target_reps || set.reps || 8;
        const seconds = set.duration_seconds != null ? byExercise.get(set.exercise_id)?.planned_duration_seconds ?? (set.duration_seconds || 60) : estimateSetSeconds(reps);
        total += seconds;
        if (set.completed === 1) done += seconds;
      }
      // Un repos entre tours, aucun avant un dropset ni après le dernier tour.
      const rest = rounds[index + 1]?.rows.some(row => row.set.set_kind !== 'drop')
        ? Math.max(0, ...round.rows.map(row => byExercise.get(row.exerciseId)?.rest_seconds ?? 0)) : 0;
      total += rest;
      if (round.rows.every(row => row.set.completed === 1)) done += rest;
    }
  }
  return total ? done / total : 0;
}

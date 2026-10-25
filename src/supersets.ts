// Ordonnancement immuable des supersets pour la séance en cours.
// Ce module n'utilise pas React : les regroupements sont testables indépendamment.
export type SessionPlan = {
  exercise_id: string;
  position: number;
  superset_group: number;
  rest_seconds: number;
};
export type WorkoutBlock = { key: string; group: number; exerciseIds: string[] };
export type SetInRound<T> = { exerciseId: string; exerciseIndex: number; set: T };
export type WorkoutRound<T> = { number: number; rows: SetInRound<T>[] };

/** Une étiquette "superset" exige au moins deux exercices dans le même groupe. */
export function buildWorkoutBlocks(plans: SessionPlan[]): WorkoutBlock[] {
  const ordered = [...plans].sort((a,b) => a.position - b.position);
  const sizeByGroup = new Map<number, number>();
  ordered.forEach(p => { if (p.superset_group > 0) sizeByGroup.set(p.superset_group, (sizeByGroup.get(p.superset_group) ?? 0) + 1); });
  const visited = new Set<string>();
  const blocks: WorkoutBlock[] = [];
  for (const plan of ordered) {
    if (visited.has(plan.exercise_id)) continue;
    const group = plan.superset_group > 0 && (sizeByGroup.get(plan.superset_group) ?? 0) >= 2 ? plan.superset_group : 0;
    const members = group
      ? ordered.filter(p => p.superset_group === group && !visited.has(p.exercise_id)).map(p=>p.exercise_id)
      : [plan.exercise_id];
    members.forEach(id => visited.add(id));
    blocks.push({ key: group ? `super-${group}` : `single-${plan.exercise_id}`, group, exerciseIds: members });
  }
  return blocks;
}

/** Affichage par TOURS (A1, B1, puis A2, B2), séries inégales et dropsets compris. */
export function buildWorkoutRounds<T extends { exercise_id: string; ordinal: number; set_kind: string }>(
  block: WorkoutBlock, sets: T[],
): WorkoutRound<T>[] {
  const byExercise = block.exerciseIds.map(id => sets.filter(s=>s.exercise_id===id).sort((a,b)=>a.ordinal-b.ordinal));
  const rounds: WorkoutRound<T>[] = [];
  const max = Math.max(0, ...byExercise.map(items=>items.length));
  for (let index=0; index<max; index++) {
    const rows: SetInRound<T>[] = [];
    byExercise.forEach((items, exerciseIndex) => {
      if (items[index]) rows.push({ exerciseId: block.exerciseIds[exerciseIndex], exerciseIndex, set: items[index] });
    });
    if (rows.length) rounds.push({ number:index+1, rows });
  }
  return rounds;
}

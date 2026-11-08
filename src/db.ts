import type { SQLiteDatabase } from 'expo-sqlite';
import type { SuggestedExercise } from './planner';

export type Folder = { id: string; name: string; created_at: number };
export type Template = { id: string; title: string; category: string; created_at: number; folder_id: string | null };
export type TemplateExercise = { template_id: string; exercise_id: string; position: number; planned_sets: number; planned_reps: number; planned_reps_min: number | null; planned_reps_max: number | null; rest_seconds: number; to_failure: number; failure_rep_guide: number; superset_group: number; dropset: number; notes: string; planned_duration_seconds?: number | null };
export type Session = { id: string; template_id: string; template_title: string; started_at: number; finished_at: number | null; folder_id: string | null };
export type LoggedSet = { id: string; session_id: string; exercise_id: string; ordinal: number; weight: number; reps: number; rpe: number | null; completed: number; set_kind: string; input?: SetInput; duration_seconds?: number | null };
export type SessionExercise = { session_id: string; exercise_id: string; position: number; superset_group: number; rest_seconds: number; notes: string; planned_duration_seconds?: number | null };
export type HistorySet = LoggedSet & { started_at: number; finished_at: number; template_title: string };
export type ExerciseMax = { exercise_id: string; weight: number; updated_at: number; reserve_reps?: number };
export type CustomExercise = { id: string; name: string; muscle: string; equipment: string; pattern: string; icon: string; description: string };
export const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

async function ensureColumn(db: SQLiteDatabase, table: string, col: string, spec: string) {
  const columns = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  if (!columns.some((c) => c.name === col)) await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${col} ${spec}`);
}

export async function initDatabase(db: SQLiteDatabase) {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS templates (id TEXT PRIMARY KEY NOT NULL, title TEXT NOT NULL, category TEXT NOT NULL, created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS template_exercises (template_id TEXT NOT NULL, exercise_id TEXT NOT NULL, position INTEGER NOT NULL, PRIMARY KEY (template_id, exercise_id));
    CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY NOT NULL, template_id TEXT NOT NULL, template_title TEXT NOT NULL, started_at INTEGER NOT NULL, finished_at INTEGER);
    CREATE TABLE IF NOT EXISTS session_exercises (session_id TEXT NOT NULL, exercise_id TEXT NOT NULL, position INTEGER NOT NULL, PRIMARY KEY(session_id, exercise_id));
    CREATE TABLE IF NOT EXISTS logged_sets (id TEXT PRIMARY KEY NOT NULL, session_id TEXT NOT NULL, exercise_id TEXT NOT NULL, ordinal INTEGER NOT NULL, weight REAL NOT NULL DEFAULT 0, reps INTEGER NOT NULL DEFAULT 8, rpe REAL, completed INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS nutrition_documents (key TEXT PRIMARY KEY NOT NULL,payload TEXT,server_revision INTEGER NOT NULL DEFAULT 0,local_version INTEGER NOT NULL DEFAULT 1,dirty INTEGER NOT NULL DEFAULT 1,conflict TEXT,conflict_revision INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS nutrition_meta (key TEXT PRIMARY KEY NOT NULL,value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS folders (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS exercise_maxes (exercise_id TEXT PRIMARY KEY NOT NULL, weight REAL NOT NULL, updated_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS custom_exercises (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, muscle TEXT NOT NULL, equipment TEXT NOT NULL, pattern TEXT NOT NULL, icon TEXT NOT NULL, description TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS idx_sets_session ON logged_sets(session_id);
    CREATE INDEX IF NOT EXISTS idx_sets_exercise ON logged_sets(exercise_id);
  `);
  await ensureColumn(db, 'templates', 'folder_id', 'TEXT');
  await ensureColumn(db, 'template_exercises', 'planned_sets', 'INTEGER NOT NULL DEFAULT 3');
  await ensureColumn(db, 'template_exercises', 'planned_reps', 'INTEGER NOT NULL DEFAULT 8');
  await ensureColumn(db, 'template_exercises', 'planned_reps_min', 'INTEGER');
  await ensureColumn(db, 'template_exercises', 'planned_reps_max', 'INTEGER');
  await ensureColumn(db, 'template_exercises', 'planned_duration_seconds', 'INTEGER');
  await ensureColumn(db, 'session_exercises', 'planned_duration_seconds', 'INTEGER');
  await ensureColumn(db, 'logged_sets', 'duration_seconds', 'INTEGER');
  await ensureColumn(db, 'exercise_maxes', 'reserve_reps', 'INTEGER NOT NULL DEFAULT 2');
  if (!await db.getFirstAsync("SELECT value FROM settings WHERE key = 'migration_rep_bounds'")) {
    await db.execAsync('UPDATE template_exercises SET planned_reps_min = CASE WHEN planned_reps > 0 THEN planned_reps ELSE NULL END');
    await db.runAsync("INSERT INTO settings (key,value) VALUES ('migration_rep_bounds','1')");
  }
  await ensureColumn(db, 'template_exercises', 'rest_seconds', 'INTEGER NOT NULL DEFAULT 120');
  await ensureColumn(db, 'template_exercises', 'to_failure', 'INTEGER NOT NULL DEFAULT 0');
  await ensureColumn(db, 'template_exercises', 'failure_rep_guide', 'INTEGER NOT NULL DEFAULT 10');
  await ensureColumn(db, 'template_exercises', 'superset_group', 'INTEGER NOT NULL DEFAULT 0');
  await ensureColumn(db, 'template_exercises', 'dropset', 'INTEGER NOT NULL DEFAULT 0');
  await ensureColumn(db, 'template_exercises', 'notes', "TEXT NOT NULL DEFAULT ''");
  await ensureColumn(db, 'sessions', 'folder_id', 'TEXT');
  await ensureColumn(db, 'logged_sets', 'set_kind', "TEXT NOT NULL DEFAULT 'normal'");
  await ensureColumn(db, 'session_exercises', 'superset_group', 'INTEGER NOT NULL DEFAULT 0');
  await ensureColumn(db, 'session_exercises', 'rest_seconds', 'INTEGER NOT NULL DEFAULT 120');
  await ensureColumn(db, 'session_exercises', 'notes', "TEXT NOT NULL DEFAULT ''");
  // Rattachement des anciennes séances au dossier connu lors de la migration.
  // Les nouvelles séances mémorisent le dossier au démarrage.
  const migrated07 = await db.getFirstAsync<{ value: string }>("SELECT value FROM settings WHERE key = 'migration_v07'");
  if (!migrated07) {
    await db.execAsync(`UPDATE sessions SET folder_id = (
      SELECT t.folder_id FROM templates t WHERE t.id = sessions.template_id
    ) WHERE folder_id IS NULL;
    UPDATE session_exercises SET notes = COALESCE((
      SELECT te.notes FROM sessions s JOIN template_exercises te
      ON te.template_id=s.template_id AND te.exercise_id=session_exercises.exercise_id
      WHERE s.id=session_exercises.session_id), '') WHERE notes = '';`);
    await db.runAsync("INSERT OR REPLACE INTO settings (key,value) VALUES ('migration_v07','1')");
  }
  // Migration V0.6 : conserver les groupes de la séance en cours, même si
  // le programme est modifié après son lancement. Exécutée UNE SEULE fois.
  const grouped = await db.getFirstAsync<{ value: string }>("SELECT value FROM settings WHERE key = 'migration_v06'");
  if (!grouped) {
    await db.execAsync(`UPDATE session_exercises SET
      superset_group = COALESCE((SELECT te.superset_group FROM sessions s JOIN template_exercises te
        ON te.template_id = s.template_id AND te.exercise_id = session_exercises.exercise_id
        WHERE s.id = session_exercises.session_id), 0),
      rest_seconds = COALESCE((SELECT te.rest_seconds FROM sessions s JOIN template_exercises te
        ON te.template_id = s.template_id AND te.exercise_id = session_exercises.exercise_id
        WHERE s.id = session_exercises.session_id), 120)
      WHERE session_id IN (SELECT id FROM sessions WHERE finished_at IS NULL)`);
    await db.runAsync("INSERT OR REPLACE INTO settings (key,value) VALUES ('migration_v06','1')");
  }
  // Migration effectuée une fois. Les anciennes séances de démo sont retirées,
  // mais AUCUN historique de séance n'est supprimé.
  const migrated = await db.getFirstAsync<{ value: string }>("SELECT value FROM settings WHERE key = 'migration_v04'");
  if (!migrated) {
    const oldIds = ['push', 'pull', 'legs', 'upper', 'lower'];
    for (const id of oldIds) {
      const row = await db.getFirstAsync<{ category: string }>('SELECT category FROM templates WHERE id = ?', id);
      if (row && row.category !== 'Perso') {
        await db.runAsync('DELETE FROM template_exercises WHERE template_id = ?', id);
        await db.runAsync('DELETE FROM templates WHERE id = ?', id);
      }
    }
    const custom = await db.getAllAsync<Template>('SELECT * FROM templates WHERE folder_id IS NULL');
    if (custom.length) {
      const id = newId();
      await db.runAsync('INSERT INTO folders (id, name, created_at) VALUES (?, ?, ?)', id, 'Mes anciennes séances', Date.now());
      await db.runAsync('UPDATE templates SET folder_id = ? WHERE folder_id IS NULL', id);
    }
    // Dans la version précédente, le repos automatique était activé par défaut.
    // Cette nouvelle préférence est désactivée à la migration, une fois seulement.
    await db.runAsync("INSERT OR REPLACE INTO settings (key,value) VALUES ('auto_rest','0')");
    await db.runAsync("INSERT OR REPLACE INTO settings (key,value) VALUES ('migration_v04','1')");
  }
}

export async function fetchOverview(db: SQLiteDatabase) {
  const [folders, templates, templateExercises, history, historySets, active] = await Promise.all([
    db.getAllAsync<Folder>('SELECT * FROM folders ORDER BY created_at, name'),
    db.getAllAsync<Template>('SELECT * FROM templates ORDER BY created_at, title'),
    db.getAllAsync<TemplateExercise>('SELECT * FROM template_exercises ORDER BY position'),
    db.getAllAsync<Session>('SELECT * FROM sessions WHERE finished_at IS NOT NULL ORDER BY finished_at DESC'),
    db.getAllAsync<HistorySet>(`SELECT ls.*, s.started_at, s.finished_at, s.template_title FROM logged_sets ls JOIN sessions s ON s.id = ls.session_id WHERE ls.completed = 1 AND s.finished_at IS NOT NULL ORDER BY s.finished_at DESC, ls.ordinal`),
    db.getFirstAsync<Session>('SELECT * FROM sessions WHERE finished_at IS NULL ORDER BY started_at DESC LIMIT 1'),
  ]);
  const activeSets = active ? await withSetInputs(db, await db.getAllAsync<LoggedSet>('SELECT * FROM logged_sets WHERE session_id = ? ORDER BY exercise_id, ordinal', active.id)) : [];
  const activeExerciseRows = active ? await db.getAllAsync<SessionExercise>('SELECT * FROM session_exercises WHERE session_id = ? ORDER BY position', active.id) : [];
  const activeExerciseIds = activeExerciseRows.length ? activeExerciseRows.map((r) => r.exercise_id) : active
    ? templateExercises.filter((r) => r.template_id === active.template_id).map((r) => r.exercise_id) : [];
  const activeSessionExercises: SessionExercise[] = activeExerciseRows.length ? activeExerciseRows :
    (active ? templateExercises.filter(r=>r.template_id===active.template_id).map(r=>({
      session_id:active.id, exercise_id:r.exercise_id, position:r.position,
      superset_group:r.superset_group, rest_seconds:r.rest_seconds, notes:r.notes ?? '',
    })) : []);
  const [exerciseMaxes, customExercises] = await Promise.all([
    db.getAllAsync<ExerciseMax>('SELECT * FROM exercise_maxes'),
    db.getAllAsync<CustomExercise>('SELECT * FROM custom_exercises ORDER BY name'),
  ]);
  return { folders, templates, templateExercises, history, historySets, active, activeSets, activeExerciseIds, activeSessionExercises, exerciseMaxes, customExercises };
}

export async function createFolder(db: SQLiteDatabase, name: string) {
  const id = newId();
  await db.runAsync('INSERT INTO folders VALUES (?, ?, ?)', id, name, Date.now());
  return id;
}
export async function renameFolder(db: SQLiteDatabase, id: string, name: string) {
  await db.runAsync('UPDATE folders SET name = ? WHERE id = ?', name, id);
}
export async function deleteEmptyFolder(db: SQLiteDatabase, id: string) {
  const count = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM templates WHERE folder_id = ?', id);
  if (count?.n) throw new Error('Déplace ou supprime les séances de ce dossier avant de le supprimer.');
  await db.runAsync('DELETE FROM folders WHERE id = ?', id);
}
export async function createTemplate(db: SQLiteDatabase, title: string, folderId: string) {
  const id = newId();
  await db.runAsync('INSERT INTO templates (id,title,category,created_at,folder_id) VALUES (?,?,?,?,?)', id, title, 'Perso', Date.now(), folderId);
  return id;
}
// L'assistant n'ecrase jamais une seance : il cree un brouillon dans un dossier choisi.
export async function createSuggestedTemplate(db: SQLiteDatabase, title: string, folderId: string, plans: SuggestedExercise[]) {
  const safeTitle=title.trim().slice(0,80);
  if (!safeTitle || !folderId || !plans.length || plans.length>15) throw new Error('Proposition invalide.');
  const folder=await db.getFirstAsync<{ id:string }>('SELECT id FROM folders WHERE id = ?',folderId);
  if (!folder) throw new Error('Dossier introuvable.');
  const id=newId();
  await db.withExclusiveTransactionAsync(async(txn)=>{
    await txn.runAsync('INSERT INTO templates (id,title,category,created_at,folder_id) VALUES (?,?,?,?,?)',id,safeTitle,'Perso',Date.now(),folderId);
    for(const [position,p] of plans.entries()) {
      if (!p.exercise_id || !Number.isInteger(p.sets) || p.sets<1 || p.sets>8 || !Number.isInteger(p.reps) || p.reps<1 || p.reps>60 || !Number.isInteger(p.rest_seconds) || p.rest_seconds<0 || p.rest_seconds>600) throw new Error('Objectifs de séance invalides.');
      await txn.runAsync(`INSERT INTO template_exercises
        (template_id,exercise_id,position,planned_sets,planned_reps,planned_reps_min,rest_seconds,to_failure,failure_rep_guide,superset_group,dropset,notes)
        VALUES (?,?,?,?,?,?,?,0,10,0,0,'')`,id,p.exercise_id,position,p.sets,p.reps,p.reps,p.rest_seconds);
    }
  });
  return id;
}

export async function duplicateTemplate(db: SQLiteDatabase, original: Template) {
  const id = await createTemplate(db, `${original.title} (copie)`, original.folder_id || '');
  const plans = await db.getAllAsync<TemplateExercise>('SELECT * FROM template_exercises WHERE template_id = ? ORDER BY position', original.id);
  for (const p of plans) await db.runAsync(`INSERT INTO template_exercises
  (template_id,exercise_id,position,planned_sets,planned_reps,planned_reps_min,planned_reps_max,rest_seconds,to_failure,failure_rep_guide,superset_group,dropset,notes,planned_duration_seconds)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, id,p.exercise_id,p.position,p.planned_sets,p.planned_reps,p.planned_reps_min,p.planned_reps_max,p.rest_seconds,p.to_failure,p.failure_rep_guide,p.superset_group,p.dropset,p.notes ?? '',p.planned_duration_seconds ?? null);
  return id;
}
export async function reorderExercise(db: SQLiteDatabase, templateId: string, exerciseId: string, direction: -1 | 1) {
  const rows = await db.getAllAsync<TemplateExercise>('SELECT * FROM template_exercises WHERE template_id = ? ORDER BY position', templateId);
  const from = rows.findIndex(r => r.exercise_id === exerciseId);
  const dest = from + direction;
  if (from < 0 || dest < 0 || dest >= rows.length) return;
  [rows[from], rows[dest]] = [rows[dest], rows[from]];
  for (const [index, row] of rows.entries()) await db.runAsync('UPDATE template_exercises SET position = ? WHERE template_id = ? AND exercise_id = ?', index, templateId, row.exercise_id);
}
export function suggestedLoad(max: number, reps: number, reserve = 2): number {
  if (!Number.isFinite(max) || max <= 0 || !Number.isFinite(reps) || reps < 1 || !Number.isInteger(reserve) || reserve < 0 || reserve > 10) return 0;
  return Math.round((max / (1 + (reps + reserve) / 30)) / 2.5) * 2.5;
}
export async function saveExerciseMax(db: SQLiteDatabase, exerciseId: string, weight: number, reserve = 2, reviewedToday = false) {
  if (!Number.isFinite(weight) || weight < 0 || weight > 1000 || !Number.isInteger(reserve) || reserve < 0 || reserve > 10) throw new Error('1RM : 0 à 1 000 kg ; réserve : 0 à 10 répétitions.');
  await db.runAsync(`INSERT INTO exercise_maxes (exercise_id,weight,updated_at,reserve_reps) VALUES (?,?,?,?)
    ON CONFLICT(exercise_id) DO UPDATE SET weight=excluded.weight, reserve_reps=excluded.reserve_reps,
    updated_at=CASE WHEN exercise_maxes.weight=excluded.weight AND ?=0 THEN exercise_maxes.updated_at ELSE excluded.updated_at END`, exerciseId, weight, Date.now(), reserve, reviewedToday ? 1 : 0);
}
export async function createCustomExercise(db: SQLiteDatabase, name: string, muscle: string, equipment: string, description: string) {
  const id = newId();
  await db.runAsync('INSERT INTO custom_exercises VALUES (?,?,?,?,?,?,?)', id, name, muscle, equipment, 'press', 'fitness', description);
  return id;
}
export async function renameTemplate(db: SQLiteDatabase, id: string, title: string) {
  await db.runAsync('UPDATE templates SET title = ? WHERE id = ?', title, id);
}
export async function deleteTemplate(db: SQLiteDatabase, id: string) {
  await db.runAsync('DELETE FROM template_exercises WHERE template_id = ?', id);
  await db.runAsync('DELETE FROM templates WHERE id = ?', id);
  // L'historique des séances précédentes est conservé.
}
export async function moveTemplate(db: SQLiteDatabase, id: string, folderId: string) {
  await db.runAsync('UPDATE templates SET folder_id = ? WHERE id = ?', folderId, id);
}
export async function addExercise(db: SQLiteDatabase, templateId: string, exerciseId: string) {
  const row = await db.getFirstAsync<{ n: number }>('SELECT COALESCE(MAX(position), -1) + 1 AS n FROM template_exercises WHERE template_id = ?', templateId);
  await db.runAsync('INSERT OR IGNORE INTO template_exercises (template_id,exercise_id,position,planned_sets,planned_reps,planned_reps_min,rest_seconds) VALUES (?,?,?,?,?,?,?)', templateId, exerciseId, row?.n ?? 0, 3, 8, 8, 120);
}
export async function changeExercisePlan(db: SQLiteDatabase, templateId: string, exerciseId: string,
  sets: number, reps: number, rest: number, failure: boolean, repGuide: number, supersetGroup: number, dropset: boolean, notes: string, repsMax: number | null = null, repsMin: number | null = reps, duration: number | null = null) {
  if (duration !== null && (!Number.isInteger(duration) || duration < 1 || duration > 86400)) throw new Error('Durée : 1 seconde à 24 heures.');
  if (duration !== null) { repsMin = null; repsMax = null; failure = false; }
  for (const value of [repsMin, repsMax]) if (value !== null && (!Number.isInteger(value) || value < 1 || value > 200)) throw new Error('Répétitions : 1 à 200 ou champ vide.');
  if (repsMin !== null && repsMax !== null && repsMin > repsMax) throw new Error('Le minimum doit être inférieur ou égal au maximum.');
  await db.runAsync(`UPDATE template_exercises SET planned_sets = ?, planned_reps = ?, rest_seconds = ?,
  to_failure = ?, failure_rep_guide = ?, superset_group = ?, dropset = ?, notes = ?, planned_reps_min = ?, planned_reps_max = ?, planned_duration_seconds = ? WHERE template_id = ? AND exercise_id = ?`,
    sets,repsMin ?? repsMax ?? 0,rest,failure?1:0,repGuide,supersetGroup,dropset?1:0,notes,repsMin,repsMax,duration,templateId,exerciseId);
}
export async function removeExercise(db: SQLiteDatabase, templateId: string, exerciseId: string) {
  await db.runAsync('DELETE FROM template_exercises WHERE template_id = ? AND exercise_id = ?', templateId, exerciseId);
}
export async function startSession(db: SQLiteDatabase, template: Template, plans: TemplateExercise[], maxes: ExerciseMax[]) {
  const id = newId(); const startedAt = Date.now();
  await db.runAsync('INSERT INTO sessions (id,template_id,template_title,started_at,finished_at,folder_id) VALUES (?,?,?,?,NULL,?)', id, template.id, template.title, startedAt, template.folder_id);
  for (const [index, plan] of plans.entries()) {
    const timed = plan.planned_duration_seconds != null;
    await db.runAsync('INSERT INTO session_exercises (session_id,exercise_id,position,superset_group,rest_seconds,notes,planned_duration_seconds) VALUES (?,?,?,?,?,?,?)',
      id, plan.exercise_id, index, plan.superset_group ?? 0, plan.rest_seconds ?? 120, plan.notes ?? '', plan.planned_duration_seconds ?? null);
    const previous = await db.getFirstAsync<{ weight: number; reps: number }>(`SELECT ls.weight, ls.reps FROM logged_sets ls JOIN sessions s ON s.id = ls.session_id WHERE ls.exercise_id = ? AND ls.completed = 1 AND s.finished_at IS NOT NULL AND (ls.duration_seconds IS NOT NULL) = ? ORDER BY s.finished_at DESC, ls.ordinal DESC LIMIT 1`, plan.exercise_id, timed ? 1 : 0);
    const reference = maxes.find(m => m.exercise_id === plan.exercise_id);
    const target = plan.to_failure ? plan.failure_rep_guide : repTarget(plan, true);
    const estimate = timed ? 0 : suggestedLoad(reference?.weight ?? 0, target, plan.to_failure ? 0 : reference?.reserve_reps ?? 2);
    for (let ordinal = 1; ordinal <= plan.planned_sets; ordinal++) {
      await db.runAsync(`INSERT INTO logged_sets (id,session_id,exercise_id,ordinal,weight,reps,rpe,completed,set_kind,duration_seconds)
        VALUES (?,?,?,?,?,?,NULL,0,'normal',?)`, newId(),id,plan.exercise_id,ordinal,estimate || previous?.weight || 0,timed || plan.to_failure ? 0 : repTarget(plan),timed ? 0 : null);
    }
    if (plan.dropset) await db.runAsync(`INSERT INTO logged_sets
      (id,session_id,exercise_id,ordinal,weight,reps,rpe,completed,set_kind,duration_seconds) VALUES (?,?,?,?,?,?,NULL,0,'drop',?)`,
      newId(),id,plan.exercise_id,plan.planned_sets+1,Math.round((estimate || previous?.weight || 0)*0.8/2.5)*2.5,0,timed ? 0 : null);
  }
  const rawSets = await db.getAllAsync<LoggedSet>('SELECT * FROM logged_sets WHERE session_id = ? ORDER BY exercise_id, ordinal', id);
  for (const set of rawSets) await saveSetInput(db, set.id, { weight: '', reps: '', ...(set.duration_seconds != null ? { duration: '' } : {}) });
  const sets = await withSetInputs(db, rawSets);
  const sessionExercises: SessionExercise[] = plans.map((plan,index) => ({ session_id:id, exercise_id:plan.exercise_id,
    position:index, superset_group:plan.superset_group ?? 0, rest_seconds:plan.rest_seconds ?? 120, notes:plan.notes ?? '', planned_duration_seconds:plan.planned_duration_seconds ?? null }));
  return { session: { id, template_id: template.id, template_title: template.title, started_at: startedAt, finished_at: null, folder_id: template.folder_id } as Session,
    sets, sessionExercises };
}
// Le remplacement et la création réussissent ensemble, ou la séance précédente reste intacte.
export async function startSelectedSession(
  db: SQLiteDatabase, template: Template, plans: TemplateExercise[], maxes: ExerciseMax[],
  previous?: { id: string; allowDiscard: boolean },
) {
  const outcome: { result?: Awaited<ReturnType<typeof startSession>> } = {};
  await db.withExclusiveTransactionAsync(async (txn) => {
    const current = await txn.getFirstAsync<Session>('SELECT * FROM sessions WHERE finished_at IS NULL ORDER BY started_at DESC LIMIT 1');
    if (current?.template_id === template.id) {
      outcome.result = {
        session: current,
        sets: await withSetInputs(txn, await txn.getAllAsync<LoggedSet>('SELECT * FROM logged_sets WHERE session_id = ? ORDER BY exercise_id, ordinal', current.id)),
        sessionExercises: await txn.getAllAsync<SessionExercise>('SELECT * FROM session_exercises WHERE session_id = ? ORDER BY position', current.id),
      };
      return;
    }
    if ((current?.id ?? null) !== (previous?.id ?? null)) {
      throw new Error('La séance en cours a changé. Reviens à la séance choisie puis réessaie.');
    }
    if (!plans.length) throw new Error('Ajoute au moins un exercice avant de commencer.');
    if (current) {
      const completed = await txn.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM logged_sets WHERE session_id = ? AND completed = 1', current.id);
      if (completed && completed.n > 0) await finishSession(txn, current.id);
      else {
        if (!previous?.allowDiscard) throw new Error('Le remplacement des saisies non validées doit être confirmé.');
        await discardSession(txn, current.id);
      }
    }
    outcome.result = await startSession(txn, template, plans, maxes);
  });
  if (!outcome.result) throw new Error('Impossible de démarrer la séance.');
  return outcome.result;
}

export async function updateLoggedSet(db: SQLiteDatabase, set: LoggedSet) {
  await db.runAsync('UPDATE logged_sets SET weight = ?, reps = ?, rpe = ?, completed = ?, duration_seconds = ? WHERE id = ?', set.weight, set.reps, set.rpe, set.completed, set.duration_seconds ?? null, set.id);
}
export async function createLoggedSet(db: SQLiteDatabase, sessionId: string, exerciseId: string, latest?: LoggedSet) {
  const row = await db.getFirstAsync<{ n: number }>('SELECT COALESCE(MAX(ordinal), 0) + 1 AS n FROM logged_sets WHERE session_id = ? AND exercise_id = ?', sessionId, exerciseId);
  const plan = await db.getFirstAsync<SessionExercise>('SELECT * FROM session_exercises WHERE session_id=? AND exercise_id=?', sessionId, exerciseId);
  const timed = latest ? latest.duration_seconds != null : plan?.planned_duration_seconds != null;
  const set: LoggedSet = { id: newId(), session_id: sessionId, exercise_id: exerciseId, ordinal: row?.n ?? 1, weight: latest?.weight ?? 0, reps: timed ? 0 : latest?.reps ?? 8, rpe: null, completed: 0, set_kind: 'normal', duration_seconds:timed ? 0 : null };
  await db.runAsync('INSERT INTO logged_sets (id,session_id,exercise_id,ordinal,weight,reps,rpe,completed,set_kind,duration_seconds) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', set.id, set.session_id, set.exercise_id, set.ordinal, set.weight, set.reps, set.rpe, set.completed, set.set_kind,set.duration_seconds!);
  set.input = { weight: '', reps: '', ...(timed ? { duration: '' } : {}) };
  await saveSetInput(db, set.id, set.input);
  return set;
}
export async function deleteLoggedSet(db: SQLiteDatabase, id: string) {
  await db.runAsync('DELETE FROM settings WHERE key = ?', `set_input:${id}`);
  await db.runAsync('DELETE FROM logged_sets WHERE id = ?', id);
}
export async function finishSession(db: SQLiteDatabase, id: string) {
  await clearSessionInputs(db, id);
  await db.runAsync('UPDATE sessions SET finished_at = ? WHERE id = ?', Date.now(), id);
}
export async function discardSession(db: SQLiteDatabase, id: string) {
  await clearSessionInputs(db, id);
  await db.runAsync('DELETE FROM logged_sets WHERE session_id = ?', id);
  await db.runAsync('DELETE FROM session_exercises WHERE session_id = ?', id);
  await db.runAsync('DELETE FROM sessions WHERE id = ?', id);
}
export async function getSettings(db: SQLiteDatabase) {
  const rows = await db.getAllAsync<{ key: string; value: string }>("SELECT key,value FROM settings WHERE key NOT LIKE 'set_input:%'");
  const obj: Record<string, string> = { username: 'Sportif', age:'', weight: '', height: '', goal: 'hypertrophy', experience:'intermediate', rest_duration: '120', auto_rest: '0', theme: 'dark' };
  rows.forEach((r) => { obj[r.key] = r.value; }); return obj;
}
export async function saveSettings(db: SQLiteDatabase, settings: Record<string, string>) {
  for (const [key, value] of Object.entries(settings)) await db.runAsync('INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)', key, value);
}
export async function exportAllData(db: SQLiteDatabase) {
  const [folders, templates, template_exercises, sessions, session_exercises, logged_sets, settings, exercise_maxes, custom_exercises] = await Promise.all([
    db.getAllAsync<Folder>('SELECT * FROM folders'), db.getAllAsync<Template>('SELECT * FROM templates'),
    db.getAllAsync<TemplateExercise>('SELECT * FROM template_exercises'), db.getAllAsync<Session>('SELECT * FROM sessions'),
    db.getAllAsync<SessionExercise>('SELECT * FROM session_exercises'), db.getAllAsync<LoggedSet>('SELECT * FROM logged_sets'),
    db.getAllAsync<{ key: string; value: string }>('SELECT * FROM settings'),
    db.getAllAsync<ExerciseMax>('SELECT * FROM exercise_maxes'), db.getAllAsync<CustomExercise>('SELECT * FROM custom_exercises'),
  ]);
  return { format: 'training-programme-backup', schema: 10, exported_at: new Date().toISOString(), folders, templates, template_exercises, sessions, session_exercises, logged_sets, settings, exercise_maxes, custom_exercises };
}

// Réinitialise uniquement les statistiques : programmes, dossiers, notes,
// exercices personnels, 1RM et préférences restent intacts.
// L'action n'est autorisée qu'en l'absence d'entraînement en cours.
export async function resetStatistics(db: SQLiteDatabase) {
  const active = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM sessions WHERE finished_at IS NULL');
  if ((active?.n ?? 0) > 0) throw new Error('Termine ou annule ta séance en cours avant de réinitialiser les statistiques.');
  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync('DELETE FROM logged_sets');
    await txn.runAsync('DELETE FROM session_exercises');
    await txn.runAsync('DELETE FROM sessions');
  });
}

// Les propriétés absentes désignent un ancien programme ; null signifie une borne laissée vide.
export function repTarget(plan: { planned_reps: number; planned_reps_min?: number | null; planned_reps_max?: number | null } | undefined, preferMax = false): number {
  if (!plan) return 0;
  if (plan.planned_reps_min === undefined) return plan.planned_reps;
  return preferMax ? plan.planned_reps_max ?? plan.planned_reps_min ?? 0 : plan.planned_reps_min ?? plan.planned_reps_max ?? 0;
}
export function repRangeLabel(plan: { planned_reps: number; planned_reps_min?: number | null; planned_reps_max?: number | null }): string {
  const min = plan.planned_reps_min === undefined ? plan.planned_reps : plan.planned_reps_min;
  const max = plan.planned_reps_max ?? null;
  return min !== null && max !== null ? min + '–' + max : String(min ?? max ?? '');
}
export function exercisePlanLabel(plan: TemplateExercise): string {
  if (plan.planned_duration_seconds != null) return `${plan.planned_sets} séries × ${Math.floor(plan.planned_duration_seconds / 60)} min ${plan.planned_duration_seconds % 60} s`;
  const reps = plan.to_failure ? 'Échec technique' : repRangeLabel(plan);
  return plan.planned_sets + ' séries' + (reps ? ' × ' + reps + (plan.to_failure ? '' : ' rép.') : '');
}

export type SetInput = { weight: string; reps: string; duration?: string };
const keyFor = (id: string) => `set_input:${id}`;

export async function readSetInput(db: SQLiteDatabase, set: LoggedSet): Promise<SetInput> {
  const stored = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', keyFor(set.id));
  if (stored) {
    try {
      const input = JSON.parse(stored.value);
      if (typeof input.weight === 'string' && typeof input.reps === 'string') return set.duration_seconds != null ? { ...input, duration:typeof input.duration === 'string' ? input.duration : String(set.duration_seconds) } : input;
    } catch { /* Une ancienne saisie numérique reste récupérable. */ }
  }
  // Conserver les saisies des séances commencées avant cette fonctionnalité.
  return { weight: String(set.weight).replace('.', ','), reps: String(set.reps), ...(set.duration_seconds != null ? { duration:String(set.duration_seconds) } : {}) };
}
export async function saveSetInput(db: SQLiteDatabase, id: string, input: SetInput) {
  await db.runAsync('INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)', keyFor(id), JSON.stringify(input));
}
export async function withSetInputs(db: SQLiteDatabase, sets: LoggedSet[]): Promise<LoggedSet[]> {
  return Promise.all(sets.map(async set => ({ ...set, input: await readSetInput(db, set) })));
}
export async function clearSessionInputs(db: SQLiteDatabase, sessionId: string) {
  await db.runAsync("DELETE FROM settings WHERE key IN (SELECT 'set_input:' || id FROM logged_sets WHERE session_id = ?)", sessionId);
}


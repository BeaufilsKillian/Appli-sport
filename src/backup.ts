// Format partagé par l'import local et l'API : aucune instruction SQL ne vient du fichier.
export const BACKUP_TABLES = {
  folders: { id: 's', name: 's', created_at: 'n' },
  templates: { id: 's', title: 's', category: 's', created_at: 'n', folder_id: 's?' },
  template_exercises: { template_id: 's', exercise_id: 's', position: 'n', planned_sets: 'n', planned_reps: 'n', planned_reps_min: 'n?', planned_reps_max: 'n?', rest_seconds: 'n', to_failure: 'n', failure_rep_guide: 'n', superset_group: 'n', dropset: 'n', notes: 's', planned_duration_seconds: 'n?' },
  sessions: { id: 's', template_id: 's', template_title: 's', started_at: 'n', finished_at: 'n?', folder_id: 's?' },
  session_exercises: { session_id: 's', exercise_id: 's', position: 'n', superset_group: 'n', rest_seconds: 'n', notes: 's', planned_duration_seconds: 'n?', progression_key: 's?', suggested_load: 'n?', progression_reason: 's?' },
  logged_sets: { id: 's', session_id: 's', exercise_id: 's', ordinal: 'n', weight: 'n', reps: 'n', rpe: 'n?', completed: 'n', set_kind: 's', duration_seconds: 'n?' },
  settings: { key: 's', value: 's' },
  exercise_maxes: { exercise_id: 's', weight: 'n', updated_at: 'n', reserve_reps: 'n', load_step: 'n' },
  custom_exercises: { id: 's', name: 's', muscle: 's', equipment: 's', pattern: 's', icon: 's', description: 's' },
} as const;
export type BackupTable = keyof typeof BACKUP_TABLES;
export type Backup = { format: 'training-programme-backup'; schema: 11; exported_at: string } & Record<BackupTable, Record<string, string | number | null>[]>;
export const MAX_BACKUP_BYTES = 2_000_000;
export function parseBackup(input: unknown): Backup {
  if (!input || typeof input !== 'object') throw new Error('Fichier de sauvegarde invalide.');
  const value = input as Record<string, unknown>;
  if (value.format !== 'training-programme-backup' || ![8,9,10,11].includes(value.schema as number)) throw new Error('Format de sauvegarde non pris en charge.');
  if (new TextEncoder().encode(JSON.stringify(input)).length > MAX_BACKUP_BYTES) throw new Error('Sauvegarde trop volumineuse (2 Mo maximum).');
  const output: Record<string, unknown> = { format: value.format, schema: 11, exported_at: String(value.exported_at ?? new Date().toISOString()) };
  for (const [table, columns] of Object.entries(BACKUP_TABLES)) {
    if (!Array.isArray(value[table])) throw new Error(`Données manquantes : ${table}.`);
    const rows = value[table] as unknown[];
    if (rows.length > 50_000) throw new Error('Trop de lignes dans la sauvegarde.');
    const ids = new Set<string>();
    output[table] = rows.map(row => {
      if (!row || typeof row !== 'object') throw new Error(`Ligne invalide : ${table}.`);
      const record = row as Record<string, unknown>;
      const clean: Record<string, unknown> = {};
      for (const [key, type] of Object.entries(columns)) {
        let v = value.schema === 8 && table === 'template_exercises' && (key === 'planned_reps_min' || key === 'planned_reps_max') ? key === 'planned_reps_min' && Number(record.planned_reps) > 0 ? record.planned_reps : null : record[key];
        if (Number(value.schema) < 10) {
          if (((table === 'template_exercises' || table === 'session_exercises') && key === 'planned_duration_seconds') || (table === 'logged_sets' && key === 'duration_seconds')) v = null;
          if (table === 'exercise_maxes' && key === 'reserve_reps') v = 2;
        }
        if(Number(value.schema)<11){
          if(table==='session_exercises'&&['progression_key','suggested_load','progression_reason'].includes(key))v=null;
          if(table==='exercise_maxes'&&key==='load_step')v=2.5;
        }
        if (v === null && type.endsWith('?')) { clean[key] = null; continue; }
        if (type[0] === 's' ? typeof v !== 'string' || v.length > 10_000 : typeof v !== 'number' || !Number.isFinite(v) || Math.abs(v) > Number.MAX_SAFE_INTEGER) throw new Error(`Valeur invalide : ${table}.${key}.`);
        if ((key === 'id' || key.endsWith('_id') || key === 'key') && (typeof v !== 'string' || !v.length || v.length > 200)) throw new Error(`Identifiant invalide : ${table}.${key}.`);
        clean[key] = v;
      }
      const id = String(record.id ?? record.key ?? (table === 'template_exercises' ? `${record.template_id}:${record.exercise_id}` : table === 'session_exercises' ? `${record.session_id}:${record.exercise_id}` : record.exercise_id));
      if (ids.has(id)) throw new Error(`Doublon dans ${table}.`);
      ids.add(id);
      return clean;
    });
  }
  const data = output as Backup;
  const folders = new Set(data.folders.map(row => row.id));
  const templates = new Set(data.templates.map(row => row.id));
  const sessions = new Set(data.sessions.map(row => row.id));
  if (data.templates.some(row => row.folder_id !== null && !folders.has(row.folder_id))) throw new Error('Dossier manquant.');
  if (data.template_exercises.some(row => !templates.has(row.template_id))) throw new Error('Programme manquant.');
  if ([...data.session_exercises, ...data.logged_sets].some(row => !sessions.has(row.session_id))) throw new Error('Séance manquante.');
  if (data.sessions.filter(row => row.finished_at === null).length > 1) throw new Error('Plusieurs séances actives dans ce fichier.');
  if (data.logged_sets.some(row => ![0, 1].includes(Number(row.completed)) || Number(row.weight) < 0 || Number(row.reps) < 0 || (row.rpe !== null && (Number(row.rpe) < 0 || Number(row.rpe) > 10)))) throw new Error('Série invalide.');
  if (data.template_exercises.some(row => [row.planned_reps_min, row.planned_reps_max].some(v => v !== null && (!Number.isInteger(v) || Number(v) < 1 || Number(v) > 200)) || (row.planned_reps_min !== null && row.planned_reps_max !== null && Number(row.planned_reps_min) > Number(row.planned_reps_max)))) throw new Error('Plage de répétitions invalide.');
  if (!data.settings.some(row => row.key === 'migration_rep_bounds')) data.settings.push({ key: 'migration_rep_bounds', value: '1' });
  for (const rows of [data.template_exercises, data.session_exercises]) if (rows.some(row => row.planned_duration_seconds !== null && (!Number.isInteger(row.planned_duration_seconds) || Number(row.planned_duration_seconds) < 1 || Number(row.planned_duration_seconds) > 86400))) throw new Error('Durée prévue invalide.');
  if (data.logged_sets.some(row => row.duration_seconds !== null && (!Number.isInteger(row.duration_seconds) || Number(row.duration_seconds) < 0 || Number(row.duration_seconds) > 86400 || row.reps !== 0 || (row.completed === 1 && Number(row.duration_seconds) === 0)))) throw new Error('Durée réalisée invalide.');
  if (data.template_exercises.some(row => row.planned_duration_seconds !== null && (row.to_failure !== 0 || row.planned_reps !== 0 || row.planned_reps_min !== null || row.planned_reps_max !== null))) throw new Error('Objectif durée et répétitions incompatibles.');
  if (data.exercise_maxes.some(row => !Number.isInteger(row.reserve_reps) || Number(row.reserve_reps) < 0 || Number(row.reserve_reps) > 10)) throw new Error('Réserve invalide.');
  if(data.exercise_maxes.some(row=>Number(row.load_step)<.1||Number(row.load_step)>100||Math.abs(Number(row.load_step)*100-Math.round(Number(row.load_step)*100))>1e-8))throw new Error('Palier de charge invalide.');
  if(data.session_exercises.some(row=>row.suggested_load!==null&&(Number(row.suggested_load)<0||Number(row.suggested_load)>1000)))throw new Error('Charge suggérée invalide.');
  return data;
}

import type { SQLiteDatabase } from 'expo-sqlite';
import type { Backup } from './backup';

export type SharedFolder = { format: 'training-programme-folder'; version: 2; folders: Backup['folders']; templates: Backup['templates']; template_exercises: Backup['template_exercises']; custom_exercises: Backup['custom_exercises'] };

type Dependencies = {
  BACKUP_TABLES: typeof import('./backup').BACKUP_TABLES;
  parseBackup: typeof import('./backup').parseBackup;
  EXERCISES: { id: string }[];
  exportAllData: typeof import('./db').exportAllData;
  newId: () => string;
};
export function createFolderSharing({BACKUP_TABLES,parseBackup,EXERCISES,exportAllData,newId}:Dependencies) {
const builtin = new Set(EXERCISES.map(exercise => exercise.id));
const empty = () => ({ format: 'training-programme-backup', schema: 10, exported_at: new Date().toISOString(), ...Object.fromEntries(Object.keys(BACKUP_TABLES).map(table => [table, []])) });

function parseSharedFolder(input: unknown): SharedFolder {
  if (!input || typeof input !== 'object') throw new Error('Dossier partagé invalide.');
  const value = input as Record<string, unknown>;
  if (value.format !== 'training-programme-folder' || (value.version !== 1 && value.version !== 2) || JSON.stringify(value).length > 500_000) throw new Error('Dossier partagé invalide ou trop volumineux.');
  const clean = parseBackup({ ...empty(), schema:value.version === 1 ? 9 : 10, folders: value.folders, templates: value.templates, template_exercises: value.template_exercises, custom_exercises: value.custom_exercises });
  if (clean.folders.length !== 1 || clean.templates.length > 100 || clean.template_exercises.length > 1000 || clean.custom_exercises.length > 200 || clean.templates.some(row => row.folder_id !== clean.folders[0].id)) throw new Error('Contenu du dossier invalide.');
  const customIds = new Set(clean.custom_exercises.map(row => String(row.id)));
  if(clean.custom_exercises.some(row=>builtin.has(String(row.id)) || !['barbell','fitness','body','walk','flash'].includes(String(row.icon))))throw new Error('Exercice personnalisé invalide.');
  if (clean.template_exercises.some(row => !builtin.has(String(row.exercise_id)) && !customIds.has(String(row.exercise_id)))) throw new Error('Exercice personnalisé manquant.');
  if (clean.template_exercises.some(row => !Number.isInteger(row.position) || Number(row.position) < 0 || !Number.isInteger(row.planned_sets) || Number(row.planned_sets) < 1 || Number(row.planned_sets) > 20 || !Number.isInteger(row.rest_seconds) || Number(row.rest_seconds) < 0 || Number(row.rest_seconds) > 600 || ![0,1].includes(Number(row.to_failure)) || ![0,1].includes(Number(row.dropset)) || !Number.isInteger(row.superset_group) || Number(row.superset_group)<0 || Number(row.superset_group)>99 || !Number.isInteger(row.failure_rep_guide) || Number(row.failure_rep_guide)<1 || Number(row.failure_rep_guide)>30 || !Number.isInteger(row.planned_reps) || Number(row.planned_reps)<0 || Number(row.planned_reps)>200)) throw new Error('Objectifs du dossier invalides.');
  return { format: 'training-programme-folder', version: 2, folders: clean.folders, templates: clean.templates, template_exercises: clean.template_exercises, custom_exercises: clean.custom_exercises };
}
function makeSharedFolder(backup: Backup, folderId: string): SharedFolder {
  const folders = backup.folders.filter(row => row.id === folderId);
  const templates = backup.templates.filter(row => row.folder_id === folderId);
  const ids = new Set(templates.map(row => row.id));
  const plans = backup.template_exercises.filter(row => ids.has(row.template_id));
  const exercises = new Set(plans.map(row => row.exercise_id));
  return parseSharedFolder({ format: 'training-programme-folder', version: 2, folders, templates, template_exercises: plans, custom_exercises: backup.custom_exercises.filter(row => exercises.has(row.id)) });
}

async function importSharedFolder(db: SQLiteDatabase, input: unknown, shareId: string) {
  const payload = parseSharedFolder(input);
  if (!/^[a-f0-9-]{36}$/i.test(shareId)) throw new Error('Identifiant de partage invalide.');
  let result = '';
  await db.withExclusiveTransactionAsync(async txn => {
    const imported = await txn.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', `shared_folder:${shareId}`);
    if (imported) { result = imported.value; return; }
    const current = parseBackup(await exportAllData(txn));
    const id = () => globalThis.crypto?.randomUUID?.() ?? newId();
    const folderId = id(), now = Date.now();
    const templates = new Map(payload.templates.map(row => [row.id, id()]));
    const customs = new Map(payload.custom_exercises.map(row => [row.id, id()]));
    const rows = {
      folders: [{ ...payload.folders[0], id: folderId, created_at: now }],
      templates: payload.templates.map(row => ({ ...row, id: templates.get(row.id)!, folder_id: folderId, created_at: now })),
      custom_exercises: payload.custom_exercises.map(row => ({ ...row, id: customs.get(row.id)! })),
      template_exercises: payload.template_exercises.map(row => ({ ...row, template_id: templates.get(row.template_id)!, exercise_id: customs.get(row.exercise_id) ?? row.exercise_id })),
    };
    const combined = { ...current, settings: [...current.settings, { key: `shared_folder:${shareId}`, value: folderId }] };
    for (const table of Object.keys(rows) as (keyof typeof rows)[]) combined[table] = [...current[table], ...rows[table]];
    parseBackup(combined); // Taille et références validées avant toute insertion.
    for (const table of Object.keys(rows) as (keyof typeof rows)[]) {
      const columns = Object.keys(BACKUP_TABLES[table]);
      for (const row of rows[table]) await txn.runAsync(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')})`, ...columns.map(column => (row as Record<string,string|number|null>)[column]));
    }
    await txn.runAsync('INSERT INTO settings (key,value) VALUES (?,?)', `shared_folder:${shareId}`, folderId);
    result = folderId;
  });
  return result;
}

return { parseSharedFolder, makeSharedFolder, importSharedFolder };
}

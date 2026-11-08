import { BACKUP_TABLES, parseBackup, type Backup } from '../backup';

// Valeurs implicites de getSettings : les enregistrer à nouveau ne constitue
// pas une modification. Les marqueurs de migration ne sont pas des saisies.
const defaults: Record<string, string> = { username: 'Sportif', age: '', weight: '', height: '', goal: 'hypertrophy', experience: 'intermediate', rest_duration: '120', auto_rest: '0', theme: 'dark' };
export function isImplicitSetting(row: Record<string, string | number | null>) {
  return String(row.key).startsWith('migration_') || defaults[String(row.key)] === row.value;
}
function substantiveSettings(data: Backup) {
  return data.settings.filter(row => !isImplicitSetting(row));
}
export function isPristineBackup(input: Backup) {
  const data = parseBackup(input);
  return Object.keys(BACKUP_TABLES).every(table => table === 'settings' ? substantiveSettings(data).length === 0 : data[table as keyof typeof BACKUP_TABLES].length === 0);
}
export async function backupFingerprint(input: Backup): Promise<string> {
  const data = parseBackup(input);
  // Les valeurs ajoutées par la migration ne doivent pas créer de faux conflits.
  const content = Object.fromEntries(Object.keys(BACKUP_TABLES).map(table => [table,
    (table === 'settings' ? substantiveSettings(data) : data[table as keyof typeof BACKUP_TABLES]).map(row => JSON.stringify(Object.fromEntries(Object.entries(row).filter(([key,value]) => !(key === 'planned_duration_seconds' || key === 'duration_seconds') || value !== null).filter(([key,value]) => key !== 'reserve_reps' || value !== 2)))).sort(),
  ]));
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(content)));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

import { BACKUP_TABLES, parseBackup, type Backup } from '../backup';
import { backupFingerprint, isImplicitSetting, isPristineBackup } from './backupFingerprint';
import type { LocalDatabase } from './localDatabase';

export type Remote = { latest: { revision: number; payload: Backup; created_at: string } | null; versions: { revision: number; created_at: string }[] };
export type SyncTransport = { get(): Promise<Remote>; save(baseVersion: number, data: Backup): Promise<{ revision: number }> };
// Action explicite : union des enregistrements, jamais suppression ni choix
// arbitraire entre deux modifications du même élément.
export function mergeBackups(localInput: Backup, remoteInput: Backup): Backup {
  const local = parseBackup(localInput), remote = parseBackup(remoteInput);
  const result = { ...remote, exported_at: new Date().toISOString() };
  for (const table of Object.keys(BACKUP_TABLES) as (keyof typeof BACKUP_TABLES)[]) {
    const key = (row: Record<string, string | number | null>) => String(row.id ?? row.key ?? (table === 'template_exercises' ? JSON.stringify([row.template_id, row.exercise_id]) : table === 'session_exercises' ? JSON.stringify([row.session_id, row.exercise_id]) : row.exercise_id));
    const rows = new Map(remote[table].map(row => [key(row), row]));
    for (const row of local[table]) {
      const existing = rows.get(key(row));
      if (existing && JSON.stringify(existing) !== JSON.stringify(row)) {
        if (table === 'settings' && isImplicitSetting(row)) continue;
        if (table !== 'settings' || !isImplicitSetting(existing)) throw new Error('Le même élément a changé sur les deux appareils. Les deux copies sont conservées.');
      }
      rows.set(key(row), row);
    }
    result[table] = [...rows.values()];
  }
  return parseBackup(result);
}
export async function combineCopies(db: LocalDatabase, transport: SyncTransport, canApply: () => boolean, isLive: () => boolean = () => true, onApplied: () => void = () => {}) {
  const remote = await transport.get();
  if (!remote.latest) throw new Error('Aucune copie en ligne à réunir.');
  const local = await db.snapshot();
  const safeToApply = () => isLive() && canApply() && !local.data.sessions.some(row => row.finished_at === null);
  if (!safeToApply()) throw new Error('Ferme la saisie ou termine la séance avant de réunir les copies.');
  const merged = mergeBackups(local.data, remote.latest.payload);
  await db.restore(merged, undefined, local.revision, safeToApply);
  onApplied();
  // -1 garde cette union comme modification locale tant que le serveur n'a
  // pas accusé réception. Un autre appareil reste protégé par le CAS.
  await db.acknowledge(remote.latest.revision, -1);
  return synchronize(db, transport, canApply, isLive);
}
export async function synchronize(db: LocalDatabase, transport: SyncTransport, canApply: () => boolean, isLive: () => boolean = () => true) {
  const remote = await transport.get();
  if (!isLive()) return { remote, status: '', restored: false };
  const local = await db.snapshot();
  const fingerprint = await backupFingerprint(local.data);
  const version = remote.latest?.revision ?? 0;
  const cloudData = remote.latest ? parseBackup(remote.latest.payload) : null;
  const same = cloudData ? fingerprint === await backupFingerprint(cloudData) : false;
  if (!isLive()) return { remote, status: '', restored: false };
  if (same) {
    await db.acknowledge(version, local.revision, fingerprint);
    return { remote, status: 'Sauvegardé en ligne', restored: false };
  }
  const clean = local.syncedRevision >= 0 && local.syncedFingerprint === fingerprint;
  const firstEmptyCopy = local.remoteVersion === 0 && local.syncedRevision === 0 && !local.syncedFingerprint && isPristineBackup(local.data);
  const needsPull = !!cloudData && (firstEmptyCopy || (version !== local.remoteVersion && clean));
  if (needsPull) {
    const safeToApply = () => isLive() && canApply() && !local.data.sessions.some(row => row.finished_at === null);
    if (!safeToApply()) return { remote, status: 'Mise à jour disponible · ferme la saisie pour synchroniser', restored: false };
    await db.restore(cloudData, version, local.revision, safeToApply);
    return { remote, status: 'Sauvegardé en ligne', restored: true };
  }
  if (version !== local.remoteVersion) return { remote, status: 'Modifications sur deux appareils · copies conservées', restored: false };
  // Une copie absente en ligne ne remplace jamais les données locales par du vide.
  if (!remote.latest && isPristineBackup(local.data)) return { remote, status: 'Prêt à synchroniser', restored: false };
  const saved = await transport.save(version, local.data);
  await db.acknowledge(saved.revision, local.revision, fingerprint);
  return { remote, status: db.meta.revision === local.revision ? 'Sauvegardé en ligne' : 'Modifications en attente', restored: false };
}

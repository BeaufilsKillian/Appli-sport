import initSqlJs, { type Database, type SqlJsStatic, type SqlValue } from 'sql.js';
import type { SQLiteDatabase } from 'expo-sqlite';
import { BACKUP_TABLES, parseBackup, type Backup } from '../backup';
import { backupFingerprint } from './backupFingerprint';

export type LocalRecord = { bytes: Uint8Array; revision: number; syncedRevision: number; remoteVersion: number; savedAt: number; syncedFingerprint?: string };
export type Persistence = { read(): Promise<LocalRecord | undefined>; readCopy?(revision: number): Promise<LocalRecord | undefined>; write(value: LocalRecord, keepCopy: boolean): Promise<void> };
export function indexedPersistence(owner: string): Persistence {
  const opened = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(`training-programme:${owner}`, 1);
    request.onupgradeneeded = () => { request.result.createObjectStore('state'); request.result.createObjectStore('copies', { keyPath: 'revision' }); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('Stockage indisponible. Quitte la navigation privée ou libère de l’espace.'));
  });
  return {
    async read() {
      const db = await opened;
      return new Promise((resolve, reject) => {
        const req = db.transaction('state').objectStore('state').get('current');
        req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
      });
    },
    async readCopy(revision) {
      const db = await opened;
      return new Promise((resolve, reject) => {
        const req = db.transaction('copies').objectStore('copies').get(revision);
        req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
      });
    },
    async write(value, keepCopy) {
      const db = await opened;
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(['state', 'copies'], 'readwrite');
        tx.objectStore('state').put(value, 'current');
        if (keepCopy) {
          const copies = tx.objectStore('copies'); copies.put(value);
          const request = copies.getAllKeys();
          request.onsuccess = () => request.result.slice(0, -10).forEach(key => copies.delete(key));
        }
        tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error ?? new Error('Enregistrement interrompu.'));
      });
    },
  };
}

// Une seule file pour les lectures, écritures et transactions. Les callbacks utilisent
// leur propre handle afin qu'aucune écriture extérieure ne rejoigne une transaction.
export class LocalDatabase {
  private sql: Database;
  private queue: Promise<unknown> = Promise.resolve();
  private listeners = new Set<(scope?:'nutrition'|'training') => void>();
  private release?: () => void;
  private closed = false;
  meta: Omit<LocalRecord, 'bytes'>;
  constructor(private engine: SqlJsStatic, private persistence: Persistence, stored?: LocalRecord) {
    this.sql = new engine.Database(stored?.bytes);
    this.meta = stored ? { revision: stored.revision, syncedRevision: stored.syncedRevision, remoteVersion: stored.remoteVersion, savedAt: stored.savedAt, syncedFingerprint: stored.syncedFingerprint } : { revision: 0, syncedRevision: 0, remoteVersion: 0, savedAt: 0 };
  }
  static async open(owner: string) {
    const engine = await initSqlJs({ locateFile: file => `/${file}` });
    if (!navigator.locks) throw new Error('Ce navigateur ne permet pas de protéger les écritures entre plusieurs fenêtres. Mets Safari à jour.');
    return new Promise<LocalDatabase>((resolve, reject) => {
      void navigator.locks.request(`training-database:${owner}`, { ifAvailable: true }, async lock => {
        if (!lock) { reject(new Error('L’application est déjà ouverte dans une autre fenêtre. Ferme-la puis réessaie.')); return; }
        try {
          const persistence = indexedPersistence(owner);
          const db = new LocalDatabase(engine, persistence, await persistence.read());
          await db.recoverSyncBaseline();
          await new Promise<void>(release => { db.release = release; resolve(db); });
        } catch (error) { reject(error); }
      }).catch(reject);
    });
  }
  async close() { await this.queue; if (this.closed) return; this.closed = true; this.sql.close(); this.release?.(); }
  subscribe = (fn: (scope?:'nutrition'|'training') => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  private exclusive<T>(fn: () => Promise<T>): Promise<T> {
    const guarded = () => { if (this.closed) throw new Error('Base fermée.'); return fn(); };
    const pending = this.queue.then(guarded, guarded); this.queue = pending.catch(() => {}); return pending;
  }
  private rows<T>(sql: string, args: SqlValue[] = []): T[] {
    const statement = this.sql.prepare(sql);
    try { statement.bind(args); const rows: T[] = []; while (statement.step()) rows.push(statement.getAsObject() as T); return rows; }
    finally { statement.free(); }
  }
  private async transaction<T>(fn: (txn: SQLiteDatabase) => Promise<T>) {
    const before = this.sql.export(); const oldMeta = { ...this.meta }; let changed = false; let nutritionOnly=true;
    const mark=(query:string)=>{changed=true;if(!/^\s*(?:INSERT(?: OR REPLACE| OR IGNORE)? INTO|UPDATE|DELETE FROM)\s+nutrition_(?:documents|meta)\b/i.test(query))nutritionOnly=false;};
    const txn = {
      // WAL est un mode de fichier natif. Ici l'atomicité est assurée par la file
      // et le commit IndexedDB de l'image complète de la base.
      execAsync: async (query: string) => { this.sql.exec(query.replace(/PRAGMA\s+journal_mode\s*=\s*WAL\s*;/gi, '')); mark(query); },
      runAsync: async (query: string, ...args: SqlValue[]) => {
        this.sql.run(query, args); mark(query);
        return { changes: this.sql.getRowsModified(), lastInsertRowId: Number(this.rows<{ id: number }>('SELECT last_insert_rowid() id')[0].id) };
      },
      getAllAsync: async <R>(query: string, ...args: SqlValue[]) => this.rows<R>(query, args),
      getFirstAsync: async <R>(query: string, ...args: SqlValue[]) => this.rows<R>(query, args)[0] ?? null,
    } as unknown as SQLiteDatabase;
    try {
      this.sql.exec('BEGIN');
      const result = await fn(txn);
      this.sql.exec('COMMIT');
      if (changed) {
        this.meta = { ...this.meta, revision: this.meta.revision + 1, savedAt: Date.now() };
        await this.persistence.write({ bytes: this.sql.export(), ...this.meta }, true);
        this.listeners.forEach(fn => { try { fn(nutritionOnly?'nutrition':'training'); } catch { /* Un observateur ne doit pas annuler un commit persistant. */ } });
      }
      return result;
    } catch (error) {
      this.sql.close(); this.sql = new this.engine.Database(before); this.meta = oldMeta;
      throw error;
    }
  }
  getAllAsync = <T>(query: string, ...args: SqlValue[]) => this.exclusive(async () => this.rows<T>(query, args));
  getFirstAsync = <T>(query: string, ...args: SqlValue[]) => this.exclusive(async () => this.rows<T>(query, args)[0] ?? null);
  runAsync = (query: string, ...args: SqlValue[]) => this.exclusive(() => this.transaction(tx => tx.runAsync(query, ...args)));
  execAsync = (query: string) => this.exclusive(() => this.transaction(tx => tx.execAsync(query)));
  withExclusiveTransactionAsync = (fn: (txn: SQLiteDatabase) => Promise<void>) => this.exclusive(() => this.transaction(fn));
  private readData(database = this.sql) {
    const data: Record<string, unknown> = { format: 'training-programme-backup', schema: 11, exported_at: new Date().toISOString() };
    for (const table of Object.keys(BACKUP_TABLES)) {
      const statement = database.prepare('SELECT * FROM ' + table); const rows = [];
      try { while (statement.step()) rows.push(statement.getAsObject()); } finally { statement.free(); }
      data[table] = rows;
      if(table==='session_exercises'&&rows.some(row=>row.progression_key===undefined||row.suggested_load===undefined||row.progression_reason===undefined)||table==='exercise_maxes'&&rows.some(row=>row.load_step===undefined))data.schema=Math.min(Number(data.schema),10);
      if ((table === 'template_exercises' || table === 'session_exercises') && rows.some(row => row.planned_duration_seconds === undefined) || table === 'logged_sets' && rows.some(row => row.duration_seconds === undefined) || table === 'exercise_maxes' && rows.some(row => row.reserve_reps === undefined)) data.schema = Math.min(Number(data.schema), 9);
      if (table === 'template_exercises' && rows.some(row => row.planned_reps_min === undefined)) data.schema = 8;
    }
    return parseBackup(data);
  }
  async recoverSyncBaseline() {
    return this.exclusive(async () => {
      if (this.meta.syncedFingerprint || this.meta.remoteVersion <= 0 || this.meta.syncedRevision < 0) return;
      if (this.meta.revision === this.meta.syncedRevision) {
        this.meta.syncedFingerprint = await backupFingerprint(this.readData());
      } else {
        const copy = await this.persistence.readCopy?.(this.meta.syncedRevision);
        if (!copy) return;
        const previous = new this.engine.Database(copy.bytes);
        try { this.meta.syncedFingerprint = await backupFingerprint(this.readData(previous)); }
        finally { previous.close(); }
      }
    });
  }
  async snapshot() {
    return this.exclusive(async () => ({ data: this.readData(), ...this.meta }));
  }
  async acknowledge(remoteVersion: number, revision: number, fingerprint?: string) {
    return this.exclusive(async () => {
      const syncedFingerprint = fingerprint ?? this.meta.syncedFingerprint;
      if (this.meta.remoteVersion === remoteVersion && this.meta.syncedRevision === revision && this.meta.syncedFingerprint === syncedFingerprint) return;
      const next = { ...this.meta, remoteVersion, syncedRevision: revision, syncedFingerprint };
      await this.persistence.write({ bytes: this.sql.export(), ...next }, false);
      this.meta = next; this.listeners.forEach(fn => { try { fn(); } catch { /* Commit déjà persistant. */ } });
    });
  }
  async restore(input: unknown, remoteVersion?: number, expectedRevision?: number, canApply: () => boolean = () => true) {
    const data: Backup = parseBackup(input);
    const fingerprint = remoteVersion !== undefined ? await backupFingerprint(data) : undefined;
    await this.exclusive(async () => {
      if (!canApply()) throw new Error('Mise à jour en attente · saisie en cours.');
      if (expectedRevision !== undefined && this.meta.revision !== expectedRevision) throw new Error('Des données ont changé. Réessaie avant de restaurer.');
      return this.transaction(async txn => {
      for (const table of Object.keys(BACKUP_TABLES).reverse()) await txn.execAsync(`DELETE FROM ${table}`);
      for (const [table, columns] of Object.entries(BACKUP_TABLES)) {
        const fields = Object.keys(columns);
        for (const row of data[table as keyof typeof BACKUP_TABLES]) await txn.runAsync(`INSERT INTO ${table} (${fields.join(',')}) VALUES (${fields.map(() => '?').join(',')})`, ...fields.map(key => row[key]));
      }
      if (remoteVersion !== undefined) this.meta = { ...this.meta, remoteVersion, syncedRevision: this.meta.revision + 1, syncedFingerprint: fingerprint };
      });
    });
  }
}

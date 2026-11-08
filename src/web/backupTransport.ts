import type { Remote, SyncTransport } from './synchronize';

type Response = Omit<Remote, 'latest'> & { latest: (Omit<NonNullable<Remote['latest']>, 'payload'> & { payload: NonNullable<Remote['latest']>['payload'] | null }) | null };
type Request = <T>(path: string, body?: unknown, headers?: Record<string, string>) => Promise<T>;

// Cache privé à un compte et à cette instance du panneau. Le serveur omet le JSON
// uniquement si la version en mémoire correspond exactement à la sienne.
export function createBackupTransport(request: Request, owner: string): SyncTransport {
  let cached: Remote['latest'] = null;
  const headers = { 'X-Training-Owner': owner };
  return {
    async get() {
      const previous = cached;
      const response = await request<Response>(`/api/backups${previous ? `?knownVersion=${previous.revision}` : ''}`, undefined, headers);
      const latest = response.latest;
      if (latest?.payload === null) {
        if (!previous || previous.revision !== latest.revision) throw new Error('Version de sauvegarde incohérente. Réessaie.');
        cached = { ...latest, payload: previous.payload };
      } else cached = latest ? { ...latest, payload: latest.payload! } : null;
      return { latest: cached, versions: response.versions };
    },
    save: (baseVersion, data) => request<{ revision: number }>('/api/backups', { baseVersion, data }, headers),
  };
}

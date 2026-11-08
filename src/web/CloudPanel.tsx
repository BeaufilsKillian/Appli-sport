import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { combineCopies, synchronize, type Remote } from './synchronize';
import { LocalDatabase } from './localDatabase';
import { api, useWebSession } from './session';
import { createBackupTransport } from './backupTransport';
import { UpdatePrompt } from './UpdatePrompt';
import { offlineMediaInstalled } from './offlineMedia';
import { FolderShareInbox } from './FolderSharing';
import type { SQLiteDatabase } from 'expo-sqlite';
import { AdminEntry,useAccess } from './Access';

type UpdateCheckpoint = { blocked: boolean; prepare(): Promise<void> };
type CloudContext = { db: LocalDatabase; status: string; remote: Remote | null; busy: React.MutableRefObject<boolean>; setBusy(value: boolean): void; setUpdateCheckpoint(value: UpdateCheckpoint): void; installUpdate(): Promise<void>; sync(): Promise<void>; merge(): Promise<void>; restore(revision: number): Promise<void>; remount(): void };
const Context = createContext<CloudContext | null>(null);
export function useCloudActivity(busy: boolean, checkpoint?: UpdateCheckpoint) {
  const context = useContext(Context);
  useEffect(() => { context?.setBusy(busy); }, [context, busy]);
  useEffect(() => { if (checkpoint) context?.setUpdateCheckpoint(checkpoint); }, [context, checkpoint]);
}
export function CloudPanel({ children, db }: { children: React.ReactNode; db: LocalDatabase }) {
  const session = useWebSession();
  const access=useAccess();
  const transport = useMemo(() => createBackupTransport(api, session.user?.id ?? ''), [session.user?.id]);
  const [status, setStatus] = useState('Enregistré sur cet appareil');
  const [remote, setRemote] = useState<Remote | null>(null);
  const [epoch, setEpoch] = useState(0);
  const [updateBlocked, setUpdateBlocked] = useState(true);
  const updateCheckpoint = useRef<UpdateCheckpoint>({ blocked: true, prepare: async () => {} });
  const installing = useRef(false);
  const busy = useRef(true), running = useRef(false), live = useRef(true);
  const sync = useCallback(async () => {
    if (running.current || !session.user || !session.configured || !session.authenticated || !access.canUse || !navigator.onLine) return;
    running.current = true;
    try {
      const result = await synchronize(db, transport, () => !busy.current, () => live.current);
      if (!live.current) return;
      setRemote(result.remote); setStatus(result.status);
      if (result.restored) setEpoch(value => value + 1);
    } catch (error) {
      if (live.current) setStatus(error instanceof Error && /copie|récente|Reconnecte|compte|saisie/.test(error.message) ? error.message : 'Sauvegarde en attente · données conservées ici');
    } finally { running.current = false; }
  }, [db, session.user, session.configured, session.authenticated,access.canUse, transport]);
  useEffect(() => {
    live.current = true; let timer: ReturnType<typeof setTimeout>;
    const schedule = () => { clearTimeout(timer); timer = setTimeout(() => { void sync(); }, 1500); };
    const unsubscribe = db.subscribe(scope => { if(scope==='nutrition')return; setStatus('Modifications en attente'); schedule(); });
    const visible = () => { if (document.visibilityState === 'visible') schedule(); };
    const poll = setInterval(visible, 20_000);
    schedule(); window.addEventListener('online', schedule); window.addEventListener('focus', schedule); document.addEventListener('visibilitychange', visible);
    return () => { live.current = false; unsubscribe(); clearTimeout(timer); clearInterval(poll); window.removeEventListener('online', schedule); window.removeEventListener('focus', schedule); document.removeEventListener('visibilitychange', visible); };
  }, [db, sync]);
  const merge = useCallback(async () => {
    if (running.current) throw new Error('Synchronisation en cours. Réessaie dans un instant.');
    if (!session.user) throw new Error('Connecte-toi pour réunir les copies.');
    running.current = true;
    try {
      const result = await combineCopies(db, transport, () => !busy.current, () => live.current, () => setEpoch(value => value + 1));
      if (live.current) { setRemote(result.remote); setStatus(result.status); }
    } finally { running.current = false; }
  }, [db, session.user, transport]);
  const restore = useCallback(async (revision: number) => {
    if (busy.current) throw new Error('Ferme les formulaires et termine la séance avant de restaurer.');
    if (!session.user) throw new Error('Connecte-toi pour restaurer.');
    const headers = { 'X-Training-Owner': session.user.id };
    const cloud = await api<Remote>(`/api/backups?revision=${revision}`, undefined, headers);
    if (!cloud.latest) throw new Error('Sauvegarde introuvable.');
    // Une ancienne version restaurée devient une modification locale, jamais une réécriture silencieuse du serveur.
    const latest = await api<Remote>('/api/backups', undefined, headers);
    const current = await db.snapshot();
    await db.restore(cloud.latest.payload, undefined, current.revision);
    await db.acknowledge(latest.latest?.revision ?? 0, -1);
    setEpoch(value => value + 1); setStatus('Version restaurée · sauvegarde en attente');
  }, [db, session.user]);
  const setBusy = useCallback((value: boolean) => { const wasBusy = busy.current; busy.current = value; if (wasBusy && !value) void sync(); }, [sync]);
  const setUpdateCheckpoint = useCallback((value: UpdateCheckpoint) => { updateCheckpoint.current = value; setUpdateBlocked(value.blocked); }, []);
  const installUpdate = useCallback(async () => {
    if (installing.current) return;
    if (updateCheckpoint.current.blocked) throw new Error('Ferme le formulaire avant d’installer la mise à jour.');
    installing.current = true;
    try {
      await updateCheckpoint.current.prepare();
      await db.snapshot();
      if (!window.trainingUpdate) throw new Error('Mise à jour indisponible. Réessaie.');
      window.trainingUpdate();
    } catch (error) { installing.current = false; throw error; }
  }, [db]);
  const context = useMemo(() => ({ db, status, remote, busy, setBusy, setUpdateCheckpoint, installUpdate, sync, merge, restore, remount: () => setEpoch(value => value + 1) }), [db, status, remote, setBusy, setUpdateCheckpoint, installUpdate, sync, merge, restore]);
  return <Context.Provider value={context}><React.Fragment key={epoch}>{children}</React.Fragment><UpdatePrompt blocked={updateBlocked} installUpdate={installUpdate} /></Context.Provider>;
}

const field = { borderWidth: 1, borderColor: '#3C4756', backgroundColor: '#171D25', color: '#F5F8FC', borderRadius: 10, padding: 12, fontSize: 16 };
function Action({ title, onPress, disabled = false }: { title: string; onPress(): void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={{ backgroundColor: disabled ? '#354257' : '#0878F9', padding: 12, borderRadius: 10, alignItems: 'center' }}><Text style={{ color: 'white', fontWeight: '700' }}>{title}</Text></Pressable>;
}
export function CloudSettings() {
  const context = useContext(Context), session = useWebSession();
  const [email, setEmail] = useState(''), [password, setPassword] = useState('');
  const [message, setMessage] = useState(''), [working, setWorking] = useState(false), [signup, setSignup] = useState(false);
  const [download, setDownload] = useState(''), [updateReady, setUpdateReady] = useState(!!window.trainingUpdate);
  const [mediaInstalled, setMediaInstalled] = useState<boolean | null>(null);
  useEffect(() => {
    let live = true;
    const check = () => {
      if (document.visibilityState !== 'visible') return;
      void offlineMediaInstalled().then(value => { if (live) setMediaInstalled(value); }).catch(() => { if (live) setMediaInstalled(false); });
    };
    check(); window.addEventListener('focus', check); window.addEventListener('pageshow', check); document.addEventListener('visibilitychange', check);
    return () => { live = false; window.removeEventListener('focus', check); window.removeEventListener('pageshow', check); document.removeEventListener('visibilitychange', check); };
  }, []);
  useEffect(() => { const ready = () => setUpdateReady(true); window.addEventListener('training-update', ready); return () => window.removeEventListener('training-update', ready); }, []);
  if (!context) return null;
  const run = async (fn: () => Promise<void>) => { setWorking(true); setMessage(''); try { await fn(); } catch (error) { setMessage(error instanceof Error ? error.message : 'Action impossible.'); } finally { setWorking(false); } };
  const importFile = () => {
    const input = document.createElement('input'); input.type = 'file'; input.accept = '.json,application/json';
    input.onchange = () => { const file = input.files?.[0]; if (!file) return;
      void run(async () => {
        if (context.busy.current) throw new Error('Termine la séance avant de restaurer.');
        if (file.size > 2_000_000) throw new Error('Fichier trop volumineux.');
        const data = JSON.parse(await file.text());
        if (!window.confirm('Remplacer les données de ce compte sur cet appareil par ce fichier ?')) return;
        const snapshot = await context.db.snapshot();
        await context.db.restore(data, undefined, snapshot.revision); context.remount();
      });
    }; input.click();
  };
  return <View style={{ marginTop: 20, padding: 16, borderRadius: 16, backgroundColor: '#101419', gap: 12 }}>
    <Text style={{ color: 'white', fontSize: 17, fontWeight: '700' }}>Compte et sauvegarde</Text>
    <AdminEntry/>
    <Text style={{ color: '#B7C5D6' }}>{session.user?.email ?? 'Sur cet appareil uniquement'}{'\n'}{session.user ? context.status : 'Export conseillé pour conserver une copie.'}</Text>
    {!session.authenticated && <>
      <TextInput accessibilityLabel="Adresse e-mail" style={field} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="Adresse e-mail" placeholderTextColor="#9AA8BB" />
      <TextInput accessibilityLabel="Mot de passe" style={field} value={password} onChangeText={setPassword} secureTextEntry placeholder="Mot de passe" placeholderTextColor="#9AA8BB" />
      <Action disabled={working || !session.configured} title={signup ? 'Créer mon compte' : 'Me connecter'} onPress={() => { void run(async () => { await session.login(email.trim(), password, signup); setPassword(''); }); }} />
      {!session.configured && <Text style={{ color: '#B7C5D6' }}>Connexion en ligne disponible après configuration de Vercel et Neon.</Text>}
      <Pressable accessibilityRole="button" onPress={() => setSignup(value => !value)}><Text style={{ color: '#64AAFF' }}>{signup ? 'J’ai déjà un compte' : 'Créer un compte'}</Text></Pressable>
      <Pressable accessibilityRole="button" disabled={!session.configured || working} onPress={() => { void run(async () => { await session.reset(email.trim()); setMessage('Si ce compte existe, un e-mail a été envoyé.'); }); }}><Text style={{ color: '#64AAFF' }}>Mot de passe oublié</Text></Pressable>
      {new URLSearchParams(location.search).has('token') && <Action title="Enregistrer le nouveau mot de passe" onPress={() => { void run(async () => { await session.resetPassword(password, new URLSearchParams(location.search).get('token')!); setPassword(''); setMessage('Mot de passe modifié.'); }); }} />}
    </>}
    {session.authenticated && <>
      {context.status.includes('deux appareils') && <Action title="Réunir les données des appareils" disabled={working || context.busy.current} onPress={() => { void run(context.merge); }} />}
      <Action title="Sauvegarder maintenant" disabled={working} onPress={() => { void run(context.sync); }} />
      {context.remote?.versions.map(version => <Pressable key={version.revision} accessibilityRole="button" disabled={working} onPress={() => {
        if (window.confirm('Restaurer cette version ? Les données actuelles seront remplacées.')) void run(() => context.restore(version.revision));
      }}><Text style={{ color: '#64AAFF' }}>Restaurer · {new Date(version.created_at).toLocaleString('fr-FR')}</Text></Pressable>)}
      <Action title="Me déconnecter" disabled={working} onPress={() => { void run(session.logout); }} />
    </>}
    <Action title="Importer une sauvegarde JSON" onPress={importFile} disabled={working} />
    <FolderShareInbox db={context.db as unknown as SQLiteDatabase} isBusy={()=>context.busy.current} onImported={context.remount}/>
    {mediaInstalled === false && <Action title="Télécharger les animations hors ligne" disabled={working} onPress={() => { void run(async () => {
      const registration = await navigator.serviceWorker?.ready;
      if (!registration?.active) throw new Error('Ouvre la version installée de l’application.');
      await new Promise<void>((resolve, reject) => {
        const channel = new MessageChannel();
        channel.port1.onmessage = event => { if (event.data.error) { channel.port1.close(); reject(new Error(event.data.error)); } else if (event.data.done) { channel.port1.close(); resolve(); } else setDownload(`${event.data.completed}/${event.data.total}`); };
        registration.active!.postMessage({ type: 'DOWNLOAD_MEDIA' }, [channel.port2]);
      });
      const installed = await offlineMediaInstalled();
      setMediaInstalled(installed);
      if (!installed) throw new Error('Téléchargement incomplet. Réessaie.');
      setDownload('Animations disponibles hors ligne');
    }); }} />}
    {download ? <Text style={{ color: '#B7C5D6' }}>{download}</Text> : null}
    {updateReady ? <Action title="Installer la mise à jour" disabled={working} onPress={() => { void run(context.installUpdate); }} /> :
      <Action title="Vérifier les mises à jour" disabled={working} onPress={() => { void run(async () => {
        if (!window.trainingCheckUpdate) throw new Error('Recharge la page pour vérifier les mises à jour.');
        const result = await window.trainingCheckUpdate();
        setUpdateReady(result === 'ready'); setMessage(result === 'ready' ? 'Mise à jour disponible' : 'Application à jour');
      }); }} />}
    {message ? <Text accessibilityRole="alert" style={{ color: '#FFBD62' }}>{message}</Text> : null}
  </View>;
}

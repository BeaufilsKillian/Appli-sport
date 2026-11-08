import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

type User = { id: string; email: string };
type SessionContext = { owner: string; user: User | null; configured: boolean; authenticated: boolean; ready:boolean; login(email: string, password: string, signup: boolean): Promise<void>; logout(): Promise<void>; reset(email: string): Promise<void>; resetPassword(password: string, token: string): Promise<void> };
const Context = createContext<SessionContext | null>(null);
export function useWebSession() { const context = useContext(Context); if (!context) throw new Error('Session non prête.'); return context; }
function remembered(): User | null {
  try { const value = JSON.parse(localStorage.getItem('training-last-user') ?? 'null'); return value && typeof value.id === 'string' && typeof value.email === 'string' ? value : null; } catch { return null; }
}
export async function api<T>(path: string, body?: unknown, additionalHeaders: Record<string, string> = {}): Promise<T> {
  const response = await fetch(path, { method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin', cache: 'no-store',
    headers: { 'X-Training-Client': '1', ...additionalHeaders, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(20_000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiRequestError(response.status,typeof data.error === 'string' ? data.error : data.message ?? 'Connexion indisponible.');
  return data as T;
}
export class ApiRequestError extends Error {constructor(public status:number,message:string){super(message);}}
export function WebSessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(remembered);
  const [configured, setConfigured] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [ready,setReady]=useState(false);
  const remember = useCallback((next: User | null) => {
    if (next) localStorage.setItem('training-last-user', JSON.stringify(next)); else localStorage.removeItem('training-last-user');
    setUser(previous => previous?.id === next?.id && previous?.email === next?.email ? previous : next); setAuthenticated(!!next);
  }, []);
  const refresh = useCallback(async () => {
    try {
      const config = await api<{ cloud: boolean }>('/api/config');
      setConfigured(config.cloud);
      if (!config.cloud) return;
      if(localStorage.getItem('training-local-signout')){await api('/api/auth/sign-out',{});localStorage.removeItem('training-local-signout');remember(null);return;}
      const current = await api<{ user?: User | null }>('/api/auth/get-session');
      if (current.user) remember({ id: current.user.id, email: current.user.email });
      else remember(null);
    } catch { setAuthenticated(false); } finally {setReady(true);}
  }, [remember]);
  useEffect(() => {
    const timer = setTimeout(() => { void refresh(); }, 0); const online = () => { void refresh(); };
    const visible = () => { if (document.visibilityState === 'visible') online(); };
    window.addEventListener('online', online); window.addEventListener('focus', online); document.addEventListener('visibilitychange', visible);
    return () => { clearTimeout(timer); window.removeEventListener('online', online); window.removeEventListener('focus', online); document.removeEventListener('visibilitychange', visible); };
  }, [refresh]);
  return <Context.Provider value={{ owner: user?.id ?? 'guest', user, configured, authenticated,ready,
    async login(email, password, signup) {
      if (!configured) throw new Error('La connexion Neon doit d’abord être configurée.');
      const result = await api<{ user?: User; error?: { message?: string } }>(`/api/auth/${signup ? 'sign-up/email' : 'sign-in/email'}`, { email, password, ...(signup ? { name: email.split('@')[0] } : {}) });
      if (result.error) throw new Error(result.error.message ?? 'Connexion impossible.');
      const session = await api<{ user?: User }>('/api/auth/get-session');
      if (!session.user) throw new Error('Vérifie ton adresse e-mail puis connecte-toi.');
      localStorage.removeItem('training-local-signout');
      remember({ id: session.user.id, email: session.user.email });
    },
    async logout() {
      window.dispatchEvent(new Event('training-before-logout'));
      try {await api('/api/auth/sign-out', {});}catch{localStorage.setItem('training-local-signout','1');}finally{remember(null);}
    },
    async reset(email) { await api('/api/auth/request-password-reset', { email, redirectTo: window.location.origin }); },
    async resetPassword(password, token) { await api('/api/auth/reset-password', { newPassword: password, token }); window.history.replaceState(null, '', '/'); },
  }}>{children}</Context.Provider>;
}

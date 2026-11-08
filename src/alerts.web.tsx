import React, { useEffect, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
type Button = { text?: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' };
type Dialog = { title: string; message?: string; buttons: Button[]; cancelable: boolean };
let current: Dialog | null = null;
const pending: Dialog[] = [], listeners = new Set<() => void>();
const emit = () => listeners.forEach(fn => fn());
export const Alert = { alert(title: string, message?: string, buttons?: Button[], options?: { cancelable?: boolean }) {
  const dialog = { title, message, buttons: buttons?.length ? buttons : [{ text: 'OK' }], cancelable: options?.cancelable !== false };
  if (current) pending.push(dialog); else current = dialog; emit();
} };
function choose(button: Button) { current = pending.shift() ?? null; emit(); button.onPress?.(); }
export function AlertHost() {
  const dialog = useSyncExternalStore(fn => { listeners.add(fn); return () => { listeners.delete(fn); }; }, () => current, () => null);
  useEffect(() => {
    if (!dialog) return;
    const previous = document.activeElement as HTMLElement | null;
    const surface = document.querySelector<HTMLElement>('[data-training-alert]');
    const buttons = Array.from(surface?.querySelectorAll<HTMLButtonElement>('button') ?? []);
    buttons[0]?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && dialog.cancelable) { event.preventDefault(); choose(dialog.buttons.find(button => button.style === 'cancel') ?? {}); }
      if (event.key === 'Tab' && buttons.length) { event.preventDefault(); const index = buttons.indexOf(document.activeElement as HTMLButtonElement); buttons[(index + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length]?.focus(); }
    };
    document.addEventListener('keydown', key); return () => { document.removeEventListener('keydown', key); previous?.focus(); };
  }, [dialog]);
  if (!dialog) return null;
  return createPortal(<div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: '#000A', display: 'grid', placeItems: 'center', padding: 20 }}>
    <div data-training-alert role="alertdialog" aria-modal="true" aria-labelledby="training-alert-title" aria-describedby="training-alert-message" style={{ width: 'min(100%, 420px)', borderRadius: 18, background: '#171D25', color: '#F5F8FC', padding: 24, fontFamily: 'system-ui' }}>
      <h2 id="training-alert-title" style={{ marginTop: 0, fontSize: 20 }}>{dialog.title}</h2>
      <p id="training-alert-message" style={{ lineHeight: 1.5 }}>{dialog.message}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{dialog.buttons.map((button, index) => <button key={index} onClick={() => choose(button)} style={{ border: '1px solid #354257', borderRadius: 10, padding: 13, background: button.style === 'cancel' ? '#26303E' : button.style === 'destructive' ? '#AD2439' : '#0878F9', color: 'white', fontSize: 16, cursor: 'pointer' }}>{button.text ?? 'OK'}</button>)}</div>
    </div>
  </div>, document.body);
}

import type { VercelRequest, VercelResponse } from '@vercel/node';

// L'ancienne version intercepte les pages, mais laisse passer /api/ : cette
// entrée permet sa mise à jour sans terminer la séance ni toucher à ses données.
const script = String.raw`(() => {
  const button = document.getElementById('install');
  const status = document.getElementById('status');
  let requested = false;
  navigator.serviceWorker?.addEventListener('controllerchange', () => {
    if (requested) location.replace('/');
  });
  const ready = (async () => {
    if (!('serviceWorker' in navigator)) throw new Error('Ouvre ce lien dans Safari ou Chrome.');
    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' });
    await registration.update();
    const worker = registration.installing;
    if (worker && !['installed', 'activated', 'redundant'].includes(worker.state)) await new Promise((resolve, reject) => {
      const cleanup = () => { clearTimeout(timeout); worker.removeEventListener('statechange', changed); };
      const changed = () => {
        if (['installed', 'activated'].includes(worker.state)) { cleanup(); resolve(); }
        else if (worker.state === 'redundant') { cleanup(); reject(new Error('Téléchargement interrompu. Réessaie.')); }
      };
      const timeout = setTimeout(() => { cleanup(); reject(new Error('Téléchargement incomplet. Recharge cette page.')); }, 90000);
      worker.addEventListener('statechange', changed); changed();
    });
    status.textContent = registration.waiting ? 'Mise à jour prête. Ta séance reste en cours.' : 'Application à jour. Ta séance reste en cours.';
    button.textContent = registration.waiting ? 'Installer la mise à jour' : 'Reprendre l’application';
    button.disabled = false;
    return registration;
  })();
  ready.catch(error => { status.textContent = error.message; });
  button.addEventListener('click', async () => {
    button.disabled = true;
    try {
      const registration = await ready;
      if (!registration.waiting) { location.replace('/'); return; }
      requested = true;
      status.textContent = 'Installation…';
      registration.waiting.postMessage({ type: 'ACTIVATE' });
    } catch (error) { status.textContent = error.message; button.disabled = false; }
  });
})();`;

const page = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mise à jour · Training Programme</title><style>
body{margin:0;background:#050709;color:#f5f8fc;font:16px system-ui;min-height:100dvh;display:grid;place-items:center}main{box-sizing:border-box;width:calc(100% - 40px);max-width:380px;padding:26px;border-radius:20px;background:#171d25}h1{font-size:23px;margin:0 0 16px}p{color:#b7c5d6;line-height:1.5}button{width:100%;padding:15px;border:0;border-radius:12px;background:#0878f9;color:white;font:600 16px system-ui;margin-top:10px}button:disabled{opacity:.55}
</style><script src="/api/update?script=1" defer></script></head><body><main><h1>Mise à jour</h1><p>Tes séances et tes saisies enregistrées sont conservées.</p><p id="status" role="status">Téléchargement de la dernière version…</p><button id="install" disabled>Installer la mise à jour</button></main></body></html>`;

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET') return res.status(405).end();
  const javascript = req.query.script === '1';
  res.setHeader('Content-Type', javascript ? 'application/javascript; charset=utf-8' : 'text/html; charset=utf-8');
  return res.status(200).send(javascript ? script : page);
}

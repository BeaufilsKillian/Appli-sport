if ('serviceWorker' in navigator && window.isSecureContext) {
  let requested = false, checking, registrationPromise, notifiedWorker, observedWorker;
  const ready = registration => {
    if (!registration.waiting || !registration.active) return false;
    const worker = registration.waiting;
    window.trainingUpdateDownloading = false;
    window.trainingUpdate = () => {
      if (!registration.waiting) throw new Error('La version a changé. Rouvre l’application.');
      requested = true; registration.waiting.postMessage({ type: 'ACTIVATE' });
    };
    if (notifiedWorker !== worker) { notifiedWorker = worker; window.dispatchEvent(new Event('training-update')); }
    return true;
  };
  const register = () => registrationPromise ??= navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then(registration => {
    const observe = () => {
      const worker = registration.installing;
      if (!worker || observedWorker === worker) return;
      observedWorker = worker;
      if (registration.active && worker.state !== 'redundant') {
        window.trainingUpdateDownloading = true;
        window.dispatchEvent(new Event('training-update-downloading'));
      }
      const changed = () => {
        // Sur certains navigateurs, waiting est affecté après statechange.
        if (worker.state === 'installed') { setTimeout(() => ready(registration), 0); setTimeout(() => ready(registration), 100); }
        if (worker.state === 'redundant') { window.trainingUpdateDownloading = false; window.dispatchEvent(new Event('training-update-failed')); }
      };
      worker.addEventListener('statechange', changed); changed();
    };
    ready(registration); observe(); registration.addEventListener('updatefound', observe);
    return registration;
  }).catch(error => { registrationPromise = undefined; throw error; });
  window.trainingCheckUpdate = () => {
    if (checking) return checking;
    checking = (async () => {
      if (!navigator.onLine) throw new Error('Connecte-toi à Internet pour vérifier.');
      const registration = await register();
      await registration.update();
      const worker = registration.installing;
      if (worker && !['installed', 'activated', 'redundant'].includes(worker.state)) await new Promise((resolve, reject) => {
        const cleanup = () => { clearTimeout(timeout); worker.removeEventListener('statechange', changed); };
        const changed = () => {
          if (['installed', 'activated'].includes(worker.state)) { cleanup(); resolve(); }
          else if (worker.state === 'redundant') { cleanup(); reject(new Error('Téléchargement interrompu. Réessaie.')); }
        };
        const timeout = setTimeout(() => { cleanup(); reject(new Error('Téléchargement en cours. Réessaie dans un instant.')); }, 60_000);
        worker.addEventListener('statechange', changed); changed();
      });
      if (worker && registration.active) for (let attempt = 0; attempt < 5 && !registration.waiting && worker.state !== 'redundant'; attempt++) await new Promise(resolve => setTimeout(resolve, 50));
      return ready(registration) ? 'ready' : 'current';
    })().finally(() => { checking = undefined; });
    return checking;
  };
  const check = () => { if (document.visibilityState === 'visible' && navigator.onLine) window.trainingCheckUpdate().catch(() => {}); };
  register().then(check).catch(() => {});
  window.addEventListener('focus', check); window.addEventListener('online', check);
  window.addEventListener('pageshow', check);
  document.addEventListener('visibilitychange', check);
  setInterval(check, 60_000);
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (requested) window.location.reload(); });
  navigator.storage?.persist?.().catch(() => {});
}

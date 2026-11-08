const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
class Events {
  listeners = new Map();
  addEventListener(name, fn) { if (!this.listeners.has(name)) this.listeners.set(name, new Set()); this.listeners.get(name).add(fn); }
  removeEventListener(name, fn) { this.listeners.get(name)?.delete(fn); }
  dispatchEvent(event) { for (const fn of this.listeners.get(event.type) ?? []) fn(event); }
}
(async () => {
  const registration = Object.assign(new Events(), { active: {}, waiting: null, installing: null, updates: 0, async update() { this.updates++; } });
  const serviceWorker = Object.assign(new Events(), { async register(url, options) { assert.equal(url, '/sw.js'); assert.equal(options.updateViaCache, 'none'); return registration; } });
  let reloads = 0;
  const window = Object.assign(new Events(), { isSecureContext: true, location: { reload() { reloads++; } } });
  const document = Object.assign(new Events(), { visibilityState: 'visible' });
  const navigator = { serviceWorker, onLine: true, storage: { persist: async () => true } };
  let downloadNotifications = 0; window.addEventListener('training-update-downloading', () => { downloadNotifications++; });
  let notifications = 0; window.addEventListener('training-update', () => { notifications++; });
  const intervals = [];
  vm.runInNewContext(fs.readFileSync('public/pwa-register.js', 'utf8'), { window, document, navigator, Event, setTimeout, clearTimeout, setInterval: fn => intervals.push(fn) });
  await new Promise(resolve => setImmediate(resolve));
  assert.ok(registration.updates > 0, 'vérification déclenchée au lancement sans clic');
  assert.equal(await window.trainingCheckUpdate(), 'current');
  const first = registration.updates;
  window.dispatchEvent(new Event('focus')); await new Promise(resolve => setImmediate(resolve));
  assert.ok(registration.updates > first, 'vérifier à chaque retour dans l’application');
  let activated = 0;
  registration.waiting = { postMessage(message) { assert.equal(message.type, 'ACTIVATE'); activated++; } };
  assert.equal(await window.trainingCheckUpdate(), 'ready', 'bouton manuel détecte une version en attente, même sans controller');
  assert.equal(activated, 0, 'jamais de changement de version sans demande');
  window.trainingUpdate(); assert.equal(activated, 1);
  serviceWorker.dispatchEvent(new Event('controllerchange')); assert.equal(reloads, 1);
  registration.waiting = null;
  const worker = Object.assign(new Events(), { state: 'installing' }); registration.installing = worker;
  const pending = window.trainingCheckUpdate();
  await new Promise(resolve => setImmediate(resolve));
  registration.waiting = { postMessage() {} }; registration.installing = null; worker.state = 'installed'; worker.dispatchEvent(new Event('statechange'));
  assert.equal(await pending, 'ready', 'attendre le téléchargement avant d’annoncer une application à jour');
  const priorNotifications = notifications;
  registration.waiting = null;
  const delayedWorker = Object.assign(new Events(), { state: 'installing' }); registration.installing = delayedWorker;
  registration.dispatchEvent(new Event('updatefound'));
  assert.ok(downloadNotifications > 0, 'annoncer dès le début du téléchargement');
  assert.equal(window.trainingUpdateDownloading, true);
  delayedWorker.state = 'installed'; delayedWorker.dispatchEvent(new Event('statechange'));
  setTimeout(() => { registration.waiting = { postMessage() {} }; registration.installing = null; }, 20);
  await new Promise(resolve => setTimeout(resolve, 150));
  assert.equal(window.trainingUpdateDownloading, false);
  assert.ok(notifications > priorNotifications, 'notification automatique même si waiting arrive après statechange, sans vérification manuelle');
  const stableNotifications = notifications;
  await window.trainingCheckUpdate(); await window.trainingCheckUpdate();
  assert.equal(notifications, stableNotifications, 'une même version ne réaffiche pas le message à chaque contrôle');
  window.dispatchEvent(new Event('pageshow')); await new Promise(resolve => setImmediate(resolve));
  navigator.onLine = false;
  await assert.rejects(window.trainingCheckUpdate(), /Internet/);
  const before = registration.updates; document.visibilityState = 'hidden'; intervals[0]();
  assert.equal(registration.updates, before, 'pas de vérifications périodiques en arrière-plan');
  let registrationAttempts = 0;
  const retryRegistration = Object.assign(new Events(), { active: {}, waiting: null, installing: null, async update() {} });
  const retryWorker = Object.assign(new Events(), { async register() { if (++registrationAttempts === 1) throw new Error('network'); return retryRegistration; } });
  const retryWindow = Object.assign(new Events(), { isSecureContext: true, location: { reload() {} } });
  const retryNavigator = { serviceWorker: retryWorker, onLine: true };
  vm.runInNewContext(fs.readFileSync('public/pwa-register.js', 'utf8'), { window: retryWindow, document, navigator: retryNavigator, Event, setTimeout, clearTimeout, setInterval() {} });
  await new Promise(resolve => setImmediate(resolve));
  document.visibilityState = 'visible'; retryWindow.dispatchEvent(new Event('online'));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(registrationAttempts, 2, 'réessayer automatiquement après un échec au démarrage');
  console.log('OK mises à jour : vérification manuelle, retour au premier plan, téléchargement attendu, installation volontaire, hors connexion.');
})().catch(error => { console.error(error); process.exitCode = 1; });

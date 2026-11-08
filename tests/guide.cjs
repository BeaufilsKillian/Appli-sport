const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

(async () => {
  const html = fs.readFileSync('public/guide/index.html', 'utf8');
  const metadata = JSON.parse(fs.readFileSync('public/guide/metadata.json', 'utf8'));
  assert.equal(metadata.revision, 'mobile-20261028');
  assert.ok(metadata.steps['save-plan'], 'défilement jusqu’au bouton Enregistrer illustré');
  for (const [id, step] of Object.entries(metadata.steps)) {
    if (!['share-modal', 'update'].includes(id)) {
      assert.equal(step.width, 390, 'capture mobile à proportions conservées : ' + id);
      assert.equal(step.height, 844, 'capture mobile entière : ' + id);
    }
    assert.ok(html.includes(step.src));
    for (const [x, y, w, h] of step.highlights) {
      assert.ok(x >= 0 && y >= 0 && x + w <= step.width && y + h <= step.height, 'repère dans la capture : ' + id);
    }
  }
  assert.ok(!html.includes('schémas indicatifs'), 'les faux menus ne sont plus présentés comme tutoriel visuel');
  assert.ok(!/\ssrc=/.test(html.match(/<video\b[^>]*>/)[0]), 'aucune URL vidéo chargée avant un geste');
  assert.ok(html.includes('preload="none"'));
  assert.ok(!html.includes('/api/config') && !html.includes('pwa-register.js'), 'le guide ne démarre ni compte ni synchronisation');
  for (const file of [metadata.pdf, metadata.video, metadata.poster, metadata.social, ...metadata.pages]) {
    assert.ok(fs.statSync('public' + file).size > 0, `fichier public présent : ${file}`);
  }
  const video = {
    dataset: { src: metadata.video }, hidden: true, src: '', plays: 0,
    getAttribute(name) { return this[name]; }, focus() {},
    async play() { this.plays++; }, addEventListener() {},
  };
  const start = { hidden: false, addEventListener(event, listener) { this.click = listener; } };
  const status = { textContent: '' };
  const elements = { '#play-presentation': start, '#presentation': video, '#video-status': status };
  vm.runInNewContext(fs.readFileSync('public/guide/guide.js', 'utf8'), { document: { querySelector: selector => elements[selector] ?? null } });
  assert.equal(video.src, '', 'visiter la page ne charge pas la vidéo');
  await start.click();
  assert.equal(video.src, metadata.video); assert.equal(video.plays, 1);
  assert.equal(video.hidden, false); assert.equal(start.hidden, true);
  video.play = async () => { throw Error('lecteur intégré'); };
  await start.click(); assert.match(status.textContent, /Lecture/);

  // Une visite du guide ne doit pas être remplacée par l'app en cache.
  const listeners = {};
  const worker = fs.readFileSync('dist/sw.js', 'utf8');
  vm.runInNewContext(worker, {
    URL, self: { location: { origin: 'https://example.test' }, addEventListener: (name, fn) => { listeners[name] = fn; } },
    caches: { open: async () => ({ match: async () => 'application' }) }, fetch() { throw Error('réseau inattendu'); },
  });
  for (const pathname of ['/guide', '/guide/', '/guide/index.html', metadata.video, metadata.pdf, '/api/guide']) {
    let intercepted = false;
    listeners.fetch({ request: { url: 'https://example.test' + pathname, method: 'GET', mode: 'navigate' }, respondWith() { intercepted = true; } });
    assert.equal(intercepted, false, `guide hors service worker : ${pathname}`);
  }
  let app;
  listeners.fetch({ request: { url: 'https://example.test/', method: 'GET', mode: 'navigate' }, respondWith(value) { app = value; } });
  assert.equal(await app, 'application', 'le fonctionnement hors connexion de l’app est conservé');
  const media = JSON.parse(fs.readFileSync('dist/offline-media.json', 'utf8'));
  assert.ok(!media.some(file => file.startsWith('/guide/')));
  const core = JSON.parse(worker.match(/const CORE = (\[[^;]+\]);/)[1]);
  assert.ok(!core.some(file => file.startsWith('/guide/')), 'ni vidéo ni guide dans les téléchargements de l’app');
  console.log('OK guide : vidéo sur clic, fichiers présents, aucun chargement Neon, guide exclu du cache PWA et des animations.');
})().catch(error => { console.error(error); process.exitCode = 1; });

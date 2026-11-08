import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { prepareMedia } from './prepare-media.mjs';
await prepareMedia();
const root = process.cwd();
fs.mkdirSync('public', { recursive: true });
fs.copyFileSync('node_modules/sql.js/dist/sql-wasm-browser.wasm', 'public/sql-wasm-browser.wasm');
// L'export conserve Expo/React Native Web et l'interface existante.
execFileSync(process.execPath, ['node_modules/expo/bin/cli', 'export', '--platform', 'web'], { stdio: 'inherit', env: { ...process.env, CI: '1' } });
const walk = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(path.join(directory, entry.name)) : [path.join(directory, entry.name)]);
let html = fs.readFileSync('dist/index.html', 'utf8');
html = html.replace('<html lang="en">', '<html lang="fr">').replace('</head>', `<link rel="manifest" href="/manifest.webmanifest"><meta name="theme-color" content="#050709"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="Training Programme"><link rel="apple-touch-icon" href="/icon-192.png"><script src="/pwa-register.js" defer></script></head>`);
fs.writeFileSync('dist/index.html', html);
// Le guide public ne fait partie ni de l'installation hors ligne ni des animations.
// Son PDF et sa vidéo restent téléchargés uniquement à la demande.
const appPaths = () => walk('dist').map(file => '/' + path.relative('dist', file).replaceAll('\\', '/')).filter(file => !file.startsWith('/guide/'));
let paths = appPaths();
const media = paths.filter(file => /\.(gif|webp)$/.test(file));
fs.writeFileSync('dist/offline-media.json', JSON.stringify(media));
paths = appPaths();
const core = paths.filter(file => !(/\.(gif|webp)$/.test(file)) && !file.endsWith('.map') && !file.endsWith('/sw.js'));
const version = crypto.createHash('sha256').update(core.map(file => fs.readFileSync(path.join(root, 'dist', file.slice(1)))).map(buffer => crypto.createHash('sha256').update(buffer).digest('hex')).join('')).digest('hex').slice(0, 16);
let worker = fs.readFileSync('scripts/service-worker.js', 'utf8');
worker = worker.replace('__VERSION__', JSON.stringify(version)).replace('__CORE__', JSON.stringify(core)).replace('__MEDIA__', JSON.stringify(media));
fs.writeFileSync('dist/sw.js', worker);
console.log(`PWA ${version} : ${core.length} fichiers essentiels, ${media.length} animations téléchargeables à la demande.`);

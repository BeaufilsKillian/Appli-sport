import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';

// Publication directe avec le compte CLI autorisé, sans attribuer le déploiement
// à l'auteur d'un ancien commit. Aucun secret local n'est copié dans l'envoi.
if (!process.env.npm_execpath) throw Error('Utiliser npm run deploy:vercel.');
const base = await fs.realpath(os.tmpdir());
const stage = await fs.mkdtemp(path.join(base, 'training-programme-vercel-'));
const allowed = ['App.tsx', 'app.json', 'index.ts', 'package.json', 'package-lock.json', 'tsconfig.json', 'metro.config.cjs', 'vercel.json', '.vercelignore', 'src', 'api', 'server', 'public', 'scripts', 'migrations', 'assets', 'neon.ts'];
try {
  for (const item of allowed) await fs.cp(path.resolve(item), path.join(stage, item), { recursive: true, filter: source => !source.endsWith('.gif') });
  await fs.mkdir(path.join(stage, '.vercel'));
  await fs.copyFile('.vercel/project.json', path.join(stage, '.vercel/project.json'));
  const size = async directory => {
    let bytes = 0;
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      bytes += entry.isDirectory() ? await size(file) : (await fs.stat(file)).size;
    }
    return bytes;
  };
  const bytes = await size(stage);
  // 2 Mo de marge sous les 100 Mo Hobby, y compris les anciens médias du guide
  // conservés pour les liens déjà envoyés.
  if (bytes > 98_000_000) throw Error('Sources trop volumineuses pour le déploiement gratuit.');
  console.log(`Sources préparées : ${(bytes / 1_000_000).toFixed(1)} Mo, sans Git ni secrets locaux.`);
  const code = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [process.env.npm_execpath, 'exec', '--yes', '--package=vercel@65.2.0', '--', 'vercel', 'deploy', '--prod', '--yes', '--scope', 'overblast2', '--cwd', stage], { stdio: 'inherit', windowsHide: true });
    child.on('error', reject); child.on('exit', resolve);
  });
  if (code !== 0) process.exitCode = code || 1;
} finally {
  const resolved = await fs.realpath(stage);
  if (path.dirname(resolved) !== base || !path.basename(resolved).startsWith('training-programme-vercel-')) throw Error('Chemin temporaire inattendu : nettoyage refusé.');
  await fs.rm(resolved, { recursive: true, force: true, maxRetries: 5, retryDelay: 250 })
    .catch(() => console.warn('Dossier temporaire encore verrouillé par Windows ; le résultat du déploiement est conservé.'));
}

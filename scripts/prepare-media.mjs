import fs from 'node:fs/promises';
import crypto from 'node:crypto';

export async function prepareMedia() {
  const manifest = JSON.parse(await fs.readFile(new URL('./media-manifest.json', import.meta.url), 'utf8'));
  for (const item of manifest) {
    if (!/^\d+\.webp$/.test(item.file)) throw Error('Nom de média invalide.');
    const bytes = await fs.readFile(new URL('../assets/exercise-demos/' + item.file, import.meta.url));
    if (crypto.createHash('sha256').update(bytes).digest('hex') !== item.sha256) throw Error('Média modifié : ' + item.file);
  }
  console.log('Animations WebP vérifiées : ' + manifest.length + '. Aucun téléchargement externe nécessaire.');
}

// Vérifier les fichiers présents, pas un indicateur qui pourrait survivre à
// l'éviction du cache ou ignorer de nouvelles animations.
export async function offlineMediaInstalled(): Promise<boolean> {
  if (!('caches' in window)) return false;
  const response = await fetch('/offline-media.json');
  if (!response.ok) throw new Error('Liste des animations indisponible.');
  const media: unknown = await response.json();
  if (!Array.isArray(media) || media.length === 0 || media.some(url => typeof url !== 'string' || !url.startsWith('/') || url.startsWith('//'))) throw new Error('Liste des animations invalide.');
  const cache = await caches.open('training-media-v1');
  const existing = new Set((await cache.keys()).map(request => request.url));
  return media.every(url => existing.has(new URL(url, location.origin).href));
}

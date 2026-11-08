const start = document.querySelector('#play-presentation');
const video = document.querySelector('#presentation');
const videoStatus = document.querySelector('#video-status');
if (start && video) {
  start.addEventListener('click', async () => {
    // Pas de src avant ce geste : même les navigateurs intégrés n'ont rien à précharger.
    if (!video.getAttribute('src')) video.src = video.dataset.src;
    video.hidden = false;
    start.hidden = true;
    video.focus();
    try { await video.play(); }
    catch { videoStatus.textContent = 'Appuie sur Lecture dans le lecteur, ou ouvre la vidéo avec le lien ci-dessous.'; }
  });
  video.addEventListener('error', () => {
    videoStatus.textContent = 'La lecture est indisponible ici. Utilise « Ouvrir la vidéo » ci-dessous.';
  });
}
const copy = document.querySelector('#copy-guide');
const copyStatus = document.querySelector('#copy-status');
copy?.addEventListener('click', async () => {
  const link = document.querySelector('link[rel="canonical"]').href;
  try {
    await navigator.clipboard.writeText(link);
    copyStatus.textContent = 'Lien copié. Tu peux le coller dans ton message.';
  } catch {
    copyStatus.textContent = 'Copie le lien affiché juste au-dessous.';
    document.querySelector('#guide-link').focus();
  }
});

# Page publique de partage

Lien à envoyer : https://training-programme-ten.vercel.app/api/guide
Alias : https://training-programme-ten.vercel.app/guide

Le lien /api/guide est une réécriture Vercel vers un fichier HTML statique, sans fonction serveur ni accès Neon. Il reste accessible aux personnes dont une ancienne version du service worker intercepte toutes les autres navigations. Le guide ne charge ni le JavaScript de l’application, ni son service worker, ni ses API de comptes.

## Contenu

- Présentation et lien vers l’application.
- Vidéo sous-titrée de 72 secondes : aucune URL src dans le lecteur avant le clic sur Lecture ; lien direct de secours.
- Tutoriels visuels sur fond noir, regroupés en rubriques : installation iPhone/Android (schémas), programme, 1RM, performances, partage, sauvegarde et mises à jour. Images agrandissables et chargées paresseusement.
- PDF visuel de 13 pages téléchargé sur demande.
- Bouton Copier le lien et métadonnées pour les aperçus de partage. Aucune intégration sociale ni suivi publicitaire.

## Fichiers et déploiement

Sources : public/guide/index.html, guide.css, guide.js, metadata.json et assets/. Les noms des médias incluent leur empreinte SHA-256 ; cache long pour les fichiers versionnés. Le HTML doit rester revalidé. Les menus d’installation sont signalés comme schémas indicatifs.

Le build exclut /guide/ des listes CORE et MEDIA : aucun téléchargement supplémentaire lors de l’installation de l’application ou des animations. Le service worker laisse passer /guide et /guide/* ; les API étaient déjà exclues.

Pour actualiser un document ou une vidéo, créer un nouveau nom avec empreinte, mettre à jour metadata.json et toutes les références HTML, puis lancer la validation et le déploiement. Conserver les anciens médias tant qu’une page mise en cache peut les référencer.

Validation : npm run typecheck ; npm run lint ; npm run build ; node tests/guide.cjs ; npm run test:sync ; npm run test:pwa. Puis vérifier le lien public, la lecture vidéo après clic, le PDF et une rubrique en format mobile.

## Validation en production - 28 octobre 2026

Déploiement dpl_3WmQ9BH7tYYhxHUakAMHYHR4KJys, alias de production confirmé. Réponses HTTP 200 pour /api/guide, /guide, PDF, vidéo et image de tutoriel ; les deux documents servis correspondent octet pour octet aux fichiers locaux. La vidéo répond aux requêtes Range en 206. Lecture réelle vérifiée dans le navigateur (72 s, readyState 4), src absent avant le clic, bouton de copie confirmé. Vue mobile 390 x 844 vérifiée sans débordement horizontal ; rubriques dépliables et images agrandissables. Typecheck, lint, build, guide.cjs, test:sync et test:pwa réussis. Sources déployées : 94,7 Mo, sous le plafond du script de publication gratuit.

## Correction de fidélité du tutoriel

Les pages entières du PDF ne sont plus utilisées comme vignettes du tutoriel web. Chaque étape contient une capture réelle au format 390 x 844, à proportions conservées, avec des cadres HTML superposés sur les champs et boutons. Le compte, le partage et le message de mise à jour ont été vérifiés dans le déploiement public. Les fenêtres partage/mise à jour sont recadrées sur le dialogue pour ne publier aucune donnée de compte en arrière-plan. Aucune série ni séance réelle n’a été modifiée ; les performances d’exemple viennent uniquement de l’aperçu local.

Les faux menus Safari/Chrome sont supprimés : consignes textuelles vérifiées et liens vers les aides officielles. Le PDF de 13 pages reprend ces mêmes captures mobiles et inclut le défilement jusqu’à Enregistrer les objectifs. metadata.json contient les dimensions, libellés, repères et identifiants des étapes. Les anciens fichiers publiés restent disponibles pour les liens déjà diffusés ; la limite de préparation des sources est de 98 Mo, en conservant 2 Mo de marge sous les 100 Mo Hobby.

Validation de la correction : déploiement dpl_5NBffUPpDCLmzuaeFAqtoQGHY1qZ Ready, alias public actualisé. Les captures dossier, 1RM et performances, la feuille de style versionnée et le PDF répondent en HTTP 200 et correspondent aux fichiers sources. Contrôle public à 390 x 844 : pas de débordement horizontal, images natives 390 x 844, vrais boutons encadrés. Le PDF est vérifié visuellement et fait 1,15 Mo. Typecheck, lint, build et tests/guide.cjs réussis. Sources publiées : 96,3 Mo.

# PASSATION — Training Programme

État arrêté au **29 octobre 2026**, Europe/Paris. Ce document décrit le travail déjà réalisé, sans secrets. Les prochaines modifications doivent suivre la nouvelle demande de l’utilisateur.

## 1. Reprise rapide : éviter la relecture de tout l’historique

- Application de musculation Expo/React Native, maintenant diffusée en **PWA indépendante du PC**, hébergée sur Vercel avec comptes et sauvegardes Neon.
- **Vraie racine du code :** `C:\Users\killi\OneDrive\Documents\appli_sport\training-programme`.
- Le dossier de chat `C:\Users\killi\OneDrive\Documents\ChatGPT\appli sport` contient notamment les scripts/livrables du guide, **pas la racine du code**.
- Application : https://training-programme-ten.vercel.app/
- Lien unique à envoyer sur Instagram/Snapchat : https://training-programme-ten.vercel.app/api/guide
- Dernière publication : **dpl_6VWMR4J16Yw2fTg6WvweoymxiQnE**, état READY, alias de production confirmé. URL technique : https://training-programme-l38k13q5k-overblast2.vercel.app/
- Dernier build local : **PWA 3449f7d624c8169e**, 166 fichiers essentiels, 155 animations facultatives.
- Dernière fonctionnalité livrée : comptes obligatoires soumis à acceptation, administration propriétaire avec mot de passe secondaire, badge/notifications, autorisation Internet renouvelable de 24 h.
- Administrateur : **killianbeaufils378@gmail.com**, identité Neon existante épinglée côté serveur ; l’adresse seule ne donne pas les droits.
- Mot de passe secondaire **déjà configuré**. Ne pas le demander à nouveau pour simplement reprendre le projet, le recopier dans une passation, le frontend ou les logs. Son dérivé est dans la configuration serveur.
- Secrets existants dans `.env.local` ignoré et Vercel Production : ne pas les afficher, régénérer ou réinitialiser sans nécessité.
- Dépôt très modifié : **763 lignes de statut Git** lors du contrôle de passation, fichiers ajoutés et non ajoutés. **Ne pas reset/clean/écraser ou refaire un clone en supposant que Git contient tout.** Aucun commit/push/GitHub n’a été réalisé pour ces publications.
- Lecture minimale du prochain agent : ce document, `AGENTS.md`, puis uniquement les fichiers utiles à la prochaine demande. Pas de relecture systématique du chat ni de toutes les notes historiques.
- La création de cette passation ne demande aucune modification fonctionnelle ni nouveau déploiement.

## 2. Règles utilisateur et travail dans le projet

1. Modifier le projet existant et préserver sa navigation. Ne pas réécrire l’application ou migrer le routeur à cause d’une recommandation générique.
2. Mobile d’abord ; iPhone/Android et PC via la même URL. PWA explicitement choisie à la place d’une publication native payante. Ne pas relancer par défaut un chantier Expo Go/App Store.
3. Vercel et Neon gratuits. Aucun abonnement Apple, domaine payant ou changement d’offre autorisé par défaut. Une estimation de capacité n’est pas une garantie de simultanéité/gratuité.
4. Textes courts dans l’application : supprimer les explications répétitives et le jargon, garder unités, consignes utiles, notes, erreurs et confirmations importantes.
5. L’utilisateur préfère une exécution complète des modifications autorisées, sans confirmations répétitives. Demander seulement une information réellement manquante ou une autorisation effectivement requise. Préserver les données et les règles des outils.
6. Avant chaque demande de vérification sur **iPhone**, générer le QR actuel et l’ouvrir dans VS Code (`AGENTS.md`). Pour la PWA : URL HTTPS de production, pas QR Expo. L’utilisateur a refusé les QR **dans le document de partage**, où un lien cliquable est demandé. Ne pas confondre ces usages.
7. Ne pas envoyer de message à un tiers ou partager sur Instagram/Snapchat à la place de l’utilisateur sans instruction explicite. Le guide fournit un bouton Copier le lien.
8. Ne pas terminer, valider, supprimer ou restaurer une vraie séance pour tester. Préserver les saisies partielles et les données existantes.
9. Suivre `AGENTS.md` : lire les docs de la version Expo avant une modification d’API Expo/RN ; dépendances via `npx expo install` ; typecheck et lint avant livraison.
10. Vérifier les processus/origines avant de lancer ou arrêter un serveur ; éviter les doublons Expo. Un aperçu statique local ne prouve pas le fonctionnement de Neon en production.
11. Windows PowerShell : `npm.cmd`, `npx.cmd`, répertoire explicite. Vérifier le chemin avant toute suppression récursive ; ne jamais afficher `.env.local` ou une chaîne de connexion.
12. Préférence actuelle : **Ponytail lite**, changement minimal mais complet, réutilisation du code existant, pas de dépendance inutile. Réponse courte avec limite/non-vérifié utile en fin. Aucun sous-agent demandé pour cette reprise.

## 3. Fonctionnalités et choix produit déjà réalisés

### Programmes et entraînement

- Dossiers de programmes, modèles de séances, bibliothèque d’exercices, objectifs, consignes, historique/statistiques, calendrier, profil, exercices personnalisés, supersets et dropsets.
- 1RM renseignable par exercice, conservé dans les sauvegardes ; tutoriel visuel dédié.
- Bug de mauvaise séance corrigé : reprise du même modèle uniquement ; changement vers un autre modèle explicite, historique/saisies protégés, transaction et verrou contre double appui. `App.tsx`, `src/db.ts`, `tests/session-switch.cjs`.
- Chronomètre de repos et automatismes retirés à la demande de l’utilisateur. Durées estimées et objectifs de repos conservés.
- Ancienne référence globale `C` supprimée dans `src/ExerciseMotion.tsx`. Diagnostics JSX VS Code corrigés auparavant par redémarrage du service TypeScript, pas par modification arbitraire de tsconfig.

### Répétitions et saisie des performances

- Objectifs : minimum et maximum **facultatifs**. Une seule borne affiche sa valeur ; deux affichent la plage ; aucune affiche seulement les séries. Bornes identiques : 10–10.
- Colonnes `planned_reps_min/max` nullables ; ancien `planned_reps` numérique conservé pour compatibilité. Anciennes valeurs migrées dans le minimum. Sauvegardes schéma 9 ; schéma 8 accepté et normalisé. Duplication/assistant/import compatibles.
- Charge et répétitions modifiables directement dans les cellules, sans ouvrir la grande interface RPE. Détails de série encore accessibles par le numéro ; données RPE existantes conservées.
- Valeurs grisées = **dernière séance terminée de cet exercice**, par numéro/type de série, jamais le record. Pas de recherche d’une séance plus ancienne si la dernière n’a pas cette série. Sans historique : tiret.
- Charge valide >= 0 et répétitions entières > 0 : renseignement des deux valide automatiquement la série.
- Rond : complète les valeurs manquantes à partir du grisé, garde les saisies du jour et valide ; second appui dévalide. Texte « Dernière : … » supprimé.
- Saisies/validation sérialisées et atomiques. Brouillons dans `settings/set_input:<id>`, exclus des réglages éditables du profil ; nettoyés après fin/annulation/suppression de série.
- Code : `src/InlineSetValue.tsx`, `src/setInputs.ts`, `src/setEditing.ts`, `src/db.ts`, `App.tsx`.

### Séances suggérées

- Durée en heures/minutes, affichage 45 min / 1 h 30 / 2 h, pas 120 min. Générateur : **25 min à 3 h**, minutes 0–59.
- Proposition regroupée en blocs musculaires : pectoraux/dos, jambes/subdivisions, épaules, biceps, triceps, avant-bras, abdos en dernier. Ordre interne conservé ; ne pas changer les séances déjà créées.
- `src/planner.ts`, `tests/planner.test.cjs`.

### Animations

- Dessins précédents rejetés. Référence finale demandée : https://www.docteur-fitness.com/exercice-musculation
- 160 correspondances pour **155 animations uniques**. GIF natifs ; WebP animés web haute qualité, environ **83,4 Mo** la bibliothèque. PNG fixes dans les listes, animation en fiche.
- Sans correspondance : accès à la recherche du site, pas d’animation inventée.
- Médias/provenance : `assets/exercise-demos/`, `sources.json` ; sélection native/web dans `src/exerciseDemos.ts` et `.web.ts`.
- Téléchargement hors ligne facultatif. Bouton masqué si les 155 médias sont réellement présents **sur cet appareil** ; réapparaît après éviction/cache incomplet/nouveau média. Pas de drapeau partagé entre comptes.
- Droits de redistribution non établis par la disponibilité publique : ne pas prétendre qu’ils sont acquis.

## 4. Architecture et sauvegardes

- Stack : Expo ~58.0.19, React 19.3.0, React Native 0.88.0, react-native-web ^0.21.4, TypeScript ~6.0.3 ; Node local 24.22.1. Entrée `index.ts`, navigation existante dans `App.tsx`.
- Natif : expo-sqlite. Web : SQL.js + IndexedDB (`src/database.web.tsx`, `src/web/localDatabase.ts`, `src/db.ts`). Transactions sérialisées/atomiques, rollback disque plein, verrou entre fenêtres du même compte, espaces locaux séparés par compte.
- Auth : **Neon Managed Better Auth**, SDK `@neondatabase/auth` 0.7.0-beta et proxy officiel ; ne pas ajouter un second fournisseur.
- Overrides : Zod ^4.6.7 pour les packages Neon ; `better-auth`, `@better-auth/core`, `@better-auth/oauth-provider` tous **1.7.14**, versions installées vérifiées. Pas de `npm audit fix --force` : une correction automatique proposait une rétrogradation Expo incompatible.
- Sauvegardes privées JSON complètes : **10 dernières versions/compte**, limite **2 Mo** (import local 2 000 000 octets), CAS par numéro de révision, conflits refusés plutôt qu’écrasés.
- Synchronisation app ouverte, compte accepté, session valide, Internet : temporisation **1,5 s** après modification, retour réseau/premier plan, contrôle toutes les **20 s** au premier plan.
- Optimisation `knownVersion` : cache mémoire privé au compte ; SQL CASE omet le JSON inchangé dès la sortie PostgreSQL. Nouvelle version = téléchargement complet ; métadonnées/dates continuent d’être envoyées.
- Une copie locale vide peut récupérer le cloud ; copie propre suit une nouvelle version distante. Deux copies modifiées divergentes ne sont pas écrasées. Réunion explicite possible si les enregistrements ne se contredisent pas ; modification concurrente du même élément refusée.
- Restauration/import/réunion protégés pendant séance/formulaire. Absence de cloud ne doit jamais vider le local.
- `src/web/CloudPanel.tsx`, `synchronize.ts`, `backupTransport.ts`, `backupFingerprint.ts` ; validation/export `src/backup.ts` ; serveur `api/backups.ts`, `server/backupStore.ts`.
- Expo Go → PWA : exporter JSON puis importer dans le bon compte PWA accepté. Pas de transfert automatique entre stockages. Import sauvegarde JSON remplace après confirmation ; import dossier partagé ajoute.
- Déconnexion ne supprime pas la copie locale. Statut « Sauvegardé en ligne » important avant fermeture. iOS peut évincer le local ; saisies jamais envoyées non protégées contre cette perte. Dix versions = historique glissant, pas archive quotidienne indépendante. Pas de chiffrement de bout en bout.

## 5. PWA et mises à jour

- Fonctionne sans PC après installation sur écran d’accueil, sous réserve du renouvellement Internet d’accès toutes les 24 h.
- Manifest/icônes dans `public/` ; `scripts/build-pwa.mjs` exporte Expo et génère `dist/sw.js`, caches et `offline-media.json`. `dist` est généré, modifier les sources.
- Cœur séparé des animations `training-media-v1`. Guide/PDF/vidéo exclus de CORE et MEDIA : pas téléchargés à l’installation de l’app.
- Fenêtre centrée automatique au lancement/retour lorsqu’une mise à jour se télécharge ou est prête ; Installer / Plus tard. Pas besoin de clic sur Vérifier. Contrôle également toutes les **60 s** au premier plan.
- Une séance active **ne bloque plus** le message ni l’installation. Attendre file de saisies/persistance, sauvegarder identifiant séance/bloc/retour écran ; reprendre au même endroit après rechargement, sans finir la séance ni valider une saisie partielle.
- Formulaire ouvert/chargement initial restent protégés. Verrous de restauration/sync distante pendant séance distincts : ne pas les retirer pour permettre une mise à jour du code.
- Secours anciens clients : https://training-programme-ten.vercel.app/api/update ; traverse l’ancien SW, sans vider les données ni changer de compte. Ne recharge pas les autres onglets automatiquement.
- Garder la même origine de production pour conserver stockage/cookies.
- Code : `public/pwa-register.js`, `scripts/service-worker.js`, `src/web/UpdatePrompt.tsx`, `src/updateResume.ts`, `src/web/CloudPanel.tsx`, `api/update.ts`.

## 6. Partage de dossier

- Choix validé : **copie indépendante**, pas dossier collaboratif.
- Dossier → Partager ce dossier → Créer un lien → Copier. Destinataire accepté : lien ou Profil → Dossier partagé, aperçu puis Importer une copie. Expéditeur transmet lui-même.
- Jeton aléatoire **32 octets**, stocké haché ; lien **7 jours**, un seul compte destinataire. Réessai pour ce compte ; import idempotent, transactionnel et ajoutant aux données, nouveaux identifiants.
- Transmet dossier, modèles, objectifs min/max, consignes, supersets/dropsets, exercices personnalisés utilisés. **Pas** profil, séances réalisées, statistiques, charges réalisées ni 1RM.
- Révocation possible avant récupération ; copie importée non révocable, modifications indépendantes.
- Pas d’import pendant séance/formulaire. Limites **500 000 caractères/dossier**, **10 liens/7 jours/compte**. Nettoyage des expirés à une prochaine création par ce compte, pas de cron.
- Code : `src/folderSharing.ts`, `src/folderSharingCore.ts`, `src/web/FolderSharing.tsx`, `server/folderSharing.ts`, `server/folderShareStore.ts`, `api/folder-shares.ts` ; migration 002.

## 7. Administration et contrôle d’accès — dernière livraison

### Compte et décisions

- Première visite : inscription ou connexion au compte existant, **pas de fonctionnalités invitées** dans la PWA actuelle.
- Nouveau compte/membre pas encore enregistré dans le contrôle : `pending`, écran d’attente et aucune fonctionnalité/API privée avant acceptation.
- Propriétaire automatiquement approuvé et administrateur : double contrôle serveur **ADMIN_USER_ID + ADMIN_EMAIL**, jamais un rôle fourni par le navigateur.
- Profil → Administration uniquement chez le propriétaire ; chaque ouverture demande le mot de passe secondaire déjà choisi, dérivé scrypt côté serveur.
- Chaque personne affiche seulement son e-mail. Groupes en attente / acceptés / refusés ou retirés.
- Accepter/Refuser : saisir exactement `accepter` ou `refuser`, vérification serveur aussi ; état attendu pour décisions concurrentes. Retrait d’un accepté = `blocked`. Propriétaire non révocable via cette interface.
- Cookie `__Host-training-admin`, opaque, HttpOnly, Secure, SameSite Strict, lié à la session Neon ; **15 min**, fermeture verrouille. Limite en base **5 essais / 15 min**.
- Liste serveur **500 comptes max**, **10 appareils push** conservés pour le propriétaire.

### Notifications

- Compteur sur l’icône Profil en bas à droite et alerte dans l’app, **propriétaire seulement**.
- Web Push réservé à ses abonnements. Activer via **Administration → Activer mes notifications** sur chaque appareil et accepter la permission. Bouton de test après activation.
- iPhone : PWA installée sur l’écran d’accueil, système compatible (Web Push iOS 16.4+), réseau/permission requis. **Réception réelle sur l’iPhone personnel encore non vérifiée** ; l’utilisateur doit activer si ce n’est pas déjà fait.
- Notification système générique sans e-mail sur l’écran verrouillé ; détails seulement dans Administration.
- SW : marqueur appareil `training-admin-device-v1`, effacé à déconnexion ; ignore les push sans marqueur. URL fixe `/?admin=1`. Clic focalise/ouvre Administration **sans recharger une séance existante**.
- Serveur : destinations push HTTPS reconnues uniquement, validation des clés/SSRF ; suppression des endpoints 404/410 ; TTL **1 h**, timeout fournisseur **7 s**.

### Internet toutes les 24 h

- Signifie **Wi-Fi/4G/5G**, pas retaper son mot de passe chaque jour si la session reste valide.
- Bail JWT **ES256, 86 400 secondes fixes**, compte/rôle/version ; issuer `training-programme`, audience `offline-access`. Clé publique seulement dans `src/web/accessPublicKey.ts`.
- Renouvellement après contrôle réussi : lancement, premier plan/réseau ; environ **5 min membre**, **30 s propriétaire**, **15 s attente visible**, ordonnanceur 5 s. Distinct du poll sauvegarde de 20 s.
- Expiration/recul d’horloge : verrou local, **séance/saisies conservées**. Internet et compte accepté : reprise. Message hors ligne avec échéance. Déconnexion supprime le bail local.
- Chaque API privée revérifie l’acceptation dans Neon ; retrait bloque immédiatement les API. Déjà hors ligne : fonctionnement possible jusqu’à l’échéance du dernier bail, au plus 24 h.
- Ancien client en cache doit mettre à jour pour le verrou local ; API privées déjà protégées. Aucune promesse de verrouillage rétroactif d’une ancienne app jamais reconnectée.
- Pas de garantie contre modification volontaire du code/stockage local ; exports/copies acquis non effaçables à distance.

### Fichiers et tables

- `api/access.ts` : état, admin, unlock/lock, décisions, abonnements/test push.
- `api/auth.ts` : proxy Neon, demande créée depuis identité obtenue de Neon.
- `server/security.ts` : `requireIdentity` authentifie ; `requireUser` exige aussi statut approuvé pour sauvegardes/partage.
- `server/accessStore.ts` : SQL, états/compteur/décisions, sessions secondaires, essais/push. `server/accessPolicy.ts` : scrypt, baux et push.
- `src/web/Access.tsx`, `AccessLogin.tsx`, `AdminPanel.tsx`, `accessLease.ts`, `session.tsx` ; intégration `src/PlatformShell.web.tsx`, badge `App.tsx`.
- Migration 003 : `training_access`, `training_admin_sessions`, `training_admin_attempts`, `training_admin_push`, RLS/retrait droits PUBLIC.
- App principale déjà chargée conservée mais cachée/inert au verrouillage pour ne pas perdre les saisies ; jamais montée pour une première demande non acceptée.

## 8. Infrastructure et configuration existante

### Vercel

- Scope **overblast2**, projet **training-programme**, liaison `.vercel/project.json`.
- Framework Other (`null`), install **npm ci**, build **npm run build:pwa**, sortie **dist**, fonctions Node **30 s max**.
- CLI **65.2.0**, publication directe sans GitHub ni attribution à un ancien auteur de commit.
- `scripts/deploy-vercel.mjs` copie les sources autorisées en staging temporaire, exclut Git/secrets locaux/.expo/node_modules/GIF natifs. Déploie en production puis nettoie après vérification du chemin.
- Plafond script **98 000 000 octets**, marge sous 100 Mo de sources Hobby ; dernier envoi **96,4 Mo**. Attention aux doublons de PDF/vidéo.
- Secrets **Production** ; ne pas les donner arbitrairement aux Preview. Uploader seulement dist oublierait les fonctions API.
- API no-store/private, SW/index revalidés, médias guide hachés immutable. CSP même origine, anti-iframe, caméra/micro/géolocalisation désactivés par Permissions-Policy ; voir `vercel.json` avant d’ajouter un service externe.
- Réécritures Auth vers `api/auth.ts` ; /guide et /api/guide vers HTML statique.

### Neon

- Projet **lively-snow-79737068**, organisation d’initialisation **org-cool-bird-48850458**.
- Branche **production**, ID **br-dawn-sea-za3hfklo** au dernier contrôle.
- PostgreSQL/Auth actifs, domaine de production autorisé. CLI authentifiée lors des travaux ; session susceptible d’expirer entre les chats.
- Migrations **001, 002, 003 déjà appliquées**. Ne pas refaire l’initialisation ; changements de schéma à tester d’abord sur branche isolée.
- Tables : `training_heads`, `training_backups`, `training_folder_shares`, quatre tables d’accès. Identités/sessions dans `neon_auth`. RLS et absence de droits PUBLIC ; pas de Data API publique.
- Branche de test accès **br-small-poetry-za4ih2zo / codex-access-control-20261029 supprimée**. Compte technique production et demande supprimés ; serveur fixture local **4203 arrêté**. Ne pas supposer ces fixtures encore présentes.

### Variables, sans secrets

| Nom | Usage |
| --- | --- |
| DATABASE_URL | SQL applicatif serveur |
| DATABASE_URL_UNPOOLED | connexion directe migrations |
| NEON_AUTH_BASE_URL | service Auth de la même branche |
| NEON_AUTH_COOKIE_SECRET | secret proxy/cookies |
| APP_ORIGIN | https://training-programme-ten.vercel.app |
| ADMIN_EMAIL | propriétaire indiqué plus haut |
| ADMIN_USER_ID | identifiant réel propriétaire épinglé |
| ADMIN_PASSWORD_HASH | dérivé scrypt existant |
| ACCESS_LEASE_PRIVATE_JWK | signature ES256 privée |
| ADMIN_VAPID_PUBLIC_KEY / ADMIN_VAPID_PRIVATE_KEY | paire Web Push |

Autres noms locaux : `NEON_AUTH_JWKS_URL`, `NEON_BRANCH`, `VERCEL_OIDC_TOKEN` ; ne pas recopier leurs valeurs. `.env.example` = exemples seulement. Aucun préfixe EXPO_PUBLIC_ pour un secret.

`scripts/setup-access.mjs` **déjà exécuté** : compte épinglé, mot de passe reçu via stdin, hash et clés enregistrés. Ne pas relancer automatiquement : réécrit la configuration du mot de passe. `scripts/configure-access-env.mjs` a déjà envoyé les six variables admin à Vercel Production via stdin. Rotation clé ES256 = coordonner clé publique embarquée/baux ; rotation VAPID affecte les abonnements.

## 9. Guide public, PDF et vidéo

- Demandes : fond noir, tuto **visuel fidèle aux vrais écrans**, vidéo sans ancienne dernière slide, création de programme mise en avant, saisie RM, **pas de QR dans le kit**.
- /api/guide = HTML statique sans Neon/compte/sync/SW de l’app, traverse les anciens SW interceptant les autres pages. Alias /guide.
- Vidéo **72 s**, src ajouté seulement après clic, `preload=none`. Pas de téléchargement vidéo automatique à la visite.
- Web : **21 étapes**, captures réelles **390 × 844**, cadres HTML ; dialogues sensibles recadrés. Faux menus Safari/Chrome supprimés au profit de consignes et aides officielles.
- PDF noir **13 pages, ~1,15 Mo**, mêmes captures mobiles, téléchargé sur demande.
- Sources : `public/guide/index.html`, `guide.css`, `guide.js`, `metadata.json`, `assets/`. Révision **mobile-20261028**.
- PDF actuel `/guide/assets/guide-mobile-ecb9f594f3.pdf`, vidéo `/guide/assets/presentation-9f7eb117ab.mp4` ; lire metadata.json avant édition plutôt que figer les noms.
- Médias hachés/versionnés ; conserver anciens fichiers publiés pour liens/caches, éviter brouillons doublons jamais publiés.
- Script fidèle : `C:\Users\killi\OneDrive\Documents\ChatGPT\appli sport\tmp\rebuild_faithful_guide.py`, captures `tmp\guide\mobile`.
- **Ne pas relancer aveuglément** les anciens `create_public_guide.py` / `create_visual_guide.py` : ils risquent de remettre anciens écrans ou vignettes de pages PDF.
- Livrables : `C:\Users\killi\OneDrive\Documents\ChatGPT\appli sport\output\guide` : `Training-Programme-Guide.pdf`, `Training-Programme-Guide-avec-video.html`, `Training-Programme-Presentation.mp4`, `Training-Programme-Kit.zip`.
- **À actualiser si demandé :** la correction visuelle précède l’inscription obligatoire/administration. Texte d’installation et introduction web actualisés le 29/10, mais certaines captures compte et PDF/vidéo peuvent encore montrer le parcours précédent. Ne pas annoncer une refonte de ces supports comme déjà faite.
- `tests/guide.cjs` vérifie présence/géométrie, lecture vidéo sur clic, exclusion du SW/Neon ; pas à lui seul la fidélité éditoriale de chaque capture. Modifier PDF implique rendu/inspection via skill PDF.

## 10. Commandes et outils

Depuis **le vrai projet**, PowerShell :

```powershell
Set-Location -LiteralPath 'C:\Users\killi\OneDrive\Documents\appli_sport\training-programme'
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run test:pwa
npm.cmd run test:sync
npm.cmd run test:sets
npm.cmd run test:sharing
npm.cmd run test:access
node tests/guide.cjs
npm.cmd run build
npm.cmd run deploy:vercel
```

- Choisir les tests adaptés à la modification ; pas de répétitions sans changement/risque nouveau. Typecheck/lint requis, build avant publication.
- `npm.cmd run preview:pwa` = aperçu local, pas preuve des API Neon réelles. Lire les options du script au besoin.
- `npm.cmd start` / `npx.cmd expo start` uniquement si natif demandé. Ancien tunnel 8082, ne pas supposer encore actif.
- Logs/captures `.expo/` ignoré ; `dist/` généré. Ne pas publier un suffixe de test modifié seulement dans dist/sw.js.
- **test:access:neon** requiert une **nouvelle branche isolée** et `.expo/.env.access-test` ; fichier supprimé après nettoyage. Le test refuse la production. Fixtures pendantes peuvent fausser le compteur : nettoyer seulement ses comptes techniques vérifiés.
- Anciens E2E `scripts/test-live.mjs`/tests live sync-partage supposent une inscription immédiatement utilisable : **adapter au parcours d’acceptation**, ne pas désactiver la sécurité pour les faire passer.
- Migration : `node scripts/migrate-neon.mjs --env CHEMIN_ENV_TEST` (001), ajouter `--folder-shares` (002) ou `--access` (003). Pas besoin de les rejouer en production à la reprise.
- CLI Neon : `npx.cmd neon@latest …`, utilisateurs sous **neon-auth user** ; `auth` est alias de login. Vérifier --help avant opération, ne pas imprimer les connexions.
- Vercel 65 : env via `--environment production` ; publication par script staging existant.
- VS Code : `C:\Users\killi\AppData\Local\Programs\Microsoft VS Code\bin\code.cmd`.
- Python documents : `C:\Users\killi\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe`, ReportLab/Pillow/pypdf disponibles. Runtime retrouvable par outil de dépendances workspace ; lire le skill PDF/documents pour une édition.
- Navigateur : CUA documenté, initialiser dans le **nouveau chat** ; ne pas supposer variables/onglets d’un ancien chat disponibles. Après compaction même session, réécrire la documentation. Restaurer viewport après tests. Préférer CLI/connecteur dédié quand suffisant ; pas d’extraction de cookies/secrets via evaluate.

## 11. Validations réellement réalisées

- Dernière livraison : typecheck, lint, build réussis ; trois packages Better Auth 1.7.14 confirmés.
- `test:access` : signature/compte/rôle, durée fixe/échéance 24 h/horloge ; SW propriétaire seul, badge/déconnexion/URL fixe, pas de rechargement séance au clic push.
- `test:access:neon` sur branche réelle isolée : attente sans API, propriétaire unique, cookie secondaire lié session, confirmation, acceptation/retrait, essais limités, RLS, validation push. Transport push simulé, pas preuve matérielle.
- `test:pwa` réussi ; régressions/sync/partage validés pendant l’implémentation. Ne pas transformer cela en garantie pour de futures modifications.
- Fichiers publics du build contrôlés : pas de clé privée, hash de mot de passe, secret de cookie ni DATABASE_URL.
- UI mobile locale : inscription, attente, badge/confirmation, accepté sans admin ; expiration/renouvellement avec charge partielle **25**, répétitions vides, **0 série validée**, saisie conservée.
- Production : inscription/session/déconnexion/reconnexion Neon ; pending, bail null, sauvegardes/partage/admin refusés. Approbation technique du seul compte synthétique → bail signé et sauvegarde autorisée ; retrait → 403/bail null.
- UI propriétaire production : mise à jour installée sans terminer la vraie séance **Gg, 0 série enregistrée** ; entrée admin, mot de passe, e-mail seul, compteur, refus tapé `refuser` enregistré.
- Compte technique/demande et branche isolée supprimés, fixture arrêtée. Aucune séance réelle volontairement validée/terminée pour tester.
- Contrôles finaux : `/api/access` 401, `/api/backups` 401 anonymes ; `/api/guide` et `/` 200.
- Capture `.expo/administration-production.png` : demande synthétique supprimée depuis. Autres captures dans .expo ; certains profils sont privés, ne pas republier sans examen.

## 12. Limites et points à ne pas oublier

1. Web Push sur l’iPhone personnel : permission/activation et essai matériel encore nécessaires ; tests serveur/VM ne prouvent pas la réception réelle.
2. Livraison e-mails Neon vérification/récupération et SMTP personnalisé non validés. Mot de passe sans vérification e-mail obligatoire au dernier état connu ; approbation manuelle désormais requise.
3. Ancien ExpoAsset natif : dépendances alignées/expo-doctor passé auparavant, pas de confirmation matérielle native. Pas le parcours PWA actuel.
4. Pas de test de charge réel ni garantie de capacité/gratuité. `ESTIMATION_CAPACITE.md` = calculs datés, quotas/prix à revérifier si nouvelle estimation demandée.
5. Scénario demandé : animations installées, **5 séances de 2 h/semaine/personne**, ~43,33 h/mois. Ancienne cible prudente gratuite **30–40 utilisateurs réguliers**, pas garantie de simultanéité. Calculs antérieurs aux nouveaux appels de contrôle d’accès, à réviser avant promesse. Éveil Neon étalé toute la journée peut épuiser le gratuit.
6. Animations/guide servis par Vercel, pas stockés dans Neon. ~83,4 Mo/appareil initialement ; second appareil/réinstallation/éviction peuvent retélécharger. PDF/vidéo pas imposés à l’installation.
7. iOS local non garanti, sauvegarde automatique app ouverte/connectée, pas archive externe quotidienne ni chiffrement de bout en bout.
8. Signalements npm audit restants sur outillage/dépendances après correctifs critiques Better Auth : ne pas annoncer zéro vulnérabilité, ne pas rétrograder Expo automatiquement.
9. Droits des animations à clarifier avant diffusion élargie/commerciale. Aucun changement d’offre payante effectué.
10. Sources Vercel proches du plafond : éviter plusieurs copies vidéo. Guide sans Neon consomme quand même le transfert Vercel à la consultation.
11. Retrait d’accès ne récupère pas un export et ne neutralise pas rétroactivement un ancien client hors ligne/modifié. Décrire la fenêtre 24 h honnêtement.
12. Certaines captures de connexion/PDF/vidéo restent à actualiser après inscription obligatoire ; cela n’a pas été fait pendant la fonctionnalité d’administration.

## 13. Notes secondaires et contradictions historiques

Consulter seulement si utile :
- `AGENTS.md` : règles locales.
- `CONTROLE_ACCES.md` : politique actuelle accès/notifications.
- `VERIFICATIONS_DEPLOIEMENT.md` : preuves, dernière section en bas.
- `ETAT_PROJET.md` : historique, premières sections dépassées par les suivantes.
- `DEPLOIEMENT_PWA.md` : anciennes procédures ; **mode invité, mise à jour bloquée pendant séance et absence de contrôle d’accès y sont des mentions obsolètes**.
- `GUIDE_PARTAGE.md` : anciennes mentions de schémas remplacées par la section de correction fidèle.
- `ESTIMATION_CAPACITE.md` : estimations, pas engagement tarifaire actuel.

En cas de contradiction, vérifier le code actuel et la dernière validation ; pour les choix produit suivre la dernière instruction humaine. Ne pas traiter un test/objectif historique comme une nouvelle demande.

## 14. Message court à coller dans le nouveau chat

> Reprends mon application Training Programme en lisant PASSATION_TRAINING_PROGRAMME_2026-10-29.md joint, puis AGENTS.md dans le vrai projet : C:\Users\killi\OneDrive\Documents\appli_sport\training-programme. Évite de relire tout l’historique ; ouvre seulement les fichiers utiles à ma prochaine demande. La PWA est déjà publiée sur https://training-programme-ten.vercel.app/, avec Vercel/Neon, sauvegardes et contrôle d’accès administrateur opérationnels. Préserve toutes les modifications locales et données existantes ; ne réinitialise ni secrets ni comptes. Confirme brièvement que tu as retrouvé le projet, puis attends ma prochaine instruction fonctionnelle.

Les secrets et données réelles restent dans leurs emplacements protégés ; cette passation ne les remplace pas.

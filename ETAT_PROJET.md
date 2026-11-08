# État du projet — 26 octobre 2026

- Textes allégés à la demande de l'utilisateur : sous-titres redondants, paragraphes de présentation et explications répétées supprimés ; libellés raccourcis dans séances, assistant, détails, profil et formulaires. Anciennes mentions de schémas SVG supprimées car remplacés par les GIF. Consignes techniques, notes, unités, erreurs et confirmations conservées. TypeScript et suites regressions/v07/v08 passent.

- Séances suggérées : deux champs heures/minutes (0–59 pour les minutes), choix rapides et aperçu au format 45 min / 1 h 30 / 2 h. Limite du générateur conservée : 25 min à 3 h. TypeScript, tests du générateur, v08 et exemples de formatage vérifiés.
- Animations : l'utilisateur a rejeté les dessins, puis demandé les animations de Docteur Fitness. Les SVG et le prototype de squat ont été remplacés par les vrais GIF locaux du site : 160 correspondances, 155 GIF uniques (environ 125 Mo de médias référencés), miniatures PNG fixes dans les listes, animation sur les fiches agrandies selon la largeur d'écran, image initiale et lien vers la source. Les 96 autres exercices affichent un accès à la recherche du site sans animation de substitution. Provenance dans `assets/exercise-demos/sources.json` ; import reproductible dans `scripts/import-docteur-fitness.py`. Vérifications : fichiers GIF/PNG, IDs, variantes et rendu liste/fiche/secours via `tests/exercise-demos.cjs`, TypeScript et six suites locales. Lecture animée native à confirmer sur iPhone.

- Projet utilisé : `C:\Users\killi\OneDrive\Documents\appli_sport\training-programme`, Expo SDK 58.
- Correction précédente : suppression de la référence globale à `C` dans `src/ExerciseMotion.tsx`. Les couleurs restent appliquées dans le composant.
- Changement de séance corrigé dans `App.tsx` et `src/db.ts` : reprise du même modèle uniquement ; autre modèle avec choix explicite, historique conservé si séries validées, deuxième confirmation avant suppression des saisies non validées, transaction exclusive avec rollback et verrou contre double appui. Navigation réinitialisée après lancement réussi ; le chronomètre a depuis été retiré.
- Vérifications : TypeScript et les quatre suites existantes passent ; `node tests/session-switch.cjs` passe (SQLite temporaire en mémoire et gestionnaire UI avec Alert/état simulés). Cela ne remplace pas un essai natif sur iPhone.
- Lint désormais configuré pour l’adaptation PWA : ESLint Expo. Vérifier également App.tsx, api et server explicitement.
- VS Code : les 64 diagnostics JSX ont disparu après redémarrage du service TypeScript, sans modification de tsconfig.
- Tests iPhone : vérifier lancement de Gg pendant Push, annulation/reprise, conservation de Push avec séries validées et confirmation avant remplacement sans série validée.
- Connexion de test : serveur Expo en mode tunnel sur le port 8082 après échec de connexion LAN. Vérifier son état et régénérer le QR dans `.expo/expo-iphone-qr.png`, puis l’ouvrir dans VS Code avant de demander tout essai iPhone.
- Erreur native ExpoAsset précédemment signalée : dépendances alignées et expo-doctor 20/20 ; résolution native sur iPhone non confirmée.

## PWA Vercel + Neon — déployée et vérifiée

- Choix explicite de l’utilisateur : PWA, Vercel et Neon, offres gratuites. L’utilisateur a connecté les deux services et autorisé la suite. Projet Neon existant et nouveau projet Vercel configurés ; aucun push Git. Secrets dans .env.local ignoré et Vercel Production uniquement.
- Web Expo exporté avec manifest, icônes, service worker versionné, mise à jour volontaire, cache du cœur de l’application et téléchargement facultatif des animations WebP hors ligne (GIF natifs conservés). Chronomètre/automatisme de repos retirés ; durées des séances et objectifs de repos conservés.
- Adaptateur web SQL.js + IndexedDB, commits persistants atomiques, file de transactions, verrou entre fenêtres, séparation locale par compte. SQLite natif conservé. Import JSON validé avant remplacement, export web et confirmations adaptées.
- API Vercel Auth avec proxy officiel Neon, sessions vérifiées côté serveur, origines contrôlées, secrets serveur uniquement. API de sauvegardes par utilisateur, contrôle de version atomique, dix dernières copies, limite JSON 2 Mo. Schéma dans migrations/001_backups.sql.
- Tests : TypeScript, lint App/src/api/server et les six suites existantes passent. tests/pwa.cjs valide persistance, rollback disque plein, isolation des transactions/comptes, import, conflits, requêtes PostgreSQL réelles en PGlite, rétention, refus API non authentifié/mauvais compte/origine et adaptation proxy Auth.
- Navigateur local : démarrage, création d’un dossier, accès Profil, puis rechargement serveur arrêté réussi avec le dossier conservé. Aperçu sur origine de test locale distincte, sans toucher aux données Expo Go. Construction de production vérifiée.
- Migration, activation Auth, secrets et déploiement HTTPS effectués. Inscription, session, déconnexion/reconnexion, versions, refus d’accès et sauvegarde automatique réelle vérifiés. Restent installation Safari sur iPhone et livraison des e-mails. Guide DEPLOIEMENT_PWA.md. Transfert initial Expo Go → export JSON → import après connexion dans la PWA.
- Limites explicites : synchronisation lorsque l’application est ouverte et connectée ; pas de fusion automatique entre appareils, pas de chiffrement de bout en bout, stockage local iOS non garanti. Sauvegardes glissantes, pas archives quotidiennes indépendantes. Audit restant sur node-forge de l’outillage Expo décrit dans le guide ; aucune rétrogradation forcée.

- Contrôle supplémentaire : bouton Installer la mise à jour testé dans le navigateur local, rechargement volontaire réussi, dossier de test conservé, aucune erreur console. npm ci --dry-run valide le verrou des dépendances. Dernier export PWA : 04f8f79fc90dde85.

## Publication du 26 octobre 2026

- URL définitive : https://training-programme-ten.vercel.app ; Vercel Ready, dpl_AymKU9uDhyaYNSxTjdcUtyST6pMh. Neon production sur lively-snow-79737068. Rapport : VERIFICATIONS_DEPLOIEMENT.md.
- Module serveur ESM et imports .js nécessaires sur Vercel ; ESLint renommé eslint.config.cjs. `npm run build` ajouté.
- Déploiement direct via `npm run deploy:vercel` : sources sans .git ni secrets, pas d’association GitHub ; contourne l’attribution à un ancien auteur sans changer les autorisations ou l’historique.
- GIF → WebP web qualité 95, 155 animations/83,4 Mo, mêmes dimensions/nombre d’images/durées avec vérification de qualité. Sources déployées 92,7 Mo. Le téléchargement à la construction avait échoué DNS ; la construction est désormais autonome.
- E2E HTTP réels et parcours navigateur passent ; dossier créé dans l’UI retrouvé automatiquement dans PostgreSQL, profil Sauvegardé en ligne. Deux comptes temporaires et leurs sauvegardes supprimés, branche de migration de test supprimée. Aucun transfert des données Expo Go effectué.
- QR HTTPS généré et ouvert dans VS Code : .expo/pwa-iphone-qr.png. L’application publiée est ouverte dans le navigateur de Codex, déconnectée du compte de test.
- Livraisons d’e-mails non vérifiées, SMTP personnalisé non configuré ; inscription par mot de passe sans vérification e-mail obligatoire (défaut Neon). iPhone physique à valider.

## Répétitions minimum / maximum — 26 octobre 2026

- Deux champs facultatifs dans les objectifs d’exercice. Minimum seul : 8 rép. ; maximum seul : 12 rép. ; deux bornes : 8–12 rép. ; aucune borne : séries seulement. Si les bornes sont identiques, les deux sont affichées (10–10).
- Ancienne valeur conservée dans le minimum lors de la migration SQLite. Colonnes planned_reps_min/max nullables, planned_reps numérique conservé pour compatibilité. Duplication et assistant compatibles. Charges/progression utilisent la borne haute si présente ; performances réalisées restent numériques.
- Sauvegardes schéma 9, import/API acceptent les anciennes sauvegardes 8 et les normalisent sans perdre les bornes. Marqueur migration_rep_bounds ajouté aux imports pour éviter une réinitialisation à la réouverture.
- Tests : sept suites incluant tests/rep-bounds.cjs, test:pwa (restauration/réouverture maximum seul), typecheck, lint, build passent. Interface locale vérifiée pour les quatre cas, preuve .expo/repetitions-min-max.png.
- Publié sur https://training-programme-ten.vercel.app ; Vercel Ready dpl_G8vMq1Fz9W99f3MmnXrMARAd4e1C. E2E en ligne --rep-bounds confirme plage et maximum seul conservés dans Neon et anciennes versions. Compte technique et ses sauvegardes supprimés. QR régénéré et ouvert dans VS Code. Pour voir le changement dans une PWA déjà installée : rouvrir, Profil > Installer la mise à jour.


## Optimisation des transferts — 26 octobre 2026

- Les vérifications automatiques conservent leur fréquence de 20 secondes lorsque l’application est visible. Le client garde la dernière sauvegarde reçue dans un cache mémoire privé au compte et envoie son numéro de version.
- PostgreSQL omet le JSON avec CASE si la version est inchangée : économie dès la sortie de la base, et pas seulement entre Vercel et le navigateur. Les clients plus anciens et la restauration des versions restent compatibles.
- Toute nouvelle version déclenche le transfert complet ; les protections de conflit, les copies locales, les sessions en cours et la séparation des comptes restent actives. Pas de migration ni de changement d’offre.
- Tests locaux : 21 vérifications pour un seul téléchargement, puis modification distante téléchargée ; requêtes PostgreSQL exécutées dans PGlite, validation API et isolation des comptes ; suites synchronisation, PWA et régressions passent.
- TypeScript, lint sans avertissement et construction PWA réussis. Publié : dpl_EEqjXaz7RvKzP5K1KTsJ75zPLKgf, état READY, alias production https://training-programme-ten.vercel.app.
- Vérification HTTP après publication : site 200, code knownVersion présent dans le script effectivement servi, cloud configuré et sauvegardes refusées sans session (401). Aucun compte utilisateur ni données distantes modifiés pour cette vérification. Les scénarios authentifiés et les requêtes conditionnelles ont été validés localement, pas avec deux appareils physiques.


## 27 octobre 2026 — saisie directe et mise à jour

Fenêtre centrée lorsqu’une version PWA est prête : installer / plus tard, reproposée à la prochaine ouverture. Différée pendant chargement, formulaire ou séance active. Charges et répétitions éditables dans les cellules, sauvegarde locale au fil des valeurs valides et écritures sérialisées avec la coche. RPE existant conservé ; détails de série accessibles par son numéro. Tests navigateur : 42,5 kg × 12, validation, rechargement, 510 kg de volume ; installation réelle du service worker sans perte du dossier ni de l’historique de test. Tests de saisie dans tests/inline-sets.cjs ; estimation documentée dans ESTIMATION_CAPACITE.md. Aucun changement d’abonnement.

Récupération PC vérifiée en production le 27 octobre : réunion explicite sans écrasement ; Programme 4j V1 (4 modèles), Test (1 modèle), test1 conservé, historique et séance active du téléphone récupérés. Statut compte : Sauvegardé en ligne. Capture privée .expo/synchronisation-pc-corrigee.png. La séance active empêche volontairement le rechargement pour installation.


## 27 octobre 2026 — performances précédentes en grisé

Aperçu validé par l’utilisateur puis intégré : cases vides avec performances de la dernière séance terminée de l’exercice en placeholder semi-transparent, correspondance par numéro et type de série. Jamais le record ; pas de reprise d’une séance plus ancienne si la dernière ne contient pas cette série. Sans historique : tiret et saisie manuelle. Texte « Dernière : … » supprimé.

Saisie des deux valeurs valides (charge >= 0, répétitions entières > 0) : validation automatique. Rond : recopie des valeurs manquantes depuis la dernière séance, conserve les saisies du jour, puis valide ; second appui dévalide. Frappes, copie et validation sérialisées, modification des performances et brouillon atomiques.

Brouillons des séries actives dans settings/set_input:<id>, compatibles sauvegardes schema 9 ; supprimés après fin/annulation ou suppression de la série. getSettings exclut ces métadonnées pour éviter une réécriture par le profil. Les anciennes séances en cours gardent leurs valeurs numériques déjà présentes. Aucun historique utilisateur remplacé.

Tests : test:sets avec SQLite réelle en mémoire (dernière séance différente d’un record ancien, séries distinctes, copie partielle, auto-validation, absence d’historique, zéro kg, invalides, reprise, export et nettoyage), test, test:pwa, test:sync, typecheck et lint réussis ; build PWA 058d5b0802c00160 local. Test navigateur local sur historique fictif : 42,5 kg × 12 en grisé, rond recopie/valide ; 45 kg seul ne valide pas, ajout de 10 répétitions valide ; effacement et réouverture conservent les placeholders et la série 2 validée. Aucune erreur console. Capture .expo/performances-grisees.png.


## 27 octobre 2026 — installation pendant une séance active

La séance active ne bloque plus le message centré ni le bouton d’installation dans Profil. Un formulaire ouvert ou le chargement initial restent protégés. Le verrou de synchronisation/restauration distante reste actif pendant l’entraînement, séparément de l’installation.

Avant activation : attente de la file des saisies, sauvegarde locale de l’identifiant de séance, du bloc courant et du retour à l’écran d’entraînement, puis attente de la persistance locale. Après rechargement : même séance, même bloc ; marqueur consommé uniquement si l’identifiant actif correspond. Aucune clôture ou validation automatique de série pendant l’installation.

Ajout de /api/update, page d’installation volontaire accessible aux anciens clients qui bloquent encore l’installation pendant une séance. Cette route et son script sont servis sans cache et passent à travers l’ancien service worker qui exclut /api/. Aucun accès aux données, aucun effacement de cache/IndexedDB, aucun changement de compte. L’installation ne recharge pas les autres onglets automatiquement. L’aperçu local réutilise le même handler pour tester ce parcours.

Tests : TypeScript, lint, régressions, PWA, séries et synchronisation passent ; nouveau tests/update-resume.cjs intégré à test:sync. Vérification navigateur avec une séance fictive active : mise à jour depuis l’ancien client via /api/update sans clôture ; puis nouvelle version simulée du service worker local, fenêtre apparue pendant l’exercice, bouton actif, installation et retour direct à l’exercice. Une série à 45 kg × 10 reste validée, une saisie partielle 52,5 kg reste non validée avec répétitions vides. Capture .expo/mise-a-jour-seance-active.png. Version locale de test du service worker modifiée uniquement dans dist ; ce suffixe n’est pas publié.


## 27 octobre 2026 — alerte automatique au lancement et animations installées

Contrôle automatique explicite au montage de l’interface, pageshow, retour au premier plan et contrôle périodique conservé. Notification dès qu’une mise à jour commence à se télécharger ; bouton Installer disponible à la fin. Correction de la course entre statechange=installed et registration.waiting : notification différée et attente bornée, sans clic sur le contrôle manuel. Le même worker n’émet qu’une notification de disponibilité afin de respecter Plus tard pendant l’utilisation ; nouvelle ouverture/retour repropose une mise à jour en attente. L’enregistrement du worker peut être réessayé après un échec réseau au démarrage. L’installation pendant séance conserve le mécanisme de sauvegarde/reprise précédent.

La construction génère offline-media.json avec les chemins réels des 155 animations, inclus dans les fichiers essentiels pour disponibilité hors connexion. Profil compare cette liste aux entrées réelles du cache training-media-v1. Le bouton Télécharger les animations est masqué tant que la bibliothèque est complète, dès la fin du téléchargement et après réouverture. Cache partiel, fichier évincé ou nouvelle animation : téléchargement à nouveau proposé. Pas d’indicateur de compte partagé : installation vérifiée sur cet appareil.

Tests : contrôles automatiques sans clic, disponibilité différée après état installed, notification dès téléchargement, absence de notifications répétées, retry après erreur réseau ; cache vide/partiel/complet, éviction et nouvelle animation. Régressions, séries, synchronisation, reprise de séance, PWA, TypeScript et lint réussis. Vérification navigateur : téléchargement local des 155 animations puis disparition immédiate du bouton ; après rechargement, bouton toujours absent (compteur DOM=0). Capture .expo/animations-installees-bouton-masque.png.


## 27 octobre 2026 — séances suggérées regroupées par muscle

Le générateur conserve sa sélection, ses objectifs, son nombre de séries et son budget temps, puis trie la proposition par groupes contigus : pectoraux/dos, jambes et subdivisions, épaules, biceps, triceps, avant-bras, abdos en dernier. L’ordre interne des exercices de chaque groupe est conservé. L’ordre de sélection des muscles ne dicte plus l’ordre de passage. createSuggestedTemplate enregistre déjà les positions dans cet ordre, sans modifier les séances existantes.

Tests : quatre combinaisons de muscles, quatre objectifs, sélection des abdos en premier, groupes contigus et grands groupes avant les bras, conservation des premiers exercices pectoraux et respect de la durée. TypeScript, lint, suite de régression et build passent. Interface locale : choix Abdos → Biceps → Pectoraux, durée 2 h, proposition de 10 exercices en 1 h 50 ; résultat trois exercices pectoraux puis trois biceps puis quatre abdos. Capture .expo/seance-suggeree-groupes.png. Aucun compte ou entraînement personnel modifié pour ce test.


## 27 octobre 2026 — partage de dossiers par lien

Choix utilisateur : copie indépendante. Bouton Partager ce dossier dans la page du dossier ; lien aléatoire valable sept jours pour un compte destinataire. L’expéditeur l’envoie lui-même et peut annuler un lien inutilisé. Profil permet l’aperçu et l’import d’un lien reçu ; ouvrir un lien positionne l’application sur Profil pour connexion/import. Les copies reçues gardent objectifs min/max, consignes, groupes/supersets/dropsets et exercices personnalisés, avec de nouveaux identifiants. Profil, statistiques, séances réalisées et 1RM exclus. Import transactionnel ajoutant aux données existantes, idempotent en cas de réessai. Import bloqué pendant une séance/formulaire ; une fenêtre de création de lien protège aussi les saisies contre restauration/mise à jour.

Base : migration additive 002_folder_shares.sql, table privée RLS, jetons hachés, vérification serveur session/compte/origine, aperçu sans contenu du programme, récupération atomique par un seul compte, réessai permis à ce compte, révocation uniquement par expéditeur avant récupération, expiration et limite dix liens/sept jours. Aucun changement de politique d’accès à l’application ; ce sujet a été expliqué séparément, notamment les limites hors connexion et la non-révocabilité d’une copie déjà importée.

Vérifications : migration et tests SQL sur branche schema-only br-cold-wave-za5rt4u0 avant application en production. Tests de copie/import avec SQL.js (confidentialité, références, indépendance, réessai, reprise et rollback). Test réel sur Vercel/Neon avec trois comptes techniques : authentification, identité, origine, aperçu, destinataire unique, réessai, copie locale puis sauvegarde cloud indépendante, consignes/plages et révocation. Régressions, PWA, synchronisation, TypeScript, lint et build passent. Correction vérifiée d’un import ESM propre au runtime Vercel, sans dupliquer la logique client/serveur (factory commune et adaptateurs). Publication finale : dpl_H2ccb7C4BUXk3jqRrBVNde6bpoRG.

## 29/10/2026 — Comptes soumis à acceptation

Contrôle d’accès mis en place : compte obligatoire, attente sans fonctionnalité, administration réservée au compte propriétaire épinglé côté serveur, mot de passe secondaire dérivé scrypt, décisions avec confirmation écrite, retrait d’accès, compteur Profil et Web Push réservés au propriétaire. Autorisation hors ligne signée de 24 h maximum ; expiration sans validation ni suppression de la séance en cours. Configuration et limites : CONTROLE_ACCES.md.

Validation : typecheck, lint et build réussis ; tests de signature/expiration, notifications/service worker, API sur branche Neon isolée et persistance PWA réussis. Parcours mobile contrôlé : inscription, attente, badge, acceptation, membre sans administration, expiration puis reprise avec charge partielle conservée. Les notifications réelles sur iPhone nécessitent l’activation explicite depuis l’application installée.

## Passation pour un nouveau chat — 29/10/2026

Lire en priorité PASSATION_TRAINING_PROGRAMME_2026-10-29.md à la racine du projet. Ce document synthétise les fonctionnalités, règles utilisateur, paramètres actuels, chemins, commandes, preuves et limites ; il identifie les anciennes mentions devenues obsolètes dans les présentes notes. Ne pas relire tout l’historique par défaut. Copie identique dans le dossier ChatGPT/appli sport. Aucun secret en clair inclus, aucun déploiement fonctionnel effectué pour cette passation.

## 29 octobre 2026 — dossier principal renommé

À la demande de l’utilisateur, le dossier principal dans Documents porte désormais le nom appli_sport. Racine du code : C:\Users\killi\OneDrive\Documents\appli_sport\training-programme. Structure, fichiers locaux et identité de l’application conservés ; références locales actualisées.

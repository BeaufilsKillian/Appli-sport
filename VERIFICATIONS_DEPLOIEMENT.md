# Vérification du déploiement — 26 octobre 2026

Application : **https://training-programme-ten.vercel.app**

Vercel : projet `overblast2/training-programme`, déploiement `dpl_AymKU9uDhyaYNSxTjdcUtyST6pMh`, état **Ready**. Trois fonctions serveur : Auth, sauvegardes, configuration.

Neon : projet existant `lively-snow-79737068`, branche `production`. PostgreSQL et Neon Auth activés par `neon deploy`. Les variables ont été récupérées dans le fichier local ignoré `.env.local` et les quatre variables requises ont été enregistrées comme secrets Vercel Production. Aucun secret ajouté au code ou aux fichiers web exportés.

## Changements

- Configuration `neon.ts`, services PostgreSQL/Auth, migration versionnée appliquée sur une branche de test puis en production ; les deux tables de sauvegarde ont leur protection RLS activée.
- Fonctions serveur en modules ESM pour charger correctement le SDK Neon ; imports serveur compatibles Node et invocation explicite `getSession({})`.
- Commande `npm run build` ajoutée, ainsi que `npm run deploy:vercel`. Cette dernière prépare seulement les sources nécessaires, sans Git ni secrets locaux, pour publier avec le compte CLI autorisé.
- Animations web encodées en WebP qualité 95 : 155 fichiers, 83,4 Mo. Chaque animation a conservé la résolution, le nombre d'images et leurs durées ; l'écart moyen de couleur a été contrôlé sur chaque image. Il s'agit d'une compression avec perte de haute qualité. Les GIF natifs restent intacts. Les sources à envoyer représentent 92,7 Mo, sous la limite gratuite Vercel. Construction autonome, sans téléchargement depuis le site d'origine.
- Manifest PWA, stockage hors connexion, import/export, sauvegarde automatique et historique de versions disponibles sur l'adresse HTTPS définitive. Le chronomètre de repos est retiré.

## Preuves

`npm run build` se termine sans erreur :

```text
Exported: dist
165 fichiers essentiels, 155 animations téléchargeables à la demande.
```

TypeScript, lint explicite App/src/api/server, les six suites existantes et `npm run test:pwa` passent. Le contrôle de l'export web n'a trouvé aucune des valeurs des secrets serveur.

Test HTTP réel, lancé avec `node scripts/test-live.mjs https://training-programme-ten.vercel.app` :

```text
OK en ligne : inscription et session Neon.
OK en ligne : écriture/lecture PostgreSQL, historique restaurable, conflit, isolation et origine.
OK en ligne : déconnexion, reconnexion et récupération de la sauvegarde.
```

Le test vérifie également HTTP 401 sans session et après déconnexion, HTTP 403 pour un autre compte et une origine étrangère, HTTP 409 pour une version périmée, lecture d'une ancienne version et réponses privées `no-store`.

Test dans le navigateur sur l'application publiée : connexion au compte temporaire, récupération automatique de sa sauvegarde, création d'un dossier dans l'interface sans utiliser Sauvegarder maintenant. Le dossier a été retrouvé dans PostgreSQL en version 3. Le profil affichait **Sauvegardé en ligne**, sans erreur console.

Les deux comptes techniques, leurs sauvegardes et la branche temporaire de migration ont ensuite été supprimés. Les données de l'utilisateur dans Expo Go n'ont pas été modifiées. Le QR HTTPS est dans `.expo/pwa-iphone-qr.png` et a été ouvert dans VS Code.

## Incidents et corrections

- L'installation automatique du plugin GitHub Copilot a échoué. Les plugins Codex et VS Code sont installés ; l'initialisation du projet a repris avec `--no-agent-setup`.
- L'association GitHub a échoué et un envoi a été bloqué en raison de l'auteur d'un ancien commit. La publication directe avec le compte Vercel autorisé fonctionne ; aucune modification de l'historique Git. Les déploiements automatiques depuis GitHub ne sont pas configurés.
- Le premier essai des fonctions a rencontré `ERR_REQUIRE_ESM` ; le passage au format ESM l'a corrigé. Les appels Auth et sauvegarde réels passent.
- Le téléchargement des GIF pendant la construction a échoué avec `ENOTFOUND www.docteur-fitness.com`. Les WebP sont maintenant inclus dans les sources. L'encodage sans perte a également été essayé mais restait trop volumineux ; la version publiée utilise la compression de haute qualité décrite ci-dessus.
- Windows a verrouillé le dossier temporaire après une publication réussie. Le helper gère désormais les nouvelles tentatives de nettoyage sans transformer cette erreur de nettoyage en échec du déploiement. L'état Ready et les tests en ligne confirment la publication.
- L'audit production signale encore quatre entrées liées à `node-forge` dans l'outillage de signature Expo, sans correctif compatible proposé. Pas de rétrogradation forcée d'Expo. Cet outillage n'est pas utilisé par les fonctions de sauvegarde ni par le JavaScript web exporté.

## À valider avec le propriétaire

L'installation Safari et le fonctionnement sur l'iPhone physique restent à vérifier. Le fonctionnement hors connexion a été vérifié dans l'aperçu local, serveur arrêté. La livraison réelle des e-mails de récupération n'a pas été testée ; SMTP personnalisé non configuré. Neon Auth utilise actuellement son réglage par défaut : inscription e-mail/mot de passe sans vérification e-mail obligatoire.

Créer un compte **dans l'application**, distinct des comptes administrateurs Neon/Vercel, puis transférer les données : Export JSON depuis l'ancienne application, connexion à son compte dans la PWA et Importer une sauvegarde JSON. Attendre **Sauvegardé en ligne**. Les sauvegardes automatiques demandent que l'application soit ouverte et connectée ; les saisies hors connexion attendent le retour du réseau.

Nettoyage local final : la suppression de deux dossiers temporaires de déploiement a été refusée par le contrôle automatique, motif fourni : bloqué par la politique. Ces copies restent dans le dossier temporaire Windows ; aucun secret local n’y avait été copié. Cela n’affecte pas le service publié. Les comptes de test et leurs sauvegardes distantes ont bien été supprimés.

## Mise à jour répétitions minimum/maximum

Déploiement Ready dpl_G8vMq1Fz9W99f3MmnXrMARAd4e1C sur la même adresse. Deux bornes facultatives, affichage d’une seule valeur si l’autre est vide, plage si les deux sont remplies, aucun objectif si les deux sont vides. Anciennes valeurs conservées. Sauvegardes schéma 9, compatibilité d’import avec le schéma 8.

TypeScript, lint, sept suites locales, test:pwa et build passent. Vérification visuelle des quatre cas. Test réel --rep-bounds : plage 8–12 puis maximum seul conservés dans Neon, lecture des versions et reconnexion réussies. Compte technique et données de test supprimés.



## 27 octobre 2026 — saisie directe et mise à jour

Fenêtre centrée lorsqu’une version PWA est prête : installer / plus tard, reproposée à la prochaine ouverture. Différée pendant chargement, formulaire ou séance active. Charges et répétitions éditables dans les cellules, sauvegarde locale au fil des valeurs valides et écritures sérialisées avec la coche. RPE existant conservé ; détails de série accessibles par son numéro. Tests navigateur : 42,5 kg × 12, validation, rechargement, 510 kg de volume ; installation réelle du service worker sans perte du dossier ni de l’historique de test. Tests de saisie dans tests/inline-sets.cjs ; estimation documentée dans ESTIMATION_CAPACITE.md. Aucun changement d’abonnement.

Publication confirmée Ready : dpl_EzYdr58DbRkbYx4WRZLoEpmzoMZB ; domaine production HTTP 200, service worker version 4f225833f61f93d5, API config cloud:true. TypeScript, lint sans avertissement, suites de régression, PWA, synchronisation/mises à jour et saisie directe passent.


## 27 octobre 2026 — performances précédentes en grisé

Aperçu validé par l’utilisateur puis intégré : cases vides avec performances de la dernière séance terminée de l’exercice en placeholder semi-transparent, correspondance par numéro et type de série. Jamais le record ; pas de reprise d’une séance plus ancienne si la dernière ne contient pas cette série. Sans historique : tiret et saisie manuelle. Texte « Dernière : … » supprimé.

Saisie des deux valeurs valides (charge >= 0, répétitions entières > 0) : validation automatique. Rond : recopie des valeurs manquantes depuis la dernière séance, conserve les saisies du jour, puis valide ; second appui dévalide. Frappes, copie et validation sérialisées, modification des performances et brouillon atomiques.

Brouillons des séries actives dans settings/set_input:<id>, compatibles sauvegardes schema 9 ; supprimés après fin/annulation ou suppression de la série. getSettings exclut ces métadonnées pour éviter une réécriture par le profil. Les anciennes séances en cours gardent leurs valeurs numériques déjà présentes. Aucun historique utilisateur remplacé.

Tests : test:sets avec SQLite réelle en mémoire (dernière séance différente d’un record ancien, séries distinctes, copie partielle, auto-validation, absence d’historique, zéro kg, invalides, reprise, export et nettoyage), test, test:pwa, test:sync, typecheck et lint réussis ; build PWA 058d5b0802c00160 local. Test navigateur local sur historique fictif : 42,5 kg × 12 en grisé, rond recopie/valide ; 45 kg seul ne valide pas, ajout de 10 répétitions valide ; effacement et réouverture conservent les placeholders et la série 2 validée. Aucune erreur console. Capture .expo/performances-grisees.png.

Publication confirmée Ready : dpl_C1CjfyCUjsyyS2o3tPuCKvXeMu72. Domaine production, service worker et API config : HTTP 200. Version du service worker publiée : f8a3571ccbeadb0a. Aucune donnée du compte réel modifiée pour ces tests.


## 27 octobre 2026 — installation pendant une séance active

La séance active ne bloque plus le message centré ni le bouton d’installation dans Profil. Un formulaire ouvert ou le chargement initial restent protégés. Le verrou de synchronisation/restauration distante reste actif pendant l’entraînement, séparément de l’installation.

Avant activation : attente de la file des saisies, sauvegarde locale de l’identifiant de séance, du bloc courant et du retour à l’écran d’entraînement, puis attente de la persistance locale. Après rechargement : même séance, même bloc ; marqueur consommé uniquement si l’identifiant actif correspond. Aucune clôture ou validation automatique de série pendant l’installation.

Ajout de /api/update, page d’installation volontaire accessible aux anciens clients qui bloquent encore l’installation pendant une séance. Cette route et son script sont servis sans cache et passent à travers l’ancien service worker qui exclut /api/. Aucun accès aux données, aucun effacement de cache/IndexedDB, aucun changement de compte. L’installation ne recharge pas les autres onglets automatiquement. L’aperçu local réutilise le même handler pour tester ce parcours.

Tests : TypeScript, lint, régressions, PWA, séries et synchronisation passent ; nouveau tests/update-resume.cjs intégré à test:sync. Vérification navigateur avec une séance fictive active : mise à jour depuis l’ancien client via /api/update sans clôture ; puis nouvelle version simulée du service worker local, fenêtre apparue pendant l’exercice, bouton actif, installation et retour direct à l’exercice. Une série à 45 kg × 10 reste validée, une saisie partielle 52,5 kg reste non validée avec répétitions vides. Capture .expo/mise-a-jour-seance-active.png. Version locale de test du service worker modifiée uniquement dans dist ; ce suffixe n’est pas publié.

Publication Ready : dpl_3PR4tC3vP6nSt77XvQqsssF95GCJ, service worker 14368663e43e3496. Domaine, worker, configuration et installateur /api/update (HTML et JS) : HTTP 200. Installation réellement appliquée sur le PC via cet accès : séance Gg toujours en cours avec zéro série validée, trois dossiers et historique inchangés à l’écran. Les saisies personnelles n’ont pas été modifiées par le test.


## 27 octobre 2026 — alerte automatique au lancement et animations installées

Contrôle automatique explicite au montage de l’interface, pageshow, retour au premier plan et contrôle périodique conservé. Notification dès qu’une mise à jour commence à se télécharger ; bouton Installer disponible à la fin. Correction de la course entre statechange=installed et registration.waiting : notification différée et attente bornée, sans clic sur le contrôle manuel. Le même worker n’émet qu’une notification de disponibilité afin de respecter Plus tard pendant l’utilisation ; nouvelle ouverture/retour repropose une mise à jour en attente. L’enregistrement du worker peut être réessayé après un échec réseau au démarrage. L’installation pendant séance conserve le mécanisme de sauvegarde/reprise précédent.

La construction génère offline-media.json avec les chemins réels des 155 animations, inclus dans les fichiers essentiels pour disponibilité hors connexion. Profil compare cette liste aux entrées réelles du cache training-media-v1. Le bouton Télécharger les animations est masqué tant que la bibliothèque est complète, dès la fin du téléchargement et après réouverture. Cache partiel, fichier évincé ou nouvelle animation : téléchargement à nouveau proposé. Pas d’indicateur de compte partagé : installation vérifiée sur cet appareil.

Tests : contrôles automatiques sans clic, disponibilité différée après état installed, notification dès téléchargement, absence de notifications répétées, retry après erreur réseau ; cache vide/partiel/complet, éviction et nouvelle animation. Régressions, séries, synchronisation, reprise de séance, PWA, TypeScript et lint réussis. Vérification navigateur : téléchargement local des 155 animations puis disparition immédiate du bouton ; après rechargement, bouton toujours absent (compteur DOM=0). Capture .expo/animations-installees-bouton-masque.png.

Vérification supplémentaire : nouvelle version simulée uniquement dans dist/sw.js ; rechargement simple, aucune utilisation du bouton Vérifier, fenêtre apparue automatiquement. Installation volontaire, retour dans Profil : bouton Télécharger les animations toujours absent ; aucune erreur console. Capture .expo/mise-a-jour-automatique-lancement.png. Version locale simulée rétablie après le test.

Publication Ready : dpl_58stfP8EqdmQXbor5BMLL1HcCTQC ; service worker bbb63df6fca97149. Worker, script de détection, manifeste de 155 animations et API config : HTTP 200. Vérification en production : simple rechargement du PC, fenêtre affichée automatiquement sans clic sur Vérifier ; installation appliquée, séance Gg toujours en cours et dossiers conservés. Capture .expo/mise-a-jour-automatique-production.png.


## 27 octobre 2026 — séances suggérées regroupées par muscle

Le générateur conserve sa sélection, ses objectifs, son nombre de séries et son budget temps, puis trie la proposition par groupes contigus : pectoraux/dos, jambes et subdivisions, épaules, biceps, triceps, avant-bras, abdos en dernier. L’ordre interne des exercices de chaque groupe est conservé. L’ordre de sélection des muscles ne dicte plus l’ordre de passage. createSuggestedTemplate enregistre déjà les positions dans cet ordre, sans modifier les séances existantes.

Tests : quatre combinaisons de muscles, quatre objectifs, sélection des abdos en premier, groupes contigus et grands groupes avant les bras, conservation des premiers exercices pectoraux et respect de la durée. TypeScript, lint, suite de régression et build passent. Interface locale : choix Abdos → Biceps → Pectoraux, durée 2 h, proposition de 10 exercices en 1 h 50 ; résultat trois exercices pectoraux puis trois biceps puis quatre abdos. Capture .expo/seance-suggeree-groupes.png. Aucun compte ou entraînement personnel modifié pour ce test.

Publication Ready : dpl_5bUrPpBodVwjkWuTzxHLZAGd5BZx ; service worker 7fa6f2df238f0ff8. Domaine, worker et API config : HTTP 200. QR de production régénéré et ouvert dans VS Code.

Le premier test de l’API de partage en production a détecté une résolution de module ESM sans extension (src/backup). Correction des imports partagés en .js pour le runtime Vercel ; validation locale et export web relancés avant nouvelle publication. Aucun compte personnel ni partage réel créé pendant cet échec.


## 27 octobre 2026 — partage de dossiers par lien

Choix utilisateur : copie indépendante. Bouton Partager ce dossier dans la page du dossier ; lien aléatoire valable sept jours pour un compte destinataire. L’expéditeur l’envoie lui-même et peut annuler un lien inutilisé. Profil permet l’aperçu et l’import d’un lien reçu ; ouvrir un lien positionne l’application sur Profil pour connexion/import. Les copies reçues gardent objectifs min/max, consignes, groupes/supersets/dropsets et exercices personnalisés, avec de nouveaux identifiants. Profil, statistiques, séances réalisées et 1RM exclus. Import transactionnel ajoutant aux données existantes, idempotent en cas de réessai. Import bloqué pendant une séance/formulaire ; une fenêtre de création de lien protège aussi les saisies contre restauration/mise à jour.

Base : migration additive 002_folder_shares.sql, table privée RLS, jetons hachés, vérification serveur session/compte/origine, aperçu sans contenu du programme, récupération atomique par un seul compte, réessai permis à ce compte, révocation uniquement par expéditeur avant récupération, expiration et limite dix liens/sept jours. Aucun changement de politique d’accès à l’application ; ce sujet a été expliqué séparément, notamment les limites hors connexion et la non-révocabilité d’une copie déjà importée.

Vérifications : migration et tests SQL sur branche schema-only br-cold-wave-za5rt4u0 avant application en production. Tests de copie/import avec SQL.js (confidentialité, références, indépendance, réessai, reprise et rollback). Test réel sur Vercel/Neon avec trois comptes techniques : authentification, identité, origine, aperçu, destinataire unique, réessai, copie locale puis sauvegarde cloud indépendante, consignes/plages et révocation. Régressions, PWA, synchronisation, TypeScript, lint et build passent. Correction vérifiée d’un import ESM propre au runtime Vercel, sans dupliquer la logique client/serveur (factory commune et adaptateurs). Publication finale : dpl_H2ccb7C4BUXk3jqRrBVNde6bpoRG.

Nettoyage final confirmé : trois comptes techniques Neon Auth supprimés, zéro partage et zéro sauvegarde pour leurs identifiants, branche schema-only supprimée. Interface de production vérifiée : bouton Partager ce dossier, fenêtre de création de lien authentifiée sans erreur ; aucun lien réel créé avec les dossiers personnels. Capture .expo/partage-dossier.png. QR de production ouvert dans VS Code.

Déploiement validé le 29/10/2026 : dpl_6VWMR4J16Yw2fTg6WvweoymxiQnE, alias https://training-programme-ten.vercel.app/ (état READY). Inscription et reconnexion réelles Neon testées : attente obligatoire, aucun bail hors ligne, API sauvegardes/partage/administration refusées. Acceptation technique puis retrait : bail signé et sauvegardes accessibles seulement pendant l’acceptation, refus immédiat après retrait. Interface propriétaire : déverrouillage secondaire, demande e-mail seule, badge Profil et refus avec saisie « refuser » vérifiés en production. Compte synthétique et branche isolée supprimés après vérification. Séance réelle Gg conservée avec 0 série enregistrée après installation de la mise à jour. Livraison Web Push sur un iPhone physique non testée : autorisation à activer par le propriétaire depuis la PWA installée.

## 29 octobre 2026 — chrono et progression pondérée

Racine actuelle retrouvée après déplacement : C:/Users/killi/OneDrive/Documents/appli_sport/training-programme.
Chrono isolé dans SessionClock, actualisé chaque seconde depuis started_at, recalcul au retour au premier plan, nettoyage au démontage. Affichage des durées en HH:MM:SS, historique compris. Aucun appel réseau ni écriture en base ajouté par le chrono.

Progression pondérée par les objectifs de répétitions (borne supérieure si plage), selon le modèle de durée déjà utilisé par l’assistant : 3 secondes/répétition + 15 secondes de mise en place, borné entre 30 et 100 secondes/série. Repos entre séries/tours, un seul repos maximal par tour de superset, aucun avant un tour uniquement dropset ni après le dernier tour du bloc. Crédit du travail à validation de la série, du repos théorique à validation complète du tour. Sans objectif : répétitions de la série, puis hypothèse de 8. Le pourcentage représente le programme estimé accompli, pas la mesure des repos réellement pris ; il ne progresse pas simplement parce que le temps passe. Pas de migration ni de changement des charges conseillées.

Vérifications réussies : typecheck, lint, npm test (nouveau tests/workout-progress.cjs inclus), test:pwa, test:sets, build. Nouveau test : format des heures au-delà de 24 h, tick, reprise après suspension avec horloge simulée, nettoyage, objectifs absents, pondération, supersets et dropsets. Aucune vraie séance modifiée pour tester. Affichage sur iPhone physique non vérifié.

Publication READY : dpl_3AiBwDUWNNNLiFbYTTR9ngW2XaYR ; alias de production habituel. Build local 6fdab612775a369e ; build Linux Vercel 998cde99804c3023 (hash dépend aussi de l’ordre des chemins générés). Production : / et /sw.js HTTP 200, /api/access anonyme HTTP 401 ; nouveau bundle contrôlé pour la progression pondérée et ses libellés. Aucun test de charge effectué. Les deux ajouts restent locaux : pas de requête supplémentaire par seconde ou par validation ; publication/build et distribution normale de la mise à jour consomment les ressources habituelles.

## 29 octobre 2026 — objectifs en durée, réserve et rappels de 1RM

Objectifs : choix Répétitions / Échec technique / Durée dans le formulaire existant. Durée prévue saisie en minutes et secondes ; saisie réalisée en secondes ou min:ss, charge facultative. Durée distincte des répétitions dans les modèles, instantanés de séance et séries ; les séances déjà commencées conservent leur unité. Historique, statistiques par exercice, CSV, duplication, partage et progression pondérée adaptés ; aucun volume kg×secondes calculé.

Réserve : 0 à 10 par référence 1RM, défaut 2 pour les anciennes données. Epley inversé et arrondi à 2,5 kg conservés ; même fonction pour le conseil affiché et les valeurs initiales de séance. Objectif explicite à l’échec : réserve 0 ; aucun calcul de charge depuis une durée. Modifier uniquement la réserve ne renouvelle pas la date du RM. Case explicite pour confirmer une réévaluation aujourd’hui, même à charge inchangée.

Rappel choisi par l’utilisateur : date + performances concordantes. Rappel discret à partir de 42 jours, ou si les trois dernières séances de cet exercice contiennent des séries comparables estimant toutes un écart d’au moins 10 % dans le même sens. Séries classiques de 1 à 15 répétitions, même difficulté (RPE 8, 8,5, 9, 9,5 ou 10), effectuées après la référence et dans les 42 derniers jours ; durées et dropsets exclus. Pas de conclusion sans difficulté renseignée, pas de remplacement automatique du RM. Choix rapides dans l’éditeur de série : Non renseigné / À l’échec / 1, 2 ou 3 répétitions restantes ; stockage dans le RPE existant. Un objectif à l’échec n’attribue pas automatiquement un effort réellement effectué. Seuils produit prudents, pas une certitude physiologique, surtout sur séries longues.

Sauvegarde schéma 10 ; schémas 8 et 9 normalisés avec durées nulles et réserve 2. Partage v2 pour préserver les unités ; anciens liens v1 toujours importables. Empreinte de synchronisation : valeurs de migration implicites exclues pour éviter les faux conflits. Aucune migration PostgreSQL ni modification des comptes réels ; champs inclus dans le JSON privé existant.

Vérifications : typecheck, lint, npm test, test:pwa, test:sync, test:sets, test:sharing et test:access réussis. Nouveau tests/duration-rm.cjs : parsing/bornes, brouillon et réouverture, charge facultative, unité indépendante du modèle modifié, sauvegarde/restauration, partage, compatibilité, vraie migration d’une ancienne base avec séance et saisie 25 partielle, empreinte inchangée, synchronisation entre deux appareils, Epley/RIR et rappels jusqu’à 15 répétitions. Build local 9c3e0f95456507fa réussi.

Contrôle visuel non effectué : CUA et node_repl échouent à initialiser leurs assets avec « Le chemin d’accès spécifié est introuvable ». Fixture locale fictive sur 4197 arrêtée et script temporaire supprimé ; clé éphémère de fixture uniquement, aucun secret de production utilisé pour signer. Aucune vraie séance terminée ou modifiée pour tester. iPhone physique et charge simultanée non testés. Calculs locaux sans nouvelle fréquence d’appels serveur ; légère hausse de taille JSON et ressources habituelles de publication/mise à jour.

Publication READY : dpl_AwamVrs55jcqEVp95QiYJ1LeMqAk, alias https://training-programme-ten.vercel.app/. Worker de production 95e27b2429a41781. Bundle public contrôlé pour les champs durée/réserve, la confirmation de réévaluation et les nouveaux libellés de difficulté ; / HTTP 200, /api/access et /api/backups HTTP 401 anonymes. Les autres appareils doivent installer la mise à jour pour lire les sauvegardes schéma 10 et les dossiers partagés v2.

## 8 novembre 2026 — Nutrition

Livraison complète de l’onglet Nutrition : journal daté et repas de la journée, aliments personnels, quantités g/ml sans conversion implicite, recettes avec ingrédients et poids final après cuisson, objectifs manuels et estimation adulte facultative. Les valeurs historiques sont des copies figées ; une modification de recette/aliment ne réécrit pas les repas consommés. Valeurs inconnues conservées nulles et totaux partiels signalés. Données Ciqual en g uniquement.

Base Ciqual officielle 2025 préparée depuis XML : 3 484 aliments, 270 869 octets. Open Food Facts testé réellement par code-barres et recherche CGI ; API de lecture avec source fixe, identification de l’app, limites/cache bornés, attribution ODbL. Codes EAN/UPC et QR GS1 reconnus ; aucun QR arbitraire visité, aucune photo ni donnée privée envoyée au fournisseur. Scanner ZXing 0.2.1, caméra uniquement sur action, audio désactivé, arrêt à fermeture/arrière-plan et si l’obtention de caméra se termine tardivement. Permissions-Policy camera=(self), microphone et géolocalisation restent désactivés.

Sauvegarde Nutrition indépendante et progressive, comptes approuvés uniquement. Migration additive 004_nutrition.sql, deux tables RLS sans droits PUBLIC ; test préalable sur branche schema-only codex-nutrition-20261108 / br-patient-cloud-za6m22ea, application en production réussie. Contrôle de version par élément et curseurs sérialisés par compte, suppressions propagées, conflits explicites, saisies pendant envoi conservées. Les écritures Nutrition ne déclenchent pas l’envoi complet des sauvegardes de séances. Anciennes sauvegardes de séances conservées au schéma 10 ; restauration des séances préserve la Nutrition. Import/export JSON Nutrition dédié et additif, sans remplacement silencieux. Formulaires Nutrition intégrés aux protections de restauration/mise à jour.

Vérifications réussies : typecheck et lint ; régressions habituelles, PWA, sync, séries, partage et accès ; tests/nutrition.cjs, nutrition-api.cjs, nutrition-ui.cjs, nutrition-scanner.cjs ; SQL réel sur branche isolée via nutrition-neon.cjs (isolation, CAS concurrent, pagination, curseurs, suppressions, RLS, droits PUBLIC). Tests des formulaires sans navigateur : création aliment, portion, recette avec saisie décimale et poids cuit, objectifs estimés/manuels et export. Test décodeur QR et cycle de caméra simulé. Aucun compte/séance réel modifié pour tester.

Limite du contrôle visuel : Browser Use a refusé l’ouverture de http://127.0.0.1:4198 (autorisation réseau refusée). Aucune tentative de contournement ; tests de composants sans navigateur ni réseau employés. Affichage réel et scan par caméra physique non vérifiés. Fixture locale arrêtée, fichier supprimé ; branche de test supprimée et absence confirmée, .expo/.env.nutrition-test supprimé. Clés de fixture éphémères uniquement, aucun secret de production utilisé pour signer la fixture.

Publication READY : dpl_6He9GTCzixPbMKLA7a8dfzv4FERi ; URL technique https://training-programme-hyy0wtzkm-overblast2.vercel.app, alias https://training-programme-ten.vercel.app/. Sources 96,7 Mo. Build local 5592ad2057c4ed28 ; worker de production 0be9c7f9c87b1615. Accueil HTTP 200, nouveaux libellés et données dans le bundle, nouvelle politique caméra confirmée ; /api/nutrition, /api/foods et /api/backups retournent 401 anonymes. Aucun test de charge ni garantie de capacité/gratuité ; contrôles et limites dans NUTRITION.md. Aucune nouvelle offre payante ni service Auth ajouté.

## 8 novembre 2026 — sélection alimentaire, repas et navigation

Sous les noms d'aliments : les cinq valeurs pour 100 g/ml remplacent les sources répétées. Attributions et licences conservées en bas de page et dans les exports. Unités Open Food Facts corrigées depuis product_quantity_unit/quantity : les boissons peuvent avoir des nutriments nommés _100g et une base réelle 100 ml. Noms multilingues et marques sous forme de tableau de l'index de recherche pris en charge. Ciqual reste en g sans conversion de densité inventée.

Journal : quatre blocs Petit-déjeuner, Repas, Collation et Dîner, ajout direct et récapitulatif des cinq nutriments par bloc, total journalier conservé. Clé Déjeuner conservée pour Repas : aucune migration ni réécriture des entrées historiques. Choix du repas aussi dans le formulaire de portion. Barre basse : six colonnes de largeur égale, base flex zéro et largeur minimale zéro, icônes/libellés resserrés, cibles de 44 px et état sélectionné accessible.

Diagnostic : requête utilisateur /api/foods HTTP 503 confirmée dans les journaux Vercel à 21:40:49 UTC ; ancienne recherche CGI OFF reproduite en HTTP 503 avec page « temporarily unavailable ». Impossible d'attribuer précisément le 503 à une panne ou à un quota global du fournisseur. Recherche principale remplacée par Search-a-licious, API officielle dédiée, avec français/anglais et champs limités. En cas de panne réseau/5xx uniquement : un recours au document indexé pour le code ou à la recherche CGI pour le nom ; aucun après 429 ou refus 4xx. Cache et déduplication conservés. Erreur précédente effacée à l'ouverture du scanner. Journal technique fournisseur limité au chemin sans code et au statut, sans nom/recherche de l'utilisateur.

Réponses réelles à travers le handler local (identité fictive uniquement dans le test en mémoire, aucun changement d'authentification déployé) : « flocons avoine » 20 résultats HTTP 200, code 3017620422003 solide HTTP 200, code 5449000000996 boisson HTTP 200 et unité ml. Tests API : panne fournisseur et réseau, recours borné, corps interrompu, absence de contournement 429/403, cache, source fixe, refus anonyme. Tests UI : les cinq valeurs sous le nom, quatre repas, sous-totaux 300/200/100/50 kcal et total 650 kcal, anciennes clés préservées, sauvegarde exportée. Régressions, PWA, sync, nutrition, lint et typecheck réussis ; typecheck relancé après l'export pour éviter la suppression simultanée des anciens fichiers dist. Build local a23ff4ed8d7110ba, 166 fichiers essentiels et 155 animations ; sources de publication 96,7 Mo.

Affichage réel sur iPhone et caméra physique non vérifiés ; aucune nouvelle tentative de navigateur après le refus d'autorisation précédent. Aucun compte, séance ni aliment personnel modifié pour tester, aucune migration SQL ni dépendance ajoutée. Affichage et sous-totaux locaux sans nouvelle charge serveur ; recours de panne limité à une requête supplémentaire, capacité simultanée non mesurée. L'index fournisseur peut être moins récent que la fiche principale : vérifier l'étiquette.

Publication READY : dpl_3GhLuk3SjGeew3Q9xSqxugxJCwYv, URL technique https://training-programme-88gj38w5n-overblast2.vercel.app, alias https://training-programme-ten.vercel.app/. Worker de production d7e9e03e65243a5f, bundle index-c647ffe3ae18a78c11368325844c9117.js avec les nouveaux libellés (accents échappés en hexadécimal par le build Linux). Accueil et worker HTTP 200, politique caméra conservée ; /api/foods, /api/nutrition et /api/backups HTTP 401 anonymes et cache privé. Pas d'appel authentifié de production effectué à la place de l'utilisateur ; tests locaux du handler avec vrais fournisseurs et tests de sécurité séparés. Aucun nouvel abonnement.

## 8 novembre 2026 — exécution de la checklist et largeur de navigation

L'utilisateur signale encore des icônes rognées. Correction renforcée au niveau des parents : conteneur web autorisé explicitement en colonne, min-width zéro et largeur/max-width 100 %, provider et écran bornés, marges de sécurité gauche/droite actives. Barre plafonnée à la largeur de fenêtre, six colonnes conservées, boîte d'icône fixe 28 × 28 et marge latérale. Libellés à 10 px, hauteur tactile au moins 44 px. Changement d'affichage local sans appel réseau ajouté, sans migration ni réécriture des données.

Rapport détaillé des treize points : TESTS_NUTRITION.md. Tests de composants étendus avec les vrais gestionnaires et SQL.js : recherche locale, cinq valeurs sous le nom, recherche/scan simulés, erreur effacée en ouvrant le scanner, aliment et quatre repas de référence (650 kcal, P65/G32,5/L26/F13), modification/déplacement/suppression, dates, liquide 250 ml → 100 kcal et G25, recette multi-ingrédients et poids cuit, portion historique conservée, objectifs, import/export sans doublon, fermeture/réouverture hors réseau. Programme et séance active synthétiques strictement préservés après tous les essais. Nouveau test de structure de navigation : noms, sélection et clics des six onglets, largeur plafonnée pour 320/375/390/430/768 ; ce n'est pas une mesure de géométrie rendue.

Tests réussis : npm test, test:nutrition, test:nutrition:live, test:pwa, test:sync, typecheck, lint et build:pwa. Trois lectures réelles à travers le handler local : flocons avoine → 20 résultats HTTP 200 ; code 3017620422003 → HTTP 200/g ; code 5449000000996 → HTTP 200/ml. Identité fictive dans le processus de test seulement ; API authentifiée de production inchangée. Build local f95ce31b6ad27cf4 ; 166 fichiers essentiels, 155 animations, sources de publication 96,7 Mo.

Contrôle visuel toujours indisponible : nouvelle demande d'ouverture http://127.0.0.1:4198/__preview rejetée par Browser Use pour autorisation d'origine enregistrée refusée. Explication donnée à l'utilisateur ; après aide sur les réglages, il demande de laisser ce réglage de côté. Aucun contournement ni nouvelle tentative. Copie locale arrêtée, fixture supprimée, absence d'écoute 4198 confirmée ; signature de test avec clé éphémère uniquement. Le rendu sans rognage et la caméra physique ne sont donc pas déclarés validés ; pas de test de charge ou de deux appareils physiques.

Publication READY : dpl_EDHaDFE8ubuMKgEB79tFdevFyZBh, URL technique https://training-programme-366envst6-overblast2.vercel.app, alias https://training-programme-ten.vercel.app/. Worker 4008f06c0d0cff9c ; bundle index-3af83bca918fd7ed014ec385057847a2.js contient la boîte navIcon 28 × 28 et le rôle tablist. Clé publique de production bien présente, identité locale fictive absente. Accueil/worker HTTP 200 ; aliments, nutrition et sauvegardes HTTP 401 anonymes avec cache privé. Aucune modification des API d'authentification ni nouvel abonnement.

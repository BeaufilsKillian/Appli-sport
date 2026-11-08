# Déploiement PWA — Vercel et Neon

Déployé le 26 octobre 2026 : https://training-programme-ten.vercel.app. PostgreSQL, Auth et sauvegarde automatique ont été testés en ligne. Voir VERIFICATIONS_DEPLOIEMENT.md pour les preuves et les limites restantes. Les étapes ci-dessous servent à retrouver ou reproduire la configuration. Le projet conserve son interface Expo. Vercel héberge la PWA et ses fonctions serveur ; Neon conserve les comptes et les sauvegardes privées.

## 1. Comptes et hébergement

Se connecter à [Vercel](https://vercel.com/dashboard) et [Neon](https://console.neon.tech). Choisir Hobby chez Vercel et Free chez Neon, sans activer une offre payante. Les offres gratuites ont des quotas ; Hobby est réservé à un usage personnel non commercial. Le code ne nécessite ni abonnement Apple ni domaine payant.

Créer un projet Neon dans une région européenne, puis activer **Neon Auth** pour la branche utilisée. Conserver l'URL Auth fournie par Neon et la chaîne de connexion PostgreSQL du rôle propriétaire de la base. Ne pas les mettre dans le code ni les envoyer dans le chat.

Dans l'éditeur SQL Neon, exécuter [migrations/001_backups.sql](migrations/001_backups.sql). Cette migration crée seulement deux tables de sauvegarde ; elle ne supprime pas les données existantes. Ne pas activer d'accès public/Data API à ces tables. Le serveur utilise le rôle propriétaire ; le navigateur n'a jamais sa chaîne de connexion.

Importer ce dossier comme projet Vercel, par dépôt Git privé ou CLI officielle depuis le dossier `training-programme`. Les fichiers locaux non suivis doivent être inclus dans le dépôt avant une importation Git. Ne pas publier de secrets, `node_modules`, `.expo`, ni `dist`. L'importation du seul dossier `dist` ne déploierait pas les fonctions de sauvegarde.

Les paramètres sont déjà dans `vercel.json` : Framework Other, installation `npm ci`, construction `npm run build:pwa`, sortie `dist`. Utiliser un runtime Node.js actuel compatible avec Neon (Node 24 recommandé). Le premier déploiement peut afficher l'application sans connexion en ligne, le temps de connaître son adresse définitive.

## 2. Secrets Vercel

Ajouter les quatre variables suivantes dans les variables d'environnement **Production** du projet Vercel, puis redéployer :

| Variable | Valeur |
| --- | --- |
| `DATABASE_URL` | Chaîne PostgreSQL Neon, avec SSL, rôle propriétaire de ces tables |
| `NEON_AUTH_BASE_URL` | URL Auth fournie par Neon pour la même branche |
| `NEON_AUTH_COOKIE_SECRET` | Secret aléatoire d'au moins 32 caractères |
| `APP_ORIGIN` | Adresse HTTPS définitive, par exemple `https://mon-projet.vercel.app`, sans chemin |

Exemple de génération du secret dans un terminal local : `node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))"`. Le saisir directement dans Vercel. Ne jamais utiliser de préfixe `EXPO_PUBLIC_` pour ces variables. `.env.example` contient uniquement des exemples ; un vrai fichier `.env` reste local et ignoré par Git.

Dans Neon Auth, ajouter cette même adresse HTTPS aux domaines/origines autorisés. Configurer les e-mails de vérification et de récupération disponibles dans le projet Neon, et tester leur livraison. Les redirections vers un autre domaine sont refusées par le code. Les déploiements Preview ne doivent pas partager les secrets de production : ils nécessitent leur propre branche Neon et leur propre origine s'ils sont utilisés pour tester des comptes.

## 3. Vérification avant usage réel

Après déploiement, vérifier sur l'adresse de production :

1. Création d'un compte de test, vérification e-mail si activée, connexion et récupération du mot de passe. Le lien de récupération ouvre l'application ; aller dans Profil pour saisir le nouveau mot de passe.
2. Création d'un dossier et d'une séance ; Profil doit indiquer **Sauvegardé en ligne**. Vérifier la restauration avec ce compte de test sur un autre navigateur.
3. Un deuxième compte ne doit voir aucune donnée du premier. Les refus d'accès et les réponses API ne doivent pas être mis en cache.
4. Sur iPhone, ouvrir l'adresse dans Safari, puis **Partager → Sur l'écran d'accueil**. Ouvrir une première fois avec Internet et attendre le chargement complet. Recharger ensuite en mode avion et vérifier une saisie locale puis sa sauvegarde après reconnexion.
5. Dans Profil, télécharger les animations hors ligne si souhaité. Leur téléchargement complet représente environ 83 Mo sur le web (WebP haute qualité ; GIF natifs inchangés), en plus du cœur de l'application ; les GIF consultés sont aussi mis en cache progressivement.

Avant chaque demande de test iPhone, générer le QR de l'adresse HTTPS de production et l'ouvrir dans VS Code. Le serveur Expo et son QR ne valident pas la PWA déployée.

## 4. Reprendre les données actuelles

Les données d'Expo Go ne sont pas automatiquement accessibles à Safari. Dans l'ancienne application, utiliser **Profil → Export JSON** et conserver ce fichier. Dans la PWA, se connecter au compte choisi, puis **Profil → Importer une sauvegarde JSON**. L'import remplace les données du compte sur cet appareil après confirmation ; il ne fusionne pas deux historiques. Attendre ensuite **Sauvegardé en ligne** et conserver l'export original jusqu'à vérification.

Le mode sans compte garde ses propres données sur l'appareil. Se connecter ouvre un espace séparé ; cela ne transfère pas automatiquement les données du mode sans compte. Les exporter avant connexion puis les importer dans le compte si nécessaire. Une déconnexion ne supprime pas la copie locale du compte.

## 5. Fonctionnement des données

Chaque modification est d'abord enregistrée dans IndexedDB sur l'appareil. Avec un compte, Internet et une session valide, la sauvegarde part automatiquement après les modifications et lors du retour au réseau ou à l'application. Il faut que l'application soit ouverte : iOS ne garantit pas une tâche de sauvegarde lorsque la PWA est fermée. Une session expirée nécessite une reconnexion ; les saisies locales restent disponibles.

Neon conserve les dix dernières versions par compte, avec une limite de 2 Mo par sauvegarde JSON. Les images d'exercices ne sont pas enregistrées dans ces sauvegardes. Les dix versions constituent un historique glissant, pas une archive quotidienne indépendante. Les anciennes copies sont retirées lorsque de nouvelles versions arrivent. Un export JSON occasionnel reste utile pour conserver une archive hors du compte.

Si deux appareils ont des copies différentes, la sauvegarde s'arrête et propose les versions disponibles ; elle ne fusionne pas les modifications. Ne pas travailler simultanément sur deux appareils avec le même compte. La restauration demande une confirmation et est bloquée pendant une séance ou un formulaire. Sur un même navigateur, une seule fenêtre par compte peut ouvrir la base à la fois pour éviter les écrasements.

Le navigateur/iOS peut retirer du stockage local : la persistance est demandée mais ne peut pas être garantie. Une copie confirmée en ligne permet de récupérer les données après perte de l'appareil ou du stockage local. Les données encore en attente ne sont pas protégées contre cette perte. Vérifier le statut avant de fermer après une séance importante.

Les données restent accessibles hors ligne sur un appareil déverrouillé ayant déjà utilisé le compte. Utiliser le verrouillage de l'iPhone ; cette version ne fournit pas de chiffrement de bout en bout ni de code PIN propre à l'application. Les identifiants de compte sont vérifiés côté serveur, les secrets restent dans Vercel et les requêtes SQL sont paramétrées.

## 6. Mise à jour et maintenance

Une mise à jour se publie par nouveau déploiement du code. La PWA propose **Installer la mise à jour** dans Profil ; le rechargement est déclenché volontairement hors séance/formulaire. Les données IndexedDB et les sauvegardes sont conservées. Garder la même adresse de production pour conserver le même stockage local et les mêmes cookies.

Contrôles locaux : `npm run typecheck`, `npx eslint App.tsx src api server --max-warnings 0`, `npm test`, `npm run test:pwa`, `npm run build:pwa`. `npm run preview:pwa` lance un aperçu local sans connexion Neon. Les fonctions Auth et PostgreSQL réelles ont été validées sur le déploiement de production. La livraison des e-mails et l’iPhone physique restent à vérifier.

Audit des dépendances au 26 octobre 2026 : la dépendance Zod de Neon a été corrigée par surcharge ciblée. `npm audit --omit=dev` conserve quatre signalements liés à la même dépendance `node-forge` de l'outillage de signature Expo. Cet outillage n'est utilisé ni par les fonctions de sauvegarde ni par la PWA exportée. La correction automatique proposée rétrograderait Expo 58 vers 44 et n'a pas été appliquée. Recontrôler lorsqu'un correctif compatible est publié.

Avant une diffusion publique des animations Docteur Fitness, vérifier les droits de réutilisation. Leur provenance est conservée dans `assets/exercise-demos/sources.json` ; la présence d'un fichier sur un site ne vaut pas autorisation de redistribution.

Documentation de référence : [PWA Expo](https://docs.expo.dev/guides/progressive-web-apps/), [fonctions Node Vercel](https://vercel.com/docs/functions/runtimes/node-js), [offre Hobby](https://vercel.com/docs/plans/hobby), [Neon Auth](https://neon.com/docs/auth/overview), [offres Neon](https://neon.com/pricing).

Déploiements suivants : `npm run build`, puis `npm run deploy:vercel` depuis ce projet déjà lié. La publication directe évite le blocage lié à l’auteur d’un ancien commit ; GitHub n’est pas connecté. Les quatre variables Production sont déjà configurées. Les images WebP sont vérifiées par empreinte pendant la construction, sans récupération distante.


## Partage de dossier — copies indépendantes

Dans un dossier, **Partager ce dossier → Créer un lien de partage → Copier le lien**. L’expéditeur transmet le lien lui-même. Le destinataire ouvre le lien dans l’application, se connecte, voit un aperçu puis choisit **Importer une copie**. Il peut aussi coller le lien dans **Profil → Dossier partagé**. Mettre l’application à jour pour voir ces commandes.

Le lien est valable sept jours pour un compte destinataire. L’aperçu ne renvoie pas les consignes ; le contenu est délivré à la récupération. Un autre compte ne peut pas récupérer le même lien après acceptation. Le même destinataire peut réessayer en cas d’échec d’enregistrement local. Avant utilisation, l’expéditeur peut annuler le lien. Après import, la copie appartient au destinataire et n’est plus révocable : ses modifications ne changent pas l’original.

Seuls le dossier, ses modèles de séances, objectifs, consignes et exercices personnalisés utilisés sont transmis. Aucun profil, historique, statistique, charge réalisée ou 1RM. Les identifiants sont recréés lors de l’import, qui ajoute sans écraser ; une transaction protège contre un import partiel. Réessayer un import ne crée pas de doublon. Une séance/formulaire en cours empêche l’import pour préserver les saisies.

Migration additive `002_folder_shares.sql` : table privée avec RLS et aucun privilège PUBLIC, accessible uniquement aux fonctions Vercel authentifiées. Jetons de 32 octets aléatoires, stockés hachés. Contrôles d’origine et de compte sur les API. Limites : 500 000 caractères par dossier, dix liens créés par compte sur sept jours. Les lignes expirées de ce compte sont nettoyées à sa prochaine création de lien ; pas de tâche périodique ajoutée. Pas de nouvelle interrogation permanente pendant l’entraînement.

Le partage et la gestion d’accès à l’application sont deux sujets distincts. Aucune liste d’utilisateurs autorisés/bloqués n’est activée par cette fonctionnalité. Une future gestion d’accès devra vérifier chaque opération serveur et définir une politique de connexion/hors connexion. Une copie locale déjà téléchargée, ou reçue comme copie indépendante, ne peut pas être effacée à distance avec l’architecture actuelle.

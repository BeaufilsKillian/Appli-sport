This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Livraison demandée par l’utilisateur — 11 novembre 2026

Après chaque modification de l’application, exécuter les vérifications adaptées (dont lint et typecheck), enregistrer les changements dans Git, les pousser sur GitHub, puis déployer la mise à jour en production sur le projet Vercel EXISTANT `training-programme` du compte `overblast2`. Cette publication est autorisée par défaut par l’utilisateur : ne pas redemander confirmation à chaque livraison. Utiliser la procédure de `DEPLOIEMENT_PWA.md` (`npm run deploy:vercel` une fois le projet lié). Ne pas considérer le push GitHub comme un déploiement : le dépôt n’est pas relié automatiquement à Vercel. Vérifier après publication que `https://training-programme-ten.vercel.app/sw.js` expose la version attendue, puis annoncer séparément le commit poussé et le déploiement confirmé. Si une connexion ou une autre condition empêche la publication, le signaler explicitement et reprendre dès que possible. Ne jamais créer un second projet ni modifier les secrets de production pour contourner un problème de connexion.

## Ponytail : mode lite

Par défaut, appliquer la compétence installée `ponytail:ponytail` au niveau **lite** pour les tâches de ce projet, sauf instruction contraire de l’utilisateur. Charger son `SKILL.md` depuis le catalogue des compétences disponibles.

Réaliser intégralement la demande, réutiliser les composants et dépendances existants et privilégier les changements ciblés. Si une solution plus simple existe, la signaler brièvement sans réduire la demande de sa propre initiative. Préserver les validations, la sécurité, l’accessibilité, les sauvegardes et la conservation des séances hors connexion. Conserver les vérifications exigées ci-dessous.

## Préférence utilisateur : vérification sur iPhone

Avant chaque demande de vérification sur iPhone, générer le QR actuel et l'ouvrir directement dans VS Code. Pour la PWA, utiliser l'adresse HTTPS de production Vercel ; un QR Expo ne teste pas la PWA. Pour les tests natifs seulement, démarrer ou vérifier le serveur Expo et réutiliser son adresse actuelle sans doublon.

## Textes de l'application

Privilégier des libellés courts. Éviter les paragraphes explicatifs répétés, le jargon technique et les sous-titres qui répètent le titre. Conserver les consignes d'exécution utiles, les notes personnelles, les unités, les erreurs et les confirmations de suppression.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

## Choix validé : PWA Vercel et Neon

Adapter l’application existante, sans réécrire sa navigation. Vercel héberge le web et les API ; Neon Auth gère les comptes, PostgreSQL les sauvegardes privées. Conserver le fonctionnement local hors connexion. Ne jamais exposer DATABASE_URL ou les secrets de cookies au navigateur. Ne pas publier ni modifier les comptes distants sans demande appropriée. Le chronomètre de repos a été retiré à la demande de l’utilisateur. Procédure et limites dans DEPLOIEMENT_PWA.md.

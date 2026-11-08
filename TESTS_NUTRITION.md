# Vérification de la checklist Nutrition — 8 novembre 2026

Les données de tous les essais sont fictives, dans des bases locales temporaires. Aucun aliment, objectif, compte ou entraînement personnel n'a été modifié pour tester. Les tests de composants exécutent les vrais gestionnaires de formulaires et SQL.js avec des composants visuels simulés : ils ne constituent pas un parcours dans Safari.

| N° | Test demandé | Résultat et méthode |
| --- | --- | --- |
| 1 | Six onglets visibles et accessibles | Sélection, noms et clics vérifiés pour les six onglets ; plafond de largeur contrôlé dans les props à 320, 375, 390, 430 et 768 px. Correction des contraintes de largeur des parents, des marges de sécurité et de la boîte d'icône. **Rendu et absence effective de rognage non vérifiés** : navigateur bloqué. |
| 2 | Recherche locale et valeurs sous le nom | Réussi dans les tests de composants : riz, poulet, cinq nutriments pour 100 g, source retirée sous le nom, valeur inconnue conservée. Catalogue officiel de 3 484 aliments contrôlé. |
| 3 | Recherche en ligne | Réussi : appel réel du handler local au fournisseur Open Food Facts, « flocons avoine » → HTTP 200 et 20 résultats. Le composant appelle le bon terme et présente les résultats ; auth de production testée séparément, aucune session réelle utilisée. |
| 4 | Code-barres et scanner | Codes 3017620422003 et 5449000000996 → réponse réelle HTTP 200 ; le second est identifié en ml. Chaîne UI après détection, effacement d'erreur, décodeur QR et arrêt/nettoyage de caméra testés automatiquement. **Caméra physique et lecture d'un emballage sur iPhone non testées.** |
| 5 | Aliment personnel | Création et modification du vrai document validées : 200 kcal, P20/G10/L8/F4 pour 100 g. Valeur de fibres initialement absente puis ajoutée. |
| 6 | Quatre repas et total | Réussi : 150/100/50/25 g → 300/200/100/50 kcal, sous-totaux de protéines et fibres contrôlés. Total des cinq nutriments : 650 kcal, P65/G32,5/L26/F13. Ancienne clé Déjeuner conservée sous le libellé Repas. |
| 7 | Modifier, déplacer et supprimer une portion | Réussi via les gestionnaires : 150 g modifiés à 120 g et déplacés en Collation → 590 kcal/jour ; confirmation de suppression de cette seule portion → 350 kcal/jour. |
| 8 | Aliment liquide | Réussi : aliment pour 100 ml à 40 kcal et G10 ; 250 ml enregistrés → 100 kcal et G25, sans conversion vers les grammes. |
| 9 | Recette, poids cuit, historique conservé | Réussi : saisie décimale 12,5 g conservée ; recette à deux ingrédients de 100 g, poids final 300 g, portion 150 g → 150 kcal, P10/G17,5/L4/F2. Passage ultérieur du poids final à 600 g : portion déjà consommée strictement inchangée. |
| 10 | Objectifs manuels et estimation | Réussi : estimation sur profil fictif adulte, sauvegarde puis modification manuelle des cinq valeurs. Cohérence de l'estimation et persistance après réouverture contrôlées. Aucun objectif personnel utilisé. |
| 11 | Dates et hors connexion | Réussi automatiquement : changement de date masque les entrées sans les supprimer ; retour à la date les restitue. Fermeture/réouverture SQL.js et persistance IndexedDB simulée, reprise PWA et données en cours testées sans réseau. Coupure puis relance dans un navigateur réel non vérifiée. |
| 12 | Synchronisation et sauvegarde | Réussi automatiquement : deux bases/appareils simulés, récupération et envoi, conflits, suppressions, pagination et écritures pendant envoi. Export depuis le formulaire, puis réimport du même JSON : dix documents actifs, aucun doublon. Tests PWA/PostgreSQL local : isolation des comptes et rétention. Pas d'essai sur deux appareils physiques. |
| 13 | Programmes, historiques et séance active | Réussi : programme et séance active synthétiques créés avant tous les essais Nutrition, sauvegarde complète identique après ceux-ci, import et réouverture compris. Régressions séances/historique/durées/RM également réussies. |

Commandes exécutées avec succès : `npm test`, `npm run test:nutrition`, `npm run test:nutrition:live`, `npm run test:pwa`, `npm run test:sync`, `npm run typecheck`, `npm run lint`, `npm run build:pwa`.

Le mode `test:nutrition:live` effectue trois lectures publiques auprès du fournisseur, via le handler local avec une identité fictive en mémoire. Les assertions auth, refus d'accès, quotas et cache utilisent des mocks séparés ; aucun contournement d'authentification n'est déployé. Les messages fournisseur 503/403 imprimés avant les trois réussites sont les scénarios de panne simulée, pas des erreurs des requêtes réelles.

Le 8 novembre, Browser Use a refusé l'ouverture de `http://127.0.0.1:4198/__preview` : une autorisation enregistrée interdit l'origine locale. L'utilisateur a demandé de laisser ce réglage de côté. Aucune nouvelle tentative ni contournement ; serveur de copie isolée arrêté, fixture supprimée. Sa clé était éphémère et ne provenait pas de la production.

Pas de test de charge simultanée. La correction de largeur reste locale, sans requête supplémentaire ; publication et lectures de contrôle consomment les ressources habituelles.

Correctif publié : déploiement READY dpl_EDHaDFE8ubuMKgEB79tFdevFyZBh, https://training-programme-ten.vercel.app/, worker 4008f06c0d0cff9c. Bundle et authentification anonyme contrôlés après publication ; cela ne remplace pas le contrôle visuel bloqué.

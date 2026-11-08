# Nutrition — 8 novembre 2026

## Utilisation

Onglet Nutrition : journal par date, aliments, repas et objectifs. Les quantités sont en g ou en ml suivant la base de la fiche, jamais converties implicitement. Les aliments Ciqual restent en grammes. Les valeurs manquantes restent inconnues ; ≥ signale un total partiel.

Sélection d'un aliment : les cinq valeurs s'affichent pour 100 g ou 100 ml sous son nom ; les attributions restent en bas de page. Les boissons Open Food Facts utilisent l'unité de volume déclarée (`product_quantity_unit` ou quantité du conditionnement), même si le champ nutritionnel de l'API s'appelle `_100g`. Aucune densité Ciqual n'est inventée. Les quatre blocs Petit-déjeuner, Repas, Collation et Dîner permettent l'ajout direct et affichent chacun leurs macros, en plus du total journalier. Le libellé Repas garde la clé historique Déjeuner pour préserver les saisies et la compatibilité des sauvegardes.

Mes repas conserve les ingrédients et leur masse, puis un poids final facultatif après cuisson. Une portion du repas utilise son poids final. Le journal garde une copie des valeurs au moment de l'ajout ; modifier ensuite un aliment ou une recette ne change pas les consommations passées.

Scanner : EAN/UPC ou QR GS1 contenant un GTIN. La caméra est utilisée localement, sans audio et sans envoi d'image. Le serveur reçoit uniquement le code ou les mots de recherche. Un QR arbitraire n'est jamais visité. La fermeture du scanner et le passage en arrière-plan arrêtent les pistes caméra. Saisie manuelle du code et création d'aliment disponibles si produit absent ou caméra refusée.

Objectifs manuels : kcal et grammes de protéines/glucides/lipides/fibres. Estimation facultative pour adultes en bonne santé, 18–80 ans, hors grossesse/allaitement et alimentation médicale : Mifflin–St Jeor puis niveau d'activité (sport inclus), maintien ou −10 % / +5 %, protéines 1,6 g/kg de poids actuel, lipides 35 % des calories, fibres 30 g, glucides restants avec 2 kcal/g de fibres. Arrondi ; pas d'objectif de date de poids garanti. Contrôles de cohérence du poids cible, IMC 18,5–35, kcal estimées 1200/1500 minimum suivant la formule et 6000 maximum. Hors cadre : objectifs manuels avec un professionnel. Le résultat doit être examiné avant enregistrement.

## Sources

- Anses. 2025. Table de composition nutritionnelle Ciqual 2025. https://doi.org/10.5281/zenodo.17550133 — 3 484 aliments, données compactes de 270 869 octets. XML officiels, constituants 328 (énergie UE), 25003 (protéines N×6,25), 31000 (glucides), 40000 (lipides), 34100 (fibres). Traces et limites non chiffrables conservées nulles. Métadonnées : src/nutrition/sources.json. Reconstruction : scripts/prepare-ciqual.mjs, fichiers XML dans .expo/nutrition-data, non publiés.
- Open Food Facts : https://world.openfoodfacts.org/terms-of-use — ODbL, sources et identifiants conservés. Les versions personnelles dérivées conservent la provenance. Aucune photo importée, aucun ajout public ni compte OFF créé. Lecture v3 par code et recherche dédiée Search-a-licious (`search.openfoodfacts.org/search`, champs limités, français/anglais). Sur erreur réseau ou 5xx uniquement : un recours au document indexé pour le code ou à la recherche CGI pour le nom. Aucun recours après quota 429 ou refus 4xx ; pas de boucle de tentatives. L'index de secours peut être moins récent : vérifier l'étiquette. User-Agent identifie l'application ; cache mémoire borné, regroupement des requêtes identiques et erreurs de quota explicites. La disponibilité et les limites dépendent du fournisseur. API de recherche : https://openfoodfacts.github.io/search-a-licious/users/ref-openapi/.
- Estimations : https://pubmed.ncbi.nlm.nih.gov/2305711/ ; https://pmc.ncbi.nlm.nih.gov/articles/PMC5477153/ ; https://anses.fr/fr/system/files/NUT2012SA0103Ra-2.pdf.

## Stockage et synchronisation

Tables SQLite séparées nutrition_documents et nutrition_meta dans l'espace local du compte. Les séances et leur sauvegarde JSON schéma 10 restent indépendantes. Une restauration de séances préserve la nutrition. Export/import JSON Nutrition séparé, import additif transactionnel, refus des identifiants contradictoires, 20 Mo maximum. Export nécessaire avant opération destructive volontaire ; déconnexion ne supprime pas la copie locale.

Migration additive 004_nutrition.sql : training_nutrition et training_nutrition_heads, RLS, aucun droit PUBLIC. API /api/nutrition : session Neon approuvée, compte vérifié, origine contrôlée à l'écriture. Aucune donnée d'un autre compte. POST un document modifié (64 Ko maximum), contrôle par révision ; GET différences après curseur, 20 documents par page. La tête verrouillée par compte sérialise les commits pour ne pas perdre des modifications entre deux curseurs. Les suppressions sont des tombstones. Limite 50 000 identifiants par compte ; prévoir archivage au-delà.

PWA : envoi après modification (1,5 s), lancement, retour au premier plan/réseau et contrôle toutes les 5 minutes lorsque visible. Pas de boucle réseau par seconde ou par frappe. Les écritures Nutrition ne déclenchent pas la sauvegarde complète des séances. Les changements pendant un envoi restent en attente ; conflit conserve les deux versions et demande un choix explicite. Les formulaires Nutrition bloquent une restauration ou installation de mise à jour ; un formulaire ancien ne peut pas écraser une version reçue entre-temps. Les données enregistrées se conservent hors ligne ; première recherche en ligne nécessite Internet. Natif ancien : données locales/export et Ciqual, scan et recherche distante prévus pour la PWA choisie.

API /api/foods : compte approuvé, source externe fixe et paramètres bornés, pas d'URL arbitraire. Contrôle local 8 recherches/minute/compte par instance ; les quotas OFF et le cache sont partagés en fonction des instances/IP du fournisseur. Cette limite mémoire ne garantit pas un quota global distribué. Une montée en charge nécessite de mesurer les quotas et l'usage réel, sans achat d'offre autorisé par défaut.

## Vérifications

`npm run test:nutrition` : calculs, cru/cuit, valeurs inconnues, frontières d'entrée, estimation/cohérence, EAN/GS1, API et droits, persistance/rechargement, import/export atomique, deux appareils, curseurs, conflits, suppressions et modifications pendant envoi ; formulaires avec données fictives et base SQL.js, sans navigateur ; décodeur et cycle caméra simulé.

`npm run test:nutrition:neon` utilise uniquement .expo/.env.nutrition-test et refuse la production. Tests sur branche schema-only : isolation, CAS concurrent, pagination, suppressions, RLS et droits PUBLIC. Aucun compte ou entraînement réel utilisé. Voir VERIFICATIONS_DEPLOIEMENT.md pour l'état publié et les limites du contrôle visuel.

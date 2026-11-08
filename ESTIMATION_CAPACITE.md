# Capacité et coût estimés — 27 octobre 2026

Estimation de dimensionnement, pas un résultat de test de charge. Aucun abonnement payant activé, aucune charge massive envoyée à la production. Les quotas appartiennent au compte/projet et les autres usages peuvent les consommer.

## Fonctionnement observé dans le code

- Saisie et historique stockés sur l’appareil ; une personne qui s’entraîne ne maintient pas une connexion PostgreSQL dédiée.
- Application visible : vérification de synchronisation toutes les 20 secondes, soit 180 appels API par heure.
- Modifications : sauvegarde différée de 1,5 seconde, avec lecture préalable et écriture si le contenu change réellement. Les frappes rapprochées sont regroupées.
- Lecture distante : le JSON complet est omis quand la révision connue est encore actuelle. Métadonnées et dix dates de sauvegarde restent envoyées.
- Dix sauvegardes complètes par compte, maximum 2 Mo par sauvegarde. La limite de taille par sauvegarde peut devenir contraignante pour un historique long, même avec un hébergement payant.
- Mise à jour : vérification au lancement/retour et chaque minute au premier plan.
- Authentification vérifiée par le serveur. Les lectures/écritures SQL, la taille des historiques et le cache d’authentification influencent le coût réel.
- Animations WebP : environ 83,4 Mo pour toute la bibliothèque. Cache sur l’appareil ; recharger l’ensemble sur 1 000 appareils représente environ 83 Go, hors application/API. Une mise à jour ne télécharge pas nécessairement toutes les animations.
- Sauvegarde témoin privée examinée : 7 319 octets, quatre modèles et aucun entraînement terminé. Ce petit échantillon ne représente pas un utilisateur après un an d’entraînement.

## Quotas officiels consultés

Sources : https://vercel.com/docs/plans/hobby ; https://vercel.com/pricing ; https://neon.com/pricing

Vercel Hobby : 100 Go de transfert, 1 million de requêtes CDN, 1 million d’appels de fonction, 4 heures CPU actives, 360 Go-heures de mémoire par mois. Usage personnel et non commercial. Dépasser un quota peut suspendre le service concerné ; cela ne signifie pas une montée en gamme automatique.

Neon Free : 100 CU-heures/mois/projet, 1 Go de base/projet, 5 Go de transfert sortant/projet, calcul jusqu’à 2 CU. À 0,25 CU, 100 CU-heures correspondent à 400 heures actives de calcul, moins si le calcul monte. Un faible trafic réparti toute la journée peut garder la base éveillée ; le nombre de comptes ne suffit pas à prédire cette consommation.

Vercel Pro : 20 USD/mois pour un siège de déploiement, avec 20 USD de crédit d’usage ; dépassements/ressources selon tarification en vigueur. Les utilisateurs de l’application ne sont pas des sièges développeur.

Neon Launch : 0,106 USD/CU-heure, 0,35 USD/Go-mois de base ; 500 Go de transfert sortant inclus par projet puis 0,10 USD/Go. Pas un forfait illimité. Ne pas confondre Neon Functions et les fonctions Vercel utilisées ici.

Prix en USD hors taxes. Les offres et conditions peuvent évoluer ; vérifier les tableaux de bord avant une ouverture publique.

## Modèle de calcul reproductible

Hypothèse : un appareil visible par personne, 18 séances d’une heure/mois, 40 groupes de modifications sauvegardés par heure, 180 lectures périodiques et jusqu’à 60 vérifications de mise à jour/heure.

Budget approximatif : 180 + 2 × 40 + 60 = 320 requêtes/heure/personne, soit environ 5 760/mois. Les démarrages, connexions, assets, versions installées et retours au premier plan s’ajoutent. La simultanéité peut grouper des appels, sans réduire le total mensuel.

- 50 utilisateurs réguliers : environ 288 000 requêtes/mois avant ces extras.
- 100 : environ 576 000.
- 150 : environ 864 000, déjà peu de marge dans le million gratuit.
- 30 personnes présentes ensemble deux heures chaque jour : environ 576 000/mois.
- 50 présentes ensemble deux heures chaque jour : environ 960 000, trop proche du quota avant les extras.

Le stockage peut dominer : dix copies de 0,5 Mo = environ 5 Mo/compte, soit un plafond arithmétique de 200 comptes dans 1 Go, avant index, comptes, autres données et marge. Dix copies au maximum de 2 Mo = environ 20 Mo/compte, soit seulement 50 comptes avant ces frais. La compression PostgreSQL peut réduire l’espace, sans garantie ; il faut mesurer le stockage effectif. Le transfert Neon dépend aussi des lectures de versions réellement nouvelles, notamment entre deux appareils.

## Estimation pratique

Gratuit : viser d’abord 50 à 100 utilisateurs réguliers avec des historiques modestes et des pointes de 20 à 30 utilisateurs simultanés. Ces nombres sont compatibles avec le modèle de requêtes, sous réserve du CPU, du stockage, du transfert et des heures de calcul. Ils ne garantissent pas l’absence de dépassement. Une présence continue 24 h/24 peut épuiser le calcul gratuit avec bien moins de personnes.

Payant Vercel Pro + Neon Launch : une pointe de 100 à 300 personnes correspondrait à environ 7 à 22 appels API de sauvegarde/seconde dans ce modèle (hors vérification de mise à jour). C’est une cible de dimensionnement plausible à confirmer par un test de charge isolé, pas une capacité mesurée. Le forfait ne fixe pas de nombre d’utilisateurs : les ressources et la facture augmentent avec l’usage.

Exemple de budget de base si la base reste active toute la journée : 0,25 à 1 CU moyen × 730 h × 0,106 = environ 19 à 77 USD/mois pour le calcul Neon. Avec Vercel Pro, cela donne environ 39 à 97 USD/mois avant stockage, historique de restauration, dépassements Vercel, transfert additionnel et taxes. Une utilisation intermittente peut coûter moins ; davantage de calcul coûte plus. Ce budget n’est pas une promesse que 300 utilisateurs y tiendront.

## Pour confirmer sans dépasser un budget

Mesurer une semaine d’utilisation représentative : requêtes, CPU/mémoire Vercel, CU-heures, transfert et stockage Neon, taille moyenne des dix copies. Extrapoler au mois, garder au moins 30 % de marge, puis faire un test de charge dans un environnement isolé. Sur les plans payants, examiner les alertes/plafonds disponibles chez chaque fournisseur ; ne pas supposer qu’une simple alerte bloque toute facturation.


## Scénario demandé : animations installées, cinq séances de deux heures par semaine

Cette estimation remplace la cible de 50–100 utilisateurs du scénario précédent. Hypothèse conservée : un appareil visible et connecté pendant toute la séance, 40 groupes de modifications sauvegardés par heure. Moyenne annuelle de 52/12 semaines par mois : 43,33 h et 21,67 séances/personne/mois. Pour un mois de cinq semaines : 50 h, soit environ 15 % de plus.

Requêtes estimées : 320/h × 43,33 h = 13 867/personne/mois, hors installation initiale, démarrages, connexions et mises à jour de l’application. Ce budget mêle appels API et vérifications statiques de mise à jour : il se compare au million de requêtes CDN, pas uniquement au million d’appels de fonction.

| Utilisateurs réguliers | Requêtes mensuelles estimées | Installation initiale des animations |
| --- | ---: | ---: |
| 20 | 277 333 | 1,668 Go |
| 30 | 416 000 | 2,502 Go |
| 40 | 554 667 | 3,336 Go |
| 50 | 693 333 | 4,170 Go |
| 60 | 832 000 | 5,004 Go |
| 70 | 970 667 | 5,838 Go |
| 100 | 1 386 667 | 8,340 Go |
| 300 | 4 160 000 | 25,020 Go |
| 1 000 | 13 866 667 | 83,400 Go |

83,4 Mo d’animations par appareil, à télécharger une fois tant que le cache persiste et que les fichiers restent identiques. Les animations sont hébergées sur Vercel, pas dans la base Neon. La première installation de l’application ajoute ses fichiers essentiels. Une réinstallation, un second appareil, une éviction du cache ou un remplacement des fichiers peuvent entraîner de nouveaux téléchargements. Un déploiement ne retélécharge pas systématiquement toute la bibliothèque : le cache média est conservé pour les mêmes chemins.

Gratuit : cible de départ 30 à 40 utilisateurs à ce rythme ; 50 est envisageable au regard des requêtes seules mais approche 800 000 pour un mois de cinq semaines, avant les extras. 70 n’offre pas de marge sur un mois moyen. Ne pas considérer ces nombres comme un engagement de capacité ou de gratuité : CPU, mémoire, stockage et calcul Neon doivent aussi rester sous leurs limites.

Le calcul Neon est particulièrement important : 100 CU-heures donnent au maximum 400 heures actives à 0,25 CU, soit environ 13 h/jour sur 30 jours. À cette taille, 24 h/24 pendant 30 jours consomment 180 CU-heures. Des utilisateurs dispersés dans différents créneaux peuvent donc épuiser le gratuit même avec un nombre de requêtes acceptable ; les pauses de cinq minutes avant mise en veille et l’authentification comptent aussi.

La simultanéité ne se déduit pas de ce budget mensuel. Si les mêmes 30 personnes s’entraînent ensemble, le total reste celui de 30 utilisateurs réguliers, mais la pointe est plus forte ; aucun test de charge n’a mesuré la limite. La synchronisation périodique donne N/20 lectures/seconde en moyenne, plus les sauvegardes et l’authentification. Le nombre 100–300 cité précédemment pour le payant est une cible hypothétique à tester, pas un résultat de mesure ni une garantie incluse dans 20 USD/mois.

Payant : 100 utilisateurs à ce rythme représentent environ 1,39 million de requêtes/mois ; 300 environ 4,16 millions. Pas de plafond forfaitaire d’utilisateurs. Exemple de base active 24 h/24, moyenne 0,25–1 CU sur 730 h : calcul Neon 19,35–77,38 USD/mois ; Vercel Pro 20 USD, soit environ 39–97 USD avant stockage, restauration, autres usages et taxes. Le crédit Vercel et les tarifs régionaux/ressources déterminent les éventuels frais supplémentaires. Ce calcul de budget n’établit pas que cette puissance suffira à 100, 300 ou 1 000 personnes.

Sources vérifiées de nouveau : https://vercel.com/docs/plans/hobby ; https://vercel.com/pricing ; https://neon.com/pricing. Aucun changement de code fonctionnel, de déploiement ou d’abonnement effectué pour ce recalcul.

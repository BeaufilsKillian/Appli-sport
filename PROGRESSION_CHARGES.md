# Double progression — 9 novembre 2026

La charge suggérée au démarrage d'une séance suit les répétitions réellement effectuées. La formule Epley inversée du 1RM reste inchangée ; elle fournit la charge de départ en l'absence d'une séance comparable. Sans 1RM, la dernière charge d'une série classique sert de repère. Aucune charge ni date de 1RM n'est réécrite automatiquement.

## Règles

Pour un exercice à trois séries de 12–15 répétitions, avec un palier de 2,5 kg :

| Dernière séance, même charge sur les trois séries | Prochaine suggestion |
| --- | --- |
| 50 kg × 15 / 14 / 12 | 50 kg, progresser en répétitions |
| 50 kg × 15 / 15 / 15 (ou plus) | 52,5 kg |
| 52,5 kg × 11 / 12 / 12, une seule fois | 52,5 kg |
| Même charge et au moins une série sous 12 sur les deux dernières séances comparables | 50 kg |

La hausse ne se cumule pas si la charge réellement effectuée reste 50 kg : elle reste alors proposée à 52,5 kg. Le système ne réduit pas la charge après un seul échec. Toutes les séries classiques prévues doivent être présentes, validées et à une charge identique. Une séance incomplète ou avec des charges différentes conserve la charge de sa première série, sans hausse ni baisse automatique. Aucun RPE obligatoire.

La comparaison porte sur les deux dernières séances terminées du même programme : exercice, position, séries, bornes min/max, repos, groupe et composition du superset, présence d'un dropset. Le contexte est mémorisé au démarrage ; un changement de ces paramètres repart de la charge de départ habituelle. Les anciennes séances sans ce contexte sont conservées mais ne déclenchent pas de progression automatique.

Les dropsets sont exclus du calcul ; leur préremplissage reste à 80 % de la suggestion avec l'arrondi existant. La progression automatique ne s'applique pas aux durées, aux objectifs à l'échec sans plage min/max ni aux exercices assistés/élastiques identifiés dans le catalogue. Pour un exercice personnalisé, la charge doit représenter la résistance ajoutée, pas le contrepoids d'assistance. Une clé de contexte trop longue pour le format de sauvegarde désactive seulement la comparaison pour ce cas.

## Utilisation

Fiche de l'exercice → Ma charge de référence → Modifier → **Palier de progression (kg)**. Réglage personnel commun aux programmes utilisant cet exercice, défaut 2,5 kg ; 0,1 à 100 kg avec deux décimales maximum, virgule ou point accepté. Modifier uniquement le palier ne réactualise pas la date du 1RM. Le palier peut être enregistré sans 1RM, avec une référence à zéro.

La suggestion et une raison courte s'affichent pendant la séance. Elles sont figées au démarrage, même après une modification du programme, du palier ou du 1RM, et conservées après réouverture. Les charges réellement saisies restent prioritaires. Les champs gris et la coche gardent leur fonction de copie de la performance précédente : une hausse suggérée n'est jamais enregistrée comme réalisée sans saisie correspondante.

## Données et compatibilité

Migration SQLite additive : `exercise_maxes.load_step`, `session_exercises.progression_key`, `suggested_load` et `progression_reason`. Pas de migration PostgreSQL : ces champs suivent le JSON privé existant. Sauvegarde version 11, lecture des versions 8/9/10 maintenue ; anciennes valeurs de contexte nulles et palier 2,5. Empreinte de synchronisation insensible à ces valeurs implicites, pour éviter des conflits dus à la seule migration. Les séances actives et leurs brouillons sont préservés. Les autres appareils doivent installer la version actuelle avant de lire une sauvegarde 11.

Le partage de dossier reste en version 2 : il transmet les programmes, sans le 1RM ni le palier personnel, comme auparavant. Nutrition et sa sauvegarde restent indépendantes.

Calcul et requête sur les deux dernières séances entièrement locaux. Aucun appel réseau ajouté ; légère augmentation du JSON de sauvegarde, limite existante de 2 Mo conservée. Aucune nouvelle dépendance ou offre payante.

## Vérifications

`tests/progression.cjs` : hausse, maintien, deux échecs, paliers personnalisés et bornes, séance partielle, charges mixtes, dropset ignoré, exercices exclus, contexte modifié, absence de hausse cumulée, formulaire réel de réglage avec virgule et erreur, 1RM inchangé, suggestion figée et saisie prioritaire, export/restauration, migration réelle 10→11 avec séance/brouillon actifs, empreinte inchangée, synchronisation entre deux bases et résolution des imports ESM dans Metro.

Régressions, PWA, sync, séries, partage, nutrition, accès, TypeScript, lint et export PWA vérifiés. Les tests utilisent des données fictives. Rendu sur iPhone et comportement biomécanique réel non vérifiés ; le nombre de répétitions ne suffit pas à vérifier la technique ou la fatigue.

Le principe de progression des répétitions puis de la charge est décrit par la NSCA : https://www.nsca.com/education/articles/nsca-coach/using-intensity-based-on-sets-and-repetitions-over-50-years-of-experience-a-brief-overview-of-load-setting-and-programming-strategy/. La règle de baisse après deux séances est un choix de produit explicite, pas un diagnostic de récupération.

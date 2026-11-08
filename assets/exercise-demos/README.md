# Démonstrations des exercices

Médias du site https://www.docteur-fitness.com/exercice-musculation intégrés à la demande de l'utilisateur pour son application personnelle.

`sources.json` conserve, pour chaque identifiant du catalogue local, le titre de la fiche source, son URL, l'URL du GIF original, ses dimensions et son nombre de frames. Les fichiers PNG sont la première frame des GIF, réduite pour les listes.

Les correspondances sont explicites dans `scripts/import-docteur-fitness.py`. Les variantes sans correspondance vérifiée restent sans média local et disposent d'un lien de recherche dans l'interface. Les identifiants d'exercices et les données SQLite restent inchangés.

Ces fichiers sont des médias tiers ; ce dossier ne leur attribue aucune licence nouvelle.

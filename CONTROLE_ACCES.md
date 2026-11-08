# Contrôle des accès — 29 octobre 2026

Le compte propriétaire est lié côté serveur à son identifiant Neon existant et à son adresse e-mail. Aucun autre compte ne reçoit le rôle administrateur, même en connaissant le mot de passe secondaire. Celui-ci est stocké sous forme de dérivé scrypt, jamais dans le navigateur.

## Utilisation

Chaque nouveau compte attend une acceptation. Avant celle-ci, ni les séances locales ni les API privées ne sont accessibles. Administration est visible uniquement dans le Profil du propriétaire. Chaque ouverture requiert le mot de passe secondaire ; le déverrouillage expire après 15 minutes et reste lié à la session du compte. Les demandes présentent uniquement l’adresse e-mail. Accepter ou refuser exige de recopier le mot correspondant. Un accès accepté peut ensuite être retiré.

Le propriétaire voit le nombre de demandes sur son icône Profil et une alerte dans l’application. Pour les notifications système, ouvrir Administration puis « Activer mes notifications » sur chaque appareil souhaité. Sur iPhone, utiliser la PWA installée et autoriser les notifications. Le bouton de test permet de vérifier la réception réelle. Le service worker ignore les notifications sur un appareil qui n’a pas été activé pour le propriétaire et efface son marqueur à la déconnexion.

## Connexion Internet et fonctionnement hors ligne

Une autorisation signée permet au maximum 24 heures hors connexion depuis la dernière vérification réussie par Wi-Fi ou réseau mobile. Il n’est pas nécessaire de saisir son mot de passe chaque jour si la session reste valide. Au-delà, l’interface se verrouille ; la séance et ses saisies sont conservées. Le retour d’Internet renouvelle l’autorisation si le compte est toujours accepté. Les API privées vérifient l’état en base à chaque requête. Le client vérifie au lancement, au retour au premier plan et périodiquement pendant l’utilisation.

Limites : un appareil déjà hors ligne peut conserver son autorisation jusqu’à son échéance de 24 heures après un retrait. Une ancienne version déjà en cache doit installer la mise à jour pour appliquer le verrouillage local ; ses API privées sont bloquées dès maintenant si le compte n’est pas accepté. Aucune application web ne peut récupérer des données déjà exportées ni garantir un verrouillage contre une modification volontaire du navigateur ou du code local. Les notifications dépendent des permissions, du système et du réseau.

## Configuration et validation

Migration : migrations/003_access_control.sql (RLS et absence de droits publics sur quatre tables). Variables exclusivement serveur : ADMIN_EMAIL, ADMIN_USER_ID, ADMIN_PASSWORD_HASH, ACCESS_LEASE_PRIVATE_JWK, ADMIN_VAPID_PUBLIC_KEY, ADMIN_VAPID_PRIVATE_KEY. La clé publique embarquée ne permet pas de signer une autorisation. Les secrets sont configurés dans Vercel Production et exclus de l’envoi des sources.

Commandes : npm run typecheck ; npm run lint ; npm run build ; npm run test:access ; npm run test:access:neon (uniquement avec la branche de test distincte de production) ; npm run test:pwa.

Tests de sécurité : attente et révocation sans API privée, compte propriétaire unique, cookie secondaire HttpOnly/Secure/SameSite Strict lié à la session, confirmation exacte, limitation des essais, signature et échéance 24 h, mauvaise identité et rôle falsifié, validation des destinations push, notifications réservées au propriétaire. Tests visuels : inscription, attente, compteur, acceptation et absence d’administration chez un membre ; expiration puis reprise d’une séance avec saisie partielle conservée.

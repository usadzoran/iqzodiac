# IQZodiac Discovery / AI Assistant — préparation d’intégration

**Statut : non connecté.** IQZodiac est actuellement un site prototype servi par `server.js`. L’inscription n’authentifie pas un compte, les données locales du navigateur ne constituent pas une base partagée, aucun fournisseur d’IA n’est appelé, et le dépôt ne contient pas de répertoire de membres réels. Le schéma `database/schema.sql` est une proposition de migration Supabase/PostgreSQL uniquement ; elle n’a pas été appliquée.

## Flux visé

1. Après la création locale du profil par le formulaire d’inscription actuel, ouvrir `assistant.html`. Tant que l’authentification n’est pas raccordée, l’écran explique honnêtement que la conversation n’a pas commencé.
2. Une fois un fournisseur IA et un backend authentifié raccordés, reprendre les réponses existantes si le statut de découverte est `completed`; sinon demander une seule question à la fois. Chaque tour accepte un identifiant d’option ou un texte libre, valide la réponse, la sauvegarde côté serveur, puis renvoie la question suivante.
3. À la fin, le serveur calcule un résumé/personnalité et les intérêts à partir des réponses. Le signe zodiacal est calculé uniquement depuis `birth_date` avec les limites de dates appropriées; il ne doit jamais être déduit des réponses de personnalité.
4. Chercher des profils réels avec découverte terminée et visibilité explicite activée, exclure l’utilisateur connecté, filtrer selon ses préférences et retourner une liste vide si aucun membre n’est admissible. Ne pas utiliser les profils statiques de `privacy-core.js` comme résultats réels.
5. Renvoyer les profils via une route serveur authentifiée et filtrée; ne pas rendre public l’accès aux tables de réponse. Toute révélation de profil ou toute mise en relation reste soumise au consentement et aux règles d’accès déjà prévues par le site.

## Contrat API proposé (à implémenter après connexion)

- `POST /api/discovery/session` — authentifie l’utilisateur, retourne son état de découverte; accepte `start` uniquement si aucune réponse complète n’existe.
- `POST /api/assistant/discovery/turn` — reçoit `{ sessionId, answerChoice?, answerText? }`; ne traite qu’une réponse au tour courant, stocke la réponse, retourne la prochaine question ou un état `completed`. Les clés fournisseur IA restent côté serveur.
- `GET /api/discovery/result` — retourne uniquement le résultat de l’utilisateur authentifié et son `zodiac_sign` calculé depuis sa date de naissance.
- `GET /api/matches` — retourne seulement des comptes réels qui ont choisi d’être visibles et des résultats admissibles. Répond par `[]` si aucun profil ne correspond; ne crée jamais de membres ou de scores fictifs.

Ces routes sont des contrats de conception, pas des endpoints opérationnels dans cette livraison. La route existante `/api/daily-feed` n’est pas un backend d’authentification ou de découverte.

## Raccordement de production requis

- Choisir et activer Supabase (Auth + base) et un fournisseur IA compatible avec le traitement côté serveur; aucun fournisseur n’est activé dans cette session.
- Ajouter une authentification réelle et une migration/recréation de profils. Les profils `localStorage` créés par le prototype ne peuvent pas être considérés comme des comptes vérifiés ou transférés automatiquement.
- Appliquer et tester la migration avec RLS. Ajouter une méthode explicite de consentement/visibilité des profils et des champs privés avant de rendre la recherche disponible.
- Mettre les clés dans les secrets du serveur; ne jamais exposer une clé de service ou d’IA dans le navigateur. Ajouter contrôle de débit, validation des entrées, rétention/suppression et consentement adapté avant d’envoyer des réponses à un fournisseur IA.
- Tester authentification, reprise de progression, calcul de date zodiacale aux limites de signes, politiques RLS, résultats vides, visibilité, et accès multi-utilisateurs avant d’annoncer le service comme actif.

## Fichiers de cette préparation

- `assistant.html` / `assistant.css` : écran et état d’intégration visibles, sans fausse conversation ni faux résultat.
- `database/schema.sql` : structure candidate avec réponses, profil, état de progression et règles RLS utilisateur.
- `discover.html` : porte d’entrée vers l’assistant pour la découverte de soi et vers Match pour rencontrer des personnes.

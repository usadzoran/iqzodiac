# IQZodiac Discovery / AI Assistant — préparation d’intégration

**État actuel : démonstration locale uniquement.** L’écran Assistant propose maintenant une conversation séquentielle, les questions de personnalité déjà utilisées dans le projet, des choix et des réponses libres. Le résultat est calculé dans le navigateur par des règles simples; aucun modèle d’IA n’est appelé. Les réponses, intérêts et date de naissance sont conservés dans le `localStorage` de ce navigateur, par profil local. Ils ne sont ni envoyés à un serveur, ni synchronisés, ni protégés comme un compte authentifié. L’inscription du projet reste également une maquette locale.

Le projet n’est relié à aucun fournisseur d’IA ou backend de compte. Aucune base Supabase n’a été connectée. `database/schema.sql` demeure un schéma préparatoire non appliqué; aucune requête n’y est adressée par la démo.

## Comportement de la démo

1. Après l’inscription prototype, `assistant.html?welcome=1` affiche un accueil humoristique qui explique que les réponses servent à explorer la communauté dans laquelle l’utilisateur pourrait se sentir à sa place et le type de personne qu’il souhaite rencontrer.
2. Le guide pose une question à la fois à partir de la série actuelle de 12 questions. L’utilisateur peut choisir une réponse ou saisir son propre texte. Les intérêts sont demandés séparément.
3. Les réponses à choix produisent un résultat illustratif à partir du décompte des quatre éléments. Les réponses libres restent enregistrées comme notes et une petite liste de mots-clés, clairement indicative, peut contribuer au résultat. Ce n’est pas une compréhension par IA ni une évaluation psychologique.
4. La date de naissance est demandée séparément pour calculer le signe zodiacal; ce dernier n’est jamais déduit des réponses de personnalité.
5. La progression peut reprendre sur le même navigateur pour le même profil local. Le bouton de redémarrage efface la progression de démonstration de ce profil.
6. Le lien vers Match mène à l’état d’attente du site : faute de base de membres réels, aucun profil ou score de compatibilité fictif n’est présenté.

Ne saisissez pas de données sensibles dans cette démo. L’effacement des données du navigateur ou le changement de navigateur/appareil supprime l’accès à la progression locale.

## Contrat futur — seulement si une intégration réelle est demandée

- `POST /api/discovery/session` — authentifie l’utilisateur et récupère son état de découverte.
- `POST /api/assistant/discovery/turn` — traite une seule réponse et sauvegarde l’avancement côté serveur.
- `GET /api/discovery/result` — retourne le résultat de l’utilisateur et son `zodiac_sign` calculé depuis sa date de naissance.
- `GET /api/matches` — retourne seulement des comptes réels admissibles ayant choisi d’être visibles; renvoie `[]` lorsqu’aucun profil ne correspond.

Ces routes sont des contrats de conception, pas des endpoints opérationnels. La route existante `/api/daily-feed` n’est pas un backend de comptes ou de découverte.

Une intégration réelle nécessiterait une authentification, une base, des règles RLS testées, un service IA côté serveur, des secrets serveur, une politique de consentement/visibilité, des contrôles de débit et une stratégie de migration des profils locaux. Rien de cela n’est activé dans cette version.

## Fichiers

- `assistant.html`, `assistant.css`, `assistant.js` : interface conversationnelle locale et démo à règles explicites.
- `database/schema.sql` : structure candidate avec profils, réponses, progression et politiques RLS; non appliquée.
- `discover.html` : porte d’entrée vers Assistant et Match.

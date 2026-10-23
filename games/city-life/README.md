# City Life — prototype Three.js

City Life est actuellement un prototype arabe d’exploration urbaine 3D isométrique. Il ne constitue pas encore le jeu complet décrit dans le brief : la création des personnages et les autres fonctions de production restent à réaliser dans les étapes suivantes.

## Fonctionnalités présentes

- Place urbaine en 3D et six destinations distinctes, dont un logement, un café, un magasin de meubles, un magasin de vêtements, un magasin d’électroménager et une épicerie.
- Entrée et sortie d’intérieurs, caméra isométrique, sélection des lieux, recherche arabe, filtres, mini-carte et affichage d’un trajet.
- Commandes WASD/flèches sur ordinateur et joystick tactile sur téléphone.
- Six véhicules bas-poly circulent en boucle, avec roues et feux animés; la fontaine et la place ont des effets lumineux discrets.
- Un mode de vision immersive masque les panneaux pour mieux voir la ville; le bouton de restauration et la touche H restent accessibles.
- Sauvegarde locale de la position, de la destination et des lieux visités dans le navigateur.
- Interface arabe RTL et paramètres de vitesse/caméra réellement consommés par le pont Tweak de développement.
- Icône de ville personnalisée et écran de chargement léger, sans image générée.

## À réaliser ultérieurement

- Les trois personnages humains gratuits, leur personnalisation, prévisualisation et animation squelettique sont volontairement différés.
- Le Character Store, la persistance entre comptes/appareils, l’inventaire et la vérification serveur n’existent pas encore.
- Aucun paiement, achat réel ni collecte de données de paiement n’est activé.
- Le mobilier interactif, les passants et les bâtiments plus réalistes restent des étapes futures.

Aucun modèle ou achat payant n’est intégré dans cette version. Ne lancez pas de production d’assets payante sans autorisation explicite.

## Développement

```bash
pnpm install
pnpm dev       # http://localhost:5173
pnpm build     # vérification TypeScript + build Vite + contrôle de taille
pnpm test      # tests unitaires
pnpm smoke     # test Playwright après le build
```

Le projet est une application Three.js/Vite. Son entrée active est `src/city-main.ts`; la scène urbaine et ses intérieurs se trouvent dans `src/game/city-world.ts`, les commandes/navigation dans `src/game/city-game.ts`, l’interface dans `src/ui/city-ui.ts` et l’état local dans `src/game/city-state.ts`.

Le dépôt du site IQZodiac conserve le source sous `games/city-life/` et la sortie statique sous `city-life/`. Pour renouveler cette sortie depuis ce dossier après `pnpm build` :

```bash
rsync -a --delete dist/ ../../city-life/
```

Les fichiers de pont Tweak sous `scripts/manus-tuning/` sont des outils de développement spécifiques à la prévisualisation Manus. Les fichiers d’identité/runtime locaux et les dépendances installées ne sont pas inclus dans le dépôt.

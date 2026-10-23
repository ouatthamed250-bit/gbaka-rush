# Feuille de route

## Étape 0 : prototype (fait)
Menu, course, trafic, argent, garage, sauvegarde, icônes, déploiement Vercel.

## Étape 1 : tester et sentir le jeu
- Déployer sur Vercel, tester sur 2 ou 3 vrais téléphones, dont un d'entrée de gamme.
- Mesurer la fluidité (cible 30 images/s). Corriger d'abord ce qui rame.
- Régler : sensibilité du glissement, vitesse, dégâts, gains (`src/config.js`).

## Étape 2 : vrai gbaka 3D
- (fait) Chargement de `gbaka.glb` avec GLTFLoader, repli automatique sur le gbaka en boîtes,
  roues animées, pot d'échappement, apprenti accroché à la porte.
- (fait) Peintures arrière et côtés : panneaux posés automatiquement, ou panneaux `skin_*` du fichier.
- (à faire) Livrer le fichier `public/models/gbaka.glb` et les images `public/skins/*_cote.jpg`
  (voir `docs/ASSETS.md`). Aucun code à changer pour les activer.

## Étape 3 : décor et trafic d'Abidjan
- (fait) Morceaux de rue modulaires : ville, marché de rue, quartier d'habitation et pont au-dessus de
  la lagune Ébrié. Chaque ambiance existe en plusieurs variantes fusionnées en un seul maillage
  (`src/game/world.js`) : la fluidité ne dépend pas du nombre d'objets. Le choix des ambiances est dans
  `src/game/districts.js`, les réglages dans `src/config.js` (`DISTRICTS`), et un test le vérifie
  (`tests/world.mjs`).
- (fait) Plus de variété de véhicules : gbaka, pick-up, bus Sotra, motos, minibus, camions.
- (à faire) Contrôle de police, nids-de-poule, pluie, nuit.

## Étape 3 bis : les niveaux (fait)
- Quatre niveaux (communes) avec un **objectif de passagers** : Yopougon 10, Adjamé 12, Plateau 14,
  Embouteillage 16. Le trafic est plus dense et plus lent à chaque niveau.
- Objectif atteint : la course s'arrête sur un écran « Niveau réussi » (bilan, prime, record) avec
  le bouton **Niveau suivant**. 100 % de dégâts : le niveau est raté, « Rejouer » relance le même.
- Après le dernier niveau : **course libre** (le trafic s'épaissit avec la distance, record à battre).
- Progression sauvegardée (`level` dans `src/save.js`), nivelée dans `LEVELS` (`src/config.js`),
  règles pures dans `src/game/levels.js`, testées par `tests/levels.mjs`. Le parcours complet
  (objectif → bilan → niveau suivant, échec, course libre) est vérifié par `tests/game-flow.mjs`
  avec un faux DOM.
- Reste à faire : une carte des niveaux pour rejouer un ancien niveau (bouton « Carte » du garage).

## Étape 4 : son et ambiance
- Vrais sons, voix de l'apprenti en nouchi, musique.

## Étape 5 : fidélisation
- Missions du jour, cadeau quotidien, classement par commune, « Défie-moi » WhatsApp.

## Étape 6 : revenus
- Publicités récompensées, achats par mobile money, peintures sponsorisées.

## Étape 7 : sortie
- Test avec 20 à 30 personnes, puis Play Store (et App Store plus tard) avec Capacitor.
- Vérifier le nom « Gbaka Rush » (recherche sur Google Play et TikTok) avant de publier.

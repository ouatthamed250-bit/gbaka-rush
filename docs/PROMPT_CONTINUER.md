# Prompt pour continuer la construction

Copie le texte ci-dessous dans **Claude Code** (ou le chat de ton assistant IA dans VS Code),
ouvert dans le dossier `gbaka-rush`. Il lit aussi `CLAUDE.md` tout seul.

---

Tu travailles sur **Gbaka Rush**, un jeu mobile 3D ivoirien (Abidjan) fait avec Three.js et Vite, déployé sur Vercel.
Je suis Hamed, fondateur solo à Abidjan, petit budget. Parle-moi en français simple.

**Commence par lire** : `CLAUDE.md`, `README.md`, `docs/GAME_DESIGN.md`, `docs/ASSETS.md`, `docs/ROADMAP.md`, puis `src/config.js` et `src/game/game.js`.
Lance `npm install` puis `npm run dev`, vérifie que le jeu démarre, et dis-moi en 5 lignes ce que tu as compris et l'état du projet.

**Ensuite, travaille par petites étapes. Après chaque étape : `npm run build` doit passer, tu me dis ce que tu as changé et comment le tester, et tu attends mon « ok » avant la suivante.**

Étape A : **solidité et fluidité**
1. Ajoute un petit compteur d'images par seconde (affiché seulement avec `?debug` dans l'adresse) et un réglage automatique : si la fluidité tombe sous 30 images/s pendant 3 secondes, passer en qualité « éco » (résolution 1, moins de véhicules actifs).
2. Vérifie les collisions et la règle « une voie libre toujours » avec un petit test automatique (script Node, comme une simulation de 5 minutes).
3. Corrige tout bug que tu trouves dans les commandes à un seul doigt (glissement, relâchement, perte de focus de l'onglet, rotation de l'écran).

Étape B : **vrai modèle 3D du gbaka**
1. Ajoute le chargement d'un fichier `public/models/gbaka.glb` avec GLTFLoader, avec repli automatique sur le gbaka en boîtes s'il est absent ou s'il échoue.
2. Exige des noms d'objets précis dans le GLB (`wheel_FL`, `wheel_FR`, `wheel_RL`, `wheel_RR`, `door_side`, `body`, `exhaust`) et écris-les dans `docs/ASSETS.md`.
3. Pose les peintures : texture du côté et de l'arrière en plus de l'arrière actuel (`SKINS` dans `src/config.js` : ajoute `side`).
4. Ajoute un apprenti simple accroché à la porte (animation légère).

Étape C : **décor d'Abidjan**
1. (fait) Morceaux de rue modulaires : ville, marché de rue, quartier d'habitation et pont au-dessus de la lagune, chacun en 2 à 6 variantes **fusionnées en un seul maillage** (une variante = 2 appels de dessin, moins qu'avec des instances). Le choix se règle dans `DISTRICTS` (`src/config.js`) et se vérifie avec `tests/world.mjs`.
2. (fait) Variation par commune : chaque secteur a sa palette, ses façades, son horizon, sa foule et ses taxis-motos (`SECTORS` dans `src/config.js`, styles dans `src/game/world.js`). Reste à faire : la nuit et la pluie.

Étape C bis : **les niveaux = secteurs** (fait)
1. (fait) Cinq niveaux, un par commune (Yopougon, Adjamé, Plateau, Treichville, Cocody), avec un objectif de passagers, une prime, un écran « Niveau réussi » et le bouton « Niveau suivant ». 100 % de dégâts = on rejoue le même niveau. Après le dernier niveau : course libre. Chaque commune a ses quartiers : les arrêts changent de quartier, l'apprenti les appelle et le HUD affiche « Commune · Quartier ». Réglages dans `SECTORS` et `LEVELS` (`src/config.js`), règles dans `src/game/sectors.js` et `src/game/levels.js`, tests dans `tests/sectors.mjs`, `tests/levels.mjs` et `tests/game-flow.mjs` (parcours complet avec un faux DOM).
2. (à faire) Carte des niveaux (rejouer un niveau déjà réussi) et missions du jour branchées sur les niveaux.

Étape D : **son**
1. Charge de vrais sons depuis `public/audio/` (moteur en boucle, klaxon, choc, voix de l'apprenti) avec repli sur les sons générés actuels.
2. Respecte le réglage « Son » et ne démarre le son qu'après un premier toucher.

Étape E : **fidélisation**
1. Missions du jour (ex. « Transporte 20 passagers », « Roule 3 km sans choc ») et cadeau quotidien.
2. Bouton « Défie-moi » qui partage le score sur WhatsApp (lien `https://wa.me/?text=...`).

**Rappels importants** : un seul doigt (jamais de boutons gauche/droite), vertical, low-poly, 30 images/s sur téléphone d'entrée de gamme, aucun visage de vraie personne, aucun logo ou marque réelle, tout l'équilibrage dans `src/config.js`.

Commence maintenant par la lecture et le résumé, puis l'étape A.

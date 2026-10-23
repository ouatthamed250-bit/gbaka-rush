# Gbaka Rush

Jeu mobile 3D ivoirien : tu conduis un gbaka dans les rues d'Abidjan, avec **un seul doigt**
(appuyer = accélérer, glisser = dévier, lever le doigt = freiner). Format **vertical**.

État : **prototype jouable** (modèles provisoires en boîtes). Le but de ce dépôt est de continuer à le construire.

- Dépôt : https://github.com/ouatthamed250-bit/gbaka-rush
- À chaque envoi sur `main`, GitHub lance `npm test` puis `npm run build` (`.github/workflows/tests.yml`).

## Installer et lancer (VS Code)

1. Installe **Node.js 20 ou plus** (https://nodejs.org, version LTS) et **VS Code**.
2. Ouvre le dossier `gbaka-rush` dans VS Code (Fichier > Ouvrir le dossier).
3. Ouvre le terminal (Ctrl+`) puis :

```bash
npm install
npm run dev
```

4. Ouvre l'adresse affichée (http://localhost:5173) dans Chrome.
   - **Sur ordinateur** : Espace ou Flèche haut = accélérer, Flèches gauche/droite = dévier.
   - **Sur ton téléphone** (même Wi-Fi) : ouvre l'adresse « Network » affichée dans le terminal (ex. `http://192.168.1.20:5173`).
   - Astuce : dans Chrome, F12 puis l'icône « téléphone » pour simuler un écran vertical.

## Mettre en ligne avec Vercel

**Méthode 1 (la plus simple)**
1. Crée un compte sur https://vercel.com et un dépôt sur https://github.com.
2. Envoie le projet sur GitHub (`git init`, `git add .`, `git commit -m "premier jet"`, puis pousse sur GitHub).
3. Sur Vercel : « Add New > Project », choisis le dépôt, puis « Deploy ». Rien à régler : `vercel.json` s'en charge.

**Méthode 2 (sans GitHub)**
```bash
npx vercel
```
Réponds aux questions, puis `npx vercel --prod` pour la version publique.

Chaque `git push` met ensuite le jeu à jour automatiquement.

## Installer comme une appli sur le téléphone
Ouvre le lien Vercel dans Chrome (Android) > menu > « Ajouter à l'écran d'accueil ». L'icône vient du logo.

## Mettre le vrai gbaka 3D
Dépose le fichier dans `public/models/gbaka.glb` : **rien d'autre à faire**. Le jeu le charge au
démarrage et remplace le gbaka en boîtes. S'il manque, s'il est illisible ou s'il n'a pas d'objet
`body`, le jeu garde le gbaka en boîtes sans erreur.

- Les noms d'objets exigés (`body`, `wheel_FL`, `wheel_FR`, `wheel_RL`, `wheel_RR`, `door_side`,
  `exhaust`), les dimensions et l'orientation sont décrits dans `docs/ASSETS.md`.
- Le fichier est vérifié par un test automatique (`npm test`) et par la console du navigateur (F12) :
  elle liste les objets manquants.
- Pour voir le compteur d'images et l'état de la qualité, ouvre le jeu avec `?debug` dans l'adresse.

## Structure

```
gbaka-rush/
├─ index.html              écrans (menu, HUD, pause, fin, niveau réussi, garage, paramètres)
├─ vercel.json             réglages Vercel
├─ package.json            dépendances (three, vite, police Montserrat)
├─ tests/                  tests automatiques (npm test), sans navigateur
│  ├─ simulate.mjs         collisions, trafic, dégâts, montée/descente
│  ├─ model.mjs            gbaka 3D et ses pièces
│  ├─ world.mjs            décor d'Abidjan et variantes
│  ├─ levels.mjs           objectifs, progression, prime, course libre
│  ├─ ui.mjs               identifiants de l'interface branchés sur index.html
│  └─ game-flow.mjs        parcours d'un niveau avec un faux DOM (bilan, échec)
├─ public/                 fichiers servis tels quels
│  ├─ brand/logo.png       logo (version provisoire, à redessiner en vectoriel)
│  ├─ icons/               icônes de l'appli (générées depuis le logo)
│  ├─ models/              gbaka.glb (le vrai modèle 3D, dès qu'il est livré)
│  ├─ skins/               peintures du gbaka (arrière et côtés)
│  └─ manifest.webmanifest nom et icônes de l'appli
├─ src/
│  ├─ main.js              point d'entrée, branche tout
│  ├─ config.js            TOUS les réglages (vitesse, niveaux, peintures, prix)
│  ├─ styles.css           style de l'interface (palette de la marque)
│  ├─ ui.js                affichage des écrans, garage, boutons
│  ├─ input.js             commande à un seul doigt (+ clavier)
│  ├─ audio.js             sons générés (moteur, klaxon, choc)
│  ├─ save.js              sauvegarde locale
│  └─ game/
│     ├─ game.js           boucle de jeu, collisions, argent, passagers, niveaux
│     ├─ levels.js         règles des niveaux (objectif, progression, course libre)
│     ├─ gbaka.js          gbaka (vrai modèle ou boîtes) + fumée noire
│     ├─ gbaka-model.js    chargement du fichier gbaka.glb (GLTFLoader) et préparation
│     ├─ model-contract.js noms d'objets attendus dans le GLB, placement des peintures
│     ├─ apprenti.js       l'apprenti qui sort et crie les destinations
│     ├─ people.js         passants sur les trottoirs
│     ├─ mesh-utils.js     outil pour fusionner des formes 3D (fluidité)
│     ├─ districts.js      choix des ambiances de rue (ville, marché, quartier, pont)
│     ├─ traffic.js        voitures, camions, motos, bus, embouteillages
│     └─ world.js          route infinie, immeubles, marché, pont et lagune
├─ docs/                   règles du jeu, liste des images à faire, feuille de route, prompt
├─ assets-source/          images de travail (NON déployées) : planches, photos de référence
└─ CLAUDE.md               consignes pour l'assistant IA
```

## Ce qui marche déjà
- Menu, course, pause, fin de partie, **niveaux**, garage (4 améliorations, 6 peintures dont 4 verrouillées), paramètres.
- **4 niveaux (communes)** : Yopougon, Adjamé, Plateau, Embouteillage. Chacun a un objectif de
  passagers (10, 12, 14, 16), une prime et un trafic plus dense. Objectif atteint → écran
  « Niveau réussi » avec le bilan, puis bouton **Niveau suivant**. 100 % de dégâts → on rejoue le
  même niveau. Après le dernier niveau, la **course libre** se débloque (le trafic s'épaissit avec
  la distance). La progression est sauvegardée (`src/save.js`, champ `level`). Réglages :
  `LEVELS` dans `src/config.js`.
- Un doigt : accélérer, dévier, freiner (délai de grâce de 0,2 s).
- Fumée noire, secousses, roulis du gbaka, trafic qui s'épaissit par commune, klaxon automatique.
- **L'apprenti** sort la tête et le bras du gbaka pour crier les destinations (« Adjamé, Adjamé ! », « Yopougon Siporex ! », « Niangon, à gauche, à droite ! », « Adjamé Liberté, par le pont ! »...), puis rentre. Quand le gbaka est plein, il crie « Complet ! ». Les cris sont dans `src/config.js` (`APPRENTI_CRIS`).
- **Ville en relief** : immeubles à fenêtres, boutiques avec auvents, balcons, trottoirs surélevés, lampadaires, poteaux et fils électriques, palmiers, étals de marché avec parasols, panneaux, passages piétons, ralentisseurs, grandes tours au fond et silhouette lointaine d'Abidjan.
- **Quartiers qui défilent** : la rue change d'ambiance tous les 48 m — la ville, le **marché de rue** (étals, parasols, vendeuses, hangar, banderoles), le **quartier d'habitation** (murs, cours, linge qui sèche, maquis) et le **pont au-dessus de la lagune Ébrié** (rambardes, lampadaires, pirogues et pêcheurs sur l'eau). Le nom du quartier s'affiche quand on y entre (réglages : `DISTRICTS` dans `src/config.js`).
- **Trafic varié** : taxis compteurs, woro-woro, berlines, minibus, camions, motos avec passager, un autre gbaka, pick-up bâché et le bus bleu de la Sotra.
- **Passants** sur les trottoirs : ils marchent, certains font signe au gbaka (bras levé).
- **Le gbaka 3D** : le fichier `public/models/gbaka.glb` est chargé automatiquement s'il existe
  (roues qui tournent, porte pour l'apprenti, pot d'échappement), sinon le gbaka en boîtes sert de
  repli. Dans les deux cas, la peinture (arrière, et côtés dès que les images seront là) et
  l'apprenti fonctionnent.
- Arrêts de gbaka (passagers qui montent/descendent), argent en FCFA, sauvegarde, peintures Maestro et Éléphant (arrière).
- Tests automatiques sans navigateur (`npm test`) : collisions et trafic, modèle 3D, décor,
  **niveaux** (`tests/levels.mjs`), écrans de l'interface (`tests/ui.mjs`) et **parcours complet
  d'un niveau** (`tests/game-flow.mjs`, avec un faux DOM : objectif atteint → bilan → niveau suivant).

## Ce qui est provisoire
- **Le gbaka et les voitures sont des boîtes** tant que `public/models/gbaka.glb` n'est pas livré.
- Les côtés des peintures ne sont pas encore posés : il manque les images `*_cote.jpg` (le code est prêt).
- Sons générés par le navigateur (pas de vrais enregistrements).
- Équilibrage (vitesse, prix, gains) à tester sur de vrais téléphones.
- Testé : le projet compile (`npm run build`) et la logique tourne en simulation. **Pas encore testé visuellement sur un téléphone.**

Pour la suite de la construction, lis `docs/PROMPT_CONTINUER.md`.

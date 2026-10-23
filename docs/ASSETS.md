# Images et fichiers à produire

Les images de travail sont dans `assets-source/`. Ce qui est déployé est dans `public/`.

## Fait
- [x] Gbaka de base (toit haut, échelle arrière, pare-buffle) : `assets-source/01_Gbaka_base_VALIDE/`
- [x] Peinture **Maestro** : arrière + côté (côté à refaire avec la **porte fermée**)
- [x] Peinture **L'Éléphant** : arrière (côté à faire). Vérifier l'orthographe du titre (un « L » en trop possible).
- [x] Planches low-poly : camionnette, taxi compteur, taxi vert (woro-woro), moto livreur
- [x] Palette, police (Montserrat), maquettes d'écrans (ChatGPT)
- [x] Icônes de l'appli (depuis le logo)

## À faire (par ordre d'importance)
1. **Modèle 3D du gbaka** (fichier .glb, < 5 000 triangles, roues séparées, porte coulissante qui peut s'ouvrir, échelle arrière). Poser dans `public/models/gbaka.glb` : voir le contrat ci-dessous.
2. **Côtés des peintures** (porte fermée) : Maestro et Éléphant → `public/skins/maestro_cote.jpg` et `elephant_cote.jpg` (voir plus bas).
3. **4 peintures verrouillées** : La Reine du Pagne, Le Grand Comédien, Supporter du Monde, La Légende Dorée. Même méthode : partir de `gbaka_cote_passager.png` et `gbaka_arriere.png`, visages **inventés**, pas de logos.
4. **Logo en vectoriel** (le logo actuel est une petite image générée par IA, et il montre un taxi au lieu du gbaka). À redessiner, avec le gbaka validé.
5. Modèles 3D des autres véhicules (taxi, woro-woro, camionnette, moto) : un seul modèle de taxi recoloré suffit pour les deux taxis.
6. Décor d'Abidjan : morceaux de rue modulaires (carrefour, marché, pont, bord de lagune), à partir de **tes propres photos**.
7. Sons réels : moteur, klaxon, choc, **voix de l'apprenti enregistrée** (une par cri de `APPRENTI_CRIS`), musique.
   Passants et apprenti : remplacer les formes simples par de vrais petits personnages 3D (visages inventés, tenues wax).
8. Capture d'écran et bannière pour le Play Store / les réseaux.

## Règles
- Pas de visage de vraie personne. Pas de logo ni de marque. Pas de reprise d'images d'autres créateurs.
- Vérifier la licence commerciale de tout outil qui génère des modèles 3D ou des images.
- Un seul style : low-poly, couleurs plates. Les peintures se posent sur un même modèle (même forme, même taille).

## Contrat du fichier `public/models/gbaka.glb`

Dépose le fichier à cet endroit : **rien à changer dans le code**. Au lancement, le jeu essaie de
le charger ; s'il est absent, il garde le gbaka en boîtes, sans erreur et sans ralentir le jeu.

### Dimensions et orientation
- 1 unité = 1 mètre. Le gbaka fait environ **6,2 m de long, 2,1 m de large, 2,8 m de haut**.
- L'**avant regarde vers -Z**, le haut vers +Y (export glTF par défaut de Blender).
- L'origine est au **centre, au niveau du sol** (les roues touchent y = 0).
  Le jeu recentre tout seul si elle est ailleurs, et corrige une échelle aberrante (hors 4 à 10 m).
  Pour un ajustement fin : `GBAKA.yaw` (rotation) et `GBAKA.scale` dans `src/config.js`.
- Moins de **5 000 triangles**, couleurs plates, pas d'ombres.
- **Pas d'armature** (modèle rigide) : les roues sont des objets séparés, pas des os.

### Noms d'objets (obligatoires)
| Nom exact | Rôle | Important |
|---|---|---|
| `body` | caisse peinte (maillage ou groupe) | matériau **blanc et sans image** : le jeu y applique la couleur choisie. Ne pas y mettre les roues, vitres ni pneus |
| `wheel_FL` | roue avant gauche | pivot **au centre de la roue**, essieu selon **X** |
| `wheel_FR` | roue avant droite | idem |
| `wheel_RL` | roue arrière gauche | idem |
| `wheel_RR` | roue arrière droite | idem |
| `door_side` | porte coulissante côté passager | côté **+X** ; l'apprenti s'y accroche |
| `exhaust` | objet vide à la sortie du pot | la fumée part de là |

Les noms sont reconnus sans tenir compte des majuscules, des espaces, des tirets, ni du suffixe
`.001` ajouté par Blender. Sans `body`, le jeu garde le modèle en boîtes. Les autres manques sont
listés dans la console (F12) et n'empêchent pas de jouer (roues fixes, fumée au mauvais endroit...).

### Peintures : deux solutions
1. **Le plus simple** : ne rien ajouter au fichier 3D. Le jeu pose lui-même les panneaux (arrière
   et côtés) sur la caisse. Le placement se règle avec `DECAL` dans `src/config.js`.
2. **Le plus propre** : ajouter trois **plans** plats, à 2 mm devant la carrosserie, avec des UV de
   0 à 1. Le jeu remplace leur matériau par l'image de la peinture :
   - `skin_rear` : panneau arrière ;
   - `skin_side_R` : côté passager (+X) ;
   - `skin_side_L` : côté conducteur (-X).

### Images des peintures (`public/skins/`)
- `maestro_arriere.jpg`, `elephant_arriere.jpg` : fait.
- `maestro_cote.jpg`, `elephant_cote.jpg` : à produire, **porte fermée**, même peinture que l'arrière.
  Format conseillé : environ 2:1 (par exemple 1024 × 512), dessin lisible au centre, sans texte
  collé aux bords (les bords sont légèrement coupés par les passages de roue).
- Pour activer un côté dès que l'image existe : dans `src/config.js`, remplacer `side: null` par
  `side: '/skins/maestro_cote.jpg'` (ou `elephant_cote.jpg`). Le jeu pose alors le panneau des
  deux côtés ; tant que `side` vaut `null`, il ne pose rien et n'affiche aucune erreur.

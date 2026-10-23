# Gbaka Rush : consignes pour l'assistant

Jeu mobile 3D ivoirien (Abidjan). Créateur : Hamed, fondateur solo à Abidjan, petit budget, parle français.
Réponds en **français simple**, par petites étapes, et dis clairement ce qui marche et ce qui ne marche pas.

## Règles du jeu à respecter
- Format **vertical** (portrait). Commande à **un seul doigt** : appuyer = accélérer, glisser = dévier, lever le doigt = freiner. **Jamais** de boutons gauche/droite.
- Caméra derrière le gbaka. Route à 3 voies avec accotements. Trafic de plus en plus dense par commune (Yopougon, Adjamé, Plateau, Treichville, Cocody). Chaque commune a son décor et ses quartiers : rien ne se mélange.
- Conduite **arcade**, pas réaliste. 3D **low-poly** stylisé, couleurs plates.
- Interface en français. Palette : lagune #00A8E8, latérite #FF7A00, taxi #FFD140, océan #0D2B6B, nature #16A34A, route #2D2D2D. Police : Montserrat.

## Contraintes techniques
- Doit tourner à **30 images/seconde sur un téléphone Android d'entrée de gamme** (2 à 3 Go de RAM). Gbaka ~5 000 triangles, autres véhicules ~2 000, 8 à 10 véhicules actifs, pas d'ombres temps réel.
- Poids total du jeu < 50 Mo. Pas de dépendance lourde. Three.js + Vite, JavaScript simple (pas de TypeScript pour l'instant).
- Hébergement : Vercel (site statique). Pas de serveur pour l'instant.
- Tous les réglages d'équilibrage vont dans `src/config.js`.

## Interdits (droits et sécurité)
- **Aucun visage de vraie personne** (artistes, acteurs, joueurs) sur les peintures. Personnages inventés uniquement.
- Aucun logo ni marque réelle (Mercedes, Fédération, clubs, opérateurs).
- Ne pas copier le jeu ou les images d'autres créateurs (les captures dans `assets-source/` sont des références d'ambiance seulement).
- Les photos de `assets-source/05_Photos_reference_vrais_gbakas` ne doivent jamais être publiées dans le jeu.

## Méthode
- Avant d'ajouter une grosse fonction, propose un petit plan et attends la validation.
- Après chaque étape : `npm run build` doit passer. Ne casse pas ce qui marche.
- Garde le code lisible, commenté en français, un fichier = une responsabilité.
- Voir `docs/GAME_DESIGN.md` (règles), `docs/ASSETS.md` (images à faire), `docs/ROADMAP.md` (étapes).

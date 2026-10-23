# Règles du jeu (version actuelle)

## But
Réussir les niveaux : transporter le nombre de passagers demandé dans chaque commune d'Abidjan,
gagner des FCFA, éviter les chocs. Après le dernier niveau, la course libre reste ouverte : on
roule alors le plus loin possible.

## Commandes (un seul doigt)
- Doigt posé : le gbaka accélère.
- Doigt glissé à gauche/droite : le gbaka dévie. Il peut rouler sur l'accotement.
- Doigt levé : freinage progressif, après 0,2 s (pour qu'un doigt qui glisse ne freine pas par erreur).
- Conséquence voulue : quand on freine, on ne peut plus diriger. Dans le trafic, c'est un choix de risque.
- Arrêt complet : on ne peut presque plus dévier (le gbaka ne glisse pas de côté à l'arrêt).

## Argent et passagers
- Tous les 400 m (premier arrêt à 150 m), des passagers descendent (0 à 2) et montent (1 à 3), dans la limite de la capacité.
- Chaque passager paie 0,25 FCFA par mètre parcouru. Valeurs de départ, **à équilibrer** dans `src/config.js`.
- Un choc peut faire descendre un passager.
- L'**objectif du niveau** compte les passagers qui sont montés depuis le départ, même s'ils
  descendent ensuite. Le passager déjà à bord au moment du départ ne compte pas.

## L'apprenti
- Toutes les 3 à 5 secondes, il sort la tête et le bras par la porte (côté droit), crie une destination dans une bulle, puis rentre.
- Si le gbaka est plein, il crie « Complet ! ». Les destinations sont dans `src/config.js`.
- À faire : voix enregistrée (nouchi), et lien avec le jeu (les passagers qui montent à l'arrêt où il a crié).

## Dégâts
- Chaque choc ajoute des dégâts (6 + 1,6 x vitesse relative). À 100 %, la course est finie : le niveau est raté.
- Après un choc : 0,9 s d'invulnérabilité, secousse de caméra, vibration du téléphone.

## Niveaux = secteurs d'Abidjan
Un niveau = **un secteur** = une course. On fait le tour d'Abidjan dans l'ordre :
**Yopougon → Adjamé → Plateau → Treichville → Cocody**. Les communes ne se mélangent jamais :
le décor, la foule, les taxis-motos et les cris de l'apprenti sont ceux du secteur joué.
L'objectif s'affiche dans le HUD (pastille verte) et dans la pause.

| Niveau | Commune | Quartiers | Objectif | Prime | Trafic | Vitesse des autres |
|---|---|---|---|---|---|---|
| 1 | Yopougon | Niangon, Siporex, Sicogi, Selmer, Toits Rouges, Ananeraie | 10 passagers | 2 500 FCFA | léger | 9 à 14 m/s |
| 2 | Adjamé | Liberté, Williamsville, Bromakoté, Bracodi, Gare routière | 12 passagers | 4 000 FCFA | moyen | 7 à 13 m/s |
| 3 | Plateau | Cité Administrative, Indénié, Dokui, Cathédrale | 14 passagers | 6 000 FCFA | dense | 5 à 12 m/s |
| 4 | Treichville | Zone 3, Arras, Belleville, Le Port | 16 passagers | 9 000 FCFA | très dense | 4 à 11 m/s |
| 5 | Cocody | Angré, Deux-Plateaux, Riviera, Danga | 18 passagers | 13 000 FCFA | embouteillage | 3 à 10 m/s |

- À chaque **arrêt** (tous les 400 m), le gbaka change de **quartier** : le HUD affiche
  « Yopougon · Niangon », le message annonce « Arrêt Niangon : +2 passagers » et l'apprenti
  appelle le quartier suivant. On fait le tour des quartiers du secteur, puis on recommence.
- Objectif atteint : la course s'arrête, l'argent de la course est encaissé, la prime est versée et
  l'écran « Niveau réussi » propose le **niveau suivant**. Le niveau suivant est alors débloqué
  (progression sauvegardée).
- 100 % de dégâts (ou « Terminer la course ») : le niveau est raté, « Rejouer » relance le même niveau.
- Après le 5e niveau : **course libre**. Plus d'objectif ; la commune (et donc le décor) change avec la
  distance parcourue et le trafic s'épaissit (2 000 m, 5 000 m, 9 000 m, 14 000 m). Le record continue.
- Un niveau déjà réussi ne peut pas être reperdu : rejouer un ancien niveau ne fait jamais reculer
  la progression.
- Règle de sécurité : il reste toujours une voie libre au moment où une voiture apparaît.
- Réglages : `SECTORS` et `LEVELS` dans `src/config.js`. Règles pures et testables :
  `src/game/sectors.js` (quartiers, cris, HUD) et `src/game/levels.js` (progression), vérifiées par
  `tests/sectors.mjs` et `tests/levels.mjs`.

## Décor
- La rue est découpée en tronçons de 48 m. Chacun reçoit une ambiance : ville (environ la moitié des
  tronçons), marché de rue, quartier d'habitation, ou pont au-dessus de la lagune (environ 9 %).
- Un marché ou un quartier dure 2 tronçons (96 m), un pont 3 (144 m) ; la ville sépare toujours deux
  ambiances spéciales. Le nom du quartier s'affiche à l'écran quand on y entre.
- Le décor ne change aucune règle du jeu : c'est de l'ambiance (réglages dans `src/config.js`).

## Garage
- 4 améliorations (vitesse, accélération, freinage, capacité), 5 niveaux chacune, prix = 2 000 x (niveau + 1) FCFA.
- 6 peintures : Maestro et Éléphant dès le départ. Les 4 autres se débloquent à 5, 15, 30 et 60 km cumulés.
- Le gbaka « Classique » est le seul modèle pour l'instant. Plus tard : de plus beaux gbakas, plus performants.

## À décider plus tard
- Une **carte des niveaux** (bouton « Carte » du garage) pour rejouer un niveau déjà réussi.
- Revenus : publicités récompensées (regarder une pub pour rejouer) et achats en mobile money (Wave, Orange Money) pour les peintures. Une enseigne réelle peut sponsoriser une peinture quand le jeu a des joueurs.
- Classement par commune (Yopougon contre Abobo) et bouton « Défie-moi » vers WhatsApp.
- Missions du jour, cadeau quotidien, pluie, contrôle de police, nids-de-poule, voix de l'apprenti.

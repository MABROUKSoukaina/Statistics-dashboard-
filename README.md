# IFN 2026 — Statistiques (Geonavigateur-Forestier-Stats)

Dashboard statistiques-only, séparé de [Geonavigateur-Forestier](../Geonavigateur-Forestier-main) :
un header d'indicateurs dendrométriques globaux + une carte des placettes avec le détail
de chaque placette en popup. Pas de section équipes/import — lecture seule.

Même base de données (`IFN_2026`), backend et frontend indépendants (ports différents),
comptes utilisateurs indépendants.

## Lancer en local

```bash
# Backend (port 8081)
cd Backend
./mvnw spring-boot:run

# Frontend (port 5173, ou le prochain libre)
cd Frontend
npm install   # première fois seulement
npm run dev
```

## Comptes

Un seul compte est créé automatiquement au premier démarrage (table `stats_app_user`,
propre à ce projet — n'a **aucun** rapport avec la table `app_user` du dashboard principal) :

- **admin** / mot de passe défini par `app.bootstrap.password` dans
  `Backend/src/main/resources/application.properties` (change-le après la première connexion).

Tout compte ajouté ensuite passe par `POST /api/users` (ADMIN uniquement) — plus jamais par
ce fichier de config, contrairement à l'ancien système du dashboard principal.

Rôles : `ADMIN` (gère aussi les comptes), `VIEWER` (lecture seule).

## Indicateurs — sources des formules

Toutes les formules dendrométriques sont reprises telles quelles depuis les scripts déjà
validés du dépôt **Fiches dendro** — rien n'est recalculé "à l'œil" :
- `scripts/generate_rapport_zip.py` (`_compute_tree_metrics`, `_compute_s9_fast`, `_compute_s7_fast`)
- `scripts/generate_fiche_indicateurs.py` (documentation des mêmes formules)

Résumé :
- **Facteur d'expansion** `f = 10000 / tree_ss_placette` (tiges/ha)
- **Surface terrière d'un arbre** `G = tree_c1_3² / (4π × 10000)` (m²)
- **Volume d'un arbre** — Huber `V = (π/4) × (tree_dm/100)² × tree_ht` si `tree_dm` et
  `tree_ht` connus, sinon `V = G × tree_ht × 0,45`
- Seuls les arbres **vivants** (`tree_etat_vegetatif = 1`) entrent dans les moyennes par
  hectare — même filtre que le script de référence.
- **Indicateurs globaux** (header) : chaque enregistrement `plot.csv` compte pour une
  valeur dans la moyenne, y compris les contrôles `C`/`CS` — c'est la convention du script
  de référence (`plot_id_ = plot_no`, sans fusion base/contrôle). Vérifié par recoupement
  indépendant (pandas) : écart < 1 % sur toutes les moyennes.
- **Popup carte** : une seule marque par placette physique (la donnée du contrôle prime sur
  la donnée standard si les deux existent) — sinon une même placette apparaîtrait 2-3 fois
  sur la carte.

## Ce qui n'est PAS dans ce projet

Team cards, filtres par équipe, import ZIP, export CSV/XLSX/KML/SHP — tout ce qui concerne
la collecte/gestion d'équipes reste dans Geonavigateur-Forestier. Si un indicateur ou un
champ popup manque, il est simple à ajouter (`StatsController.java` + `MapView.tsx`).

# Guide des indicateurs — Tableau de bord IFN 2026

Signification et mode de calcul de chaque indicateur affiché dans le tableau de bord statistique, du bandeau supérieur jusqu'au popup de la carte. Les formules ci-dessous sont celles réellement exécutées côté serveur (`Backend/src/main/java/com/ifnstats/controller/`) — aucune n'est ré-agrégée côté navigateur.

## Sommaire

1. [Principes & briques de calcul](#1-principes--briques-de-calcul)
2. [Écosystème, composition, strate](#2-écosystème-composition-strate)
3. [Indicateurs globaux (bandeau supérieur)](#3-indicateurs-globaux-bandeau-supérieur)
4. [Analyse forestière détaillée](#4-analyse-forestière-détaillée)
5. [Page Écosystème](#5-page-écosystème)
6. [Carte des placettes et popup](#6-carte-des-placettes-et-popup)
7. [Page Placettes](#7-page-placettes)

---

## 1. Principes & briques de calcul

Tous les indicateurs « par hectare » se construisent à partir des mêmes trois briques, appliquées arbre par arbre puis agrégées par placette (voir `StatsController.TREE_CALC_CTE`).

**Facteur d'expansion**
```
facteur (tiges/ha) = 10 000 / surface_sous-placette (m²)
```
Chaque arbre est mesuré dans une sous-placette concentrique dont la taille dépend de sa classe de diamètre (`tree_ss_placette`). Ce facteur ramène un seul arbre mesuré à « combien de tiges par hectare il représente ».

**Surface terrière d'un arbre**
```
g (m²) = C1,3² / (4 × π × 10 000)
```
C1,3 = circonférence à 1,30 m (cm). Dérive le diamètre de la circonférence (D = C/π), calcule l'aire du disque, convertit cm² → m².

**Volume d'un arbre — formule de Huber**
```
v (m³) = (π/4) × (D_mi-hauteur/100)² × hauteur   si D_mi-hauteur ET hauteur mesurés
v (m³) = g × hauteur × 0,45                       si seule la hauteur est mesurée (coeff. de forme)
v (m³) = 0                                        sinon
```

**Seuls les arbres vivants** (`tree_etat_vegetatif = 1`) comptent dans les indicateurs « par hectare » usuels (densité, surface terrière, volume, hauteur, circonférence moyennes du bandeau et du tableau croisé). Les arbres coupés (état = 3) et morts (état = 4) sont comptés à part.

**Convention « moyenne par placette »**. Densité, surface terrière, volume, hauteur et circonférence (bandeau, tableau croisé) sont d'abord calculés *pour chaque placette*, puis moyennés *entre placettes* — chaque placette compte une fois, quel que soit son nombre d'arbres. Filtrer par écosystème/composition/strate relance ce calcul côté serveur sur exactement le sous-ensemble sélectionné, plutôt que de ré-agréger les chiffres déjà affichés.

**Zéro réel vs. donnée inconnue**. Une placette visitée dont aucun arbre n'est vivant (tous coupés/morts) a une densité, une surface terrière et un volume réellement nuls — affichés `0`, pas `—`. En revanche la hauteur ou la circonférence moyenne d'un ensemble vide n'existe pas mathématiquement : ces deux-là restent `—` (jamais `0 m`, qui impliquerait à tort des arbres de hauteur nulle). Une placette jamais visitée, elle, reste `—` partout — voir la garde `CASE WHEN pd_reg.plot_plot_no IS NOT NULL …` dans `StatsController#getMap`.

---

## 2. Écosystème, composition, strate

Proviennent exclusivement des relevés de terrain (ZIP Collect), jamais du programme théorique.

**Écosystème** — déduit de l'essence dominante relevée sur le terrain (`strate_terrain_essence`), **jamais** de `ifn_programme.essence_group` (interprétation d'image, pas une observation terrain). Mapping dans `FormationMapping.caseExpr()` :

| Code | Écosystème | Code | Écosystème |
|---|---|---|---|
| Ca | Cèdre | Ar | Acacia |
| Qs | Chêne liège | F | Autres feuillus |
| Ta | Thuya | R | Autres résineux |
| Ph | Pin d'alep | La | Landes |
| Pp | Pin maritime | Fr | Fruticées |
| Jp/Jt/Jo | Genévriers | RR | Reboisements résineux |
| Qr/Qc/Qf | Chêne vert | RF | Reboisements feuillus |

**Composition** — pure ou mélange, d'après `strate_terrain_composition`.

**Strate (densité du couvert)** — 1 Dense, 2 Moyennement dense, 3 Claire (codes terrain 3 et 4 fusionnés).

**Placette (comptage)** — chaque placette physique (`ifn_programme.num_placette`) peut avoir jusqu'à trois enregistrements dans `plot` : la visite régulière, une contrôle SREA (`…C`), une contrôle service (`…CS`). Pour compter des **placettes** (légende carte, donut, tableau croisé), on résout **une seule** classification par lieu, priorité visite régulière → contrôle → contrôle service (`FormationController.LOC_CTE`) — sans quoi un lieu contrôlé deux fois serait compté deux fois. Pour les **moyennes dendrométriques**, chaque enregistrement (visite + contrôle) reste une observation indépendante, volontairement non fusionnée (voir §1).

Le sélecteur « Analyse forestière » (Écosystème / Composition / Strate) accepte une sélection multiple ; cocher plusieurs valeurs recalcule tous les indicateurs (bandeau, tableau croisé, carte) sur l'union exacte des placettes correspondantes.

---

## 3. Indicateurs globaux (bandeau supérieur)

| Carte | Formule | Remarque |
|---|---|---|
| **Placettes** | `placettes_visitées / placettes_programmées` | Avec une sélection active : nombre de placettes de la sélection, sans barre de progression. |
| **Arbres** | `Σ nb_arbres_total` | Tous états confondus. Sous-valeur : *X coupés · Y morts* (comptage brut, tous écosystèmes). |
| **Densité** | `moyenne( Σ facteur, vivants, par placette )` | tiges/ha |
| **Surface terrière** | `moyenne( Σ g×facteur, vivants, par placette )` | m²/ha |
| **Volume** | `moyenne( Σ v×facteur, vivants, par placette )` | m³/ha, formule de Huber |
| **Hauteur** | `moyenne( hauteur moyenne du peuplement, par placette )` | sous-valeur : circonférence C1,3 moyenne |
| **Régénération** | `moyenne( (brins ≥1,3m + brins <1,3m) × 10 000/2 827,43, par placette )` | brins/ha, sous-placette rayon 30 m |
| **Échantillons** | `Σ arbres avec tree_echantillon = vrai` | compte simple, sans sous-valeur |

---

## 4. Analyse forestière détaillée

**Tableau croisé (3 onglets)** — Densité, Surface terrière, Volume, Hauteur, Circonférence, Régénération calculés à trois niveaux indépendants (Écosystème / Composition / Strate), via un seul `GROUPING SETS` — chaque niveau est requêté séparément, pas dérivé du niveau plus fin. Le nombre de placettes par ligne vient de la même résolution « une classification par lieu » décrite en §2.

**Répartition des écosystèmes (anneau)** — part et nombre de placettes par écosystème, indépendant du filtre « Analyse forestière ».

**Répartition par composition et strate (barres empilées)** — pour le ou les écosystèmes sélectionnés, part des placettes Dense/Moy. dense/Claire, séparément Pur et Mélange. Simple comptage de placettes (additionner plusieurs écosystèmes y est donc valide, à la différence des moyennes du tableau croisé).

---

## 5. Page Écosystème

Les 8 indicateurs de la section 3, restreints aux placettes de l'écosystème choisi, plus :

- **Structure en circonférences / en hauteurs** — histogrammes du nombre de tiges vivantes par classe (20 cm / 2 m), avec courbe de tendance.
- **Répartition selon l'exposition, la position topographique, le substrat, le type de sol** — comptage de placettes par modalité.
- **Classes de pente** — 0–10, 11–20, 21–30, 31–40, 41–50, >50 (%).

Au survol d'une barre, une bulle affiche la valeur exacte.

---

## 6. Carte des placettes et popup

**Légende** — un point par placette, coloré par écosystème (gris = « Non renseigné »). L'icône **œil** à côté de chaque écosystème masque/réaffiche ses points — réglage d'affichage purement local, sans effet sur les indicateurs ni le nombre de « placettes affichées ».

Le popup ouvert au clic sur une placette est chargé en deux temps : l'en-tête et « Informations de la placette » sont immédiats (déjà dans le GeoJSON de la carte) ; les trois autres sections sont récupérées à la demande via `GET /api/stats/plots/{numPlacette}/detail`, mis en cache par placette.

**Informations de la placette** — X, Y (coordonnées du point), DPANEF.

**Description qualitative** (placettes visitées uniquement) — Écosystème, Strate terrain (`plot_stratum`), Composition, Exposition, Position topo, Substrat (avec qualificatif libre pour les codes 4 « Sable » et 10 « Autre », règle identique à `generate_fiche_simple.py`), Profondeur du sol, Couverture végétale, Intensité de parcours, État sanitaire général, Signes d'incendie.

**Description quantitative** (placettes avec au moins un arbre mesuré) — les figures propres à *cette* placette :

| Ligne | Source | Remarque |
|---|---|---|
| Densité | `COUNT` arbres vivants (sans facteur) | tiges — valeur physique réelle de la placette, pas extrapolée |
| Surface terrière | `Σ g` arbres vivants (sans facteur) | m² |
| Volume | `Σ v` arbres vivants (sans facteur) | m³ |
| Régénération | identique au calcul global | brins/ha |
| Arbres inventoriés | `nb_arbres_total` (%sains) | % sains = arbres `tree_health = 1` (Vigueur) parmi les arbres notés |
| Arbres Chêne liège | démasclés + non démasclés (%démasclé) | `treecl_etat_demasclage` : 1 Démasclé, 2 Non démasclé |
| Arbres coupés / morts | `nb_coupes` / `nb_morts` | comptage brut |
| Hauteur dominante | `couverture_vegetale_hauteur_moyenne_dominante` | |
| Hauteur max / min | `MAX`/`MIN(tree_ht)`, vivants | |
| Hauteur moyenne | identique au calcul global | vivants uniquement |
| Circonférence 1,3 moyenne | identique au calcul global | C1,3, vivants uniquement |
| Circonférence C0 moyenne | `AVG(tree_c0)`, vivants | circonférence à la base |

Densité/Surface terrière/Volume sont ici la grandeur **physique réelle** mesurée sur la petite surface effectivement parcourue (aucune expansion par le facteur) — volontairement différents des mêmes libellés dans la section suivante. Hauteur moyenne et Circonférence 1,3 moyenne, elles, sont identiques dans les deux sections : une moyenne ne dépend pas d'une surface, il n'existe pas de version « par placette » d'une hauteur moyenne.

**Indicateurs rapportés à l'hectare** — les mêmes arbres, extrapolés à l'hectare via le facteur d'expansion : Densité, Volume, Surface terrière, Régénération, Hauteur moyenne, Circonférence 1,3 moyenne (mêmes formules que la section 3).

---

## 7. Page Placettes

Tableau détaillé, une ligne par placette — valeurs propres à *cette* placette (pas des moyennes), reflète le filtre « Analyse forestière » et la recherche en cours. Export (rôle Administrateur) : Excel, CSV, KML, Shapefile, sur exactement les lignes affichées.

| Colonne | Contenu |
|---|---|
| Placette | Numéro |
| Statut | Programmée / Visitée / Contrôlée |
| Écosystème | Formation terrain (§2) |
| DPANEF | Direction provinciale de rattachement |
| Arbres | Nombre d'arbres recensés, tous états |
| Densité | Tiges/ha de cette placette |
| ST | Surface terrière/ha de cette placette |
| Volume | Volume/ha de cette placette |
| Hauteur | Hauteur moyenne de cette placette |
| Circonf. | Circonférence C1,3 moyenne de cette placette |

---

*Tableau de bord statistique IFN 2026 — DRANEF Rabat-Salé-Kénitra. Formules portées depuis `generate_rapport_zip.py` / `generate_fiche_indicateurs.py` / `generate_fiche_simple.py` (dépôt Fiches dendro) et le rapport de référence « Synthèse des paramètres dendrométriques ».*

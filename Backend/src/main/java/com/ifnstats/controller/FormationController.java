package com.ifnstats.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Dendrometric indicators broken down by écosystème (formation) × composition × strate —
 * the "Analyse forestière" axis described in the reference report
 * (docs/Rapport_synthèse_paramètres_dendrométriques_v19062025_162431_NB.docx, section III.3):
 * each écosystème's figures are given at three independent levels — the whole écosystème,
 * by composition (pure/mélange), and by composition × strate dendrométrique (1/2/3).
 *
 * Each level is queried on its own (not derived by averaging the finer level up), matching
 * how the reference report itself computes them independently — e.g. "densité moyenne de
 * l'écosystème" is the mean over ALL its plots, not a weighted average of its composition
 * sub-means. GROUPING SETS gives all three levels in one query; the GROUPING() markers
 * (g_comp/g_strate) tell each row's level apart from a plot with a genuinely unclassified
 * (NULL) composition/strate at a finer level — those look identical otherwise.
 *
 * formation = strate_terrain_essence mapped to an écosystème name, same mapping as
 * ESSENCE_TO_FORMATION in scripts/generate_rapport_v2.py (Fiches dendro repo), plus 'Fr'
 * (Fruticées) which that mapping's own comment flagged as "to add if it appears in the
 * data" — it now does (89 plots locally), so it's added here as its own écosystème rather
 * than silently dropped.
 */
@RestController
@RequestMapping("/api/stats")
public class FormationController {

    private final JdbcTemplate jdbc;

    public FormationController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    // Shared écosystème classification — see FormationMapping.
    private static final String FORMATION_CASE = FormationMapping.caseExpr("p");

    /**
     * One row per physical location (ifn_programme.num_placette), classified with the same
     * regular/contrôle/contrôle-service priority as StatsController#getMap — used everywhere
     * a "nombre de placettes" figure needs to count physical sites, not visit records. Without
     * this, a location visited twice (a regular visit plus a later SREA contrôle, both
     * classified) was counted twice by {@code COUNT(DISTINCT plot_no)} over the raw plot
     * table — 56 locations locally, enough to visibly desync the donut/pivot's per-écosystème
     * counts from the map's one-marker-per-location legend (e.g. Chêne liège read 295 instead
     * of 273). Dendrometric averages deliberately do NOT use this — see plot_classified below.
     */
    private static final String LOC_CTE =
        "loc AS ( " +
        "  SELECT p.num_placette AS plot_no, " +
        "    COALESCE(" + FormationMapping.caseExpr("reg") + ", " + FormationMapping.caseExpr("ctrl") + ", " + FormationMapping.caseExpr("cs") + ") AS formation, " +
        "    COALESCE(" + FormationMapping.compositionExpr("reg") + ", " + FormationMapping.compositionExpr("ctrl") + ", " + FormationMapping.compositionExpr("cs") + ") AS composition, " +
        "    COALESCE(" + FormationMapping.strateExpr("reg") + ", " + FormationMapping.strateExpr("ctrl") + ", " + FormationMapping.strateExpr("cs") + ") AS strate_niveau, " +
        "    COALESCE(reg.donnees_topographiques_plot_elevation, ctrl.donnees_topographiques_plot_elevation, cs.donnees_topographiques_plot_elevation) AS altitude, " +
        "    COALESCE(reg.donnees_topographiques_plot_topo_exposition, ctrl.donnees_topographiques_plot_topo_exposition, cs.donnees_topographiques_plot_topo_exposition) AS exposition, " +
        "    COALESCE(reg.donnees_topographiques_plot_topo_position, ctrl.donnees_topographiques_plot_topo_position, cs.donnees_topographiques_plot_topo_position) AS position_topo, " +
        "    COALESCE(reg.donnees_topographiques_plot_pente, ctrl.donnees_topographiques_plot_pente, cs.donnees_topographiques_plot_pente) AS pente, " +
        "    COALESCE(reg.description_pedologique_substrat, ctrl.description_pedologique_substrat, cs.description_pedologique_substrat) AS substrat, " +
        "    COALESCE(reg.description_pedologique_type_de_sol, ctrl.description_pedologique_type_de_sol, cs.description_pedologique_type_de_sol) AS type_sol " +
        "  FROM ifn_programme p " +
        "  LEFT JOIN plot reg  ON reg.plot_no  = p.num_placette " +
        "  LEFT JOIN plot ctrl ON ctrl.plot_no = p.num_placette || 'C' " +
        "  LEFT JOIN plot cs   ON cs.plot_no   = p.num_placette || 'CS' " +
        "  WHERE COALESCE(reg.plot_no, ctrl.plot_no, cs.plot_no) IS NOT NULL " +
        ")";

    // Régénération subplot ≈ 2827.43 m² (rayon 30 m) — same convention as the reference
    // report's "brins/ha" figures (its sommaire_regeneration_999_30 view) and documented
    // in scripts/generate_fiche_indicateurs.py. Cross-checked locally: raw average of
    // ~78 brins/placette × this factor ≈ 277 brins/ha, a plausible regeneration density.
    private static final String FORMATION_SQL =
        "WITH tree_calc AS ( " +
        "  SELECT plot_plot_no, tree_etat_vegetatif, tree_echantillon, " +
        "    10000.0 / NULLIF(tree_ss_placette, 0) AS facteur, " +
        "    POWER(tree_c1_3, 2) / (4 * PI() * 10000) AS g_m2, " +
        "    tree_c1_3, tree_ht, " +
        "    CASE " +
        "      WHEN tree_dm IS NOT NULL AND tree_ht IS NOT NULL " +
        "        THEN (PI() / 4) * POWER(tree_dm / 100.0, 2) * tree_ht " +
        "      WHEN tree_ht IS NOT NULL " +
        "        THEN (POWER(tree_c1_3, 2) / (4 * PI() * 10000)) * tree_ht * 0.45 " +
        "      ELSE 0 " +
        "    END AS v_m3 " +
        "  FROM tree " +
        "), " +
        "plot_dendro AS ( " +
        "  SELECT plot_plot_no, " +
        "    COUNT(*) AS nb_arbres_total, " +
        "    COUNT(*) FILTER (WHERE tree_echantillon = true) AS nb_echantillons, " +
        "    SUM(facteur)      FILTER (WHERE tree_etat_vegetatif = 1) AS nbre_tiges_ha, " +
        "    SUM(g_m2*facteur) FILTER (WHERE tree_etat_vegetatif = 1) AS surface_terriere_ha, " +
        "    SUM(v_m3*facteur) FILTER (WHERE tree_etat_vegetatif = 1) AS volume_ha, " +
        "    AVG(tree_c1_3)    FILTER (WHERE tree_etat_vegetatif = 1) AS c1_30_moy, " +
        "    AVG(tree_ht)      FILTER (WHERE tree_etat_vegetatif = 1) AS ht_moy " +
        "  FROM tree_calc GROUP BY plot_plot_no " +
        "), " +
        "regen_calc AS ( " +
        "  SELECT plot_plot_no, " +
        "    SUM(COALESCE(reg_nbre_sup_1_3,0)+COALESCE(reg_nbre_inf_1_3,0)) * (10000.0/2827.43) AS regen_ha " +
        "  FROM regeneration GROUP BY plot_plot_no " +
        "), " +
        // Raw per-visit-record rows — deliberately NOT deduplicated by location: a control
        // re-measurement is its own observation for the dendrometric averages, matching
        // StatsController's documented convention (collapsing it first would shift every mean).
        "plot_classified AS ( " +
        "  SELECT p.plot_no, " +
        "    " + FORMATION_CASE + " AS formation, " +
        "    CASE WHEN COALESCE(p.strate_terrain_composition, false) THEN 'melange' ELSE 'pure' END AS composition, " +
        "    CASE WHEN p.strate_terrain_densite IN (3,4) THEN 3 ELSE p.strate_terrain_densite END AS strate_niveau " +
        "  FROM plot p " +
        "), " +
        LOC_CTE + ", " +
        "agg AS ( " +
        "  SELECT pc.formation, pc.composition, pc.strate_niveau, " +
        "    GROUPING(pc.composition) AS g_comp, GROUPING(pc.strate_niveau) AS g_strate, " +
        "    SUM(pd.nb_arbres_total) AS nb_arbres, " +
        "    SUM(pd.nb_echantillons) AS nb_echantillons, " +
        "    ROUND(AVG(pd.nbre_tiges_ha)::numeric, 1) AS densite_ha, " +
        "    ROUND(AVG(pd.surface_terriere_ha)::numeric, 2) AS surface_terriere_ha, " +
        "    ROUND(AVG(pd.volume_ha)::numeric, 2) AS volume_ha, " +
        "    ROUND(AVG(pd.ht_moy)::numeric, 1) AS hauteur_moyenne, " +
        "    ROUND(AVG(pd.c1_30_moy)::numeric, 1) AS circonference_moyenne, " +
        "    ROUND(AVG(rc.regen_ha)::numeric, 0) AS regeneration_ha " +
        "  FROM plot_classified pc " +
        "  LEFT JOIN plot_dendro pd ON pd.plot_plot_no = pc.plot_no " +
        "  LEFT JOIN regen_calc rc ON rc.plot_plot_no = pc.plot_no " +
        "  WHERE pc.formation IS NOT NULL " +
        "  GROUP BY GROUPING SETS ((pc.formation), (pc.formation, pc.composition), (pc.formation, pc.composition, pc.strate_niveau)) " +
        "), " +
        // Placette counts from the deduplicated locations, at the same three levels — joined
        // to `agg` below only after BOTH sides have already been through their own GROUPING
        // SETS, since composition/strate_niveau are only correctly NULLed post-aggregation.
        "counts AS ( " +
        "  SELECT formation, composition, strate_niveau, " +
        "    GROUPING(composition) AS g_comp, GROUPING(strate_niveau) AS g_strate, " +
        "    COUNT(*) AS nb_placettes " +
        "  FROM loc WHERE formation IS NOT NULL " +
        "  GROUP BY GROUPING SETS ((formation), (formation, composition), (formation, composition, strate_niveau)) " +
        ") " +
        "SELECT a.formation, a.composition, a.strate_niveau, a.g_comp, a.g_strate, " +
        "  COALESCE(c.nb_placettes, 0) AS nb_placettes, " +
        "  a.nb_arbres, a.nb_echantillons, a.densite_ha, a.surface_terriere_ha, a.volume_ha, " +
        "  a.hauteur_moyenne, a.circonference_moyenne, a.regeneration_ha " +
        "FROM agg a " +
        "LEFT JOIN counts c ON c.formation = a.formation " +
        "  AND c.composition IS NOT DISTINCT FROM a.composition " +
        "  AND c.strate_niveau IS NOT DISTINCT FROM a.strate_niveau " +
        "  AND c.g_comp = a.g_comp AND c.g_strate = a.g_strate " +
        "ORDER BY a.formation, a.g_comp, a.composition, a.g_strate, a.strate_niveau";

    /**
     * GET /api/stats/formations — one row per (écosystème, composition?, strate?) combination,
     * at all three levels at once. The frontend picks the level it wants by filtering on
     * g_comp/g_strate (1 = aggregated over / not in this row's grouping, 0 = grouped by it):
     *   écosystème only            : g_comp = 1 AND g_strate = 1
     *   écosystème × composition   : g_comp = 0 AND g_strate = 1
     *   écosystème × comp. × strate: g_comp = 0 AND g_strate = 0
     */
    @GetMapping("/formations")
    public ResponseEntity<List<Map<String, Object>>> getFormations() {
        return ResponseEntity.ok(jdbc.queryForList(FORMATION_SQL));
    }

    /**
     * GET /api/stats/formations/{formation}/detail — one écosystème's descripteurs
     * qualitatifs and structure histograms, for the Écosystème page. {formation} is
     * matched against the same FORMATION_CASE mapping (parameterized — never concatenated
     * into SQL, since it comes straight from the URL).
     *
     * Bin widths (20 cm for circonférence, 2 m for hauteur) match the reference report's
     * own charts exactly — read off its embedded histograms, not assumed.
     */
    @GetMapping("/formations/{formation}/detail")
    public ResponseEntity<Map<String, Object>> getFormationDetail(@PathVariable String formation) {
        // Raw per-visit-record rows — only for the tree-structure histograms below, where a
        // control re-measurement's trees are additional real observations (see FORMATION_SQL).
        String plotsCte =
            "plots AS ( " +
            "  SELECT p.plot_no " +
            "  FROM plot p WHERE " + FORMATION_CASE + " = ? " +
            ")";

        Map<String, Object> result = new LinkedHashMap<>();

        // ── Descripteurs quantitatifs — une ligne par placette (lieu), pas par visite ──
        String sqlAlt =
            "WITH " + LOC_CTE + " " +
            "SELECT COUNT(*) AS nb_placettes, MIN(altitude) AS altitude_min, MAX(altitude) AS altitude_max " +
            "FROM loc WHERE formation = ?";
        List<Map<String, Object>> altRows = jdbc.queryForList(sqlAlt, formation);
        result.put("resume", altRows.isEmpty() ? Map.of() : altRows.get(0));

        // ── Descripteurs qualitatifs — comptage de placettes (lieux) par modalité ──────
        result.put("exposition", jdbc.queryForList(
            "WITH " + LOC_CTE + " SELECT exposition AS code, COUNT(*) AS nb " +
            "FROM loc WHERE formation = ? AND exposition IS NOT NULL GROUP BY exposition ORDER BY exposition", formation));
        result.put("position_topo", jdbc.queryForList(
            "WITH " + LOC_CTE + " SELECT position_topo AS code, COUNT(*) AS nb " +
            "FROM loc WHERE formation = ? AND position_topo IS NOT NULL GROUP BY position_topo ORDER BY position_topo", formation));
        result.put("substrat", jdbc.queryForList(
            "WITH " + LOC_CTE + " SELECT substrat AS code, COUNT(*) AS nb " +
            "FROM loc WHERE formation = ? AND substrat IS NOT NULL GROUP BY substrat ORDER BY substrat", formation));
        result.put("type_sol", jdbc.queryForList(
            "WITH " + LOC_CTE + " SELECT type_sol AS code, COUNT(*) AS nb " +
            "FROM loc WHERE formation = ? AND type_sol IS NOT NULL GROUP BY type_sol ORDER BY type_sol", formation));
        result.put("pente", jdbc.queryForList(
            "WITH " + LOC_CTE + " " +
            "SELECT CASE WHEN pente <= 10 THEN '0-10' WHEN pente <= 20 THEN '11-20' " +
            "            WHEN pente <= 30 THEN '21-30' WHEN pente <= 40 THEN '31-40' " +
            "            WHEN pente <= 50 THEN '41-50' ELSE '>50' END AS classe, " +
            "       MIN(CASE WHEN pente <= 10 THEN 0 WHEN pente <= 20 THEN 11 WHEN pente <= 30 THEN 21 " +
            "                WHEN pente <= 40 THEN 31 WHEN pente <= 50 THEN 41 ELSE 51 END) AS ordre, " +
            "       COUNT(*) AS nb " +
            "FROM loc WHERE formation = ? AND pente IS NOT NULL GROUP BY classe ORDER BY ordre", formation));

        // ── Structure — histogrammes circonférence (20 cm) et hauteur (2 m) ─────
        // sur les arbres vivants des placettes de cet écosystème.
        String treeCte =
            "WITH " + plotsCte + ", live AS ( " +
            "  SELECT t.tree_c1_3, t.tree_ht FROM tree t " +
            "  JOIN plots pl ON pl.plot_no = t.plot_plot_no " +
            "  WHERE t.tree_etat_vegetatif = 1 " +
            ") ";
        result.put("structure_circonference", jdbc.queryForList(
            treeCte +
            "SELECT (FLOOR(tree_c1_3/20)*20)::int AS bin_start, COUNT(*) AS nb " +
            "FROM live WHERE tree_c1_3 IS NOT NULL GROUP BY bin_start ORDER BY bin_start", formation));
        result.put("structure_hauteur", jdbc.queryForList(
            treeCte +
            "SELECT (FLOOR(tree_ht/2)*2)::int AS bin_start, COUNT(*) AS nb " +
            "FROM live WHERE tree_ht IS NOT NULL GROUP BY bin_start ORDER BY bin_start", formation));

        return ResponseEntity.ok(result);
    }
}

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
 * GET /api/stats/plots/{numPlacette}/detail — the "Description de la placette" shown in the
 * map popup for one placette: site descriptors (topo/pédologie/couverture/caractéristiques/
 * incendie) plus a dendrometric breakdown scoped to this one placette's trees.
 *
 * Site column names, dictionaries and the reg/ctrl/cs visit-record priority match the
 * already-validated "Détails placette" feature in the main Geonavigateur-Forestier dashboard
 * (DashboardController#getMapData) and scripts/generate_fiche_simple.py (Fiches dendro repo)
 * — not re-derived here. The dendrometric figures reuse this app's own expansion-factor
 * methodology (facteur = 10000/tree_ss_placette, see StatsController) rather than a separate
 * nested-plot-radius formula, since that factor already encodes each tree's own subplot size.
 */
@RestController
@RequestMapping("/api/stats/plots")
public class PlotDetailController {

    private final JdbcTemplate jdbc;

    public PlotDetailController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @GetMapping("/{numPlacette}/detail")
    public ResponseEntity<Map<String, Object>> getDetail(@PathVariable String numPlacette) {
        // Same regular/contrôle/contrôle-service priority as StatsController#getMap.
        String resolveSql =
            "SELECT COALESCE(reg.plot_no, ctrl.plot_no, cs.plot_no) AS plot_no " +
            "FROM ifn_programme p " +
            "LEFT JOIN plot reg  ON reg.plot_no  = p.num_placette " +
            "LEFT JOIN plot ctrl ON ctrl.plot_no = p.num_placette || 'C' " +
            "LEFT JOIN plot cs   ON cs.plot_no   = p.num_placette || 'CS' " +
            "WHERE p.num_placette = ?";
        List<Map<String, Object>> resolved = jdbc.queryForList(resolveSql, numPlacette);
        String plotNo = resolved.isEmpty() ? null : (String) resolved.get(0).get("plot_no");
        if (plotNo == null) return ResponseEntity.ok(Map.of());

        String siteSql =
            "SELECT plot_stratum AS strate_terrain, " +
            "  donnees_topographiques_plot_elevation AS altitude, " +
            "  donnees_topographiques_plot_topo_exposition AS exposition, " +
            "  donnees_topographiques_plot_pente AS pente, " +
            "  donnees_topographiques_plot_topo_position AS position_topo, " +
            "  description_pedologique_substrat AS substrat, " +
            "  description_pedologique_substrat_qualifier AS substrat_qualifier, " +
            "  COALESCE(description_pedologique_type_sol1, description_pedologique_type_sol) AS substrat_autre, " +
            "  description_pedologique_profondeur_du_sol AS profondeur_sol, " +
            "  couverture_vegetale_couverture_du_sol AS couverture_sol, " +
            "  couverture_vegetale_hauteur_moyenne_dominante AS hauteur_dominante, " +
            "  couverture_vegetale_hauteur_moyenne_dominante_unit_name AS hauteur_dominante_unite, " +
            "  caractristiques_specifiques_plot_intensite_de_parcours AS intensite_parcours, " +
            "  caractristiques_specifiques_plot_etat AS etat_sanitaire_general, " +
            "  caractristiques_specifiques_plot_signes_incendies AS signes_incendie, " +
            "  caractristiques_specifiques_plot_fire AS intensite_incendie, " +
            "  caractristiques_specifiques_fire_year AS annee_incendie " +
            "FROM plot WHERE plot_no = ?";
        List<Map<String, Object>> siteRows = jdbc.queryForList(siteSql, plotNo);

        // Circonférence C0 / hauteur max-min use the SAME "vivants uniquement" (état=1) scope
        // as circonférence_moyenne/hauteur_moyenne already shown from the map feature (see
        // StatsController's TREE_CALC_CTE), so every measurement in "Description quantitative"
        // describes the same group of trees. % sains = part des arbres notés (tree_health non
        // nul) évalués en pleine vigueur (code 1) — voir coded_list_vf.xlsx "État sanitaire de
        // l'arbre". Chêne liège démasclage counts are raw tallies, not restricted to état=1,
        // since a demasclage record can exist on a tree in any state.
        //
        // densite_plot/surface_terriere_plot/volume_plot are this placette's own physical
        // figures — a plain stem count and the raw Σg/Σv over the actual (small) area walked,
        // WITHOUT the ×facteur expansion — as distinct from "Indicateurs rapportés à l'hectare"
        // below, which extrapolates the same trees to a full hectare. g_m2/v_m3 mirror
        // StatsController's TREE_CALC_CTE exactly (not re-derived).
        String treeSql =
            "WITH t AS ( " +
            "  SELECT *, " +
            "    POWER(tree_c1_3, 2) / (4 * PI() * 10000) AS g_m2, " +
            "    CASE " +
            "      WHEN tree_dm IS NOT NULL AND tree_ht IS NOT NULL " +
            "        THEN (PI() / 4) * POWER(tree_dm / 100.0, 2) * tree_ht " +
            "      WHEN tree_ht IS NOT NULL " +
            "        THEN (POWER(tree_c1_3, 2) / (4 * PI() * 10000)) * tree_ht * 0.45 " +
            "      ELSE 0 " +
            "    END AS v_m3 " +
            "  FROM tree WHERE plot_plot_no = ? " +
            ") " +
            "SELECT " +
            // COALESCE(...,0): this endpoint is only ever called for a placette that has at
            // least one tree record (see hasDendro in MapView), so a plain COUNT/SUM returning
            // 0 or NULL both mean the same real thing here — "no living trees" — and should
            // render the same way. Postgres's SUM returns NULL (not 0) over zero matching rows.
            "  COUNT(*) FILTER (WHERE tree_etat_vegetatif = 1) AS densite_plot, " +
            "  ROUND(COALESCE(SUM(g_m2) FILTER (WHERE tree_etat_vegetatif = 1), 0)::numeric, 3) AS surface_terriere_plot, " +
            "  ROUND(COALESCE(SUM(v_m3) FILTER (WHERE tree_etat_vegetatif = 1), 0)::numeric, 3) AS volume_plot, " +
            "  ROUND(AVG(tree_c0) FILTER (WHERE tree_etat_vegetatif = 1)::numeric, 1) AS c0_moyenne, " +
            "  MAX(tree_ht) FILTER (WHERE tree_etat_vegetatif = 1) AS hauteur_max, " +
            "  MIN(tree_ht) FILTER (WHERE tree_etat_vegetatif = 1) AS hauteur_min, " +
            "  ROUND(100.0 * COUNT(*) FILTER (WHERE tree_health = 1) " +
            "    / NULLIF(COUNT(*) FILTER (WHERE tree_health IS NOT NULL), 0), 0) AS pct_sains, " +
            "  COUNT(*) FILTER (WHERE tree_liege = true AND treecl_etat_demasclage = 1) AS liege_demascles, " +
            "  COUNT(*) FILTER (WHERE tree_liege = true AND treecl_etat_demasclage = 2) AS liege_non_demascles " +
            "FROM t";
        List<Map<String, Object>> treeRows = jdbc.queryForList(treeSql, plotNo);

        String regenSql =
            "SELECT ROUND((SUM(COALESCE(reg_nbre_sup_1_3,0) + COALESCE(reg_nbre_inf_1_3,0)) * (10000.0/2827.43))::numeric, 0) AS regeneration_ha " +
            "FROM regeneration WHERE plot_plot_no = ?";
        List<Map<String, Object>> regenRows = jdbc.queryForList(regenSql, plotNo);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("plotNo", plotNo);
        result.put("site", siteRows.isEmpty() ? Map.of() : siteRows.get(0));
        result.put("arbres", treeRows.isEmpty() ? Map.of() : treeRows.get(0));
        result.put("regenerationHa", regenRows.isEmpty() ? null : regenRows.get(0).get("regeneration_ha"));
        return ResponseEntity.ok(result);
    }
}

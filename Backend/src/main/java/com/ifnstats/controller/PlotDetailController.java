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

        // "Arbres recensables" = vivants + dépérissants (tree_etat_vegetatif 1 ou 2), matching
        // the reference fiche's own section 3.1 title. C1.3/C0/HT/H7 are per-tree measurements
        // (cm or m) recorded together on every recensable tree — never a "per hectare" figure
        // themselves — so they're reported as this plot's average values, shown alongside
        // Densité/ST/Volume in the popup's "Dendrométrie" block (already this tree group's rate).
        String treeSql =
            "WITH t AS ( " +
            "  SELECT *, 10000.0 / NULLIF(tree_ss_placette, 0) AS facteur " +
            "  FROM tree WHERE plot_plot_no = ? " +
            ") " +
            "SELECT " +
            "  ROUND(AVG(tree_c1_3) FILTER (WHERE tree_etat_vegetatif IN (1,2))::numeric, 1) AS recensables_c13_moy, " +
            "  ROUND(AVG(tree_c0)   FILTER (WHERE tree_etat_vegetatif IN (1,2))::numeric, 1) AS recensables_c0_moy, " +
            "  ROUND(AVG(tree_ht)   FILTER (WHERE tree_etat_vegetatif IN (1,2))::numeric, 1) AS recensables_ht_moy, " +
            "  ROUND(AVG(tree_h7)   FILTER (WHERE tree_etat_vegetatif IN (1,2))::numeric, 1) AS recensables_h7_moy, " +
            "  ROUND(SUM(facteur) FILTER (WHERE tree_etat_vegetatif = 3)::numeric, 1) AS coupes_ha, " +
            "  ROUND(SUM(facteur) FILTER (WHERE tree_etat_vegetatif = 4 AND dead_etat IN (1,2))::numeric, 1) AS morts_sur_pied_ha, " +
            "  ROUND(SUM(facteur) FILTER (WHERE tree_etat_vegetatif = 4 AND dead_etat = 3)::numeric, 1) AS chablis_ha, " +
            "  COUNT(*) FILTER (WHERE tree_liege = true AND treecl_etat_demasclage = 1) AS liege_demascles, " +
            "  COUNT(*) FILTER (WHERE tree_liege = true AND treecl_etat_demasclage = 2) AS liege_non_demascles " +
            "FROM t";
        List<Map<String, Object>> treeRows = jdbc.queryForList(treeSql, plotNo);

        String regenSql =
            "SELECT ROUND((SUM(COALESCE(reg_nbre_sup_1_3,0) + COALESCE(reg_nbre_inf_1_3,0)) * (10000.0/2827.43))::numeric, 0) AS regeneration_ha " +
            "FROM regeneration WHERE plot_plot_no = ?";
        List<Map<String, Object>> regenRows = jdbc.queryForList(regenSql, plotNo);

        // État sanitaire par essence — a dedicated per-species health survey (stand_health),
        // distinct from the per-tree tree_health code used in the "Dendrométrie" block.
        String sanitaireSql =
            "SELECT treeh_species_scientific_name AS essence, treeh_emondage, " +
            "  treeh_mortalite_branche, treeh_pourriture_du_tronc, treeh_charbon_de_la_mere " +
            "FROM stand_health WHERE plot_plot_no = ? ORDER BY essence";
        List<Map<String, Object>> sanitaireRows = jdbc.queryForList(sanitaireSql, plotNo);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("plotNo", plotNo);
        result.put("site", siteRows.isEmpty() ? Map.of() : siteRows.get(0));
        result.put("arbres", treeRows.isEmpty() ? Map.of() : treeRows.get(0));
        result.put("regenerationHa", regenRows.isEmpty() ? null : regenRows.get(0).get("regeneration_ha"));
        result.put("sanitaireParEssence", sanitaireRows);
        return ResponseEntity.ok(result);
    }
}

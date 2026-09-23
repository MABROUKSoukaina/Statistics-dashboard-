package com.ifnstats.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Read-only dendrometric statistics: global header indicators + per-plot map data.
 *
 * All formulas below are ported 1:1 from the validated reference implementation in
 * scripts/generate_rapport_zip.py / scripts/generate_fiche_indicateurs.py (Fiches dendro
 * repo) — NOT re-derived here. Only living trees (tree_etat_vegetatif = 1) count towards
 * the per-hectare figures, matching that script's `live = tree[ev == 1]` filter.
 *
 *   facteur (tiges/ha)     = 10000 / tree_ss_placette
 *   G_arbre (m²)           = tree_c1_3² / (4π × 10000)      (tree_c1_3 in cm)
 *   V_arbre (m³)           = Huber: (π/4) × (tree_dm/100)² × tree_ht   [if tree_dm & tree_ht]
 *                             else : G_arbre × tree_ht × 0.45           [if tree_ht only]
 *                             else : 0
 *   nbre_tiges_ha per plot = Σ facteur                        (living trees only)
 *   surface_terriere_ha    = Σ (G_arbre × facteur)
 *   volume_ha              = Σ (V_arbre × facteur)
 *   c1_30 / c0_20 / ht     = mean over living trees of the plot
 *
 * Global indicators average these per-plot values across plots (D̄, ST̄, V̄, H̄, C̄ — same
 * convention as section V of the reference fiche): each plot counts once, not each tree.
 */
@RestController
@RequestMapping("/api/stats")
public class StatsController {

    private final JdbcTemplate jdbc;

    public StatsController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    // Per-tree derived metrics, then aggregated per plot (living trees only for the
    // per-ha figures; all trees for the raw counts). Referenced by both endpoints below.
    private static final String TREE_CALC_CTE =
        "tree_calc AS ( " +
        "  SELECT plot_plot_no, tree_etat_vegetatif, tree_echantillon, " +
        "    10000.0 / NULLIF(tree_ss_placette, 0) AS facteur, " +
        "    POWER(tree_c1_3, 2) / (4 * PI() * 10000) AS g_m2, " +
        "    tree_c1_3, tree_c0, tree_ht, " +
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
        "    COUNT(*)                                                    AS nb_arbres_total, " +
        "    COUNT(*) FILTER (WHERE tree_echantillon = true)              AS nb_echantillons, " +
        "    COUNT(*) FILTER (WHERE tree_etat_vegetatif = 3)              AS nb_coupes, " +
        "    COUNT(*) FILTER (WHERE tree_etat_vegetatif = 4)              AS nb_morts, " +
        "    COUNT(*) FILTER (WHERE tree_etat_vegetatif = 1)              AS nb_vivants, " +
        "    SUM(facteur)      FILTER (WHERE tree_etat_vegetatif = 1)     AS nbre_tiges_ha, " +
        "    SUM(g_m2*facteur) FILTER (WHERE tree_etat_vegetatif = 1)     AS surface_terriere_ha, " +
        "    SUM(v_m3*facteur) FILTER (WHERE tree_etat_vegetatif = 1)     AS volume_ha, " +
        "    AVG(tree_c1_3)    FILTER (WHERE tree_etat_vegetatif = 1)     AS c1_30_moy, " +
        "    AVG(tree_c0)      FILTER (WHERE tree_etat_vegetatif = 1)     AS c0_20_moy, " +
        "    AVG(tree_ht)      FILTER (WHERE tree_etat_vegetatif = 1)     AS ht_moy " +
        "  FROM tree_calc GROUP BY plot_plot_no " +
        ")";

    // Régénération naturelle, per hectare — matches the reference report's convention
    // (docs/Rapport_synthèse_..._v19062025_162431_NB.docx), not the raw brins/placette
    // convention the generated Maâmora report used. Subplot ≈ 2827.43 m² (rayon 30 m),
    // same expansion factor family as TREE_CALC_CTE. See FormationController for the
    // cross-check against a plausible brins/ha order of magnitude.
    private static final String REGEN_CALC_CTE =
        "regen_calc AS ( " +
        "  SELECT plot_plot_no, " +
        "    SUM(COALESCE(reg_nbre_sup_1_3,0)+COALESCE(reg_nbre_inf_1_3,0)) * (10000.0/2827.43) AS regen_ha " +
        "  FROM regeneration GROUP BY plot_plot_no " +
        ")";

    /**
     * GET /api/stats/global — header KPI cards.
     * The per-hectare means average one value per `plot.csv` record — control (C/CS)
     * re-measurements count as their own record, same as generate_rapport_zip.py's
     * `plot_id_ = plot_no` (no suffix stripping/collapsing). This matches that script's
     * validated numbers exactly; collapsing C/CS into their base plot first (as the
     * map endpoint below does, for display) would silently shift every mean.
     * nb_placettes_visitees/programmees are the one exception: those count physical
     * locations against the ifn_programme, so C/CS naturally collapse there.
     */
    /** Frontend sentinel for "placette without a field-observed écosystème". */
    private static final String NO_FORMATION = "__sans_formation__";

    /** "a, b,,c" -> ["a","b","c"] — the multi-select filters send one comma-joined value. */
    private static List<String> splitValues(String raw) {
        return Arrays.stream(raw.split(",")).map(String::trim).filter(s -> !s.isEmpty()).toList();
    }

    private static String placeholders(int n) {
        return String.join(",", Collections.nCopies(n, "?"));
    }

    @GetMapping("/global")
    public ResponseEntity<Map<String, Object>> getGlobal(
            @RequestParam(required = false) String formation,
            @RequestParam(required = false) String composition,
            @RequestParam(required = false) String strate) {

        // The "Analyse forestière" selection narrows the set the indicators are computed
        // over. Each param is a multi-select from the UI, sent as a comma-separated list;
        // values are always bound as parameters, never concatenated into the SQL.
        StringBuilder where = new StringBuilder();
        List<Object> params = new ArrayList<>();

        if (formation != null && !formation.isBlank()) {
            List<String> values = splitValues(formation);
            List<String> named = values.stream().filter(v -> !NO_FORMATION.equals(v)).toList();
            boolean wantsNull = values.contains(NO_FORMATION);

            List<String> clauses = new ArrayList<>();
            if (!named.isEmpty()) {
                clauses.add("pc.formation IN (" + placeholders(named.size()) + ")");
                params.addAll(named);
            }
            if (wantsNull) clauses.add("pc.formation IS NULL");
            if (!clauses.isEmpty()) where.append(" AND (").append(String.join(" OR ", clauses)).append(")");
        }
        if (composition != null && !composition.isBlank()) {
            List<String> values = splitValues(composition);
            for (String v : values) {
                if (!v.equals("pure") && !v.equals("melange")) {
                    return ResponseEntity.badRequest().body(Map.of("error", "Composition invalide: " + v));
                }
            }
            where.append(" AND pc.composition IN (").append(placeholders(values.size())).append(")");
            params.addAll(values);
        }
        if (strate != null && !strate.isBlank()) {
            List<String> raw = splitValues(strate);
            List<Integer> niveaux = new ArrayList<>();
            for (String v : raw) {
                int n;
                try {
                    n = Integer.parseInt(v);
                } catch (NumberFormatException e) {
                    return ResponseEntity.badRequest().body(Map.of("error", "Strate invalide: " + v));
                }
                if (n < 1 || n > 3) {
                    return ResponseEntity.badRequest().body(Map.of("error", "Strate invalide: " + v));
                }
                niveaux.add(n);
            }
            where.append(" AND pc.strate_niveau IN (").append(placeholders(niveaux.size())).append(")");
            params.addAll(niveaux);
        }

        // Self-contained scalar subqueries — kept out of the FROM clause so they don't
        // need to appear in a GROUP BY alongside the AVG/SUM aggregates below. They always
        // describe the whole programme; the filtered count is nb_placettes_mesurees.
        String programme =
            "(SELECT COUNT(*) FROM ifn_programme WHERE x_centre IS NOT NULL AND y_centre IS NOT NULL)";
        String visited =
            "(SELECT COUNT(*) FROM ifn_programme p " +
            " WHERE p.x_centre IS NOT NULL AND p.y_centre IS NOT NULL AND EXISTS ( " +
            "   SELECT 1 FROM plot pl WHERE pl.plot_no IN (p.num_placette, p.num_placette || 'C', p.num_placette || 'CS') " +
            " ))";

        String sql =
            "WITH " + TREE_CALC_CTE + ", " + REGEN_CALC_CTE + ", " +
            "plot_classified AS ( " +
            "  SELECT p.plot_no, " + FormationMapping.caseExpr("p") + " AS formation, " +
            "    " + FormationMapping.compositionExpr("p") + " AS composition, " +
            "    " + FormationMapping.strateExpr("p") + " AS strate_niveau " +
            "  FROM plot p " +
            ") " +
            "SELECT " +
            "  " + visited + "                                        AS nb_placettes_visitees, " +
            "  " + programme + "                                      AS nb_placettes_programmees, " +
            "  COUNT(DISTINCT pd.plot_plot_no)                       AS nb_placettes_mesurees, " +
            "  ROUND(AVG(pd.nbre_tiges_ha)::numeric, 1)              AS densite_moyenne_ha, " +
            "  ROUND(AVG(pd.surface_terriere_ha)::numeric, 2)        AS surface_terriere_moyenne_ha, " +
            "  ROUND(AVG(pd.volume_ha)::numeric, 2)                  AS volume_moyen_ha, " +
            "  ROUND(AVG(pd.c1_30_moy)::numeric, 1)                  AS circonference_moyenne, " +
            "  ROUND(AVG(pd.ht_moy)::numeric, 1)                     AS hauteur_moyenne, " +
            "  ROUND(AVG(rc.regen_ha)::numeric, 0)                   AS regeneration_moyenne_ha, " +
            "  SUM(pd.nb_arbres_total)                               AS nb_arbres_total, " +
            "  SUM(pd.nb_echantillons)                               AS nb_echantillons_total, " +
            "  SUM(pd.nb_coupes)                                     AS nb_coupes_total, " +
            "  SUM(pd.nb_morts)                                      AS nb_morts_total " +
            "FROM plot_dendro pd " +
            "JOIN plot_classified pc ON pc.plot_no = pd.plot_plot_no " +
            "LEFT JOIN regen_calc rc ON rc.plot_plot_no = pd.plot_plot_no " +
            "WHERE 1 = 1" + where;

        List<Map<String, Object>> rows = jdbc.queryForList(sql, params.toArray());
        return ResponseEntity.ok(rows.isEmpty() ? Map.of() : rows.get(0));
    }

    /**
     * GET /api/stats/map — GeoJSON FeatureCollection, one feature per programmed plot,
     * carrying identification + per-plot dendrometric summary for the map popup.
     */
    @GetMapping("/map")
    public ResponseEntity<Map<String, Object>> getMap() {
        String sql =
            "WITH " + TREE_CALC_CTE + " " +
            "SELECT p.num_placette, p.x_centre AS lon, p.y_centre AS lat, " +
            "  p.equipe, p.dpanef, " +
            // Écosystème observed on the ground, from whichever visit record exists — the
            // single formation source for the whole app (see FormationMapping). Deliberately
            // NOT ifn_programme.essence_group: that column is a photo-interpretation, not a
            // field observation, so it must never stand in for the formation.
            "  COALESCE(" + FormationMapping.caseExpr("reg") + ", " +
            FormationMapping.caseExpr("ctrl") + ", " + FormationMapping.caseExpr("cs") + ") AS formation, " +
            // Strate dendrométrique relevée sur le terrain (plot_stratum, ex. « QsMH2 »),
            // et non strate_cartographique de l'ifn_programme, qui est interprétée sur image.
            "  COALESCE(reg.plot_stratum, ctrl.plot_stratum, cs.plot_stratum) AS strate, " +
            // Composition et niveau de strate, pour que les sélecteurs « Analyse forestière »
            // filtrent la carte avec exactement la même classification que les tableaux.
            "  COALESCE(" + FormationMapping.compositionExpr("reg") + ", " +
            FormationMapping.compositionExpr("ctrl") + ", " + FormationMapping.compositionExpr("cs") + ") AS composition, " +
            "  COALESCE(" + FormationMapping.strateExpr("reg") + ", " +
            FormationMapping.strateExpr("ctrl") + ", " + FormationMapping.strateExpr("cs") + ") AS strate_niveau, " +
            "  CASE WHEN cs.plot_no  IS NOT NULL THEN 'controle' " +
            "       WHEN ctrl.plot_no IS NOT NULL THEN 'controle' " +
            "       WHEN reg.plot_no  IS NOT NULL THEN 'visitee' " +
            "       ELSE 'programmee' END AS statut, " +
            "  COALESCE(reg.plot_accessibilite, ctrl.plot_accessibilite, cs.plot_accessibilite) AS accessibilite, " +
            "  COALESCE(pd_reg.nb_arbres_total, pd_ctrl.nb_arbres_total, pd_cs.nb_arbres_total, 0) AS nb_arbres_total, " +
            "  COALESCE(pd_reg.nb_echantillons, pd_ctrl.nb_echantillons, pd_cs.nb_echantillons, 0) AS nb_echantillons, " +
            "  COALESCE(pd_reg.nb_coupes, pd_ctrl.nb_coupes, pd_cs.nb_coupes, 0)                   AS nb_coupes, " +
            "  COALESCE(pd_reg.nb_morts, pd_ctrl.nb_morts, pd_cs.nb_morts, 0)                       AS nb_morts, " +
            "  COALESCE(pd_reg.nb_vivants, pd_ctrl.nb_vivants, pd_cs.nb_vivants, 0)                 AS nb_vivants, " +
            // A visited plot with trees but none of them living (all coupé/mort) is a real,
            // meaningful "0" for these three SUM-based figures — Postgres's SUM returns NULL
            // over zero matching rows, not 0, so without the fallback it would misleadingly
            // render as "—" (no data) right next to a genuinely-computed "0" elsewhere in the
            // same popup. Guarded on pd_*.plot_plot_no so an actually-unvisited "programmée"
            // placette (no plot_dendro row at all) still reports unknown, not a false 0 — that
            // distinction matters here since the Placettes table renders this same field for
            // every placette, visited or not. Hauteur/circonférence stay nullable regardless:
            // the mean of zero living trees is undefined, not zero.
            "  CASE WHEN COALESCE(pd_reg.plot_plot_no, pd_ctrl.plot_plot_no, pd_cs.plot_plot_no) IS NOT NULL " +
            "    THEN ROUND(COALESCE(pd_reg.nbre_tiges_ha, pd_ctrl.nbre_tiges_ha, pd_cs.nbre_tiges_ha, 0)::numeric, 1) " +
            "    ELSE NULL END AS nbre_tiges_ha, " +
            "  CASE WHEN COALESCE(pd_reg.plot_plot_no, pd_ctrl.plot_plot_no, pd_cs.plot_plot_no) IS NOT NULL " +
            "    THEN ROUND(COALESCE(pd_reg.surface_terriere_ha, pd_ctrl.surface_terriere_ha, pd_cs.surface_terriere_ha, 0)::numeric, 2) " +
            "    ELSE NULL END AS surface_terriere_ha, " +
            "  CASE WHEN COALESCE(pd_reg.plot_plot_no, pd_ctrl.plot_plot_no, pd_cs.plot_plot_no) IS NOT NULL " +
            "    THEN ROUND(COALESCE(pd_reg.volume_ha, pd_ctrl.volume_ha, pd_cs.volume_ha, 0)::numeric, 2) " +
            "    ELSE NULL END AS volume_ha, " +
            "  ROUND(COALESCE(pd_reg.c1_30_moy, pd_ctrl.c1_30_moy, pd_cs.c1_30_moy)::numeric, 1)                           AS circonference_moyenne, " +
            "  ROUND(COALESCE(pd_reg.ht_moy, pd_ctrl.ht_moy, pd_cs.ht_moy)::numeric, 1)                                    AS hauteur_moyenne " +
            "FROM ifn_programme p " +
            "LEFT JOIN plot reg  ON reg.plot_no  = p.num_placette " +
            "LEFT JOIN plot ctrl ON ctrl.plot_no = p.num_placette || 'C' " +
            "LEFT JOIN plot cs   ON cs.plot_no   = p.num_placette || 'CS' " +
            "LEFT JOIN plot_dendro pd_reg  ON pd_reg.plot_plot_no  = reg.plot_no " +
            "LEFT JOIN plot_dendro pd_ctrl ON pd_ctrl.plot_plot_no = ctrl.plot_no " +
            "LEFT JOIN plot_dendro pd_cs   ON pd_cs.plot_plot_no   = cs.plot_no " +
            "WHERE p.x_centre IS NOT NULL AND p.y_centre IS NOT NULL";

        List<Map<String, Object>> rows = jdbc.queryForList(sql);
        List<Map<String, Object>> features = new ArrayList<>(rows.size());

        for (Map<String, Object> row : rows) {
            double lon = ((Number) row.get("lon")).doubleValue();
            double lat = ((Number) row.get("lat")).doubleValue();

            Map<String, Object> geometry = new LinkedHashMap<>();
            geometry.put("type", "Point");
            geometry.put("coordinates", new double[]{lon, lat});

            Map<String, Object> props = new LinkedHashMap<>(row);
            props.remove("lon");
            props.remove("lat");

            Map<String, Object> feature = new LinkedHashMap<>();
            feature.put("type", "Feature");
            feature.put("geometry", geometry);
            feature.put("properties", props);
            features.add(feature);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("type", "FeatureCollection");
        result.put("totalFeatures", features.size());
        result.put("features", features);
        return ResponseEntity.ok(result);
    }
}

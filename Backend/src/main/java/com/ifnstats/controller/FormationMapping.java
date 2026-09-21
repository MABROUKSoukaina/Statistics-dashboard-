package com.ifnstats.controller;

/**
 * Single definition of the écosystème (formation) classification, shared by every endpoint
 * so the map, the donut, the pivot table and the Écosystème page all speak one vocabulary.
 *
 * Source field is {@code plot.strate_terrain_essence} — the essence observed on the ground —
 * mapped exactly like ESSENCE_TO_FORMATION in scripts/generate_rapport_v2.py (Fiches dendro
 * repo), plus 'Fr' (Fruticées), which that mapping's comment flagged as "to add the day it
 * shows up in the data": it now accounts for 89 plots locally.
 *
 * NB: this is deliberately NOT {@code ifn_programme.essence_group}. That column carries the
 * *planned* classification with a different vocabulary ("Chene liege", "Plantation Feuillus",
 * "Land", unaccented) and exists for plots that have not been visited yet. The report's
 * statistics are all built on the observed essence, so that is what the dashboard shows.
 */
final class FormationMapping {

    private FormationMapping() {}

    /**
     * Composition of the peuplement for one visit record — 'pure' / 'melange', or NULL when
     * that record does not exist. The NULL guard matters: without it a missing LEFT JOIN row
     * would read as 'pure' (COALESCE(NULL,false)) and silently invent a composition.
     * A record that exists but has no value is 'pure', matching _prepare_plot's fillna('pure')
     * in scripts/generate_rapport_v2.py.
     */
    static String compositionExpr(String alias) {
        return "CASE WHEN " + alias + ".plot_no IS NOT NULL THEN " +
               "  CASE WHEN COALESCE(" + alias + ".strate_terrain_composition, false) " +
               "       THEN 'melange' ELSE 'pure' END END";
    }

    /** Strate dendrométrique 1/2/3 (densité 4 « très claire » regrouped with 3). */
    static String strateExpr(String alias) {
        return "CASE WHEN " + alias + ".strate_terrain_densite IN (3,4) THEN 3 " +
               "     ELSE " + alias + ".strate_terrain_densite END";
    }

    /** Formation CASE expression over {@code <alias>.strate_terrain_essence}. */
    static String caseExpr(String alias) {
        return
            "CASE " + alias + ".strate_terrain_essence " +
            "  WHEN 'Ca' THEN 'Cèdre' WHEN 'Qs' THEN 'Chêne liège' WHEN 'Ta' THEN 'Thuya' " +
            "  WHEN 'Ph' THEN 'Pin d''alep' WHEN 'Pp' THEN 'Pin maritime' " +
            "  WHEN 'Jp' THEN 'Genévriers' WHEN 'Jt' THEN 'Genévriers' WHEN 'Jo' THEN 'Genévriers' " +
            "  WHEN 'Qr' THEN 'Chêne vert' WHEN 'Qc' THEN 'Chêne vert' WHEN 'Qf' THEN 'Chêne vert' " +
            "  WHEN 'RR' THEN 'Reboisements résineux' WHEN 'RF' THEN 'Reboisements feuillus' " +
            "  WHEN 'Ar' THEN 'Acacia' WHEN 'F' THEN 'Autres feuillus' WHEN 'R' THEN 'Autres résineux' " +
            "  WHEN 'La' THEN 'Landes' WHEN 'Fr' THEN 'Fruticées' " +
            "  ELSE NULL END";
    }
}

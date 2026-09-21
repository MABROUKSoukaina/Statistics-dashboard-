import { useMemo } from 'react';
import type { PlotFeature } from './services/api';

/** Écosystème value standing for "placette without a field-observed essence". */
export const NO_FORMATION = '__sans_formation__';

/**
 * One source of truth for what the map shows: the "Analyse forestière" selection
 * (écosystème / composition / strate).
 *
 * These live in the "Analyse forestière" selection, not local state here, because they
 * scope the analysis panels too — the map and the Placettes table just apply the same
 * selection instead of offering their own separate controls.
 */
export function useMapFilters(
  features: PlotFeature[],
  ecosysteme: string[],
  composition: string[],
  strate: string[],
) {
  const activeCount = (ecosysteme.length ? 1 : 0) + (composition.length ? 1 : 0) + (strate.length ? 1 : 0);

  const filtered = useMemo(() => features.filter(f => {
    const p = f.properties;

    // "Analyse forestière" selection — same classification as the tables, so the map and
    // the pivot always describe the same set of placettes. Each is now a multi-select:
    // an empty array means "no restriction", not "match nothing".
    if (ecosysteme.length && !ecosysteme.includes(p.formation ?? NO_FORMATION)) return false;
    if (composition.length && !(p.composition && composition.includes(p.composition))) return false;
    if (strate.length && !(p.strate_niveau != null && strate.includes(String(p.strate_niveau)))) return false;

    return true;
  }), [features, ecosysteme, composition, strate]);

  return { filtered, activeCount };
}

export type MapFilters = ReturnType<typeof useMapFilters>;

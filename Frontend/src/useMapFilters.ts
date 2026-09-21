import { useMemo, useState } from 'react';
import type { PlotFeature } from './services/api';

export type FilterKey = 'controle';

/** Écosystème value standing for "placette without a field-observed essence". */
export const NO_FORMATION = '__sans_formation__';

export type FilterState = Record<FilterKey, Set<string>>;

const EMPTY: FilterState = { controle: new Set() };

/**
 * One source of truth for what the map shows: the "Analyse forestière" selection
 * (écosystème / composition / strate) plus the statut toggles in the map legend.
 *
 * `ecosysteme` is deliberately not part of FilterState: it lives in the "Analyse forestière"
 * selection because it scopes the analysis panels too, and is applied here so the map and
 * the Placettes table follow the same selection instead of offering a second écosystème control.
 */
export function useMapFilters(
  features: PlotFeature[],
  ecosysteme: string,
  composition: string,
  strate: string,
) {
  const [filters, setFilters] = useState<FilterState>(EMPTY);

  const toggle = (key: FilterKey, value: string) =>
    setFilters(prev => {
      const next = new Set(prev[key]);
      if (next.has(value)) next.delete(value); else next.add(value);
      return { ...prev, [key]: next };
    });

  const clear = (key: FilterKey) => setFilters(prev => ({ ...prev, [key]: new Set() }));
  const clearAll = () => setFilters(EMPTY);

  const activeCount = (Object.keys(filters) as FilterKey[])
    .reduce((n, k) => n + (filters[k].size > 0 ? 1 : 0), 0)
    + (ecosysteme ? 1 : 0) + (composition ? 1 : 0) + (strate ? 1 : 0);

  const filtered = useMemo(() => features.filter(f => {
    const p = f.properties;

    // "Analyse forestière" selection — same classification as the tables, so the map and
    // the pivot always describe the same set of placettes.
    if (ecosysteme && (p.formation ?? NO_FORMATION) !== ecosysteme) return false;
    if (composition && p.composition !== composition) return false;
    if (strate && String(p.strate_niveau) !== strate) return false;

    // Statut selection comes from the map legend.
    if (filters.controle.size && !filters.controle.has(p.statut)) return false;
    return true;
  }), [features, filters, ecosysteme, composition, strate]);

  return { filters, toggle, clear, clearAll, filtered, activeCount };
}

export type MapFilters = ReturnType<typeof useMapFilters>;

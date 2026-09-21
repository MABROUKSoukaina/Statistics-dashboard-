import { useMemo } from 'react';
import PlaceIcon from '@mui/icons-material/PinDrop';
import ForestIcon from '@mui/icons-material/Forest';
import GridOnIcon from '@mui/icons-material/GridOn';
import CropSquareIcon from '@mui/icons-material/Crop32';
import ViewInArIcon from '@mui/icons-material/ViewInAr';
import HeightIcon from '@mui/icons-material/Height';
import GrassIcon from '@mui/icons-material/Grass';
import ScienceIcon from '@mui/icons-material/Science';
import { T, fmt, ecosystemeColor } from '../theme';
import { Panel } from '../components/ui/Panel';
import { KpiCard } from '../components/KpiCard';
import { MapView } from '../components/MapView';
import { DonutChart } from '../components/charts/DonutChart';
import { AnalyseForestiere } from '../components/AnalyseForestiere';
import type { AnalyseSelection } from '../components/TopBar';
import type { GlobalStats, PlotFeature, FormationRow } from '../services/api';
import type { MapFilters } from '../useMapFilters';

export function SynthesePage({
  stats, features, formations, ecosystemes, loading, mapFilters, analyse,
}: {
  stats: GlobalStats | null;
  features: PlotFeature[];
  formations: FormationRow[];
  ecosystemes: string[];
  loading: boolean;
  mapFilters: MapFilters;
  analyse: AnalyseSelection;
}) {
  const ecoRows = useMemo(() => {
    const rows = formations.filter(r => r.g_comp === 1 && r.g_strate === 1)
      .sort((a, b) => b.nb_placettes - a.nb_placettes);
    const total = rows.reduce((s, r) => s + r.nb_placettes, 0) || 1;
    return rows.map(r => ({
      name: r.formation,
      placettes: r.nb_placettes,
      pct: (r.nb_placettes / total) * 100,
      color: ecosystemeColor(ecosystemes, r.formation),
    }));
  }, [formations, ecosystemes]);

  const visitPct = stats && stats.nb_placettes_programmees
    ? stats.nb_placettes_visitees / stats.nb_placettes_programmees
    : undefined;

  // With a selection active the header describes that subset, so progress against the
  // whole programme would be misleading — show the retained placettes instead.
  const filtre = Boolean(analyse.ecosysteme || analyse.composition || analyse.strate);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* ── KPI row ───────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gap: 9, gridTemplateColumns: 'repeat(auto-fit, minmax(146px, 1fr))' }}>
        {filtre ? (
          <KpiCard icon={<PlaceIcon style={{ fontSize: 17 }} />} color={T.green}
            label="Placettes" value={fmt(stats?.nb_placettes_mesurees)} sub="de la sélection" />
        ) : (
          <KpiCard icon={<PlaceIcon style={{ fontSize: 17 }} />} color={T.green}
            label="Placettes" value={fmt(stats?.nb_placettes_visitees)}
            sub={`/ ${fmt(stats?.nb_placettes_programmees)} programmées`} progress={visitPct} />
        )}
        <KpiCard icon={<ForestIcon style={{ fontSize: 17 }} />} color={T.teal}
          label="Arbres" value={fmt(stats?.nb_arbres_total)} sub="mesurés, tous états" />
        <KpiCard icon={<GridOnIcon style={{ fontSize: 16 }} />} color={T.orange}
          label="Densité" value={fmt(stats?.densite_moyenne_ha, 0)} unit="tiges/ha" sub="moyenne par placette" />
        <KpiCard icon={<CropSquareIcon style={{ fontSize: 17 }} />} color={T.purple}
          label="Surface terrière" value={fmt(stats?.surface_terriere_moyenne_ha, 1)} unit="m²/ha" sub="arbres vivants" />
        <KpiCard icon={<ViewInArIcon style={{ fontSize: 17 }} />} color={T.blue}
          label="Volume" value={fmt(stats?.volume_moyen_ha, 0)} unit="m³/ha" sub="tarif Huber" />
        <KpiCard icon={<HeightIcon style={{ fontSize: 17 }} />} color={T.cyan}
          label="Hauteur" value={fmt(stats?.hauteur_moyenne, 1)} unit="m" sub={`circonf. ${fmt(stats?.circonference_moyenne, 0)} cm`} />
        <KpiCard icon={<GrassIcon style={{ fontSize: 17 }} />} color={T.greenLite}
          label="Régénération" value={fmt(stats?.regeneration_moyenne_ha, 0)} unit="brins/ha" sub="sous-placette 30 m" />
        <KpiCard icon={<ScienceIcon style={{ fontSize: 16 }} />} color={T.pink}
          label="Échantillons" value={fmt(stats?.nb_echantillons_total)}
          sub={`${fmt(stats?.nb_coupes_total)} coupés · ${fmt(stats?.nb_morts_total)} morts`} />
      </div>

      {/* ── Map + écosystème mix ──────────────────────────────────── */}
      {/* Donut panel capped at a fixed width instead of a flex share — on a wide screen
          the old 1fr let it keep growing well past what the ring and table need. */}
      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'minmax(520px, 1fr) 340px' }}>
        <Panel
          title="Carte des placettes"
          action={<span style={{ fontSize: 11.5, color: T.dim }}>
            {loading ? 'Chargement…' : `${fmt(mapFilters.filtered.length)} placette${mapFilters.filtered.length > 1 ? 's' : ''} affichée${mapFilters.filtered.length > 1 ? 's' : ''}`}
          </span>}
          style={{ height: 580 }}
          bodyStyle={{ display: 'flex', padding: '0 16px 16px' }}
        >
          <MapView
            features={mapFilters.filtered}
            ecosystemes={ecosystemes}
            loading={loading}
            statutFilter={mapFilters.filters.controle}
            onStatutFilter={v => mapFilters.toggle('controle', v)}
          />
        </Panel>

        <Panel title="Répartition des écosystèmes" style={{ height: 580 }}
          bodyStyle={{ display: 'flex', flexDirection: 'column', minHeight: 0, padding: '0 16px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingBottom: 12 }}>
            <DonutChart
              slices={ecoRows.map(r => ({ label: r.name, value: r.placettes, color: r.color }))}
              centerValue={String(ecoRows.length)}
              centerLabel="écosystèmes"
            />
          </div>
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
              <thead>
                <tr>
                  <th style={{ ...miniTh, textAlign: 'left' }}></th>
                  <th style={miniTh}>%</th>
                  <th style={miniTh}>Placettes</th>
                </tr>
              </thead>
              <tbody>
                {ecoRows.map(r => (
                  <tr key={r.name}>
                    <td style={{ ...miniTd, textAlign: 'left' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: r.color, flexShrink: 0 }} />
                        <span style={{ color: T.text }}>{r.name}</span>
                      </span>
                    </td>
                    {/* 1 decimal: at 0 decimals a 1-placette écosystème (0,09 %) reads as
                        "0 %", as if it didn't exist. */}
                    <td style={miniTd}>{fmt(r.pct, 1)} %</td>
                    <td style={{ ...miniTd, color: T.text }}>{fmt(r.placettes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      {/* ── Detailed analysis ─────────────────────────────────────── */}
      <AnalyseForestiere
        rows={formations}
        loading={loading}
        analyse={analyse}
        ecosystemes={ecosystemes}
      />
    </div>
  );
}

const miniTh: React.CSSProperties = {
  padding: '5px 6px', fontSize: 9.5, fontWeight: 700, letterSpacing: '0.04em',
  textTransform: 'uppercase', color: T.dim, textAlign: 'right',
};

const miniTd: React.CSSProperties = {
  padding: '5px 6px', textAlign: 'right', color: T.muted,
  fontFamily: "'Space Mono', monospace", fontSize: 11,
};

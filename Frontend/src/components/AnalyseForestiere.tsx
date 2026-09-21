import { useMemo, useState } from 'react';
import { T, fmt, labelStyle } from '../theme';
import { Panel } from './ui/Panel';
import { Segmented } from './ui/Controls';
import { StackedBarChart, ChartLegend } from './charts/StackedBarChart';
import type { FormationRow } from '../services/api';
import type { AnalyseSelection } from './TopBar';

type Tab = 'ecosysteme' | 'composition' | 'strate';

export const INDICATEURS = [
  { value: 'densite_ha',            label: 'Densité moyenne (arbres/ha)', short: 'Densité',         unit: 'arbres/ha', decimals: 1 },
  { value: 'surface_terriere_ha',   label: 'Surface terrière (m²/ha)',    short: 'Surface terrière', unit: 'm²/ha',    decimals: 2 },
  { value: 'volume_ha',             label: 'Volume (m³/ha)',              short: 'Volume',          unit: 'm³/ha',     decimals: 2 },
  { value: 'hauteur_moyenne',       label: 'Hauteur moyenne (m)',         short: 'Hauteur',         unit: 'm',         decimals: 1 },
  { value: 'circonference_moyenne', label: 'Circonférence moyenne (cm)',  short: 'Circonférence',   unit: 'cm',        decimals: 1 },
  { value: 'regeneration_ha',       label: 'Régénération (brins/ha)',     short: 'Régénération',    unit: 'brins/ha',  decimals: 0 },
] as const;

const STRATE_LABEL: Record<number, string> = { 1: 'Dense', 2: 'Moy. dense', 3: 'Claire' };
const STRATE_COLOR: Record<number, string> = { 1: '#34d399', 2: '#38bdf8', 3: '#f59e0b' };
const COMPO_LABEL: Record<string, string> = { pure: 'Pur', melange: 'Mélange' };
const COMPO_COLOR: Record<string, string> = { pure: '#34d399', melange: '#38bdf8' };

/** Green → blue ramp for the table cells: high values read green, low ones blue. */
function heatColor(v: number | null, min: number, max: number): string {
  if (v == null || max <= min) return 'transparent';
  const t = (v - min) / (max - min);
  const stops: [number, number, number][] = [[56, 128, 190], [45, 170, 175], [52, 199, 132]];
  const i = t < 0.5 ? 0 : 1;
  const local = t < 0.5 ? t * 2 : (t - 0.5) * 2;
  const [r1, g1, b1] = stops[i], [r2, g2, b2] = stops[i + 1];
  const r = Math.round(r1 + (r2 - r1) * local);
  const g = Math.round(g1 + (g2 - g1) * local);
  const b = Math.round(b1 + (b2 - b1) * local);
  return `rgba(${r},${g},${b},${0.22 + t * 0.55})`;
}

export function AnalyseForestiere({ rows, loading, analyse, ecosystemes }: {
  rows: FormationRow[];
  loading: boolean;
  analyse: AnalyseSelection;
  ecosystemes: string[];
}) {
  const [tab, setTab] = useState<Tab>('ecosysteme');

  const selectedEco = analyse.ecosysteme || ecosystemes[0] || '';

  const summary = rows.find(r => r.formation === selectedEco && r.g_comp === 1 && r.g_strate === 1);

  /** Rows shown in the table, per tab + the top-bar composition/strate filters. */
  const tableRows = useMemo(() => {
    const byEco = rows.filter(r => r.formation === selectedEco);
    const compoOk = (r: FormationRow) => !analyse.composition || r.composition === analyse.composition;
    const strateOk = (r: FormationRow) => !analyse.strate || String(r.strate_niveau) === analyse.strate;

    if (tab === 'ecosysteme') {
      // one line per écosystème, so formations can be compared side by side — including
      // those with placettes but no measured tree, whose cells simply read "—".
      return rows.filter(r => r.g_comp === 1 && r.g_strate === 1)
        .sort((a, b) => b.nb_placettes - a.nb_placettes);
    }
    if (tab === 'composition') {
      return byEco.filter(r => r.g_comp === 0 && r.g_strate === 1).filter(compoOk);
    }
    return byEco.filter(r => r.g_comp === 0 && r.g_strate === 0).filter(compoOk).filter(strateOk)
      .sort((a, b) => (a.composition ?? '').localeCompare(b.composition ?? '')
        || (a.strate_niveau ?? 9) - (b.strate_niveau ?? 9));
  }, [rows, selectedEco, tab, analyse.composition, analyse.strate]);

  const metricCols = INDICATEURS;
  const ranges = useMemo(() => {
    const out: Record<string, { min: number; max: number }> = {};
    for (const c of metricCols) {
      const vals = tableRows.map(r => r[c.value]).filter((v): v is number => v != null);
      out[c.value] = { min: Math.min(...vals), max: Math.max(...vals) };
    }
    return out;
  }, [tableRows, metricCols]);

  /** Stacked columns: share of placettes per strate, within each composition. */
  const stackGroups = useMemo(() => {
    const strateRows = rows.filter(r => r.formation === selectedEco && r.g_comp === 0 && r.g_strate === 0);
    return (['pure', 'melange'] as const).map(compo => ({
      label: COMPO_LABEL[compo],
      parts: [1, 2, 3].map(s => ({
        label: STRATE_LABEL[s],
        color: STRATE_COLOR[s],
        value: strateRows.find(r => r.composition === compo && r.strate_niveau === s)?.nb_placettes ?? 0,
      })),
    }));
  }, [rows, selectedEco]);

  function rowLabel(r: FormationRow): string {
    if (tab === 'ecosysteme') return r.formation;
    if (tab === 'composition') return COMPO_LABEL[r.composition ?? ''] ?? '—';
    return r.strate_niveau != null ? STRATE_LABEL[r.strate_niveau] : 'Non renseigné';
  }

  return (
    <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'minmax(520px, 2.4fr) minmax(260px, 1fr)' }}>
      {/* ── Detailed table ─────────────────────────────────────────── */}
      <Panel
        title="Analyse forestière détaillée"
        action={<Segmented size="sm" value={tab} onChange={setTab} options={[
          { value: 'ecosysteme', label: 'Écosystème' },
          { value: 'composition', label: 'Composition' },
          { value: 'strate', label: 'Strate' },
        ]} />}
      >
        {tab !== 'ecosysteme' && (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, marginBottom: 13, flexWrap: 'wrap' }}>
            <div style={{ paddingBottom: 3 }}>
              <div style={{ ...labelStyle, fontSize: 9, marginBottom: 2 }}>Écosystème</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{selectedEco || '—'}</div>
            </div>
            {summary && (
              <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', paddingBottom: 3 }}>
                {[
                  { k: 'Placettes', v: fmt(summary.nb_placettes) },
                  { k: 'Arbres', v: fmt(summary.nb_arbres) },
                  { k: 'Densité', v: `${fmt(summary.densite_ha, 0)} /ha` },
                  { k: 'Surf. terrière', v: `${fmt(summary.surface_terriere_ha, 1)} m²/ha` },
                  { k: 'Volume', v: `${fmt(summary.volume_ha, 0)} m³/ha` },
                  { k: 'Hauteur', v: `${fmt(summary.hauteur_moyenne, 1)} m` },
                ].map(s => (
                  <div key={s.k}>
                    <div style={{ ...labelStyle, fontSize: 9, marginBottom: 2 }}>{s.k}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{s.v}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {loading ? (
          <div style={{ color: T.dim, fontSize: 12.5, padding: '18px 0' }}>Chargement…</div>
        ) : (
          <div style={{ overflowX: 'auto', borderRadius: 10, border: `1px solid ${T.border}` }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 620 }}>
              <thead>
                <tr style={{ background: T.panelAlt }}>
                  <th style={{ ...th, textAlign: 'left' }}>
                    {tab === 'ecosysteme' ? 'Écosystème' : tab === 'composition' ? 'Composition' : 'Strate'}
                  </th>
                  <th style={th}>Placettes</th>
                  {metricCols.map(c => (
                    <th key={c.value} style={th}>
                      {c.short}<br /><span style={{ fontWeight: 400, color: T.dim }}>{c.unit}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableRows.map((r, i) => (
                  <tr key={i}>
                    <td style={{ ...td, textAlign: 'left', color: T.text, fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {tab === 'strate' && (
                        <span style={{
                          display: 'inline-block', width: 7, height: 7, borderRadius: '50%', marginRight: 7,
                          background: COMPO_COLOR[r.composition ?? ''] ?? T.dim,
                        }} />
                      )}
                      {tab === 'strate' && <span style={{ color: T.muted, fontWeight: 500 }}>{COMPO_LABEL[r.composition ?? '']} · </span>}
                      {rowLabel(r)}
                    </td>
                    <td style={td}>{fmt(r.nb_placettes)}</td>
                    {metricCols.map(c => {
                      const v = r[c.value];
                      const { min, max } = ranges[c.value];
                      return (
                        <td key={c.value} style={{
                          ...td,
                          background: heatColor(v, min, max),
                          color: v == null ? T.dim : '#eaf6f1',
                          fontWeight: 500,
                        }}>
                          {fmt(v, c.decimals)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {tableRows.length === 0 && (
                  <tr><td colSpan={metricCols.length + 2} style={{ ...td, color: T.dim, padding: '18px 0' }}>
                    Aucune donnée pour cette sélection
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        <p style={{ margin: '9px 2px 0', fontSize: 10.5, color: T.dim }}>
          Cellules colorées du plus faible (bleu) au plus élevé (vert) de la sélection affichée.
        </p>
      </Panel>

      {/* ── Composition × strate mix ────────────────────────────────── */}
      <Panel title="Répartition par composition et strate">
        <ChartLegend items={[1, 2, 3].map(s => ({ label: STRATE_LABEL[s], color: STRATE_COLOR[s] }))} />
        <div style={{ marginTop: 10 }}>
          <StackedBarChart groups={stackGroups} />
        </div>
      </Panel>

    </div>
  );
}

const th: React.CSSProperties = {
  padding: '9px 10px', fontSize: 9.5, fontWeight: 700, letterSpacing: '0.04em',
  textTransform: 'uppercase', color: T.muted, textAlign: 'center',
  borderBottom: `1px solid ${T.border}`, whiteSpace: 'nowrap',
};

const td: React.CSSProperties = {
  padding: '8px 10px', textAlign: 'center', color: T.muted,
  fontFamily: "'Space Mono', monospace", fontSize: 11.5,
  borderBottom: `1px solid ${T.border}`,
};

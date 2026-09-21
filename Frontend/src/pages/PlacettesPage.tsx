import { useMemo, useState } from 'react';
import SearchIcon from '@mui/icons-material/Search';
import DownloadIcon from '@mui/icons-material/FileDownloadOutlined';
import { T, fmt } from '../theme';
import { Panel } from '../components/ui/Panel';
import { exportCSV, exportXLSX, exportKML, exportSHP } from '../components/exportUtils';
import { getUser, type PlotFeature } from '../services/api';

type SortKey =
  | 'num_placette' | 'statut' | 'formation' | 'dpanef' | 'nb_arbres_total'
  | 'nbre_tiges_ha' | 'surface_terriere_ha' | 'volume_ha' | 'hauteur_moyenne' | 'circonference_moyenne';

const STATUT_LABEL: Record<PlotFeature['properties']['statut'], string> = {
  controle: 'Contrôlée', visitee: 'Visitée', programmee: 'Programmée',
};
const STATUT_COLOR: Record<PlotFeature['properties']['statut'], string> = {
  controle: T.violet, visitee: T.green, programmee: T.orange,
};

const COLUMNS: { key: SortKey; label: string; numeric?: boolean; decimals?: number }[] = [
  { key: 'num_placette', label: 'Placette' },
  { key: 'statut', label: 'Statut' },
  { key: 'formation', label: 'Écosystème' },
  { key: 'dpanef', label: 'DPANEF' },
  { key: 'nb_arbres_total', label: 'Arbres', numeric: true, decimals: 0 },
  { key: 'nbre_tiges_ha', label: 'Densité (tiges/ha)', numeric: true, decimals: 1 },
  { key: 'surface_terriere_ha', label: 'ST (m²/ha)', numeric: true, decimals: 2 },
  { key: 'volume_ha', label: 'Volume (m³/ha)', numeric: true, decimals: 2 },
  { key: 'hauteur_moyenne', label: 'Hauteur (m)', numeric: true, decimals: 1 },
  { key: 'circonference_moyenne', label: 'Circonf. (cm)', numeric: true, decimals: 1 },
];

export function PlacettesPage({ features, loading }: { features: PlotFeature[]; loading: boolean }) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('num_placette');
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  const [exportOpen, setExportOpen] = useState(false);
  const isAdmin = getUser()?.role === 'ADMIN';

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? features.filter(f =>
          f.properties.num_placette.toLowerCase().includes(q) ||
          (f.properties.formation ?? '').toLowerCase().includes(q) ||
          (f.properties.dpanef ?? '').toLowerCase().includes(q))
      : features;

    return [...filtered].sort((a, b) => {
      const av = a.properties[sortKey], bv = b.properties[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'string' && typeof bv === 'string') return av.localeCompare(bv) * sortDir;
      return ((av as number) - (bv as number)) * sortDir;
    });
  }, [features, search, sortKey, sortDir]);

  return (
    <Panel
      title="Placettes"
      action={
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 7, background: T.panelAlt,
            border: `1px solid ${T.border}`, borderRadius: 9, padding: '6px 10px',
          }}>
            <SearchIcon style={{ fontSize: 15, color: T.dim }} />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Placette, écosystème, DPANEF…"
              style={{ background: 'none', border: 'none', outline: 'none', color: T.text, fontSize: 12.5, width: 210, fontFamily: 'inherit' }} />
          </div>

          {isAdmin && rows.length > 0 && (
            <div style={{ position: 'relative' }}>
              <button onClick={() => setExportOpen(o => !o)} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '7px 11px', borderRadius: 9,
                background: exportOpen ? 'rgba(16,185,129,0.15)' : T.panelAlt,
                border: `1px solid ${exportOpen ? 'rgba(16,185,129,0.45)' : T.border}`,
                color: exportOpen ? T.greenLite : T.muted, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
              }}>
                <DownloadIcon style={{ fontSize: 16 }} /> Exporter
              </button>
              {exportOpen && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 3000,
                  background: T.raised, border: `1px solid ${T.borderStrong}`, borderRadius: 11,
                  boxShadow: '0 16px 40px rgba(0,0,0,.55)', padding: '8px 0', minWidth: 172,
                }}>
                  {[
                    { label: 'Excel (.xlsx)', run: () => exportXLSX(rows) },
                    { label: 'CSV', run: () => exportCSV(rows) },
                    { label: 'KML (Google Earth)', run: () => exportKML(rows) },
                    { label: 'Shapefile (.zip)', run: () => { void exportSHP(rows); } },
                  ].map(o => (
                    <button key={o.label} onClick={() => { o.run(); setExportOpen(false); }} style={{
                      display: 'block', width: '100%', textAlign: 'left', padding: '8px 14px',
                      background: 'none', border: 'none', cursor: 'pointer', color: T.text,
                      fontSize: 12.5, fontFamily: 'inherit',
                    }}>{o.label}</button>
                  ))}
                </div>
              )}
            </div>
          )}

          <span style={{ fontSize: 11.5, color: T.dim }}>
            {loading ? 'Chargement…' : `${fmt(rows.length)} ligne${rows.length > 1 ? 's' : ''}`}
          </span>
        </div>
      }
      bodyStyle={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', minHeight: 0 }}
      style={{ height: 'calc(100vh - 210px)', minHeight: 420 }}
    >
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', border: `1px solid ${T.border}`, borderRadius: 10 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
            <tr style={{ background: T.panelAlt }}>
              {COLUMNS.map(c => (
                <th key={c.key}
                  onClick={() => { if (sortKey === c.key) setSortDir(d => (d === 1 ? -1 : 1)); else { setSortKey(c.key); setSortDir(1); } }}
                  style={{
                    padding: '10px 12px', fontSize: 9.5, fontWeight: 700, letterSpacing: '0.04em',
                    textTransform: 'uppercase', color: sortKey === c.key ? T.greenLite : T.muted,
                    textAlign: c.numeric ? 'right' : 'left', cursor: 'pointer', userSelect: 'none',
                    borderBottom: `1px solid ${T.border}`, whiteSpace: 'nowrap',
                  }}>
                  {c.label}{sortKey === c.key ? (sortDir === 1 ? ' ▲' : ' ▼') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(f => {
              const p = f.properties;
              return (
                <tr key={p.num_placette}>
                  <td style={{ ...td, color: T.text, fontWeight: 600 }}>{p.num_placette}</td>
                  <td style={td}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: STATUT_COLOR[p.statut], fontSize: 11 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: STATUT_COLOR[p.statut] }} />
                      {STATUT_LABEL[p.statut]}
                    </span>
                  </td>
                  <td style={td}>{p.formation ?? '—'}</td>
                  <td style={td}>{p.dpanef ?? '—'}</td>
                  <td style={tdNum}>{fmt(p.nb_arbres_total)}</td>
                  <td style={tdNum}>{fmt(p.nbre_tiges_ha, 1)}</td>
                  <td style={tdNum}>{fmt(p.surface_terriere_ha, 2)}</td>
                  <td style={tdNum}>{fmt(p.volume_ha, 2)}</td>
                  <td style={tdNum}>{fmt(p.hauteur_moyenne, 1)}</td>
                  <td style={tdNum}>{fmt(p.circonference_moyenne, 1)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

const td: React.CSSProperties = {
  padding: '8px 12px', borderBottom: `1px solid ${T.border}`, color: T.muted,
  fontSize: 12, whiteSpace: 'nowrap',
};

const tdNum: React.CSSProperties = {
  ...td, textAlign: 'right', fontFamily: "'Space Mono', monospace", fontSize: 11.5,
};

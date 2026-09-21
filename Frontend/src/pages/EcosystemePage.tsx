import { useEffect, useState } from 'react';
import { T, fmt, labelStyle, ecosystemeColor } from '../theme';
import { Panel } from '../components/ui/Panel';
import { PlainSelect } from '../components/ui/Controls';
import { HistogramChart } from '../components/charts/HistogramChart';
import { CategoricalBarChart } from '../components/charts/CategoricalBarChart';
import { EXPOSITION, TOPO_POS, SUBSTRAT, TYPE_SOL } from '../labels';
import { fetchFormationDetail, type FormationDetail, type FormationRow } from '../services/api';

function decode(data: { code: number; nb: number }[] | undefined, dict: Record<number, string>) {
  return (data ?? []).map(d => ({ label: dict[d.code] ?? `Code ${d.code}`, nb: d.nb }));
}

export function EcosystemePage({ formations, ecosystemes, selected, onSelect }: {
  formations: FormationRow[];
  ecosystemes: string[];
  selected: string;
  onSelect: (v: string) => void;
}) {
  const [detail, setDetail] = useState<FormationDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selected) return;
    setLoading(true); setDetail(null); setError(null);
    fetchFormationDetail(selected)
      .then(setDetail)
      .catch(e => setError(e instanceof Error ? e.message : 'Erreur de chargement'))
      .finally(() => setLoading(false));
  }, [selected]);

  const summary = formations.find(r => r.formation === selected && r.g_comp === 1 && r.g_strate === 1);
  const color = ecosystemeColor(ecosystemes, selected);

  const stats = [
    { label: 'Placettes', value: fmt(summary?.nb_placettes), color: T.green },
    { label: 'Arbres', value: fmt(summary?.nb_arbres), color: T.teal },
    { label: 'Échantillons', value: fmt(summary?.nb_echantillons), color: T.pink },
    { label: 'Densité', value: `${fmt(summary?.densite_ha, 0)} /ha`, color: T.orange },
    { label: 'Surface terrière', value: `${fmt(summary?.surface_terriere_ha, 1)} m²/ha`, color: T.purple },
    { label: 'Volume', value: `${fmt(summary?.volume_ha, 0)} m³/ha`, color: T.blue },
    { label: 'Hauteur', value: `${fmt(summary?.hauteur_moyenne, 1)} m`, color: T.cyan },
    { label: 'Régénération', value: `${fmt(summary?.regeneration_ha, 0)} brins/ha`, color: T.greenLite },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Panel
        title="Écosystème"
        action={
          <PlainSelect value={selected} width={220} onChange={onSelect}
            options={ecosystemes.map(e => ({ value: e, label: e }))} />
        }
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <span style={{ width: 11, height: 11, borderRadius: '50%', background: color }} />
          <span style={{ fontSize: 19, fontWeight: 700, color: T.text, letterSpacing: '-0.01em' }}>{selected || '—'}</span>
          {detail && (
            <span style={{ fontSize: 12, color: T.dim }}>
              altitude {fmt(detail.resume.altitude_min)} – {fmt(detail.resume.altitude_max)} m
            </span>
          )}
        </div>

        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))' }}>
          {stats.map(s => (
            <div key={s.label} style={{
              background: T.panelAlt, border: `1px solid ${T.border}`, borderRadius: 11,
              padding: '11px 13px', position: 'relative', overflow: 'hidden',
            }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: s.color, opacity: .65 }} />
              <div style={{ ...labelStyle, fontSize: 9, marginBottom: 5 }}>{s.label}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: T.text }}>{s.value}</div>
            </div>
          ))}
        </div>
      </Panel>

      {error && <div style={{ color: T.red, fontSize: 13 }}>{error}</div>}
      {loading && <div style={{ color: T.dim, fontSize: 13 }}>Chargement…</div>}

      {detail && !loading && (
        <>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))' }}>
            <Panel title="Structure en circonférences">
              <HistogramChart bins={detail.structure_circonference} unit="Circonférence C1.3 (cm)" color={T.cyan} />
            </Panel>
            <Panel title="Structure en hauteurs">
              <HistogramChart bins={detail.structure_hauteur} unit="Hauteur des tiges (m)" color={T.green} />
            </Panel>
          </div>

          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))' }}>
            <Panel title="Répartition selon l'exposition">
              <CategoricalBarChart data={decode(detail.exposition, EXPOSITION)} color={T.blue} />
            </Panel>
            <Panel title="Répartition selon la position topographique">
              <CategoricalBarChart data={decode(detail.position_topo, TOPO_POS)} color={T.teal} />
            </Panel>
            <Panel title="Répartition selon le substrat">
              <CategoricalBarChart data={decode(detail.substrat, SUBSTRAT)} color={T.purple} />
            </Panel>
            <Panel title="Répartition selon le type de sol">
              <CategoricalBarChart data={decode(detail.type_sol, TYPE_SOL)} color={T.pink} />
            </Panel>
            <Panel title="Classes de pente">
              <CategoricalBarChart data={detail.pente.map(p => ({ label: `${p.classe} %`, nb: p.nb }))} color={T.orange} />
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}

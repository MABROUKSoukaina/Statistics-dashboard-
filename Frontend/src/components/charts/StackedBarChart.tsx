import { T } from '../../theme';

export interface StackGroup { label: string; parts: { label: string; value: number; color: string }[] }

/** 100 % stacked columns — répartition des placettes par composition et strate. */
export function StackedBarChart({ groups, height = 210 }: { groups: StackGroup[]; height?: number }) {
  const width = 300;
  const padT = 10, padB = 26, padL = 34, padR = 8;
  const plotH = height - padT - padB;
  const plotW = width - padL - padR;
  const colW = plotW / Math.max(groups.length, 1);
  const barW = Math.min(colW * 0.52, 62);

  const hasData = groups.some(g => g.parts.some(p => p.value > 0));
  if (!hasData) {
    return <div style={{ color: T.dim, fontSize: 12, padding: '30px 0', textAlign: 'center' }}>Aucune donnée</div>;
  }

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {[0, 0.25, 0.5, 0.75, 1].map(f => (
        <g key={f}>
          <line x1={padL} x2={width - padR} y1={padT + plotH * f} y2={padT + plotH * f}
            stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
          <text x={padL - 7} y={padT + plotH * f + 3.5} textAnchor="end" fontSize={9} fill={T.dim}>
            {Math.round((1 - f) * 100)}%
          </text>
        </g>
      ))}

      {groups.map((g, gi) => {
        const total = g.parts.reduce((s, p) => s + p.value, 0);
        const x = padL + gi * colW + (colW - barW) / 2;
        let y = padT + plotH;
        return (
          <g key={gi}>
            {g.parts.map((p, pi) => {
              if (total === 0 || p.value === 0) return null;
              const h = (p.value / total) * plotH;
              y -= h;
              const pct = Math.round((p.value / total) * 100);
              return (
                <g key={pi}>
                  <rect x={x} y={y} width={barW} height={h} fill={p.color} rx={2} />
                  {h > 17 && (
                    <text x={x + barW / 2} y={y + h / 2 + 3.5} textAnchor="middle"
                      fontSize={10} fontWeight={700} fill="#06231a">{pct} %</text>
                  )}
                </g>
              );
            })}
            <text x={padL + gi * colW + colW / 2} y={height - 8} textAnchor="middle"
              fontSize={11} fill={T.muted}>{g.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function ChartLegend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', justifyContent: 'center' }}>
      {items.map(i => (
        <span key={i.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: T.muted }}>
          <span style={{ width: 9, height: 9, borderRadius: 3, background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

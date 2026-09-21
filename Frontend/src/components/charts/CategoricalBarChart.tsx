/**
 * Plain bar chart — matches the reference report's "Répartition selon…" charts
 * (nombre de placettes per modality: exposition, position topo, substrat, type de sol, pente).
 */
export function CategoricalBarChart({
  data, color = '#10b981', height = 200,
}: { data: { label: string; nb: number }[]; color?: string; height?: number }) {
  if (data.length === 0) {
    return <div style={{ color: '#7a8a9c', fontSize: 12, padding: '20px 0', textAlign: 'center' }}>Aucune donnée</div>;
  }

  const width = 560;
  const padL = 34, padR = 14, padT = 14, padB = 48;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const maxNb = Math.max(...data.map(d => d.nb), 1);
  const n = data.length;
  const barW = plotW / n;

  const x = (i: number) => padL + i * barW;
  const y = (nb: number) => padT + plotH - (nb / maxNb) * plotH;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {[0, 0.5, 1].map(f => (
        <line key={f} x1={padL} x2={width - padR} y1={padT + plotH * (1 - f)} y2={padT + plotH * (1 - f)}
          stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
      ))}
      {[0, 0.5, 1].map(f => (
        <text key={f} x={padL - 6} y={padT + plotH * (1 - f) + 3} textAnchor="end" fontSize={9} fill="#7a8a9c">
          {Math.round(maxNb * f)}
        </text>
      ))}
      {data.map((d, i) => (
        <rect key={i} x={x(i) + barW * 0.12} y={y(d.nb)} width={barW * 0.76} height={plotH - (y(d.nb) - padT)}
          fill={color} fillOpacity={0.8} stroke={color} strokeWidth={1} rx={2} />
      ))}
      {data.map((d, i) => (
        <text key={i} x={x(i) + barW / 2} y={height - padB + 16} textAnchor="end" fontSize={9} fill="#94a3b8"
          transform={`rotate(-35 ${x(i) + barW / 2} ${height - padB + 16})`}>
          {d.label}
        </text>
      ))}
    </svg>
  );
}

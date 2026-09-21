import { T } from '../../theme';

export interface DonutSlice { label: string; value: number; color: string }

/** Ring chart with a centred count — écosystème mix on the Synthèse page. */
export function DonutChart({ slices, centerValue, centerLabel, size = 168, thickness = 26 }: {
  slices: DonutSlice[];
  centerValue: string;
  centerLabel: string;
  size?: number;
  thickness?: number;
}) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;

  let offset = 0;
  const arcs = slices.map(s => {
    const frac = total > 0 ? s.value / total : 0;
    const arc = { ...s, dash: frac * c, offset };
    offset += frac * c;
    return arc;
  });

  return (
    <svg viewBox={`0 0 ${size} ${size}`} style={{ width: size, height: size, flexShrink: 0 }}>
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke="rgba(255,255,255,0.05)" strokeWidth={thickness} />
        {arcs.map((a, i) => {
          // The 1.5px gap between slices only reads as separation when the slice is big
          // enough to survive it — a fixed subtraction silently erases anything smaller
          // (an écosystème with a handful of placettes would draw as nothing at all).
          // Capping the gap at a third of the slice keeps every non-zero value visible.
          const gap = a.dash > 0 ? Math.min(1.5, a.dash / 3) : 0;
          return (
            <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none"
              stroke={a.color} strokeWidth={thickness}
              strokeDasharray={`${Math.max(a.dash - gap, 0)} ${c}`}
              strokeDashoffset={-a.offset} />
          );
        })}
      </g>
      <text x={size / 2} y={size / 2 - 3} textAnchor="middle"
        fontSize={25} fontWeight={700} fill={T.text}>{centerValue}</text>
      <text x={size / 2} y={size / 2 + 15} textAnchor="middle"
        fontSize={10.5} fill={T.dim}>{centerLabel}</text>
    </svg>
  );
}

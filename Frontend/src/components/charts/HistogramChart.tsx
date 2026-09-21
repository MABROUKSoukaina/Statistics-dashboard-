import { useRef, useState } from 'react';
import type { HistBin } from '../../services/api';
import { ChartTooltip, type HoverPoint } from './ChartTooltip';

/**
 * Bar histogram + trend line, matching the reference report's "Structure en
 * circonférences / en hauteurs" charts (bars = nombre de tiges, orange line = "Tendance").
 * The trend line here connects each bar's own top (no spline smoothing) — visually close
 * to the report's spline without pulling in a math dependency for it.
 */
export function HistogramChart({
  bins, unit, color = '#38bdf8', height = 200,
}: { bins: HistBin[]; unit: string; color?: string; height?: number }) {
  const [hover, setHover] = useState<HoverPoint | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  if (bins.length === 0) {
    return <div style={{ color: '#7a8a9c', fontSize: 12, padding: '20px 0', textAlign: 'center' }}>Aucune donnée</div>;
  }

  const width = 560;
  const padL = 44, padR = 14, padT = 14, padB = 34;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const maxNb = Math.max(...bins.map(b => b.nb), 1);
  const n = bins.length;
  const barW = plotW / n;

  const x = (i: number) => padL + i * barW;
  const y = (nb: number) => padT + plotH - (nb / maxNb) * plotH;

  // Show every bin label if few, else thin them out to avoid overlap.
  const labelStep = Math.max(1, Math.ceil(n / 12));
  // Bins are equal-width, so any consecutive pair gives the bin's span for the tooltip.
  const binWidth = n > 1 ? bins[1].bin_start - bins[0].bin_start : 0;

  const point = (i: number, e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setHover({ i, x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        {/* gridlines */}
        {[0, 0.25, 0.5, 0.75, 1].map(f => (
          <line key={f} x1={padL} x2={width - padR} y1={padT + plotH * (1 - f)} y2={padT + plotH * (1 - f)}
            stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
        ))}
        {/* y-axis labels */}
        {[0, 0.5, 1].map(f => (
          <text key={f} x={padL - 6} y={padT + plotH * (1 - f) + 3} textAnchor="end" fontSize={9} fill="#7a8a9c">
            {Math.round(maxNb * f)}
          </text>
        ))}
        {/* bars */}
        {bins.map((b, i) => (
          <rect key={i} x={x(i) + 1} y={y(b.nb)} width={Math.max(barW - 2, 1)} height={plotH - (y(b.nb) - padT)}
            fill={color} fillOpacity={hover?.i === i ? 1 : 0.75} stroke={color} strokeWidth={hover?.i === i ? 1.8 : 1}
            style={{ cursor: 'pointer' }}
            onMouseEnter={e => point(i, e)} onMouseMove={e => point(i, e)} onMouseLeave={() => setHover(null)} />
        ))}
        {/* trend line */}
        <polyline
          fill="none" stroke="#fb923c" strokeWidth={1.8}
          points={bins.map((b, i) => `${x(i) + barW / 2},${y(b.nb)}`).join(' ')}
        />
        {/* x-axis labels */}
        {bins.map((b, i) => (i % labelStep === 0) ? (
          <text key={i} x={x(i) + barW / 2} y={height - padB + 14} textAnchor="middle" fontSize={8.5} fill="#7a8a9c">
            {b.bin_start}
          </text>
        ) : null)}
        <text x={width / 2} y={height - 4} textAnchor="middle" fontSize={9.5} fill="#94a3b8">{unit}</text>
      </svg>

      {hover && (
        <ChartTooltip point={hover}>
          <div style={{ fontWeight: 700 }}>
            {bins[hover.i].bin_start}{binWidth ? ` – ${bins[hover.i].bin_start + binWidth}` : ''}
          </div>
          <div style={{ color: '#8b9bb0' }}>{bins[hover.i].nb} tige{bins[hover.i].nb > 1 ? 's' : ''}</div>
        </ChartTooltip>
      )}
    </div>
  );
}

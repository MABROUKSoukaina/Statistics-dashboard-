import type { ReactNode } from 'react';

export interface HoverPoint {
  /** Index of the hovered bar/bin within its data array. */
  i: number;
  /** Pointer position in pixels, relative to the chart's container div. */
  x: number;
  y: number;
}

/**
 * Floating tooltip for the hand-rolled SVG charts. Positioned from the raw pointer
 * coordinates (relative to the chart's container) rather than the SVG's internal viewBox
 * units, so it stays pixel-accurate regardless of how much the `viewBox` is scaled up or
 * down to fill its container.
 */
export function ChartTooltip({ point, children }: { point: HoverPoint; children: ReactNode }) {
  return (
    <div style={{
      position: 'absolute', left: point.x, top: point.y, transform: 'translate(-50%, calc(-100% - 10px))',
      pointerEvents: 'none', background: '#16212f', border: '1px solid rgba(255,255,255,0.13)',
      borderRadius: 8, padding: '6px 10px', fontSize: 11, lineHeight: 1.4, color: '#e6edf5',
      whiteSpace: 'nowrap', boxShadow: '0 8px 20px rgba(0,0,0,0.45)', zIndex: 10,
    }}>
      {children}
    </div>
  );
}

import type { CSSProperties } from 'react';

/** Design tokens — deep-navy dashboard palette. */
export const T = {
  bg:        '#0a1018',
  sidebar:   '#0c131d',
  panel:     '#111a26',
  panelAlt:  '#0e1621',
  raised:    '#16212f',
  border:    'rgba(255,255,255,0.07)',
  borderStrong: 'rgba(255,255,255,0.13)',

  text:      '#e6edf5',
  muted:     '#8b9bb0',
  dim:       '#64748b',

  green:     '#10b981',
  greenLite: '#34d399',
  teal:      '#14b8a6',
  blue:      '#3b82f6',
  cyan:      '#06b6d4',
  purple:    '#a855f7',
  pink:      '#ec4899',
  orange:    '#f59e0b',
  red:       '#ef4444',
  violet:    '#8b5cf6',
};

/** Écosystème colour ramp — stable order, used by map, donut and legend alike. */
export const ECOSYSTEME_COLORS = [
  '#34d399', '#38bdf8', '#22c55e', '#f59e0b', '#06b6d4',
  '#a78bfa', '#f472b6', '#facc15', '#c084fc', '#2dd4bf',
  '#fb923c', '#60a5fa', '#94a3b8',
];

export function ecosystemeColor(list: string[], name: string | null | undefined): string {
  if (!name) return T.dim;
  const i = list.indexOf(name);
  return i < 0 ? T.dim : ECOSYSTEME_COLORS[i % ECOSYSTEME_COLORS.length];
}

export const panelStyle: CSSProperties = {
  background: T.panel,
  border: `1px solid ${T.border}`,
  borderRadius: 14,
};

export const labelStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.07em',
  textTransform: 'uppercase',
  color: T.dim,
};

export function fmt(n: number | null | undefined, decimals = 0): string {
  if (n == null) return '—';
  return Number(n).toLocaleString('fr-FR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

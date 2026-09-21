import type { ReactNode } from 'react';
import { T, labelStyle } from '../../theme';

/**
 * Single-choice select styled like the filter boxes.
 * `inline` puts the label beside the control instead of above it — shorter rows, and the
 * control group spreads across the width instead of leaving the panel half empty.
 */
export function PlainSelect({ label, value, options, onChange, width = 120, inline = false }: {
  label?: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  width?: number | string;
  inline?: boolean;
}) {
  const select = (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        width: inline ? width : '100%', background: T.panelAlt, border: `1px solid ${T.border}`,
        borderRadius: 9, padding: '7px 8px', color: T.text, fontSize: 12.5,
        fontFamily: 'inherit', outline: 'none', cursor: 'pointer',
      }}
    >
      {options.map(o => <option key={o.value} value={o.value} style={{ background: T.raised }}>{o.label}</option>)}
    </select>
  );

  if (inline) {
    return (
      <label style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        {label && <span style={{ ...labelStyle, whiteSpace: 'nowrap' }}>{label}</span>}
        {select}
      </label>
    );
  }

  return (
    <div style={{ width }}>
      {label && <div style={{ ...labelStyle, marginBottom: 5 }}>{label}</div>}
      {select}
    </div>
  );
}

/** Pill segmented control — used for "Vue" and for the analysis tabs. */
export function Segmented<V extends string>({ value, options, onChange, size = 'md' }: {
  value: V;
  options: { value: V; label: string }[];
  onChange: (v: V) => void;
  size?: 'sm' | 'md';
}) {
  return (
    <div style={{
      display: 'inline-flex', gap: 3, padding: 3,
      background: T.panelAlt, border: `1px solid ${T.border}`, borderRadius: 10,
    }}>
      {options.map(o => {
        const active = o.value === value;
        return (
          <button key={o.value} onClick={() => onChange(o.value)} style={{
            padding: size === 'sm' ? '5px 11px' : '7px 15px',
            borderRadius: 7, border: 'none', cursor: 'pointer',
            fontSize: size === 'sm' ? 11.5 : 12.5, fontWeight: active ? 650 : 500,
            fontFamily: 'inherit',
            background: active ? T.green : 'transparent',
            color: active ? '#04170f' : T.muted,
            transition: 'background .15s, color .15s',
          }}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Radio list used in the "Indicateur et vue" panel. */
export function RadioList<V extends string>({ value, options, onChange }: {
  value: V;
  options: { value: V; label: string }[];
  onChange: (v: V) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {options.map(o => {
        const on = o.value === value;
        return (
          <label key={o.value} style={{
            display: 'flex', alignItems: 'center', gap: 9, padding: '6px 0', cursor: 'pointer',
          }}>
            <span style={{
              width: 15, height: 15, borderRadius: '50%', flexShrink: 0,
              border: `1.5px solid ${on ? T.green : T.borderStrong}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {on && <span style={{ width: 7, height: 7, borderRadius: '50%', background: T.green }} />}
            </span>
            <input type="radio" checked={on} onChange={() => onChange(o.value)}
              style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }} />
            <span style={{ fontSize: 12.5, color: on ? T.text : T.muted }}>{o.label}</span>
          </label>
        );
      })}
    </div>
  );
}

/** Soft callout with an icon slot — the "tip" box in the right-hand panel. */
export function Callout({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div style={{
      display: 'flex', gap: 10, padding: '11px 13px', borderRadius: 11,
      background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.22)',
    }}>
      <span style={{ color: T.greenLite, display: 'flex', flexShrink: 0 }}>{icon}</span>
      <span style={{ fontSize: 11.5, lineHeight: 1.5, color: T.muted }}>{children}</span>
    </div>
  );
}

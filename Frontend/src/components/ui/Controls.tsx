import { useEffect, useRef, useState, type ReactNode } from 'react';
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

export interface MultiOption { value: string; label: string }

/**
 * Checkbox dropdown standing in for a native <select>: the browser draws its own
 * "selected option" highlight (blue on Windows/Chrome) and that can't be restyled, and
 * it only ever holds one value. Drawing the list ourselves lets the selected rows use
 * the app's green, and lets more than one option be active at once.
 */
export function MultiSelectDropdown({
  label, value, options, onChange, width = 170, inline = false, allLabel = 'Tous',
}: {
  label?: string;
  value: string[];
  options: MultiOption[];
  onChange: (v: string[]) => void;
  width?: number | string;
  inline?: boolean;
  allLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const toggleValue = (v: string) =>
    onChange(value.includes(v) ? value.filter(x => x !== v) : [...value, v]);

  const summary = value.length === 0
    ? allLabel
    : value.length === 1
      ? (options.find(o => o.value === value[0])?.label ?? value[0])
      : `${value.length} sélectionnés`;

  const control = (
    <div ref={ref} style={{ position: 'relative', width: inline ? width : '100%' }}>
      <button type="button" onClick={() => setOpen(o => !o)} style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        background: T.panelAlt, border: `1px solid ${open ? T.green : T.border}`,
        borderRadius: 9, padding: '7px 8px', color: value.length ? T.text : T.muted, fontSize: 12.5,
        fontFamily: 'inherit', outline: 'none', cursor: 'pointer', textAlign: 'left',
      }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{summary}</span>
        <span style={{
          color: T.dim, fontSize: 10, flexShrink: 0,
          transform: open ? 'rotate(180deg)' : undefined, transition: 'transform .15s',
        }}>▾</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 5px)', left: 0, minWidth: '100%', width: 'max-content',
          // Leaflet draws its own panes/controls up to z-index 1000, and since neither the
          // map container nor this dropdown's ancestors open a stacking context of their
          // own, those compete directly against this panel — well above 1000 keeps it on top.
          maxWidth: 280, maxHeight: 280, overflowY: 'auto', zIndex: 2000,
          background: T.raised, border: `1px solid ${T.borderStrong}`, borderRadius: 10,
          padding: 5, boxShadow: '0 12px 28px rgba(0,0,0,0.45)',
        }}>
          {options.map(o => {
            const on = value.includes(o.value);
            return (
              <label key={o.value} style={{
                display: 'flex', alignItems: 'center', gap: 9, padding: '6px 8px', borderRadius: 7,
                cursor: 'pointer', background: on ? 'rgba(16,185,129,0.14)' : 'transparent',
              }}>
                <span style={{
                  width: 15, height: 15, borderRadius: 4, flexShrink: 0,
                  border: `1.5px solid ${on ? T.green : T.borderStrong}`, background: on ? T.green : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {on && <span style={{ color: '#04170f', fontSize: 10, fontWeight: 700, lineHeight: 1 }}>✓</span>}
                </span>
                <input type="checkbox" checked={on} onChange={() => toggleValue(o.value)}
                  style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }} />
                <span style={{ fontSize: 12.5, color: on ? T.text : T.muted, whiteSpace: 'nowrap' }}>{o.label}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );

  if (inline) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        {label && <span style={{ ...labelStyle, whiteSpace: 'nowrap' }}>{label}</span>}
        {control}
      </div>
    );
  }

  return (
    <div style={{ width }}>
      {label && <div style={{ ...labelStyle, marginBottom: 5 }}>{label}</div>}
      {control}
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

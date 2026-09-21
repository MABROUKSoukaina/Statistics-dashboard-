import type { ReactNode } from 'react';
import { T, panelStyle } from '../theme';

export function KpiCard({ icon, color, label, value, unit, sub, progress }: {
  icon: ReactNode;
  color: string;
  label: string;
  value: string;
  unit?: string;
  sub?: string;
  /** 0–1; renders a thin progress bar with its percentage. */
  progress?: number;
}) {
  return (
    <div style={{ ...panelStyle, padding: '11px 12px', display: 'flex', gap: 9, alignItems: 'flex-start', minWidth: 0 }}>
      <div style={{
        width: 30, height: 30, borderRadius: 9, flexShrink: 0,
        background: `${color}1f`, color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {icon}
      </div>

      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{
          fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
          color: T.dim, marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {label}
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, minWidth: 0 }}>
          <span style={{ fontSize: 20, fontWeight: 700, color: T.text, lineHeight: 1.05, letterSpacing: '-0.02em' }}>
            {value}
          </span>
          {unit && <span style={{ fontSize: 10.5, color: T.muted, fontWeight: 600, whiteSpace: 'nowrap' }}>{unit}</span>}
        </div>

        {sub && (
          <div style={{
            fontSize: 9.5, color: T.dim, marginTop: 3,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {sub}
          </div>
        )}

        {progress != null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
            <div style={{ flex: 1, height: 3.5, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
              <div style={{
                width: `${Math.max(0, Math.min(1, progress)) * 100}%`, height: '100%',
                background: color, borderRadius: 3,
              }} />
            </div>
            <span style={{ fontSize: 9.5, color: T.muted, fontWeight: 600 }}>
              {Math.round(progress * 100)} %
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

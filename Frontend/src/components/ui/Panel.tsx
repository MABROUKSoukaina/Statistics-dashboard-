import type { CSSProperties, ReactNode } from 'react';
import { T, panelStyle } from '../../theme';

export function Panel({ title, action, children, style, bodyStyle }: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  style?: CSSProperties;
  bodyStyle?: CSSProperties;
}) {
  return (
    <section style={{ ...panelStyle, display: 'flex', flexDirection: 'column', minWidth: 0, ...style }}>
      {(title || action) && (
        <header style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          padding: '13px 16px 11px',
        }}>
          {title && <h2 style={{ margin: 0, fontSize: 13.5, fontWeight: 650, color: T.text }}>{title}</h2>}
          {action}
        </header>
      )}
      <div style={{ padding: title ? '0 16px 16px' : 16, flex: 1, minHeight: 0, ...bodyStyle }}>
        {children}
      </div>
    </section>
  );
}

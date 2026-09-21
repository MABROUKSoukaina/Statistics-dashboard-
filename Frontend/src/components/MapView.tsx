import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import LayersIcon from '@mui/icons-material/Layers';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import SearchIcon from '@mui/icons-material/Search';
import { T, ecosystemeColor, fmt } from '../theme';
import type { PlotFeature } from '../services/api';

const BASEMAPS = [
  { id: 'esri-hybrid',  label: 'Esri Satellite',   url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',    attribution: '© Esri, Maxar', maxZoom: 19 },
  { id: 'google-sat',   label: 'Google Satellite', url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',                                               attribution: '© Google',      maxZoom: 20 },
  { id: 'esri-topo',    label: 'Topographique',    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',   attribution: '© Esri',        maxZoom: 19 },
  { id: 'esri-streets', label: 'Routier',          url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', attribution: '© Esri',        maxZoom: 19 },
] as const;
type BasemapId = typeof BASEMAPS[number]['id'];

const STATUT_LABEL: Record<PlotFeature['properties']['statut'], string> = {
  programmee: 'Programmée', visitee: 'Visitée', controle: 'Contrôlée',
};

function zoomToDot(zoom: number): number {
  if (zoom >= 15) return 13;
  if (zoom >= 13) return 11;
  if (zoom >= 11) return 9;
  if (zoom >= 9) return 7;
  return 6;
}

function markerIcon(color: string, highlighted: boolean, zoom: number): L.DivIcon {
  const base = zoomToDot(zoom);
  const dot = highlighted ? base + 6 : base;
  const hit = Math.max(26, dot + 14);
  const glow = highlighted ? `0 0 12px ${color},` : '';
  return L.divIcon({
    className: '',
    html: `<div style="width:${hit}px;height:${hit}px;display:flex;align-items:center;justify-content:center"><div style="width:${dot}px;height:${dot}px;background:${color};border:1.5px solid rgba(255,255,255,0.9);border-radius:50%;box-shadow:${glow}0 2px 6px rgba(0,0,0,.45);box-sizing:border-box"></div></div>`,
    iconSize: [hit, hit] as L.PointExpression,
    iconAnchor: [hit / 2, hit / 2] as L.PointExpression,
    popupAnchor: [0, -(dot / 2 + 3)] as L.PointExpression,
  });
}

function MapFitter({ features }: { features: PlotFeature[] }) {
  const map = useMap();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || features.length === 0) return;
    done.current = true;
    // The map mounts inside a flex panel, so Leaflet's first size measurement can be
    // stale — without invalidateSize() here fitBounds computes against the wrong
    // viewport and lands zoomed far out.
    const id = window.setTimeout(() => {
      map.invalidateSize();
      map.fitBounds(features.map(f => [f.geometry.coordinates[1], f.geometry.coordinates[0]] as [number, number]),
        { padding: [26, 26], maxZoom: 13 });
    }, 60);
    return () => window.clearTimeout(id);
  }, [features, map]);
  return null;
}

function MapFlyer({ target }: { target: [number, number] | null }) {
  const map = useMap();
  useEffect(() => { if (target) map.flyTo(target, 15, { duration: 1.1 }); }, [map, target]);
  return null;
}

function ZoomTracker({ onZoom }: { onZoom: (z: number) => void }) {
  const map = useMap();
  useEffect(() => {
    const h = () => onZoom(map.getZoom());
    h();
    map.on('zoomend', h);
    return () => { map.off('zoomend', h); };
  }, [map, onZoom]);
  return null;
}

/**
 * Keeps Leaflet's viewport in step with its container. The map lives in a flex panel whose
 * width changes with the layout (and once more when the fonts settle), and Leaflet only
 * measures on its own at mount — without this the tiles stop short of the panel edge and
 * fitBounds computes against the wrong size.
 */
function SizeWatcher() {
  const map = useMap();
  useEffect(() => {
    const el = map.getContainer();
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(el);
    return () => ro.disconnect();
  }, [map]);
  return null;
}

/** Native Leaflet scale bar, bottom-left, styled by CSS in index.css. */
function ScaleBar() {
  const map = useMap();
  useEffect(() => {
    const ctrl = L.control.scale({ imperial: false, position: 'bottomleft', maxWidth: 120 });
    ctrl.addTo(map);
    return () => { ctrl.remove(); };
  }, [map]);
  return null;
}

/** Custom control stack (zoom in/out, recentre, basemap) — replaces Leaflet's default. */
function ControlStack({ onReset, onBasemap, basemapOpen }: {
  onReset: () => void; onBasemap: () => void; basemapOpen: boolean;
}) {
  const map = useMap();
  const btn: React.CSSProperties = {
    width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(14,22,33,0.94)', border: `1px solid ${T.borderStrong}`, borderRadius: 9,
    color: T.text, cursor: 'pointer', fontSize: 17, lineHeight: 1, padding: 0,
    backdropFilter: 'blur(6px)',
  };
  return (
    <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 1000, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <button style={btn} onClick={() => map.zoomIn()} title="Zoom avant">+</button>
      <button style={btn} onClick={() => map.zoomOut()} title="Zoom arrière">−</button>
      <button style={btn} onClick={onReset} title="Vue initiale"><MyLocationIcon style={{ fontSize: 16 }} /></button>
      <button style={{ ...btn, color: basemapOpen ? T.greenLite : T.text }} onClick={onBasemap} title="Fond de carte">
        <LayersIcon style={{ fontSize: 16 }} />
      </button>
    </div>
  );
}

const COMPOSITION_LABEL: Record<string, string> = { pure: 'Pure', melange: 'Mélange' };
const STRATE_NIVEAU_LABEL: Record<number, string> = { 1: 'Dense', 2: 'Moyennement dense', 3: 'Claire' };

function PopupBody({ f, color }: { f: PlotFeature; color: string }) {
  const p = f.properties;
  const done = p.statut !== 'programmee';
  // A visited placette can still carry no living tree (nothing recensable on it), so the
  // dendrometric block only makes sense when there is something to summarise.
  const hasDendro = done && p.nb_arbres_total > 0;
  return (
    <div style={{ fontFamily: 'inherit' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 9, marginBottom: 9, borderBottom: `1px solid ${T.border}` }}>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
        <span style={{ fontWeight: 700, fontSize: 14, color: T.text }}>{p.num_placette}</span>
        <span style={{
          marginLeft: 'auto', marginRight: 18, fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
          background: `${done ? T.green : T.orange}22`, color: done ? T.greenLite : T.orange,
        }}>{STATUT_LABEL[p.statut]}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '5px 14px', fontSize: 12 }}>
        {p.formation && <><span style={{ color: T.dim }}>Écosystème</span><span style={{ color: T.text, fontWeight: 600 }}>{p.formation}</span></>}
        {p.composition && <><span style={{ color: T.dim }}>Composition</span><span style={{ color: T.text, fontWeight: 600 }}>{COMPOSITION_LABEL[p.composition]}</span></>}
        {p.strate_niveau != null && <><span style={{ color: T.dim }}>Strate</span><span style={{ color: T.text, fontWeight: 600 }}>{STRATE_NIVEAU_LABEL[p.strate_niveau]}</span></>}
        {p.strate && <><span style={{ color: T.dim }}>Code strate</span><span style={{ color: T.text, fontWeight: 600 }}>{p.strate}</span></>}
        {p.dpanef && <><span style={{ color: T.dim }}>DPANEF</span><span style={{ color: T.text, fontWeight: 600 }}>{p.dpanef}</span></>}
        {p.equipe && <><span style={{ color: T.dim }}>Équipe</span><span style={{ color: T.text, fontWeight: 600 }}>{p.equipe.replace(/^Equipe\s+/, '').replace(/\s*\(.*$/, '')}</span></>}
      </div>

      {!hasDendro && (
        <div style={{
          marginTop: 9, paddingTop: 8, borderTop: `1px solid ${T.border}`,
          fontSize: 11.5, color: T.dim, lineHeight: 1.45,
        }}>
          {done
            ? 'Placette visitée, aucun arbre recensable mesuré.'
            : 'Placette programmée — pas encore inventoriée.'}
        </div>
      )}

      {hasDendro && (
        <div style={{ marginTop: 9, paddingTop: 8, borderTop: `1px solid ${T.border}` }}>
          <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.cyan, marginBottom: 6 }}>
            Dendrométrie
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '5px 14px', fontSize: 12 }}>
            <span style={{ color: T.dim }}>Densité</span><span style={{ color: T.text, fontWeight: 600 }}>{fmt(p.nbre_tiges_ha, 1)} tiges/ha</span>
            <span style={{ color: T.dim }}>Surface terrière</span><span style={{ color: T.text, fontWeight: 600 }}>{fmt(p.surface_terriere_ha, 2)} m²/ha</span>
            <span style={{ color: T.dim }}>Volume</span><span style={{ color: T.text, fontWeight: 600 }}>{fmt(p.volume_ha, 2)} m³/ha</span>
            <span style={{ color: T.dim }}>Hauteur moy.</span><span style={{ color: T.text, fontWeight: 600 }}>{fmt(p.hauteur_moyenne, 1)} m</span>
            <span style={{ color: T.dim }}>Circonférence moy.</span><span style={{ color: T.text, fontWeight: 600 }}>{fmt(p.circonference_moyenne, 1)} cm</span>
            <span style={{ color: T.dim }}>Arbres</span><span style={{ color: T.text, fontWeight: 600 }}>{fmt(p.nb_arbres_total)} dont {fmt(p.nb_echantillons)} éch.</span>
            <span style={{ color: T.dim }}>Coupés / morts</span><span style={{ color: T.text, fontWeight: 600 }}>{fmt(p.nb_coupes)} / {fmt(p.nb_morts)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export function MapView({ features, ecosystemes, loading, statutFilter, onStatutFilter }: {
  features: PlotFeature[];
  ecosystemes: string[];
  loading: boolean;
  statutFilter: Set<string>;
  onStatutFilter: (v: string) => void;
}) {
  const [basemap, setBasemap] = useState<BasemapId>('esri-hybrid');
  const [basemapOpen, setBasemapOpen] = useState(false);
  const [zoom, setZoom] = useState(8);
  const [selected, setSelected] = useState<string | null>(null);
  const [flyTarget, setFlyTarget] = useState<[number, number] | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [legendOpen, setLegendOpen] = useState(true);
  const [query, setQuery] = useState('');
  const [resetKey, setResetKey] = useState(0);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  // Legend entries follow what is actually on the map, écosystèmes first then the
  // "non renseigné" grey group — placettes with no field-observed essence yet.
  const legendRows = useMemo(() => {
    const counts = new Map<string, number>();
    let none = 0;
    for (const f of features) {
      const k = f.properties.formation;
      if (k) counts.set(k, (counts.get(k) ?? 0) + 1); else none++;
    }
    const rows = ecosystemes
      .filter(e => counts.has(e))
      .map(e => ({ label: e, color: ecosystemeColor(ecosystemes, e), count: counts.get(e)! }));
    if (none > 0) rows.push({ label: 'Non renseigné', color: T.dim, count: none });
    return rows;
  }, [features, ecosystemes]);

  const bm = BASEMAPS.find(b => b.id === basemap)!;
  const results = query.trim()
    ? features.filter(f => f.properties.num_placette.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 15)
    : [];

  return (
    <div style={{ position: 'relative', flex: 1, minHeight: 0, borderRadius: 11, overflow: 'hidden', border: `1px solid ${T.border}` }}>
      <MapContainer center={[34, -6]} zoom={8} zoomControl={false} scrollWheelZoom
        style={{ width: '100%', height: '100%', background: T.bg }}>
        <TileLayer key={basemap} url={bm.url} attribution={bm.attribution} maxZoom={bm.maxZoom} />
        {basemap === 'esri-hybrid' && (
          <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}" maxZoom={19} />
        )}

        <SizeWatcher />
        <MapFitter features={features} />
        <MapFlyer target={flyTarget} />
        <ZoomTracker onZoom={setZoom} />
        <ScaleBar />
        <ControlStack
          basemapOpen={basemapOpen}
          onBasemap={() => setBasemapOpen(o => !o)}
          onReset={() => setResetKey(k => k + 1)}
        />
        <ResetOnKey trigger={resetKey} features={features} />

        {features.map(f => {
          const [lon, lat] = f.geometry.coordinates;
          const color = ecosystemeColor(ecosystemes, f.properties.formation);
          const hi = f.properties.num_placette === selected;
          return (
            <Marker key={f.properties.num_placette} position={[lat, lon]} icon={markerIcon(hi ? T.orange : color, hi, zoom)}>
              <Popup minWidth={232} maxWidth={300} className="ifn-popup" autoPan autoPanPadding={[28, 28]}>
                <PopupBody f={f} color={color} />
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Basemap picker */}
      {basemapOpen && (
        <div style={{
          position: 'absolute', top: 12, left: 52, zIndex: 1001,
          background: 'rgba(22,33,47,0.97)', border: `1px solid ${T.borderStrong}`, borderRadius: 11,
          boxShadow: '0 12px 32px rgba(0,0,0,.5)', overflow: 'hidden', minWidth: 158, backdropFilter: 'blur(8px)',
        }}>
          {BASEMAPS.map(b => (
            <button key={b.id} onClick={() => { setBasemap(b.id); setBasemapOpen(false); }} style={{
              display: 'block', width: '100%', textAlign: 'left', padding: '8px 13px', border: 'none',
              cursor: 'pointer', fontSize: 12, fontFamily: 'inherit',
              background: basemap === b.id ? 'rgba(16,185,129,0.14)' : 'transparent',
              color: basemap === b.id ? T.greenLite : T.text,
            }}>{b.label}</button>
          ))}
        </div>
      )}

      {/* Search */}
      <div ref={searchRef} style={{ position: 'absolute', top: 12, right: 12, zIndex: 1001, width: searchOpen ? 218 : 32 }}>
        <div style={{
          display: 'flex', alignItems: 'center', height: 32, overflow: 'hidden',
          background: 'rgba(14,22,33,0.94)', border: `1px solid ${T.borderStrong}`, borderRadius: 9,
          backdropFilter: 'blur(6px)',
        }}>
          <button onClick={() => setSearchOpen(o => !o)} title="Rechercher une placette" style={{
            width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'none', border: 'none', cursor: 'pointer', color: T.muted, flexShrink: 0,
          }}>
            <SearchIcon style={{ fontSize: 16 }} />
          </button>
          {searchOpen && (
            <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="N° de placette…"
              style={{ flex: 1, minWidth: 0, background: 'none', border: 'none', outline: 'none', color: T.text, fontSize: 12, fontFamily: 'inherit', paddingRight: 8 }} />
          )}
        </div>
        {searchOpen && results.length > 0 && (
          <div style={{
            marginTop: 5, background: 'rgba(22,33,47,0.97)', border: `1px solid ${T.borderStrong}`,
            borderRadius: 10, maxHeight: 210, overflowY: 'auto', backdropFilter: 'blur(8px)',
          }}>
            {results.map(f => (
              <button key={f.properties.num_placette} onMouseDown={() => {
                const [lon, lat] = f.geometry.coordinates;
                setSelected(f.properties.num_placette);
                setFlyTarget([lat, lon]);
                setSearchOpen(false);
              }} style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
                padding: '7px 11px', background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 12, color: T.text, fontFamily: 'inherit',
              }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                  background: ecosystemeColor(ecosystemes, f.properties.formation) }} />
                {f.properties.num_placette}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Legend */}
      <div style={{
        position: 'absolute', right: 12, bottom: 12, zIndex: 1000, width: 186,
        background: 'rgba(14,22,33,0.93)', border: `1px solid ${T.borderStrong}`, borderRadius: 12,
        padding: '10px 13px 12px', backdropFilter: 'blur(8px)',
      }}>
        <button onClick={() => setLegendOpen(o => !o)} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
          background: 'none', border: 'none', padding: 0, cursor: 'pointer', marginBottom: legendOpen ? 8 : 0,
          fontSize: 11, fontWeight: 650, color: T.text, fontFamily: 'inherit',
        }}>
          Écosystème (couleur)
          <span style={{ color: T.dim, fontSize: 10, transform: legendOpen ? 'none' : 'rotate(180deg)' }}>▾</span>
        </button>

        {legendOpen && (
          <>
            {/* capped so the Statut group below always stays visible */}
            <div style={{ maxHeight: 146, overflowY: 'auto', paddingRight: 2 }}>
              {legendRows.map(r => (
                <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', flexShrink: 0, background: r.color }} />
                  <span style={{ flex: 1, fontSize: 11, color: T.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.label}
                  </span>
                  <span style={{ fontSize: 10, color: T.dim, fontFamily: "'Space Mono', monospace" }}>{r.count}</span>
                </div>
              ))}
            </div>

            <div style={{ borderTop: `1px solid ${T.border}`, margin: '10px 0 9px' }} />
            <div style={{ fontSize: 11, fontWeight: 650, color: T.text, marginBottom: 7 }}>Statut</div>
        {(['programmee', 'visitee', 'controle'] as const).map(s => {
          const on = statutFilter.has(s);
          return (
            <label key={s} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0', cursor: 'pointer' }}>
              <span style={{
                width: 13, height: 13, borderRadius: '50%', flexShrink: 0,
                border: `1.5px solid ${on ? T.green : T.borderStrong}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {on && <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.green }} />}
              </span>
              <input type="checkbox" checked={on} onChange={() => onStatutFilter(s)}
                style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }} />
              <span style={{ fontSize: 11, color: on ? T.text : T.muted }}>{STATUT_LABEL[s]}</span>
            </label>
          );
        })}
          </>
        )}
      </div>

      {loading && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(10,16,24,0.75)', backdropFilter: 'blur(2px)', gap: 10, flexDirection: 'column',
        }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', border: `3px solid ${T.border}`, borderTopColor: T.green, animation: 'ifn-spin .85s linear infinite' }} />
          <span style={{ fontSize: 12.5, color: T.muted }}>Chargement de la carte…</span>
        </div>
      )}
    </div>
  );
}

function ResetOnKey({ trigger, features }: { trigger: number; features: PlotFeature[] }) {
  const map = useMap();
  useEffect(() => {
    if (trigger > 0 && features.length > 0) {
      map.fitBounds(features.map(f => [f.geometry.coordinates[1], f.geometry.coordinates[0]] as [number, number]),
        { padding: [24, 24], maxZoom: 15, animate: true });
    }
  }, [trigger]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

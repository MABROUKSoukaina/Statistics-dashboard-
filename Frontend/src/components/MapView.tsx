import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import LayersIcon from '@mui/icons-material/Layers';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import SearchIcon from '@mui/icons-material/Search';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { T, ecosystemeColor, fmt } from '../theme';
import { NO_FORMATION } from '../useMapFilters';
import { fetchPlotDetail, type PlotFeature, type PlotDetail } from '../services/api';
import {
  EXPOSITION, TOPO_POS, SUBSTRAT, PROFONDEUR_SOL, COUVERTURE_SOL, INTENSITE_PARCOURS,
  ETAT_SANITAIRE_GENERAL, INTENSITE_INCENDIE, ANCIENNETE_INCENDIE,
  EMONDAGE, MORTALITE_BRANCHES, POURRITURE_TRONC, CHARBON_MERE,
} from '../labels';

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

/** One label/value row, skipped entirely when the value is unknown — a popup with a field
 *  missing for half the placettes should shrink, not fill up with dashes. */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  if (children == null || children === '') return null;
  return (
    <>
      <span style={{ color: T.dim }}>{label}</span>
      <span style={{ color: T.text, fontWeight: 600 }}>{children}</span>
    </>
  );
}

/** Substrat, with the same "code 4 / code 10 get a free-text qualifier" rule as the
 *  reference fiche (generate_fiche_simple.py) — never invented independently here. */
function substratLabel(site: PlotDetail['site']): string | null {
  if (site.substrat == null) return null;
  if (site.substrat === 10 && site.substrat_autre) return `Autre : ${site.substrat_autre}`;
  if (site.substrat === 4 && site.substrat_qualifier) return `Sable : ${site.substrat_qualifier}`;
  return SUBSTRAT[site.substrat] ?? `Code ${site.substrat}`;
}

function incendieLabel(site: PlotDetail['site']): string {
  if (!site.signes_incendie) return 'Non';
  const bits = [
    site.intensite_incendie != null ? INTENSITE_INCENDIE[site.intensite_incendie] : null,
    site.annee_incendie != null ? ANCIENNETE_INCENDIE[site.annee_incendie] : null,
  ].filter(Boolean);
  return bits.length ? `Oui (${bits.join(', ')})` : 'Oui';
}

/** "Description de la placette" — classification (écosystème/composition) plus the site
 *  descriptors (topo/pédologie/couverture/caractéristiques/incendie) and the tree-level
 *  breakdown, fetched lazily once the popup for this placette opens (see MapView's
 *  detailCache). Écosystème/composition come from the map GeoJSON (already loaded), the
 *  rest from the on-demand detail fetch. */
function DescriptionPlacette({ formation, composition, detail }: {
  formation: string | null;
  composition: string | null;
  detail: PlotDetail | 'loading' | 'error' | undefined;
}) {
  const classification = (
    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '5px 14px', fontSize: 12 }}>
      <Row label="Écosystème">{formation}</Row>
      <Row label="Composition">{composition ? COMPOSITION_LABEL[composition] : null}</Row>
    </div>
  );

  if (detail === 'loading' || detail === undefined) {
    return (
      <>
        {classification}
        <div style={{ fontSize: 11.5, color: T.dim, padding: '4px 0' }}>Chargement…</div>
      </>
    );
  }
  if (detail === 'error') {
    return (
      <>
        {classification}
        <div style={{ fontSize: 11.5, color: T.red, padding: '4px 0' }}>Erreur de chargement.</div>
      </>
    );
  }

  const { site, arbres, regenerationHa, sanitaireParEssence } = detail;
  const hasLiege = arbres.liege_demascles > 0 || arbres.liege_non_demascles > 0;
  const hasMorts = arbres.morts_sur_pied_ha != null || arbres.chablis_ha != null;

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '5px 14px', fontSize: 12 }}>
        <Row label="Écosystème">{formation}</Row>
        <Row label="Composition">{composition ? COMPOSITION_LABEL[composition] : null}</Row>
        <Row label="Strate terrain">{site.strate_terrain}</Row>
        <Row label="Altitude">{site.altitude != null ? `${fmt(site.altitude)} m` : null}</Row>
        <Row label="Exposition">{site.exposition != null ? EXPOSITION[site.exposition] : null}</Row>
        <Row label="Pente">{site.pente != null ? `${fmt(site.pente, 1)} %` : null}</Row>
        <Row label="Position topo">{site.position_topo != null ? TOPO_POS[site.position_topo] : null}</Row>
        <Row label="Substrat">{substratLabel(site)}</Row>
        <Row label="Profondeur du sol">{site.profondeur_sol != null ? PROFONDEUR_SOL[site.profondeur_sol] : null}</Row>
        <Row label="Couverture du sol">{site.couverture_sol != null ? COUVERTURE_SOL[site.couverture_sol] : null}</Row>
        <Row label="Hauteur dominante">{site.hauteur_dominante != null ? `${fmt(site.hauteur_dominante, 1)} ${site.hauteur_dominante_unite ?? 'm'}` : null}</Row>
        <Row label="Intensité de parcours">{site.intensite_parcours != null ? INTENSITE_PARCOURS[site.intensite_parcours] : null}</Row>
        <Row label="État sanitaire général">{site.etat_sanitaire_general != null ? ETAT_SANITAIRE_GENERAL[site.etat_sanitaire_general] : null}</Row>
        <Row label="Signes d'incendie">{incendieLabel(site)}</Row>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '5px 14px', fontSize: 12, marginTop: 8 }}>
        <Row label="Arbres coupés">{arbres.coupes_ha != null ? `${fmt(arbres.coupes_ha, 1)} tiges/ha` : null}</Row>
        {hasMorts && (
          <Row label="Morts sur pied / Chablis">
            {`${fmt(arbres.morts_sur_pied_ha, 1)} / ${fmt(arbres.chablis_ha, 1)} tiges/ha`}
          </Row>
        )}
        {hasLiege && (
          <Row label="Chêne liège">{`${fmt(arbres.liege_demascles)} démasclés, ${fmt(arbres.liege_non_demascles)} non démasclés`}</Row>
        )}
        <Row label="Régénération">{regenerationHa != null ? `${fmt(regenerationHa)} brins/ha` : null}</Row>
      </div>

      {sanitaireParEssence.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 11, color: T.dim, marginBottom: 4 }}>État sanitaire par essence</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {sanitaireParEssence.map((s, i) => {
              const bits = [
                s.treeh_emondage != null && EMONDAGE[s.treeh_emondage] !== "Pas d'émondage" ? `Émondage ${EMONDAGE[s.treeh_emondage]}` : null,
                s.treeh_mortalite_branche != null && MORTALITE_BRANCHES[s.treeh_mortalite_branche] !== 'Pas de mortalité de branches' ? `Mort. branches ${MORTALITE_BRANCHES[s.treeh_mortalite_branche]}` : null,
                s.treeh_pourriture_du_tronc != null && POURRITURE_TRONC[s.treeh_pourriture_du_tronc] !== 'Pas de pourriture' ? `Pourriture ${POURRITURE_TRONC[s.treeh_pourriture_du_tronc]}` : null,
                s.treeh_charbon_de_la_mere != null && CHARBON_MERE[s.treeh_charbon_de_la_mere] !== 'Absence' ? `Charbon ${CHARBON_MERE[s.treeh_charbon_de_la_mere]}` : null,
              ].filter(Boolean);
              return (
                <div key={i} style={{ fontSize: 11.5 }}>
                  <span style={{ color: T.text, fontWeight: 600 }}>{s.essence}</span>
                  <span style={{ color: T.dim }}>{bits.length ? ` — ${bits.join(' · ')}` : ' — sans anomalie'}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

function PopupBody({ f, color, detail }: { f: PlotFeature; color: string; detail: PlotDetail | 'loading' | 'error' | undefined }) {
  const p = f.properties;
  const done = p.statut !== 'programmee';
  const [lon, lat] = f.geometry.coordinates;
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

      <div style={{ maxHeight: 420, overflowY: 'auto', paddingRight: 2 }}>
        {/* Info de départ */}
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '5px 14px', fontSize: 12 }}>
          <Row label="X">{lon.toFixed(5)}</Row>
          <Row label="Y">{lat.toFixed(5)}</Row>
          <Row label="DPANEF">{p.dpanef}</Row>
          <Row label="Équipe">{p.equipe ? p.equipe.replace(/^Equipe\s+/, '').replace(/\s*\(.*$/, '') : null}</Row>
        </div>

        {done && (
          <div style={{ marginTop: 9, paddingTop: 8, borderTop: `1px solid ${T.border}` }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.greenLite, marginBottom: 6 }}>
              Description de la placette
            </div>
            <DescriptionPlacette formation={p.formation} composition={p.composition} detail={detail} />
          </div>
        )}

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

            {detail && detail !== 'loading' && detail !== 'error' && [
              detail.arbres.recensables_c13_moy, detail.arbres.recensables_c0_moy,
              detail.arbres.recensables_ht_moy, detail.arbres.recensables_h7_moy,
            ].some(v => v != null) && (
              <>
                <div style={{ fontSize: 11, color: T.dim, margin: '8px 0 3px' }}>Mesures moyennes</div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 12 }}>
                  <span><span style={{ color: T.dim }}>C1,3 </span><b style={{ color: T.text }}>{fmt(detail.arbres.recensables_c13_moy, 1)} cm</b></span>
                  <span><span style={{ color: T.dim }}>C0 </span><b style={{ color: T.text }}>{fmt(detail.arbres.recensables_c0_moy, 1)} cm</b></span>
                  <span><span style={{ color: T.dim }}>HT </span><b style={{ color: T.text }}>{fmt(detail.arbres.recensables_ht_moy, 1)} m</b></span>
                  <span><span style={{ color: T.dim }}>H7 </span><b style={{ color: T.text }}>{fmt(detail.arbres.recensables_h7_moy, 1)} m</b></span>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function MapView({ features, ecosystemes, loading }: {
  features: PlotFeature[];
  ecosystemes: string[];
  loading: boolean;
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
  // Per-écosystème visibility, toggled from the legend's eye buttons — a quick way to
  // declutter the map. Purely visual: it doesn't touch the Analyse forestière selection,
  // so the KPI header, tables and "N placettes affichées" count stay unaffected.
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const searchRef = useRef<HTMLDivElement>(null);

  const toggleHidden = (key: string) =>
    setHidden(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });

  // "Description de la placette" is fetched lazily — only for the placette whose popup is
  // actually open — and cached by num_placette so reopening the same popup doesn't refetch.
  const [openPlacette, setOpenPlacette] = useState<string | null>(null);
  const [detailCache, setDetailCache] = useState<Record<string, PlotDetail | 'loading' | 'error'>>({});

  useEffect(() => {
    if (!openPlacette || detailCache[openPlacette]) return;
    setDetailCache(prev => ({ ...prev, [openPlacette]: 'loading' }));
    fetchPlotDetail(openPlacette)
      .then(d => setDetailCache(prev => ({ ...prev, [openPlacette]: d })))
      .catch(() => setDetailCache(prev => ({ ...prev, [openPlacette]: 'error' })));
  }, [openPlacette]); // eslint-disable-line react-hooks/exhaustive-deps

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
      .map(e => ({ key: e, label: e, color: ecosystemeColor(ecosystemes, e), count: counts.get(e)! }));
    if (none > 0) rows.push({ key: NO_FORMATION, label: 'Non renseigné', color: T.dim, count: none });
    return rows;
  }, [features, ecosystemes]);

  const visibleFeatures = useMemo(
    () => features.filter(f => !hidden.has(f.properties.formation ?? NO_FORMATION)),
    [features, hidden],
  );

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

        {visibleFeatures.map(f => {
          const [lon, lat] = f.geometry.coordinates;
          const color = ecosystemeColor(ecosystemes, f.properties.formation);
          const hi = f.properties.num_placette === selected;
          return (
            <Marker key={f.properties.num_placette} position={[lat, lon]} icon={markerIcon(hi ? T.orange : color, hi, zoom)}>
              <Popup minWidth={252} maxWidth={340} className="ifn-popup" autoPan autoPanPadding={[28, 28]}
                eventHandlers={{
                  add: () => setOpenPlacette(f.properties.num_placette),
                  remove: () => setOpenPlacette(prev => prev === f.properties.num_placette ? null : prev),
                }}>
                <PopupBody f={f} color={color} detail={detailCache[f.properties.num_placette]} />
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
          Écosystème
          <span style={{ color: T.dim, fontSize: 10, transform: legendOpen ? 'none' : 'rotate(180deg)' }}>▾</span>
        </button>

        {legendOpen && (
          <div style={{ maxHeight: 240, overflowY: 'auto', paddingRight: 2 }}>
            {legendRows.map(r => {
              const isHidden = hidden.has(r.key);
              return (
                <div key={r.key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, opacity: isHidden ? 0.45 : 1 }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', flexShrink: 0, background: r.color }} />
                  <span style={{ flex: 1, fontSize: 11, color: T.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.label}
                  </span>
                  <span style={{ fontSize: 10, color: T.dim, fontFamily: "'Space Mono', monospace" }}>{r.count}</span>
                  <button onClick={() => toggleHidden(r.key)} title={isHidden ? 'Afficher sur la carte' : 'Masquer de la carte'} style={{
                    background: 'none', border: 'none', padding: 0, marginLeft: 1, cursor: 'pointer',
                    color: isHidden ? T.dim : T.muted, display: 'flex', alignItems: 'center', flexShrink: 0,
                  }}>
                    {isHidden ? <VisibilityOffIcon style={{ fontSize: 14 }} /> : <VisibilityIcon style={{ fontSize: 14 }} />}
                  </button>
                </div>
              );
            })}
          </div>
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

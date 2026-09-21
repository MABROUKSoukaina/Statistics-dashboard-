const TOKEN_KEY = 'ifn_stats_token';
const USER_KEY = 'ifn_stats_user';

export interface AuthUser {
  username: string;
  fullName: string | null;
  role: 'ADMIN' | 'VIEWER';
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function clearAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function login(username: string, password: string): Promise<AuthUser> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Connexion refusée (${res.status})`);
  }
  const body = await res.json();
  localStorage.setItem(TOKEN_KEY, body.token);
  const user: AuthUser = { username: body.username, fullName: body.fullName, role: body.role };
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  return user;
}

// ─── Global indicators (header KPI cards) ──────────────────────────────────────

export interface GlobalStats {
  nb_placettes_visitees: number;
  nb_placettes_programmees: number;
  /** Placettes retenues par la sélection « Analyse forestière » (et ayant des arbres). */
  nb_placettes_mesurees: number;
  densite_moyenne_ha: number | null;
  surface_terriere_moyenne_ha: number | null;
  volume_moyen_ha: number | null;
  circonference_moyenne: number | null;
  hauteur_moyenne: number | null;
  regeneration_moyenne_ha: number | null;
  nb_arbres_total: number;
  nb_echantillons_total: number;
  nb_coupes_total: number;
  nb_morts_total: number;
}

/** Indicateurs globaux, recalculés côté serveur pour la sélection en cours. */
export async function fetchGlobalStats(
  filter: { formation?: string; composition?: string; strate?: string } = {},
): Promise<GlobalStats> {
  const qs = new URLSearchParams();
  if (filter.formation) qs.set('formation', filter.formation);
  if (filter.composition) qs.set('composition', filter.composition);
  if (filter.strate) qs.set('strate', filter.strate);
  const suffix = qs.toString() ? `?${qs}` : '';
  const res = await fetch(`/api/stats/global${suffix}`, { headers: authHeaders() });
  if (res.status === 401) { clearAuth(); throw new Error('Session expirée'); }
  if (!res.ok) throw new Error(`Erreur indicateurs globaux (${res.status})`);
  return res.json();
}

// ─── Map GeoJSON ────────────────────────────────────────────────────────────────

export interface PlotFeature {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: {
    num_placette: string;
    equipe: string | null;
    /** Écosystème relevé sur le terrain (plot.strate_terrain_essence, issu du ZIP Collect). */
    formation: string | null;
    dpanef: string | null;
    /** Strate dendrométrique de terrain (plot_stratum). */
    strate: string | null;
    /** Composition relevée : pure / melange — null tant que la placette n'est pas visitée. */
    composition: 'pure' | 'melange' | null;
    /** Niveau de strate 1 = dense, 2 = moyennement dense, 3 = claire. */
    strate_niveau: 1 | 2 | 3 | null;
    statut: 'visitee' | 'programmee' | 'controle';
    accessibilite: number | null;
    nb_arbres_total: number;
    nb_echantillons: number;
    nb_coupes: number;
    nb_morts: number;
    nb_vivants: number;
    nbre_tiges_ha: number | null;
    surface_terriere_ha: number | null;
    volume_ha: number | null;
    circonference_moyenne: number | null;
    hauteur_moyenne: number | null;
  };
}

export interface MapCollection {
  type: 'FeatureCollection';
  totalFeatures: number;
  features: PlotFeature[];
}

export async function fetchMapGeoJson(): Promise<MapCollection> {
  const res = await fetch('/api/stats/map', { headers: authHeaders() });
  if (res.status === 401) { clearAuth(); throw new Error('Session expirée'); }
  if (!res.ok) throw new Error(`Erreur carte (${res.status})`);
  return res.json();
}

// ─── Formations (écosystème × composition × strate) ────────────────────────────

export interface FormationRow {
  formation: string;
  composition: 'pure' | 'melange' | null;
  strate_niveau: 1 | 2 | 3 | null;
  g_comp: 0 | 1;
  g_strate: 0 | 1;
  nb_placettes: number;
  nb_arbres: number | null;
  nb_echantillons: number | null;
  densite_ha: number | null;
  surface_terriere_ha: number | null;
  volume_ha: number | null;
  hauteur_moyenne: number | null;
  circonference_moyenne: number | null;
  regeneration_ha: number | null;
}

export async function fetchFormations(): Promise<FormationRow[]> {
  const res = await fetch('/api/stats/formations', { headers: authHeaders() });
  if (res.status === 401) { clearAuth(); throw new Error('Session expirée'); }
  if (!res.ok) throw new Error(`Erreur formations (${res.status})`);
  return res.json();
}

export interface CodeCount { code: number; nb: number; }
export interface PenteCount { classe: string; ordre: number; nb: number; }
export interface HistBin { bin_start: number; nb: number; }

export interface FormationDetail {
  resume: { nb_placettes: number; altitude_min: number | null; altitude_max: number | null };
  exposition: CodeCount[];
  position_topo: CodeCount[];
  substrat: CodeCount[];
  type_sol: CodeCount[];
  pente: PenteCount[];
  structure_circonference: HistBin[];
  structure_hauteur: HistBin[];
}

export async function fetchFormationDetail(formation: string): Promise<FormationDetail> {
  const res = await fetch(`/api/stats/formations/${encodeURIComponent(formation)}/detail`, { headers: authHeaders() });
  if (res.status === 401) { clearAuth(); throw new Error('Session expirée'); }
  if (!res.ok) throw new Error(`Erreur détail écosystème (${res.status})`);
  return res.json();
}

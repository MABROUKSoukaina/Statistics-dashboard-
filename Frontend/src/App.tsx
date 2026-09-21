import { useEffect, useMemo, useState } from 'react';
import { Login } from './components/Login';
import { TopBar, type AnalyseSelection, type Page } from './components/TopBar';
import { SynthesePage } from './pages/SynthesePage';
import { EcosystemePage } from './pages/EcosystemePage';
import { PlacettesPage } from './pages/PlacettesPage';
import { useMapFilters } from './useMapFilters';
import { T } from './theme';
import {
  getToken, getUser, clearAuth, fetchGlobalStats, fetchMapGeoJson, fetchFormations,
  type AuthUser, type GlobalStats, type PlotFeature, type FormationRow,
} from './services/api';

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(() => (getToken() ? getUser() : null));
  const [page, setPage] = useState<Page>('synthese');

  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [features, setFeatures] = useState<PlotFeature[]>([]);
  const [formations, setFormations] = useState<FormationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyse, setAnalyse] = useState<AnalyseSelection>({ ecosysteme: '', composition: '', strate: '' });

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    Promise.all([
      fetchMapGeoJson().then(d => setFeatures(d.features)).catch(() => {}),
      fetchFormations().then(setFormations).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, [user]);

  // Global indicators are recomputed server-side for the current selection, so the header
  // always describes exactly the placettes shown on the map and in the tables.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetchGlobalStats({
      formation: analyse.ecosysteme,
      composition: analyse.composition,
      strate: analyse.strate,
    })
      .then(s => { if (!cancelled) setStats(s); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [user, analyse.ecosysteme, analyse.composition, analyse.strate]);

  // The Écosystème selection lives in `analyse` because it scopes the analysis panels too;
  // passing it here makes the map and the Placettes table follow the same choice.
  const mapFilters = useMapFilters(features, analyse.ecosysteme, analyse.composition, analyse.strate);

  /** Every écosystème present on the ground, largest first — drives the colour ramp,
   *  the map legend, the donut and the analysis alike. Formations without a measured
   *  tree (fruticées, genévriers…) stay in the list: they have placettes, and their
   *  dendrometric cells simply read "—". */
  const ecosystemes = useMemo(
    () => formations.filter(r => r.g_comp === 1 && r.g_strate === 1)
      .sort((a, b) => b.nb_placettes - a.nb_placettes)
      .map(r => r.formation),
    [formations],
  );

  if (!user) return <Login onLogin={setUser} />;

  const logout = () => { clearAuth(); setUser(null); };
  const activeLabel = mapFilters.activeCount === 0
    ? 'Aucun (vue globale)'
    : `${mapFilters.activeCount} filtre${mapFilters.activeCount > 1 ? 's' : ''} · ${mapFilters.filtered.length} placettes`;
  const clearEverything = () => { mapFilters.clearAll(); setAnalyse({ ecosysteme: '', composition: '', strate: '' }); };

  return (
    <div style={{ height: '100vh', background: T.bg, overflowY: 'auto' }}>
      <main style={{ minWidth: 0, padding: '14px 20px 24px' }}>
        <TopBar
          page={page} onNavigate={setPage}
          analyse={analyse} onAnalyseChange={setAnalyse}
          ecosystemeOptions={ecosystemes}
          updatedAt={new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
          user={user} onLogout={logout}
          activeLabel={activeLabel} activeCount={mapFilters.activeCount} onClearAll={clearEverything}
        />

        <div style={{ marginTop: 12 }}>
        {page === 'synthese' && (
          <SynthesePage
            stats={stats} features={features} formations={formations} ecosystemes={ecosystemes}
            loading={loading} mapFilters={mapFilters}
            analyse={analyse} onAnalyseChange={setAnalyse}
          />
        )}
        {page === 'ecosysteme' && (
          <EcosystemePage
            formations={formations} ecosystemes={ecosystemes}
            selected={analyse.ecosysteme || ecosystemes[0] || ''}
            onSelect={v => setAnalyse({ ...analyse, ecosysteme: v })}
          />
        )}
        {page === 'placettes' && <PlacettesPage features={mapFilters.filtered} loading={loading} />}
        </div>
      </main>
    </div>
  );
}

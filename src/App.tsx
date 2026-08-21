import React, { useState, Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import { QueryClient, QueryClientProvider, QueryCache } from '@tanstack/react-query';
import { Toaster, sileo } from 'sileo';
import 'sileo/styles.css';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { triggerLogout } from './auth/authStore';
import { LoginPage } from './auth/LoginPage';
import { TopNav, SubNav, PeriodSelector } from './components/layout';
import { NovedadesTicker } from './components/layout/NovedadesTicker';
import type { Tab } from './components/layout';
import { useTrack } from './hooks/useTrack';
import { useUserRole } from './hooks/useUserRole';
import type { UserRoleData } from './hooks/useUserRole';

const MetasPage        = React.lazy(() => import('./pages/MetasPage').then((m) => ({ default: m.MetasPage })));
const CarteraPage      = React.lazy(() => import('./pages/CarteraPage').then((m) => ({ default: m.CarteraPage })));
const SegmentacionPage = React.lazy(() => import('./pages/SegmentacionPage').then((m) => ({ default: m.SegmentacionPage })));
const MiVistaPage      = React.lazy(() => import('./pages/MiVistaPage').then((m) => ({ default: m.MiVistaPage })));
const HerramientasPage = React.lazy(() => import('./pages/HerramientasPage').then((m) => ({ default: m.HerramientasPage })));
const NovedadesPage    = React.lazy(() => import('./pages/NovedadesPage').then((m) => ({ default: m.NovedadesPage })));
const CampanasPage     = React.lazy(() => import('./pages/CampanasPage').then((m) => ({ default: m.CampanasPage })));

class ErrorBoundary extends Component<
  { children: ReactNode; fallback?: (err: Error) => ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: ReactNode; fallback?: (err: Error) => ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    // Chunk load failures → recargar una vez en lugar de mostrar el error
    const isChunkError =
      error.message?.includes('Failed to fetch dynamically imported module') ||
      error.message?.includes('Loading chunk') ||
      error.message?.includes('Importing a module script failed');
    if (isChunkError && !sessionStorage.getItem('chunk_reload')) {
      sessionStorage.setItem('chunk_reload', '1');
      window.location.reload();
      return { error: null };
    }
    sessionStorage.removeItem('chunk_reload');
    return { error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info);
  }
  render() {
    if (this.state.error) {
      return this.props.fallback
        ? this.props.fallback(this.state.error)
        : (
          <div className="p-6">
            <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
              <p className="font-semibold text-red-700 mb-1">Error al cargar la página</p>
              <p className="text-sm text-red-600 font-mono break-all">{this.state.error.message}</p>
              <button
                onClick={() => this.setState({ error: null })}
                className="mt-3 text-xs text-red-600 underline hover:no-underline py-1 px-2"
              >
                Reintentar
              </button>
            </div>
          </div>
        );
    }
    return this.props.children;
  }
}

// Flag para mostrar el toast de sesión expirada solo una vez aunque fallen múltiples queries
let sessionExpiredShown = false;

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 5 * 60 * 1000, gcTime: 30 * 60 * 1000, retry: 1 } },
  queryCache: new QueryCache({
    onError: (error: Error) => {
      if (error.message?.includes('401') && !sessionExpiredShown) {
        sessionExpiredShown = true;
        sileo.error({
          title: 'Sesión expirada',
          description: 'Tu sesión cerró por inactividad. Redirigiendo...',
          duration: 3000,
        });
        setTimeout(() => {
          sessionExpiredShown = false;
          triggerLogout();
        }, 2800);
      }
    },
  }),
});

const tabSuspenseFallback = (
  <div className="flex items-center justify-center h-48">
    <span className="animate-spin w-5 h-5 rounded-full border-2 border-[#0097A7] border-t-transparent" />
  </div>
);

// Tabs visibles según rol:
// - null / 'C-level' → dashboard completo, todos los países
// - 'Admin' (sin viewAs) → dashboard completo + Campañas, todos los países
// - 'Country Manager' → dashboard completo, PERO filtrado a su país
// - 'Ejecutivo' (incluye Full Cycle y BDM, que se normalizan a Ejecutivo) y
//   Admin impersonando → Mi Vista + todo filtrado a su país
//
// Nadie queda filtrado por nombre de ejecutivo: un ejecutivo ve la cartera
// completa de SU PAÍS, no solo la propia. Mi Vista sigue siendo personal —lee
// su rol directo, no estos filtros— así que ahí sigue viendo lo suyo.
const C_LEVEL_TABS: Tab[]  = ['metas', 'cartera', 'segmentacion', 'herramientas', 'novedades'];
const EXEC_TABS: Tab[]      = ['mivista', 'metas', 'cartera', 'herramientas', 'novedades'];
// Campañas consume tokens de la API de Claude, así que va solo para Admin. Ocultar el
// tab no es el control de acceso: el backend exige requireAdmin en /api/campanas.
const ADMIN_TABS: Tab[]     = [...C_LEVEL_TABS, 'campanas'];

function Dashboard() {
  const { user, logout } = useAuth();
  const { data: userRole, isLoading: roleLoading } = useUserRole();
  const [period, setPeriod] = useState({ anio: new Date().getFullYear(), mes: new Date().getMonth() + 1 });
  const [viewAs, setViewAs] = useState<UserRoleData | null>(null);
  // Preselección del filtro de cambios al saltar de Overview → Clientes
  const [presetCambio, setPresetCambio] = useState<'mejoraron' | 'empeoraron' | 'cualquiera' | undefined>();
  const { track } = useTrack();

  const isAdmin    = !roleLoading && userRole?.rol === 'Admin';
  const isExec     = !roleLoading && userRole?.rol === 'Ejecutivo';
  const isCM       = !roleLoading && userRole?.rol === 'Country Manager';
  // `restricted` = se le acota el país. Incluye al Country Manager: tiene el
  // layout general pero solo de su país.
  const restricted = isExec || isCM;

  // Admin impersonando un ejecutivo → Mi Vista de ese ejecutivo
  const adminViewingExec = isAdmin && viewAs !== null;

  // Mi Vista es solo para quien tiene cartera propia. El Country Manager pasó al
  // dashboard completo: gestiona el país, no una cartera.
  const visibleTabs = (isExec || adminViewingExec)
    ? EXEC_TABS
    : (isAdmin ? ADMIN_TABS : C_LEVEL_TABS);

  const [tab, setTab] = useState<Tab>(() => (isExec ? 'mivista' : 'metas'));

  // Si el rol cargó y el tab activo no es visible, redirigir
  const activeTab = visibleTabs.includes(tab) ? tab : visibleTabs[0];

  // Rol efectivo: si admin está impersonando, usa viewAs; si no, usa su propio rol
  const effectiveRole = viewAs ?? userRole;

  // Filtros de país/KAM para páginas filtradas por rol
  const filterPais = (restricted || adminViewingExec) ? (effectiveRole?.pais ?? undefined) : undefined;

  // Antes acá iba el nombre del ejecutivo, y cada uno veía únicamente sus propios
  // clientes. Ahora el alcance es el país completo: un ejecutivo ve también la
  // cartera de sus compañeros del mismo país. Se deja la constante en undefined
  // en vez de borrar la prop porque es el interruptor de esta decisión, y así
  // queda a la vista dónde se revierte si cambia el criterio.
  const filterKam: string | undefined = undefined;

  // Nombres de evento para analítica. 'cartera' y 'segmentacion' conservan sus
  // nombres históricos para no partir la serie ya registrada en Firestore.
  const EVENTO_TAB: Record<Tab, string> = {
    cartera:      'analisis_clientes',
    segmentacion: 'clientes',
    mivista:      'mivista',
    metas:        'desempeno:overview',
    herramientas: 'herramientas',
    novedades:    'novedades',
    campanas:     'campanas',
  };

  function handleTabChange(t: Tab) {
    setTab(t);
    track(EVENTO_TAB[t] ?? t);
  }

  // Mi Vista es el tab por defecto de los ejecutivos (línea 122), así que al
  // entrar nunca pasa por handleTabChange y no se registraba: un ejecutivo que
  // solo mira su propia vista aparecía como "nunca entró". Esto registra el tab
  // de aterrizaje una vez por sesión, cuando el rol ya se resolvió.
  const aterrizajeRegistrado = React.useRef(false);
  React.useEffect(() => {
    if (roleLoading || aterrizajeRegistrado.current) return;
    aterrizajeRegistrado.current = true;
    track(EVENTO_TAB[activeTab] ?? activeTab);
  }, [roleLoading, activeTab]);   // eslint-disable-line react-hooks/exhaustive-deps

  function handlePeriodChange(p: Partial<typeof period>) {
    setPeriod((prev) => ({ ...prev, ...p }));
  }

  const showPeriod = activeTab !== 'cartera' && activeTab !== 'herramientas'
    && activeTab !== 'novedades' && activeTab !== 'campanas';

  return (
    <div className="flex flex-col h-screen">
      <TopNav
        onLogout={logout}
        isAdmin={isAdmin}
        viewAs={viewAs}
        onViewAs={setViewAs}
      />
      <SubNav active={activeTab} onChange={handleTabChange} visibleTabs={visibleTabs} />
      {showPeriod && (
        <PeriodSelector period={period} onChange={handlePeriodChange} />
      )}
      {/* El ticker de Novedades es `fixed right-3 w-[210px]`, anclado al viewport
          y no a este contenedor. Sin reservar el espacio, entre 1280px (donde
          aparece por el breakpoint xl) y ~1645px de ancho el contenedor centrado
          de 1200px le pasa por debajo — a 1280px son 182px de solape. Este
          padding-right en xl reserva su ancho y el contenido se centra en lo que
          queda, así que ninguna página vuelve a quedar tapada.
          Se aplica solo cuando el ticker existe: en el tab de Novedades no se
          monta y sería un margen muerto. */}
      <main className={`flex-1 overflow-auto bg-slate-50 ${activeTab !== 'novedades' ? 'xl:pr-[226px]' : ''}`}>
        <div className="mx-auto w-full px-4 sm:px-6" style={{ maxWidth: '1200px' }}>
          {activeTab === 'mivista' && effectiveRole && (
            <ErrorBoundary>
              <React.Suspense fallback={tabSuspenseFallback}>
                <MiVistaPage
                  userRole={effectiveRole}
                  email={viewAs ? '' : (user?.email ?? '')}
                  anio={period.anio}
                  mes={period.mes}
                />
              </React.Suspense>
            </ErrorBoundary>
          )}
          {activeTab === 'mivista' && roleLoading && (
            <div className="flex items-center justify-center h-48">
              <span className="animate-spin w-5 h-5 rounded-full border-2 border-[#0097A7] border-t-transparent" />
            </div>
          )}
          {activeTab === 'metas' && (
            <ErrorBoundary>
              <React.Suspense fallback={tabSuspenseFallback}>
                <MetasPage anio={period.anio} mes={period.mes} semana={1} filterPais={filterPais} />
              </React.Suspense>
            </ErrorBoundary>
          )}
          {activeTab === 'cartera' && (
            <ErrorBoundary>
              <React.Suspense fallback={tabSuspenseFallback}>
                <CarteraPage
                  filterPais={filterPais}
                  filterKam={filterKam}
                  esEjecutivo={effectiveRole?.rol === 'Ejecutivo'}
                  // El detalle vive en el tab Clientes, que no existe para los
                  // ejecutivos: sin él, el enlace no se ofrece.
                  onVerCambios={visibleTabs.includes('segmentacion')
                    ? (dir) => { setPresetCambio(dir); handleTabChange('segmentacion'); }
                    : undefined}
                />
              </React.Suspense>
            </ErrorBoundary>
          )}
          {activeTab === 'segmentacion' && (
            <ErrorBoundary>
              <React.Suspense fallback={tabSuspenseFallback}>
                <SegmentacionPage filterKam={filterKam} filterPais={filterPais} presetCambio={presetCambio} />
              </React.Suspense>
            </ErrorBoundary>
          )}
          {activeTab === 'herramientas' && (
            <ErrorBoundary>
              <React.Suspense fallback={tabSuspenseFallback}>
                <HerramientasPage />
              </React.Suspense>
            </ErrorBoundary>
          )}
          {activeTab === 'novedades' && (
            <ErrorBoundary>
              <React.Suspense fallback={tabSuspenseFallback}>
                <NovedadesPage isAdmin={isAdmin} />
              </React.Suspense>
            </ErrorBoundary>
          )}
          {activeTab === 'campanas' && (
            <ErrorBoundary>
              <React.Suspense fallback={tabSuspenseFallback}>
                <CampanasPage />
              </React.Suspense>
            </ErrorBoundary>
          )}
        </div>
      </main>
      {/* Ticker fijo a la derecha; se oculta en el propio tab de Novedades para no duplicar */}
      {activeTab !== 'novedades' && (
        <ErrorBoundary fallback={() => null}>
          <NovedadesTicker onOpen={() => handleTabChange('novedades')} />
        </ErrorBoundary>
      )}
    </div>
  );
}

function AppContent() {
  const { user } = useAuth();
  if (!user) return <LoginPage />;
  return <Dashboard />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppContent />
        <Toaster position="top-right" theme="light" />
      </AuthProvider>
    </QueryClientProvider>
  );
}

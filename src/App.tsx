import React, { useState, Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { LoginPage } from './auth/LoginPage';
import { TopNav, SubNav, PeriodSelector } from './components/layout';
import type { Tab } from './components/layout';
import { useTrack } from './hooks/useTrack';
import { useUserRole } from './hooks/useUserRole';

const MetasPage      = React.lazy(() => import('./pages/MetasPage').then((m) => ({ default: m.MetasPage })));
const CarteraPage    = React.lazy(() => import('./pages/CarteraPage').then((m) => ({ default: m.CarteraPage })));
const SegmentacionPage = React.lazy(() => import('./pages/SegmentacionPage').then((m) => ({ default: m.SegmentacionPage })));
const MiVistaPage    = React.lazy(() => import('./pages/MiVistaPage').then((m) => ({ default: m.MiVistaPage })));

class ErrorBoundary extends Component<
  { children: ReactNode; fallback?: (err: Error) => ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: ReactNode; fallback?: (err: Error) => ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
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

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 5 * 60 * 1000, gcTime: 30 * 60 * 1000, retry: 1 } },
});

const tabSuspenseFallback = (
  <div className="flex items-center justify-center h-48">
    <span className="animate-spin w-5 h-5 rounded-full border-2 border-[#0097A7] border-t-transparent" />
  </div>
);

// Tabs visibles según rol:
// - null / 'C-level' → dashboard completo sin Ranking
// - 'Ejecutivo' / 'Country Manager' → solo Mi Vista
const C_LEVEL_TABS: Tab[]  = ['metas', 'cartera', 'segmentacion'];
const EXEC_TABS: Tab[]      = ['mivista'];

function Dashboard() {
  const { user, logout } = useAuth();
  const { data: userRole, isLoading: roleLoading } = useUserRole();
  const [period, setPeriod] = useState({ anio: new Date().getFullYear(), mes: new Date().getMonth() + 1 });
  const { track } = useTrack();

  const isExec = !roleLoading && userRole?.rol === 'Ejecutivo';
  const isCM   = !roleLoading && userRole?.rol === 'Country Manager';
  const restricted = isExec || isCM;

  const visibleTabs = restricted ? EXEC_TABS : C_LEVEL_TABS;
  const [tab, setTab] = useState<Tab>(() => (restricted ? 'mivista' : 'metas'));

  // Si el rol cargó y el tab activo no es visible, redirigir
  const activeTab = visibleTabs.includes(tab) ? tab : visibleTabs[0];

  function handleTabChange(t: Tab) {
    setTab(t);
    if (t === 'cartera')      track('analisis_clientes');
    if (t === 'segmentacion') track('clientes');
  }

  function handlePeriodChange(p: Partial<typeof period>) {
    setPeriod((prev) => ({ ...prev, ...p }));
  }

  const showPeriod = activeTab !== 'cartera';

  return (
    <div className="flex flex-col h-screen">
      <TopNav onLogout={logout} />
      <SubNav active={activeTab} onChange={handleTabChange} visibleTabs={visibleTabs} />
      {showPeriod && (
        <PeriodSelector period={period} onChange={handlePeriodChange} />
      )}
      <main className="flex-1 overflow-auto bg-slate-50">
        <div className="mx-auto w-full px-4 sm:px-6" style={{ maxWidth: '1200px' }}>
          {activeTab === 'mivista' && userRole && (
            <ErrorBoundary>
              <React.Suspense fallback={tabSuspenseFallback}>
                <MiVistaPage
                  userRole={userRole}
                  email={user?.email ?? ''}
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
                <MetasPage anio={period.anio} mes={period.mes} semana={1} />
              </React.Suspense>
            </ErrorBoundary>
          )}
          {activeTab === 'cartera' && (
            <ErrorBoundary>
              <React.Suspense fallback={tabSuspenseFallback}>
                <CarteraPage />
              </React.Suspense>
            </ErrorBoundary>
          )}
          {activeTab === 'segmentacion' && (
            <ErrorBoundary>
              <React.Suspense fallback={tabSuspenseFallback}>
                <SegmentacionPage />
              </React.Suspense>
            </ErrorBoundary>
          )}
        </div>
      </main>
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
      </AuthProvider>
    </QueryClientProvider>
  );
}

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { LoginPage } from './auth/LoginPage';
import { TopNav, SubNav, PeriodSelector } from './components/layout';
import type { Tab } from './components/layout';
import { MetasPage } from './pages/MetasPage';
import { CarteraPage } from './pages/CarteraPage';
import { SegmentacionPage } from './pages/SegmentacionPage';
import { RankingPage } from './pages/RankingPage';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 5 * 60 * 1000, retry: 1 } },
});

function Dashboard() {
  const { logout } = useAuth();
  const [tab, setTab] = useState<Tab>('metas');
  const [period, setPeriod] = useState({ anio: new Date().getFullYear(), mes: new Date().getMonth() + 1 });

  function handlePeriodChange(p: Partial<typeof period>) {
    setPeriod((prev) => ({ ...prev, ...p }));
  }

  return (
    <div className="flex flex-col h-screen">
      <TopNav onLogout={logout} />
      <SubNav active={tab} onChange={setTab} />
      <PeriodSelector
        period={period}
        onChange={handlePeriodChange}
      />
      <main className="flex-1 overflow-auto bg-slate-50">
        {tab === 'metas' && <MetasPage anio={period.anio} mes={period.mes} semana={1} />}
        {tab === 'cartera' && <CarteraPage />}
        {tab === 'segmentacion' && <SegmentacionPage />}
        {tab === 'ranking' && <RankingPage />}
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

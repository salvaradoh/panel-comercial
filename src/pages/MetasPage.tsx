import { useState, useEffect } from 'react';
import { DesempenoNav } from '../components/layout/DesempenoNav';
import type { DesempenoTab } from '../components/layout/DesempenoNav';
import { OverviewTab } from './desempeno/OverviewTab';
import { LeaderboardTab } from './desempeno/LeaderboardTab';
import { PorEjecutivoTab } from './desempeno/PorEjecutivoTab';
import { useMetas } from '../hooks/useMetas';
import { useTrack } from '../hooks/useTrack';

interface MetasPageProps {
  anio: number;
  mes: number;
  semana: number;
  filterPais?: string;
}

export function MetasPage({ anio, mes, semana, filterPais }: MetasPageProps) {
  const [subTab, setSubTab] = useState<DesempenoTab>(filterPais ? 'leaderboard' : 'overview');
  const [_paisSeleccionado, setPaisSeleccionado] = useState<string | undefined>();
  const { track } = useTrack();

  // Trackear el tab inicial al entrar a Desempeño
  useEffect(() => { track('desempeno:overview'); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: metas, isLoading, error } = useMetas(anio, mes, semana);

  function handleSubTab(t: DesempenoTab) {
    setSubTab(t);
    if (t === 'overview')     track('desempeno:overview');
    if (t === 'ejecutivo')    track('desempeno:ejecutivo');
    if (t === 'leaderboard')  track('desempeno:leaderboard');
  }

  function handleSelectPais(pais: string) {
    setPaisSeleccionado(pais);
    setSubTab('leaderboard');
    track('desempeno:leaderboard', pais);
  }

  if (isLoading || !metas) {
    return (
      <div className="p-6 animate-pulse flex flex-col gap-6">
        <div className="h-8 w-64 bg-slate-100 rounded-xl" />
        <div className="grid grid-cols-3 gap-4">
          {[0,1,2].map(i => <div key={i} className="h-24 bg-slate-100 rounded-2xl" />)}
        </div>
        <div className="h-80 bg-slate-100 rounded-2xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-red-500" role="alert">
        Error cargando datos: {String(error)}
      </div>
    );
  }

  return (
    <div className="px-6 pt-3 pb-6 flex flex-col gap-4">
      <DesempenoNav active={subTab} onChange={handleSubTab} hiddenTabs={filterPais ? ['overview'] : undefined} />

      {subTab === 'overview' && !filterPais && (
        <OverviewTab
          metas={metas}
          anio={anio}
          mes={mes}
          onSelectPais={handleSelectPais}
        />
      )}
      {subTab === 'leaderboard' && (
        <LeaderboardTab
          anio={anio}
          mes={mes}
          defaultSemana={semana}
          filterPais={filterPais}
        />
      )}
      {subTab === 'ejecutivo' && (
        <PorEjecutivoTab anio={anio} mes={mes} filterPais={filterPais} />
      )}
    </div>
  );
}

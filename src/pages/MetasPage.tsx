import { useState } from 'react';
import { DesempenoNav } from '../components/layout/DesempenoNav';
import type { DesempenoTab } from '../components/layout/DesempenoNav';
import { OverviewTab } from './desempeno/OverviewTab';
import { PorPaisTab } from './desempeno/PorPaisTab';
import { PorEjecutivoTab } from './desempeno/PorEjecutivoTab';
import { useMetas } from '../hooks/useMetas';

interface MetasPageProps {
  anio: number;
  mes: number;
  semana: number;
}

export function MetasPage({ anio, mes, semana }: MetasPageProps) {
  const [subTab, setSubTab] = useState<DesempenoTab>('overview');
  const [paisSeleccionado, setPaisSeleccionado] = useState<string | undefined>();

  const { data: metas, isLoading, error } = useMetas(anio, mes, semana);

  function handleSelectPais(pais: string) {
    setPaisSeleccionado(pais);
    setSubTab('pais');
  }

  if (isLoading) {
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

  if (error || !metas) {
    return (
      <div className="p-6 text-red-500" role="alert">
        Error cargando datos: {String(error)}
      </div>
    );
  }

  return (
    <div className="px-6 pt-3 pb-6 flex flex-col gap-4">
      <DesempenoNav active={subTab} onChange={setSubTab} />

      {subTab === 'overview' && (
        <OverviewTab
          metas={metas}
          anio={anio}
          onSelectPais={handleSelectPais}
        />
      )}
      {subTab === 'pais' && (
        <PorPaisTab
          metas={metas}
          anio={anio}
          initialPais={paisSeleccionado}
        />
      )}
      {subTab === 'ejecutivo' && (
        <PorEjecutivoTab anio={anio} />
      )}
    </div>
  );
}

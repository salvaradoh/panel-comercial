import { useState } from 'react';
import { PortafolioNav } from '../components/layout/PortafolioNav';
import type { PortafolioTab } from '../components/layout/PortafolioNav';
import { ClientesSubNav } from '../components/layout/ClientesSubNav';
import type { ClientesSubTab } from '../components/layout/ClientesSubNav';
import { SaludTab } from './portafolio/SaludTab';
import { SegmentacionTab } from './portafolio/SegmentacionTab';

export function CarteraPage() {
  const [portafolioTab, setPortafolioTab] = useState<PortafolioTab>('estacionales');
  const [subTab, setSubTab] = useState<ClientesSubTab>('salud');
  const anio = new Date().getFullYear();

  return (
    <div className="p-6 flex flex-col gap-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <PortafolioNav
          active={portafolioTab}
          onChange={(t) => {
            setPortafolioTab(t);
            setSubTab('salud');
          }}
        />
      </div>

      <ClientesSubNav active={subTab} onChange={setSubTab} />

      {subTab === 'salud' && <SaludTab tipo={portafolioTab} anio={anio} />}
      {subTab === 'segmentacion' && <SegmentacionTab tipo={portafolioTab} />}
    </div>
  );
}

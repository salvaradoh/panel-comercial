import { useState, useEffect } from 'react';
import { PortafolioNav } from '../components/layout/PortafolioNav';
import type { PortafolioTab } from '../components/layout/PortafolioNav';
import { ClientesSubNav } from '../components/layout/ClientesSubNav';
import type { ClientesSubTab } from '../components/layout/ClientesSubNav';
import { OverviewTab } from './portafolio/OverviewTab';
import { SaludTab } from './portafolio/SaludTab';
import { SegmentacionTab } from './portafolio/SegmentacionTab';
import { ComparadorTab } from './portafolio/ComparadorTab';
import { MovimientosTab } from './portafolio/MovimientosTab';
import { IPCTab } from './portafolio/IPCTab';
import { IndustriaPaisTab } from './portafolio/IndustriaPaisTab';
import { useTrack } from '../hooks/useTrack';

interface CarteraPageProps {
  filterPais?: string;
  filterKam?: string;
  /** Ejecutivo (o admin impersonando uno): no ve Movimientos. */
  esEjecutivo?: boolean;
  /** Salta al tab Clientes con el filtro de cambios de status aplicado. */
  onVerCambios?: (dir: 'mejoraron' | 'empeoraron' | 'cualquiera') => void;
}

export function CarteraPage({ filterPais, filterKam, esEjecutivo, onVerCambios }: CarteraPageProps = {}) {
  const [portafolioTab, setPortafolioTab] = useState<PortafolioTab>('estacionales');
  const [subTab, setSubTab] = useState<ClientesSubTab>('overview');
  const anio = new Date().getFullYear();
  const { track } = useTrack();

  // Trackear vista inicial al entrar
  useEffect(() => { track('analisis:estacionales:salud'); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Priorización quedó con una sola vista, el Comparador: la Concentración ABC se
  // eliminó por pedido del negocio (2026-08-19), así que el sub-nav ya no existe.
  // El id 'cuentas-clave' del tab se conserva por compatibilidad, aunque la
  // entrada ya no se registra: el único evento de Priorización es 'comparar'.

  // Movimientos es vista de gestión (Country Manager, C-level, Admin): mide la
  // cartera completa del país y ordena a los ejecutivos por cartera enfriándose.
  // Para el ejecutivo el tab ni se dibuja; esto cubre el caso de que el rol se
  // resuelva DESPUÉS de un clic, que si no dejaría el área en blanco.
  // Industria por País, en cambio, es visible para todos sin restricción de rol.
  const subActivo: ClientesSubTab =
    esEjecutivo && subTab === 'movimientos' ? 'overview' : subTab;

  function handlePortafolioTab(t: PortafolioTab) {
    setPortafolioTab(t);
    // No se cambia de pestaña. Antes hacía `setSubTab('salud')`, así que estando
    // en Segmentación y alternando Estacionales/Recurrentes te sacaba de vuelta
    // a Salud del Cliente: el selector es un filtro de la vista actual, no una
    // navegación.
    track(`analisis:${t}:${subTab}`);
  }

  function handleSubTab(t: ClientesSubTab) {
    setSubTab(t);
    // Priorización NO registra la entrada a propósito: solo interesa si se usa el
    // comparador, y eso lo emite `analisis:cuentas-clave:comparar` cuando se
    // agrega un cliente. Contar visitas acá inflaba el uso con gente que entra,
    // mira y se va.
    if (t === 'cuentas-clave') return;
    // Movimientos, IPC, Industria por País y Overview quedan fuera del selector
    // Estacionales/Recurrentes, así que no llevan el tipo en el evento:
    // `analisis:estacionales:movimientos` daba a entender un filtro que esa
    // vista no aplica y partía la serie en dos.
    track(t === 'movimientos' || t === 'ipc' || t === 'industria' ? `analisis:${t}`
        : `analisis:${portafolioTab}:${t}`);
  }

  return (
    <div className="p-6 flex flex-col gap-5">
      {/* Los tabs van SIEMPRE primero y en posición fija. Antes el selector de
          Estacionales/Recurrentes se insertaba encima y solo en dos de las cuatro
          pestañas, así que al cambiar de pestaña la barra de tabs saltaba ~40px y
          parecía que "Cuentas Clave" estaba duplicada en dos lugares distintos. */}
      <ClientesSubNav active={subActivo} onChange={handleSubTab} esEjecutivo={esEjecutivo} />

      {/* Movimientos queda fuera del selector Estacionales/Recurrentes: mide entradas
          y salidas de la cartera completa, y filtrarlo por tipo daría una serie que
          no cierra — un cliente puede cambiar de tipo entre dos meses. */}
      {subActivo !== 'overview' && subActivo !== 'cuentas-clave' && subActivo !== 'movimientos'
        && subActivo !== 'ipc' && subActivo !== 'industria' && (
        <div className="flex items-center justify-between flex-wrap gap-3 -mt-1">
          <PortafolioNav active={portafolioTab} onChange={handlePortafolioTab} />
        </div>
      )}

      {subActivo === 'overview'      && <OverviewTab pais={filterPais} onVerCambios={onVerCambios} />}
      {subActivo === 'salud'         && <SaludTab tipo={portafolioTab} anio={anio} />}
      {subActivo === 'segmentacion'  && <SegmentacionTab tipo={portafolioTab} />}
      {subActivo === 'ipc'           && <IPCTab />}
      {subActivo === 'cuentas-clave' && <ComparadorTab filterPais={filterPais} filterKam={filterKam} />}
      {subActivo === 'industria'     && <IndustriaPaisTab pais={filterPais} />}
      {subActivo === 'movimientos' && <MovimientosTab pais={filterPais} kam={filterKam} />}
    </div>
  );
}

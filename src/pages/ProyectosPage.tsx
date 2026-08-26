import { useState } from 'react';
import { ProyectosSubNav } from '../components/layout/ProyectosSubNav';
import type { ProyectoTab } from '../components/layout/ProyectosSubNav';
import { ProyectoCBS } from './proyectos';

/**
 * Tab Proyectos: iniciativas comerciales con tablero propio.
 *
 * Hoy vive un solo proyecto (CBS, Cross Border Sales LATAM → México), pero la
 * navegación ya tiene el nivel de proyecto porque la idea es sumar más: agregar
 * el siguiente es una entrada en ProyectosSubNav y un caso acá.
 */
export function ProyectosPage() {
  const [proyecto, setProyecto] = useState<ProyectoTab>('cbs');

  return (
    <div className="py-5 space-y-5">
      <ProyectosSubNav active={proyecto} onChange={setProyecto} />
      {proyecto === 'cbs' && <ProyectoCBS />}
    </div>
  );
}

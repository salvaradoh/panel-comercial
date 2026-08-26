import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';

export type AlertaIPC = 'Verde' | 'Amarillo' | 'Rojo';

export interface ClienteIPC {
  empresa: string;
  kam: string;
  pais: string;
  tipo: string;
  segmento: string;
  panelId: string;
  meta: number;
  pts: number;
  interacciones: number;
  ipcScore: number;
  proyectado: number;
  alerta: AlertaIPC;
  /** Puntos de IPC contra el trimestre anterior. `null` = no hay con qué comparar. */
  tendencia: number | null;
  ultimaInteraccion: string | null;
  ultimoTipo: string;
  diasSinInteraccion: number | null;
  sinInteraccionReciente: boolean;
}

export interface IPCResponse {
  trimestre: string;
  trimestreAnterior: string;
  segmento: string;
  pais: string | null;
  periodo: {
    inicio: string;
    fin: string;
    dias: number;
    transcurridos: number;
    restantes: number;
    cerrado: boolean;
  };
  metaPorTipo: Record<string, number>;
  banda: number;
  resumen: {
    clientes: number;
    interacciones: number;
    interaccionesPrev: number;
    ipcPromedio: number;
    verde: number;
    amarillo: number;
    rojo: number;
    sinInteraccion: number;
    /** Clientes A+ del alcance que NO figuran en Registro Interacciones. Fuera de la lista. */
    sinRegistro: number;
    /** Total de clientes A+ del alcance, con y sin registro. */
    universo: number;
    /** Participación de cada tipo de interacción en el trimestre, de mayor a menor. */
    porTipo: { tipo: string; n: number }[];
  };
  clientes: ClienteIPC[];
  alcance: {
    rol: string;
    global: boolean;
    pais: string | null;
    puedeElegirPais: boolean;
  };
  trimestresDisponibles: string[];
  diagnostico: {
    filasSinEmpresa: number;
    interaccionesOtroSegmento: number;
    empresasDesconocidas: string[];
  };
}

/**
 * IPC — Índice de Presencia Comercial.
 *
 * El país NO se manda como filtro de confianza: la ruta resuelve el alcance desde
 * el email autenticado e ignora `pais` si el rol es restringido. Se envía solo
 * para el selector de los roles globales (C-level y Admin).
 */
export function useIPC(trimestre: string, pais?: string) {
  return useQuery<IPCResponse>({
    queryKey: ['ipc', trimestre, pais ?? 'todos'],
    queryFn: () => {
      const qs = new URLSearchParams({ trimestre });
      if (pais) qs.set('pais', pais);
      return apiFetch<IPCResponse>(`/api/ipc?${qs.toString()}`);
    },
    enabled: !!trimestre,
    staleTime: 10 * 60 * 1000,
  });
}

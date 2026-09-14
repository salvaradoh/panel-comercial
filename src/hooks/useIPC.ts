import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';

export type AlertaIPC = 'Verde' | 'Amarillo' | 'Rojo';
/** Semáforo del SEGMENTO por cobertura. Distinto del de cada cuenta. */
export type AlertaCobertura = 'Verde' | 'Amarilla' | 'Roja';

export interface CoberturaSegmento {
  segmento: string;
  clientes: number;
  contactados: number;
  cobertura: number;
  alerta: AlertaCobertura;
}

export interface ClienteIPC {
  empresa: string;
  kam: string;
  pais: string;
  tipo: string;
  segmento: string;
  panelId: string;
  status: string;
  /** Probabilidad de fuga en porcentaje (0-100). `null` = el modelo no la calculó. */
  probFuga: number | null;
  diasSinCompra: number;
  /** Tuvo al menos una interacción en el trimestre elegido. */
  contactado: boolean;
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

/** Una fila de `Registro Interacciones`, ya cruzada con su cliente. Solo se usa
 *  para la descarga: la pantalla trabaja con los agregados por cliente. */
export interface InteraccionIPC {
  fecha: string;
  hora: string;
  kam: string;
  tipoInteraccion: string;
  tarea: string;
  canal: string;
  ptsBase: number;
  factor: number;
  pts: number;
  trimestre: string;
  /** Segmento que la hoja congeló al registrar. Discrepa del vigente en ~23% de las filas. */
  segmentoEstampado: string;
  fuente: string;
  idExterno: string;
  empresa: string;
  pais: string;
  panelId: string;
  kamCartera: string;
  tipoCliente: string;
  segmentoVigente: string;
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
  /** Metas del segmento pedido. Vacío cuando el segmento es 'Todos'. */
  metaPorTipo: Record<string, number>;
  /** Tabla completa de metas por segmento y tipo. */
  metaPorSegmento: Record<string, Record<string, number>>;
  segmentosDisponibles: string[];
  banda: number;
  resumen: {
    clientes: number;
    interacciones: number;
    interaccionesPrev: number;
    ipcPromedio: number;
    verde: number;
    amarillo: number;
    rojo: number;
    /** Clientes de la cartera que nadie contactó en el trimestre. */
    sinContactar: number;
    /** Total de clientes del alcance: el denominador de la cobertura. */
    universo: number;
    /** Contactados ÷ universo, en porcentaje. */
    cobertura: number;
    alertaCobertura: AlertaCobertura;
    /** Participación de cada tipo de interacción en el trimestre, de mayor a menor. */
    porTipo: { tipo: string; n: number }[];
  };
  clientes: ClienteIPC[];
  coberturaPorSegmento: CoberturaSegmento[];
  /** Frescura de la cartera: cuándo el GAS cargarCartera() leyó BigQuery. */
  cartera: { actualizada: string; universo: number };
  interacciones: InteraccionIPC[];
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
export function useIPC(trimestre: string, pais?: string, segmento = 'A+') {
  return useQuery<IPCResponse>({
    queryKey: ['ipc', trimestre, pais ?? 'todos', segmento],
    queryFn: () => {
      const qs = new URLSearchParams({ trimestre, segmento });
      if (pais) qs.set('pais', pais);
      return apiFetch<IPCResponse>(`/api/ipc?${qs.toString()}`);
    },
    enabled: !!trimestre,
    staleTime: 10 * 60 * 1000,
  });
}

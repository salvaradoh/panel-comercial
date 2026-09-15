import { useMemo } from 'react';
import { useCacheSheet } from './useCacheSheet';
import { mismoPais } from '../lib/paises';

/**
 * Semáforo de inactividad y movimientos entre tramos.
 *
 * Los tramos son días fijos sin comprar —≤60, 61-90, >90— sobre los clientes con
 * segmento real (estacional/recurrente), el mismo universo del Comparador.
 *
 * Reemplazó al modelo anterior basado en `f_r`, que adaptaba el umbral al ciclo
 * de cada cliente. Ese sigue existiendo en `vista_eventos_clientes` para los
 * clientes nuevos, pero el tab muestra el criterio simple que se pidió.
 */
export interface MovAgregado {
  /** Semáforo: cuántos hay en cada tramo al cierre del mes. */
  t60: number;
  t90: number;
  t90mas: number;
  cartera: number;

  /** Movimientos respecto al mes anterior. */
  empeoraron: number;
  mejoraron: number;
  sinCambio: number;

  /** Detalle de cada cruce. */
  de60a90: number;
  de90a90mas: number;
  de60a90mas: number;
  de90a60: number;
  de90masa60: number;
  de90masa90: number;

  /** Entró o salió del universo (cliente nuevo, o cambió de tipo). */
  entraron: number;
  salieron: number;

  usdEmpeoraron: number;
  usdT90mas: number;
  usdCartera: number;

  /** % de la cartera en cada tramo. null si no hay cartera. */
  pct60: number | null;
  pct90: number | null;
  pct90mas: number | null;
}

export interface MovMes extends MovAgregado {
  mes: string;          // 'YYYY-MM'
  /** El mes en curso se corta hoy: no es comparable con los cerrados. */
  esParcial: boolean;
}

export interface MovKam extends MovAgregado {
  pais: string;
  nombre: string;
}

/**
 * Churn trimestral — definición del PDF "Cómo se calcula el churn" (2026-08-18).
 *
 * Es una TERCERA definición de pérdida, que convive con el semáforo de tramos y
 * con el `f_r` de `vista_eventos_clientes`. Un cliente cuenta como perdido en un
 * trimestre si compró en el trimestre de referencia y después no compró en ningún
 * mes de la ventana de silencio: 4 meses si es recurrente, 13 si es estacional.
 * Da números distintos al semáforo a propósito, así que la vista lo dice al pie.
 */
export interface ChurnQTrimestre {
  trimestreId: string;      // '2026-Q2'
  cierre: string;           // 'YYYY-MM-DD', último día del mes de cierre
  anio: number;
  trimestre: number;
  churn: number;
  churnRec: number;
  churnEst: number;
  usdChurn: number;
  /** Clientes del país con historial HASTA ESE CIERRE, no la foto de hoy. */
  cartera: number;
  /** El mismo denominador abierto por rama. carteraRec + carteraEst = cartera:
   *  cada cliente vive en una sola rama en cada cierre. */
  carteraRec: number;
  carteraEst: number;
  pctChurn: number | null;
  /** La historia del país no alcanza para armar la referencia: no es comparable. */
  coberturaParcial: boolean;
  /** Trimestre en curso: cuenta como perdidos a clientes que todavía pueden
   *  comprar antes del cierre. Se muestra aparte y fuera de los promedios. */
  ventanaAbierta: boolean;
}

/** Una celda de la matriz trimestre × país del resumen. */
export interface ChurnQPais {
  trimestreId: string;
  pais: string;
  churn: number;
  churnRec: number;
  churnEst: number;
  cartera: number;
  carteraRec: number;
  carteraEst: number;
  pctChurn: number | null;
  /** Sin cobertura: la historia del país no llega. Se muestra 'n/d', no 0. */
  coberturaParcial: boolean;
  ventanaAbierta: boolean;
}

export interface ChurnQKam {
  pais: string;
  nombre: string;
  churn: number;
  cartera: number;
  usdChurn: number;
  pctChurn: number | null;
}

export interface ClienteChurnQ {
  /** Ausente en el payload viejo, que solo publicaba el último trimestre. */
  trimestreId?: string;
  pais: string;
  kam: string;
  panelId: string;
  /** ID tributario (RUT/RFC/NIT/RUC), el último que usó el cliente. Ausente en
   *  el payload anterior. Quién es el cliente lo sigue definiendo panelId. */
  idTributario?: string;
  nombre: string;
  rama: 'recurrente' | 'estacional' | string;
  tipoRef: string;
  usdReferencia: number;
  /** Ventana con la que se declaró la pérdida: compró entre refDe y refA,
   *  nada desde silDe. Permite verificar el caso sin volver a la base. */
  refDe?: string;
  refA?: string;
  silDe?: string;
  /** En cuántos meses del trimestre de referencia compró: 1 es una compra
   *  aislada, 3 es cadencia. Ausente en el payload anterior al 2026-08-25. */
  mesesRef?: number;
  /** Facturación de los 12 meses previos al cierre de la referencia. */
  usd12m?: number;
  /** El trimestre todavía no cerró: es un candidato, no una pérdida firme. */
  abierta?: boolean;
  /** Meses entre la primera compra del cliente y el cierre de su referencia.
   *  Distingue al que nunca terminó de arrancar del que se fue después de años.
   *  Ausente en el payload anterior al 2026-09-15. */
  antiguedadMeses?: number;
}

/** Un cliente que entró o salió de la base activa en un trimestre. */
export interface MovimientoBase {
  trimestreId: string;
  pais: string;
  kam: string;
  panelId: string;
  nombre: string;
  tipo: string;
  /** 'alta' entró a la base ese trimestre, 'baja' dejó de estar. */
  movimiento: 'alta' | 'baja' | string;
  usd12m: number;
  /** Rama de la que entra o sale. Ausente en el payload anterior. */
  rama?: string;
  /** 'entrada' / 'salida' son movimientos reales de la base. 'reclasificacion'
   *  es el mismo cliente cambiando de rama: emite una baja y un alta que se
   *  anulan en el total y solo se ven al separar por rama. */
  motivo?: string;
}

export interface MovimientosResponse {
  meses: MovMes[];
  kams: MovKam[];
  total: MovAgregado;
  /** Vista trimestral. Independiente del año: se publican los últimos 8 cerrados. */
  churnQ: ChurnQTrimestre[];
  churnQPaises: ChurnQPais[];
  /** Altas y bajas de la base. Vacío en el payload anterior al 2026-09-15. */
  movimientosBase: MovimientoBase[];
  churnQKams: ChurnQKam[];
  clientesQ: ClienteChurnQ[];
  ultimoQ: string | null;
  anio: number;
  pais: string | null;
  kam: string | null;
}

/** Fila cruda de la hoja: un (mes, país, KAM). */
type FilaCache = Omit<MovAgregado, 'pct60' | 'pct90' | 'pct90mas'> & {
  mes: string; esParcial: boolean; pais: string; kam: string;
};

/** Fila cruda trimestral: un (trimestre, país, KAM). */
interface FilaQ {
  trimestreId: string; cierre: string; anio: number; trimestre: number;
  pais: string; kam: string;
  churn: number; churnRec: number; churnEst: number; usdChurn: number;
  cartera: number; coberturaParcial: boolean;
  /** Ausentes en el payload anterior al desglose por rama: caen a 0 y el panel
   *  muestra el total, que es lo que había antes. */
  carteraRec?: number; carteraEst?: number;
  /** Trimestre en curso: la ventana de silencio no cerró. Ausente en el
   *  payload anterior al 2026-08-25, donde solo iban trimestres cerrados. */
  ventanaAbierta?: boolean;
}

interface CacheMovimientos {
  anio: number;
  generado: string;
  filas: FilaCache[];
  // Ausentes hasta que corra el GAS con el churn trimestral; el tab degrada solo.
  trimestres?: FilaQ[];
  ultimoQ?: string | null;
  /** Clientes de todos los trimestres publicados. */
  clientesQ?: ClienteChurnQ[];
  /** Altas y bajas de la base activa. Ausente hasta que corra el GAS nuevo. */
  movimientosBase?: MovimientoBase[];
  /** Payload anterior: solo el último trimestre, sin `trimestreId`. Se sigue
   *  leyendo para que el tab no quede vacío entre el deploy y el próximo
   *  refresco del GAS. */
  clientesUltimoQ?: ClienteChurnQ[];
}

const CAMPOS = [
  't60', 't90', 't90mas', 'cartera',
  'empeoraron', 'mejoraron', 'sinCambio',
  'de60a90', 'de90a90mas', 'de60a90mas', 'de90a60', 'de90masa60', 'de90masa90',
  'entraron', 'salieron',
  'usdEmpeoraron', 'usdT90mas', 'usdCartera',
] as const;

function vacio(): MovAgregado {
  const a = {} as MovAgregado;
  for (const k of CAMPOS) a[k] = 0;
  a.pct60 = null; a.pct90 = null; a.pct90mas = null;
  return a;
}

function sumar(d: MovAgregado, f: FilaCache) {
  for (const k of CAMPOS) d[k] += Number(f[k]) || 0;
}

/**
 * Los porcentajes se derivan al final, nunca se promedian: al filtrar por país o
 * ejecutivo hay que recalcular sobre ESA cartera.
 */
function cerrar(a: MovAgregado): MovAgregado {
  const pct = (n: number) => (a.cartera > 0 ? Math.round((100 * n / a.cartera) * 10) / 10 : null);
  a.pct60 = pct(a.t60);
  a.pct90 = pct(a.t90);
  a.pct90mas = pct(a.t90mas);
  return a;
}

export function useMovimientos(anio: number, pais?: string, kam?: string) {
  const { data: raw, isLoading, error } = useCacheSheet<CacheMovimientos>('Cache_Movimientos');

  const data = useMemo<MovimientosResponse | undefined>(() => {
    if (!raw) return undefined;

    const filas = (raw.filas ?? []).filter(f =>
      (!pais || mismoPais(f.pais, pais)) && (!kam || f.kam === kam));

    const porMes    = new Map<string, MovAgregado>();
    const porKam    = new Map<string, MovAgregado>();
    const parcialDe = new Map<string, boolean>();

    for (const f of filas) {
      parcialDe.set(f.mes, Boolean(f.esParcial));

      if (!porMes.has(f.mes)) porMes.set(f.mes, vacio());
      sumar(porMes.get(f.mes)!, f);

      const k = `${f.pais}||${f.kam}`;
      if (!porKam.has(k)) porKam.set(k, vacio());
      sumar(porKam.get(k)!, f);
    }

    const meses: MovMes[] = [...porMes.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mes, a]) => ({ mes, esParcial: parcialDe.get(mes) ?? false, ...cerrar(a) }));

    // El "total" del año no se suma: el semáforo es un stock, y sumar 8 meses
    // daría 8× la cartera. Se toma el último mes disponible, que es la foto de hoy.
    const ultimo = meses.length ? meses[meses.length - 1] : vacio();

    // Por ejecutivo también es stock, así que se toma su último mes, no la suma.
    const ultimoMes = meses.length ? meses[meses.length - 1].mes : null;
    const kams: MovKam[] = [];
    if (ultimoMes) {
      const porKamUltimo = new Map<string, MovAgregado>();
      for (const f of filas.filter(x => x.mes === ultimoMes)) {
        const k = `${f.pais}||${f.kam}`;
        if (!porKamUltimo.has(k)) porKamUltimo.set(k, vacio());
        sumar(porKamUltimo.get(k)!, f);
      }
      for (const [k, a] of porKamUltimo) {
        const [p, nombre] = k.split('||');
        kams.push({ pais: p, nombre, ...cerrar(a) });
      }
      kams.sort((x, y) => y.t90mas - x.t90mas);
    }

    // ── Vista trimestral ────────────────────────────────────────────────────
    // El % se deriva acá y nunca se promedia: al filtrar por país o ejecutivo hay
    // que recalcularlo sobre ESA cartera, igual que en la vista mensual.
    const filasQ = (raw.trimestres ?? []).filter(f =>
      (!pais || mismoPais(f.pais, pais)) && (!kam || f.kam === kam));

    const porQ = new Map<string, ChurnQTrimestre>();
    for (const f of filasQ) {
      let d = porQ.get(f.trimestreId);
      if (!d) {
        d = {
          trimestreId: f.trimestreId, cierre: f.cierre,
          anio: Number(f.anio) || 0, trimestre: Number(f.trimestre) || 0,
          churn: 0, churnRec: 0, churnEst: 0, usdChurn: 0,
          cartera: 0, carteraRec: 0, carteraEst: 0,
          pctChurn: null, coberturaParcial: false,
          ventanaAbierta: false,
        };
        porQ.set(f.trimestreId, d);
      }
      d.churn    += Number(f.churn) || 0;
      d.churnRec += Number(f.churnRec) || 0;
      d.churnEst += Number(f.churnEst) || 0;
      d.usdChurn += Number(f.usdChurn) || 0;
      d.cartera  += Number(f.cartera) || 0;
      d.carteraRec += Number(f.carteraRec) || 0;
      d.carteraEst += Number(f.carteraEst) || 0;
      if (f.coberturaParcial) d.coberturaParcial = true;
      if (f.ventanaAbierta) d.ventanaAbierta = true;
    }
    const churnQ = [...porQ.values()]
      .sort((a, b) => a.trimestreId.localeCompare(b.trimestreId))
      .map(d => ({
        ...d,
        pctChurn: d.cartera > 0 ? Math.round((100 * d.churn / d.cartera) * 10) / 10 : null,
      }));

    // Por ejecutivo, solo el último trimestre cerrado: es un evento del trimestre,
    // no un stock, pero sumar 8 trimestres mezclaría reactivaciones con pérdidas.
    // Si el GAS no publicó ultimoQ (payload viejo), se cae al último CERRADO y no
    // al último a secas: con el trimestre en curso publicado, ese sería el abierto.
    const cerradosQ = churnQ.filter(q => !q.ventanaAbierta);
    const ultimoQ = raw.ultimoQ
      ?? (cerradosQ.length ? cerradosQ[cerradosQ.length - 1].trimestreId : null);
    const porKamQ = new Map<string, ChurnQKam>();
    for (const f of filasQ.filter(x => x.trimestreId === ultimoQ)) {
      const k = `${f.pais}||${f.kam}`;
      let d = porKamQ.get(k);
      if (!d) {
        d = { pais: f.pais, nombre: f.kam, churn: 0, cartera: 0, usdChurn: 0, pctChurn: null };
        porKamQ.set(k, d);
      }
      d.churn    += Number(f.churn) || 0;
      d.cartera  += Number(f.cartera) || 0;
      d.usdChurn += Number(f.usdChurn) || 0;
    }
    const churnQKams = [...porKamQ.values()]
      .map(d => ({
        ...d,
        pctChurn: d.cartera > 0 ? Math.round((100 * d.churn / d.cartera) * 10) / 10 : null,
      }))
      .sort((a, b) => b.churn - a.churn);

    // Matriz trimestre × país para el resumen. Va aparte de churnQ porque ahí el
    // país se colapsa, y el resumen necesita justamente esa dimensión.
    const porPaisQ = new Map<string, ChurnQPais>();
    for (const f of filasQ) {
      const k = `${f.trimestreId}||${f.pais}`;
      let d = porPaisQ.get(k);
      if (!d) {
        d = { trimestreId: f.trimestreId, pais: f.pais, churn: 0,
              churnRec: 0, churnEst: 0, cartera: 0, carteraRec: 0, carteraEst: 0,
              pctChurn: null, coberturaParcial: false, ventanaAbierta: false };
        porPaisQ.set(k, d);
      }
      d.churn     += Number(f.churn) || 0;
      d.churnRec  += Number(f.churnRec) || 0;
      d.churnEst  += Number(f.churnEst) || 0;
      d.cartera   += Number(f.cartera) || 0;
      d.carteraRec += Number(f.carteraRec) || 0;
      d.carteraEst += Number(f.carteraEst) || 0;
      if (f.coberturaParcial) d.coberturaParcial = true;
      if (f.ventanaAbierta) d.ventanaAbierta = true;
    }
    const churnQPaises = [...porPaisQ.values()].map(d => ({
      ...d,
      pctChurn: d.cartera > 0 ? Math.round((100 * d.churn / d.cartera) * 10) / 10 : null,
    }));

    // Los clientes vienen de todos los trimestres; el componente elige cuál abre.
    // Al payload viejo se le pone el trimestreId del último, que es de donde salía.
    const crudos = raw.clientesQ
      ?? (raw.clientesUltimoQ ?? []).map(c => ({ ...c, trimestreId: ultimoQ ?? undefined }));
    const clientesQ = crudos.filter(c =>
      (!pais || mismoPais(c.pais, pais)) && (!kam || c.kam === kam));

    return {
      meses, kams,
      total: cerrar({ ...ultimo }),
      churnQ, churnQPaises, churnQKams, clientesQ, ultimoQ,
      movimientosBase: (raw.movimientosBase ?? []).filter((m: MovimientoBase) =>
        (!pais || mismoPais(m.pais, pais)) && (!kam || m.kam === kam)),
      anio: raw.anio ?? anio,
      pais: pais ?? null,
      kam:  kam  ?? null,
    };
  }, [raw, anio, pais, kam]);

  return { data, isLoading, error };
}

export interface PaisData {
  pais: string;
  avance: number;
  meta: number;
  pct: number;
  serie: { semana: number; avance: number; meta: number }[];
  // Campos comparativos
  mesAnterior?: number;
  avanceYoY?: number;
  varYoY?: number;
  varYoYPct?: number;
  // Proyecciones precomputadas por el GAS (cols 8 y 9 del Cache_Reporte)
  proyeccionSem?: number;  // Proy. semanal lineal (días)
  proyeccionMes?: number;  // Proy. mensual YoY
}

export interface MetasResponse {
  paises: PaisData[];
  semanasDisponibles: number[];
  periodo: { anio: number; mes: number; semana: number };
}

export interface KamSalud {
  kam: string;
  pais: string;
  base: number;
  churn: number;
  retencion: number;
  volumen: number;
}

export interface CarteraResponse {
  estacionales: { kams: KamSalud[] };
  recurrentes: { kams: KamSalud[] };
  productos: { nombre: string; avance: number; pct: number }[];
  tendencia: { mes: string; valor: number }[];
  _placeholder?: boolean;
}

export interface ClienteChurn {
  empresa: string;
  volumen: number;
  factPerd: number;
  ultimaCompra: string;
  diasSinCompra: number;
  subSeg: string;
  score: number;
  segmento: 'A+' | 'A' | 'B' | 'C';
  catPrincipal?: string;
  // Desglose del score de SEGMENTACIÓN (no confundir con scoreVNT, de salud).
  segVol?: number;
  segFVol?: number;
  segFProd?: number;
  segFMeses?: number;
  segFMargen?: number;
  scoreVNT?: number;
  fE?: number;
  fN?: number;
  fT?: number;
  npsRaw?: number | null;
  caida?: number | null;
  señalesEng?: string[];
  ctxE?: string;
  /** USD de dotación (solo Colombia). Marca para el filtro; no afecta montos. */
  dot?: number;
}

export interface KamEstacional {
  kam: string;
  base: number;
  ret: number;
  churn: number;
  churnPct: number;
  retPct: number;
  volumen: number;
  factPerd: number;
  pctVtaPerd: number;
  churn1ra: number;
  scoreEst: number;
  porTipo: {
    estacional: { base: number; ret: number; churn: number; volumen: number; factPerd: number };
    puntual: { base: number; ret: number; churn: number; volumen: number; factPerd: number };
    primera_compra: { base: number; ret: number; churn: number; volumen: number; factPerd: number };
  };
  clientesChurn: ClienteChurn[];
  clientesRetenidos: { empresa: string; volumen: number; subSeg: string; score: number; segmento: string; scoreVNT?: number; ultimaCompra?: string; diasSinCompra?: number; fE?: number; fN?: number; fT?: number; npsRaw?: number | null; caida?: number | null; señalesEng?: string[]; ctxE?: string; dot?: number; segVol?: number; segFVol?: number; segFProd?: number; segFMeses?: number; segFMargen?: number }[];
}

export interface PaisEstacional {
  pais: string;
  churnPct: number;
  periodo: string;
  kams: KamEstacional[];
  totales: { base: number; ret: number; churn: number; churnPct: number; volumen: number; factPerd: number; pctVtaPerd: number; churn1ra: number } | null;
}

export interface ClienteRec {
  /** USD de dotación (solo Colombia). Marca para el filtro; no afecta montos. */
  dot?: number;
  empresa: string;
  score: number;
  segmento: string;
  diasSinCompra: number;
  ultimaCompra?: string;
  volumen: number;
  tipo?: string;
  fR?: number;
  fE?: number;
  fN?: number;
  fT?: number;
  npsRaw?: number | null;
  monto6m?: number | null;
  monto6mAnt?: number | null;
  detalleEngagement?: string;
  ctxE?: string;
}

export interface KamRecurrente {
  kam: string;
  base: number;
  saludables: number;
  monitorear: number;
  enRiesgo: number;
  criticos: number;
  scorePromedio: number;
  montoPerdido: number;
  caidaUSD?: number;
  clientes?: ClienteRec[];
  clientesPH?: ClienteRec[];
}

export interface CarteraRichResponse {
  anioSig: number;
  estacionales: {
    globales: { base: number; churn: number; churn_pct: number; fact_perd: number; pct_vta_perd: number; churn1ra: number };
    paises: PaisEstacional[];
  };
  recurrentes: {
    globales: { total: number; saludables: number; monitorear: number; enRiesgo: number; criticos: number; montoPerdido: number; scorePromedio: number; totalPH?: number };
    paises: { pais: string; resumen: Record<string, number>; kams: KamRecurrente[] }[];
  };
  _placeholder?: boolean;
}

export interface ClienteSegmentacion {
  /** USD de dotación (solo Colombia). Marca para el filtro; no afecta score. */
  dot?: number;
  cliente: string;
  /** panel_id (campo `empresa` del caché). Llave para cruzar con el score de salud. */
  panelId?: string;
  /**
   * Score de salud (RENT/VENT) ya resuelto. En estacionales viene en el mismo
   * objeto del caché (`scoreVNT.score`), así que no hace falta cruzar nada; en
   * recurrentes queda undefined y se resuelve por panel_id.
   */
  saludScore?: number;
  segmento: 'A+' | 'A' | 'B' | 'C';
  score: number;
  vol: number;
  meses?: number;
  // Factores de RECURRENTES (Cache_Segmentacion18): vol 50% · meses 20% · usuarios 20% · fee 10%
  ptVol?: number;
  ptMeses?: number;
  ptUsrInc?: number;
  ptFee?: number;
  // Factores de ESTACIONALES (Cache_Churn → scoreEstacional). Pesos distintos a los
  // de recurrentes: vol 50% · producto dominante 25% · meses 12.5% · margen de mix 12.5%
  fVol?: number;
  fProd?: number;
  fMeses?: number;
  fMargen?: number;
  /** 'estacional' | 'primera_compra' — se muestra en la columna Tipo */
  subSeg?: string;
}

export interface KamSegmentacion {
  kam: string;
  total: number;
  aPlus: number;
  a: number;
  b: number;
  c: number;
  vol: number;
  clientes: ClienteSegmentacion[];
}

export interface PaisSegmentacion {
  pais: string;
  total: number;
  aPlus: number;
  a: number;
  b: number;
  c: number;
  vol: number;
  kams: KamSegmentacion[];
}

export interface SegmentacionResponse {
  clientes: {
    cliente: string; kam: string; pais: string; panelId?: string;
    segmento: 'A+' | 'A' | 'B' | 'C'; score: number; vol: number;
    ptVol?: number; ptMeses?: number; ptUsrInc?: number; ptFee?: number;
  }[];
  conteos: Record<'A+' | 'A' | 'B' | 'C', number>;
  globales: { total: number; vol: number };
  paises: PaisSegmentacion[];
  fechaCalculo: string;
}

export interface KamRanking {
  nombre: string;
  pais: string;
  metaAnualUSD: number;
  metaYTDUSD?: number;
  avanceAnualUSD: number;
  cumplimiento: number;
}

export interface PaisRanking {
  nombre: string;
  metaAnualUSD: number;
  avanceAnualUSD: number;
  cumplimiento: number;
}

export interface ConsistenciaItem {
  nombre: string;
  pais: string;
  mesesCumplidos: number;
  totalMeses: number;
  semanasCumplidas: number;
  totalSemanas: number;
}

export interface RankingResponse {
  anio: number;
  kams: KamRanking[];
  paises: PaisRanking[];
  consistencia: ConsistenciaItem[];
  indicadores: unknown[];
}

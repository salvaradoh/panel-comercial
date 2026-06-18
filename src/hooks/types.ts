export interface PaisData {
  pais: string;
  avance: number;
  meta: number;
  pct: number;
  serie: { semana: number; avance: number; meta: number }[];
  // Nuevos campos comparativos (opcionales — el backend los incluye progresivamente)
  mesAnterior?: number;
  avanceYoY?: number;
  varYoY?: number;
  varYoYPct?: number;
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
  clientesRetenidos: { empresa: string; volumen: number; subSeg: string; score: number; segmento: string }[];
}

export interface PaisEstacional {
  pais: string;
  churnPct: number;
  periodo: string;
  kams: KamEstacional[];
  totales: { base: number; ret: number; churn: number; churnPct: number; volumen: number; factPerd: number; pctVtaPerd: number; churn1ra: number } | null;
}

export interface ClienteRec {
  empresa: string;
  score: number;
  segmento: string;
  diasSinCompra: number;
  volumen: number;
  tipo?: string;
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

export interface SegmentacionResponse {
  clientes: { cliente: string; kam: string; segmento: 'A+' | 'A' | 'B' | 'C'; score: number; vol: number }[];
  conteos: Record<'A+' | 'A' | 'B' | 'C', number>;
}

export interface KamRanking {
  nombre: string;
  pais: string;
  metaAnualUSD: number;
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


/**
 * Proyecto CBS (Cross Border Sales): LATAM → México.
 *
 * Todo —Farming y Hunting— sale de UNA sola hoja plana. No hay caché ni ETL de
 * por medio: se lee en vivo con el token del usuario, porque el equipo comercial
 * la edita a diario y el panel tiene que mostrar lo último.
 */
export const CBS_SPREADSHEET_ID = '1WXM1fjHPCpNKD8AZbzosEp51Qa-asJk9p3cpgYYFweo';
export const CBS_HOJA           = 'BBDD para MX';
export const CBS_GID            = '102518817';
export const CBS_URL =
  `https://docs.google.com/spreadsheets/d/${CBS_SPREADSHEET_ID}/edit?gid=${CBS_GID}#gid=${CBS_GID}`;

/** Acento del proyecto: se distingue del cian del panel porque es un tablero aparte. */
export const CBS_ACENTO = '#E11D48';

export const fmtPct = (v: number) => `${Math.round(v * 100)}%`;
export const fmtNum = (v: number) => v.toLocaleString('es-PE');

/** A→BD son las 56 columnas que tiene hoy la hoja; el margen de filas cubre crecimiento. */
export const CBS_RANGO = `'${CBS_HOJA}'!A1:BD2000`;

/**
 * Cabeceras de la hoja, tal cual están escritas (minúsculas y tildes incluidas).
 *
 * Se mapea por NOMBRE y no por índice de columna a propósito: si el equipo
 * inserta una columna en el medio —cosa que pasa— los índices se corren en
 * silencio y los KPIs quedan mal sin que nadie se entere, mientras que un
 * nombre que ya no existe se detecta y se avisa (ver `faltantes` más abajo).
 *
 * Ojo con los pares que se parecen y NO son lo mismo:
 *   'Envío secuencia'  (farming)  vs  'Envío de secuencia' (hunting)
 *   'Whatsapp/Call'    (farming)  vs  'whatsapp'           (hunting)
 */
const COL = {
  idEmpresa:             'ID Empresa',
  nombreEmpresa:         'Nombre Empresa',
  razonSocial:           'Razón Social',
  paisOrigen:            'País Origen',
  segmentacion:          'Segmentación',
  idKam:                 'ID KAM',
  motivoCompra:          'Motivo de compra',
  contactoActual:        'Nombre contacto actual',
  areaContacto:          'área',
  correoContacto:        'Correo contacto actual',
  // — Perfil de la empresa (alimenta la ficha) —
  paginaWeb:             'paginaWeb',
  paisesConPresencia:    'paisesConPresencia',
  oportunidadChile:      'OportunidadChile',
  oportunidadColombia:   'OportunidadColombia',
  oportunidadPeru:       'OportunidadPerú',
  oportunidadMexico:     'OportunidadMéxico',
  oportunidadEcuador:    'OportunidadEcuador',
  totalOpp:              'Total Opp',
  facturacion12m:        'Facturación últimos 12 meses',
  usuariosIncentivados:  'N° usuarios incentivados',
  abonosTotales:         'N° de abonos totales',
  usuariosEmpleados:     'N° usuarios empleados',
  usuariosComisionistas: 'N° usuarios comisionistas',
  usuariosClientes:      'N° usuarios clientes',
  // — Farming —
  whatsappCall:          'Whatsapp/Call',
  envioSecuencia:        'Envío secuencia',
  noAplica:              'No aplica',
  enGestionActiva:       'En gestión activa',
  sponsors:              'Sponsors validados',
  nombreSponsor:         'Nombre sponsor validado',
  correoSponsor:         'Correo sponsor validado',
  areaSponsor:           'área sponsor validado',
  aHunting:              'A hunting',
  notas:                 'Notas',
  fechaInicio:           'Fecha inicio',
  fechaFin:              'Fecha fin',
  // — Hunting, etapa 1: derivación —
  paisDestino:           'País destino',
  comercialDestino:      'Comercial destino',
  idKamBdm:              'ID KAM/BDM',
  enGestionReunion:      'En gestión/Reunión',
  noAplicaProspeccion:   'No aplica en prospección',
  cierreGanado:          'Cierre ganado/venta',
  // — Hunting, etapa 2: prospección —
  contactosHunting:      'Contactos a Hunting',
  nuevosContactos:       'Nuevos contactos',
  envioSecuenciaHunting: 'Envío de secuencia',
  whatsappHunting:       'whatsapp',
  empresasEnGestion:     'Empresas en gestión',
  seguimiento:           'Seguimiento/Notas',
} as const;

type ClaveCBS = keyof typeof COL;

/** Campos que se leen como número (banderas 1/0 y contadores). */
const NUMERICOS = new Set<ClaveCBS>([
  'whatsappCall', 'envioSecuencia', 'noAplica', 'enGestionActiva', 'sponsors', 'aHunting',
  'enGestionReunion', 'noAplicaProspeccion', 'cierreGanado',
  'contactosHunting', 'nuevosContactos', 'envioSecuenciaHunting', 'whatsappHunting',
  'empresasEnGestion',
  'totalOpp', 'facturacion12m', 'usuariosIncentivados', 'abonosTotales',
  'usuariosEmpleados', 'usuariosComisionistas', 'usuariosClientes',
]);

export interface FilaCBS {
  // Texto
  idEmpresa: string; nombreEmpresa: string; razonSocial: string; paisOrigen: string;
  segmentacion: string; idKam: string; motivoCompra: string; contactoActual: string;
  areaContacto: string; correoContacto: string; nombreSponsor: string; correoSponsor: string;
  areaSponsor: string; notas: string; fechaInicio: string; fechaFin: string;
  paisDestino: string; comercialDestino: string; idKamBdm: string; seguimiento: string;
  paginaWeb: string; paisesConPresencia: string;
  oportunidadChile: string; oportunidadColombia: string; oportunidadPeru: string;
  oportunidadMexico: string; oportunidadEcuador: string;
  // Números
  whatsappCall: number; envioSecuencia: number; noAplica: number; enGestionActiva: number;
  sponsors: number; aHunting: number; enGestionReunion: number; noAplicaProspeccion: number;
  cierreGanado: number; contactosHunting: number; nuevosContactos: number;
  envioSecuenciaHunting: number; whatsappHunting: number; empresasEnGestion: number;
  totalOpp: number; facturacion12m: number; usuariosIncentivados: number;
  abonosTotales: number; usuariosEmpleados: number; usuariosComisionistas: number;
  usuariosClientes: number;
}

/** La hoja escribe los decimales con coma; las banderas son enteros planos. */
function num(v: unknown): number {
  const n = parseFloat(String(v ?? '').trim().replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function txt(v: unknown): string {
  return String(v ?? '').trim();
}

/** Normaliza los `Sí`/`Si`/`sí` que conviven en la misma columna. */
export function esSi(v: string): boolean {
  return /^s[íi]$/i.test(txt(v));
}

export interface DatosCBS {
  filas: FilaCBS[];
  /** Cabeceras esperadas que ya no están en la hoja. Vacío = todo mapeó bien. */
  faltantes: string[];
}

/**
 * Pasa la tabla cruda a filas tipadas. Pura y exportada a propósito: así los
 * KPIs se pueden verificar contra la hoja real sin montar React.
 */
export function parseFilasCBS(headers: string[], filas: string[][]): DatosCBS {
  const idx: Partial<Record<ClaveCBS, number>> = {};
  const faltantes: string[] = [];
  (Object.keys(COL) as ClaveCBS[]).forEach((k) => {
    const i = headers.indexOf(COL[k]);
    if (i === -1) faltantes.push(COL[k]);
    else idx[k] = i;
  });

  const parseadas = filas
    // Una fila cuenta como registro si tiene ID o nombre: la hoja arrastra
    // filas vacías al final del rango pedido.
    .filter((r) => txt(r[idx.idEmpresa ?? 0]) !== '' || txt(r[idx.nombreEmpresa ?? 1]) !== '')
    .map((r) => {
      const o = {} as Record<string, string | number>;
      (Object.keys(COL) as ClaveCBS[]).forEach((k) => {
        const i = idx[k];
        const bruto = i === undefined ? '' : r[i];
        o[k] = NUMERICOS.has(k) ? num(bruto) : txt(bruto);
      });
      // `o` se arma clave por clave sobre COL, que es exactamente el shape de
      // FilaCBS; TypeScript no puede probarlo desde un Record genérico.
      return o as unknown as FilaCBS;
    });

  return { filas: parseadas, faltantes };
}

// ── Agregados ─────────────────────────────────────────────────────────────────
// Funciones puras: los tabs las llaman sobre las filas ya filtradas.

const suma = (filas: FilaCBS[], k: ClaveCBS) =>
  filas.reduce((a, f) => a + num(f[k as keyof FilaCBS]), 0);

function agrupar(filas: FilaCBS[], clave: (f: FilaCBS) => string): Map<string, FilaCBS[]> {
  const mapa = new Map<string, FilaCBS[]>();
  filas.forEach((f) => {
    const k = clave(f);
    const acc = mapa.get(k);
    if (acc) acc.push(f);
    else mapa.set(k, [f]);
  });
  return mapa;
}

/**
 * "Oportunidades" NO es el número de filas.
 *
 * Looker Studio cuenta razones sociales distintas: 287 filas dan 262
 * oportunidades porque una misma empresa aparece varias veces (una fila por
 * país de origen desde el que se la trabaja). Verificado el 2026-08-25 contra
 * los cuatro KPIs y los cuatro denominadores por tier del tablero original.
 */
export function cuentaOportunidades(filas: FilaCBS[]): number {
  return new Set(filas.map((f) => f.razonSocial).filter(Boolean)).size;
}

export interface ResumenFarming {
  oportunidades: number;
  avance: number;
  enGestionActiva: number;
  sponsors: number;
  aHunting: number;
}

export function resumenFarming(filas: FilaCBS[]): ResumenFarming {
  const oportunidades = cuentaOportunidades(filas);
  const sponsors = suma(filas, 'sponsors');
  return {
    oportunidades,
    avance: oportunidades ? sponsors / oportunidades : 0,
    enGestionActiva: suma(filas, 'enGestionActiva'),
    sponsors,
    aHunting: suma(filas, 'aHunting'),
  };
}

export interface EstadoLeads {
  pais: string;
  whatsappCall: number;
  envioSecuencia: number;
  noAplica: number;
  sponsors: number;
  total: number;
}

/** Barra apilada de "Estado actual de gestión de leads", una por país de origen. */
export function estadoLeadsPorPais(filas: FilaCBS[]): EstadoLeads[] {
  return [...agrupar(filas, (f) => f.paisOrigen || '—').entries()]
    .map(([pais, fs]) => {
      const e = {
        pais,
        whatsappCall:   suma(fs, 'whatsappCall'),
        envioSecuencia: suma(fs, 'envioSecuencia'),
        noAplica:       suma(fs, 'noAplica'),
        sponsors:       suma(fs, 'sponsors'),
      };
      return { ...e, total: e.whatsappCall + e.envioSecuencia + e.noAplica + e.sponsors };
    })
    .sort((a, b) => b.total - a.total);
}

export interface AvancePorTier {
  tier: string;
  sponsors: number;
  oportunidades: number;
  avance: number;
}

/** El denominador es distinct Razón Social DENTRO del tier, no el conteo de filas. */
export function avancePorTier(filas: FilaCBS[]): AvancePorTier[] {
  const ORDEN = ['Tier A+', 'Tier A', 'Tier B', 'Tier C'];
  return [...agrupar(filas, (f) => f.segmentacion || 'Sin tier').entries()]
    .map(([tier, fs]) => {
      const sponsors = suma(fs, 'sponsors');
      const oportunidades = cuentaOportunidades(fs);
      return { tier, sponsors, oportunidades, avance: oportunidades ? sponsors / oportunidades : 0 };
    })
    .sort((a, b) => {
      const ia = ORDEN.indexOf(a.tier), ib = ORDEN.indexOf(b.tier);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
}

export interface SponsorsPorPais { pais: string; sponsors: number }

export function sponsorsPorPaisDestino(filas: FilaCBS[]): SponsorsPorPais[] {
  const mapa = new Map<string, number>();
  filas.forEach((f) => {
    const k = f.paisDestino || '—';
    mapa.set(k, (mapa.get(k) ?? 0) + num(f.sponsors));
  });
  return [...mapa.entries()]
    .map(([pais, sponsors]) => ({ pais, sponsors }))
    .filter((x) => x.pais !== '—' || x.sponsors > 0)
    .sort((a, b) => b.sponsors - a.sponsors);
}

export interface ResumenHunting {
  // Etapa 1 · derivación
  sponsors: number;
  pasaronBdm: number;
  pasaronKam: number;
  enGestionReunion: number;
  noAplicaProspeccion: number;
  cierreGanado: number;
  // Etapa 2 · prospección
  aHunting: number;
  empresasEnGestion: number;
  nuevosContactos: number;
}

export function resumenHunting(filas: FilaCBS[]): ResumenHunting {
  const destino = (v: string) => filas.filter((f) => f.comercialDestino.toUpperCase() === v).length;
  return {
    sponsors:            suma(filas, 'sponsors'),
    pasaronBdm:          destino('BDM'),
    pasaronKam:          destino('KAM'),
    // Suma y no conteo: la columna trae 1 y 0, así que 24 celdas llenas valen 19.
    enGestionReunion:    suma(filas, 'enGestionReunion'),
    noAplicaProspeccion: suma(filas, 'noAplicaProspeccion'),
    cierreGanado:        suma(filas, 'cierreGanado'),
    aHunting:            suma(filas, 'aHunting'),
    // La columna que alimenta este KPI es 'Contactos a Hunting' (12), NO la que
    // se llama 'Empresas en gestión' (43): así estaba en el tablero original.
    empresasEnGestion:   suma(filas, 'contactosHunting'),
    nuevosContactos:     suma(filas, 'nuevosContactos'),
  };
}

/** Valores únicos de una columna de texto, ordenados, para los selectores. */
export function opcionesDe(filas: FilaCBS[], k: ClaveCBS): string[] {
  return [...new Set(filas.map((f) => txt(f[k as keyof FilaCBS])).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'es'));
}

// ── Valor en USD ──────────────────────────────────────────────────────────────

/**
 * Tipo de cambio a USD, por país de origen de la cuenta.
 *
 * La columna `Facturación últimos 12 meses` viene en MONEDA LOCAL y mezclada:
 * la mediana de Chile son 8,6 millones (CLP) y la de Perú 7.000 (PEN). Sumarlas
 * sin convertir no significa nada.
 *
 * Estos valores NO son inventados ni traídos de una API: son los que la propia
 * empresa ya tiene aplicados en `MONTO_USD`, derivados el 2026-08-25 de 22.717
 * facturas reales de los últimos 12 meses:
 *
 *   SELECT Pais, SUM(MONTO_LOCAL)/SUM(MONTO_USD)
 *   FROM `apprecio-peru.Ventas_Apprecio.Tabla_Analisis_Clientes`
 *   WHERE FECHA >= DATE_SUB(CURRENT_DATE(), INTERVAL 12 MONTH)
 *
 * Usar el mismo tipo importa: así el "USD en juego" de CBS es comparable con
 * cualquier otra cifra del panel en vez de ser una moneda paralela.
 */
export const TC_USD: Record<string, number> = {
  chile: 950, colombia: 4000, peru: 3.4, mexico: 18,
};

const sinTildes = (p: string) =>
  p.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Facturación 12m de la cuenta en USD. 0 si el país no tiene tipo conocido. */
export function usdDe(f: FilaCBS): number {
  const tc = TC_USD[sinTildes(f.paisOrigen)];
  return tc ? f.facturacion12m / tc : 0;
}

export const sumaUSD = (filas: FilaCBS[]) => filas.reduce((a, f) => a + usdDe(f), 0);

// ── Estado de la cuenta ───────────────────────────────────────────────────────

export type EstadoCBS = 'sponsor' | 'gestion' | 'hunting' | 'descartada' | 'sin_tocar';

/**
 * Estado único de la cuenta, por precedencia.
 *
 * La hoja marca cada etapa en su propia columna, así que una fila puede tener
 * varias banderas y los conteos sueltos se pisan. Verificado el 2026-08-25: con
 * esta precedencia los cinco estados son mutuamente excluyentes y suman las 287
 * filas exactas. El solapamiento real es mínimo (sponsor∩hunting = 0,
 * sponsor∩descartada = 1), así que el orden casi no decide nada — pero deja de
 * ser ambiguo.
 */
export function estadoDe(f: FilaCBS): EstadoCBS {
  if (f.sponsors > 0)        return 'sponsor';
  if (f.enGestionActiva > 0) return 'gestion';
  if (f.aHunting > 0)        return 'hunting';
  if (f.noAplica > 0)        return 'descartada';
  return 'sin_tocar';
}

export const ESTADO_META: Record<EstadoCBS, { label: string; color: string; ayuda: string }> = {
  sponsor:    { label: 'Sponsor validado', color: '#16A34A', ayuda: 'Hay un decisor confirmado del lado del cliente' },
  gestion:    { label: 'En gestión',       color: '#0097A7', ayuda: 'Conversación abierta, todavía sin sponsor' },
  hunting:    { label: 'A hunting',        color: '#F59E0B', ayuda: 'Sin sponsor tras el deadline: pasa a prospección del BDM' },
  descartada: { label: 'Descartada',       color: '#94A3B8', ayuda: 'No aplica o el cliente no quiere' },
  sin_tocar:  { label: 'Sin tocar',        color: '#E11D48', ayuda: 'Ninguna marca de gestión: nadie la trabajó todavía' },
};

/** Orden de lectura: primero lo ganado, al final lo que reclama acción. */
export const ORDEN_ESTADOS: EstadoCBS[] = ['sponsor', 'gestion', 'hunting', 'descartada', 'sin_tocar'];

export interface TramoEstado { estado: EstadoCBS; cuentas: number; usd: number }

export function distribucionEstados(filas: FilaCBS[]): TramoEstado[] {
  return ORDEN_ESTADOS.map((estado) => {
    const f = filas.filter((x) => estadoDe(x) === estado);
    return { estado, cuentas: f.length, usd: sumaUSD(f) };
  });
}

// ── Embudo de conversión ──────────────────────────────────────────────────────

export interface EtapaEmbudo {
  id: string;
  label: string;
  cuentas: number;
  usd: number;
  /** Conversión respecto de la etapa anterior. `null` en la primera. */
  conversion: number | null;
  ayuda: string;
}

/**
 * Rama ganadora del proceso, sin solapamientos.
 *
 * Verificado el 2026-08-25: los 4 cierres y las 19 reuniones son TODOS cuentas
 * con sponsor validado, así que cada etapa es un subconjunto de la anterior y
 * los porcentajes de conversión significan lo que parecen.
 *
 * "Oportunidades" es distinct razón social (262), no filas (287) — ver
 * `cuentaOportunidades`. Las demás etapas se cuentan por fila porque cada fila
 * es una gestión: la misma empresa trabajada desde dos países son dos gestiones.
 */
export function embudoConversion(filas: FilaCBS[]): EtapaEmbudo[] {
  const conSponsor = filas.filter((f) => f.sponsors > 0);
  const enReunion  = filas.filter((f) => f.enGestionReunion > 0);
  const cerradas   = filas.filter((f) => f.cierreGanado > 0);

  const universo = cuentaOportunidades(filas);
  const etapas: Omit<EtapaEmbudo, 'conversion'>[] = [
    { id: 'universo', label: 'Oportunidades', cuentas: universo,            usd: sumaUSD(filas),       ayuda: 'Razones sociales únicas en la base' },
    { id: 'sponsor',  label: 'Sponsor validado', cuentas: conSponsor.length, usd: sumaUSD(conSponsor), ayuda: 'Decisor confirmado del lado del cliente' },
    { id: 'reunion',  label: 'En reunión',    cuentas: enReunion.length,     usd: sumaUSD(enReunion),  ayuda: 'Ya hay conversación con el KAM o BDM de destino' },
    { id: 'cierre',   label: 'Cierre ganado', cuentas: cerradas.length,      usd: sumaUSD(cerradas),   ayuda: 'Venta concretada en el país de destino' },
  ];

  return etapas.map((e, i) => ({
    ...e,
    conversion: i === 0 ? null : (etapas[i - 1].cuentas ? e.cuentas / etapas[i - 1].cuentas : 0),
  }));
}

// ── Ranking de ejecutivos ─────────────────────────────────────────────────────

export interface FilaRanking {
  nombre: string;
  cuentas: number;
  usd: number;
  sponsors: number;
  avance: number;
  sinTocar: number;
  aHunting: number;
  usdSinTocar: number;
}

/**
 * Avance por ejecutivo. `campo` es 'idKam' en Farming y 'idKamBdm' en Hunting.
 *
 * Es la vista que el tablero original no tenía —ahí el KAM era solo un filtro— y
 * es donde aparece lo accionable: al 2026-08-25 hay cuatro KAMs con 66 cuentas
 * entre todos y cero sponsors.
 */
export function rankingEjecutivos(filas: FilaCBS[], campo: 'idKam' | 'idKamBdm'): FilaRanking[] {
  return [...agrupar(filas.filter((f) => f[campo] !== ''), (f) => f[campo]).entries()]
    .map(([nombre, fs]) => {
      const sinTocar = fs.filter((f) => estadoDe(f) === 'sin_tocar');
      return {
        nombre,
        cuentas:  fs.length,
        usd:      sumaUSD(fs),
        sponsors: suma(fs, 'sponsors'),
        avance:   fs.length ? suma(fs, 'sponsors') / fs.length : 0,
        sinTocar: sinTocar.length,
        aHunting: suma(fs, 'aHunting'),
        usdSinTocar: sumaUSD(sinTocar),
      };
    })
    .sort((a, b) => b.usd - a.usd);
}

// ── Ventana del proyecto ──────────────────────────────────────────────────────

export interface VentanaProyecto {
  /** Fecha fin más tardía de las filas visibles, en ISO. `null` si no se pudo leer. */
  finISO: string | null;
  /** Positivo = quedan días; negativo = venció hace tantos días. */
  diasRestantes: number | null;
  vencida: boolean;
}

/** La hoja escribe `d/mm/aaaa`. `new Date(...)` de eso es ambiguo, así que se parte a mano. */
function parseFechaHoja(v: string): Date | null {
  const m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Estado de la ventana de trabajo, leído de la hoja y NO cableado en código.
 *
 * Al 2026-08-25 todas las `Fecha fin` son de abril 2026, así que devuelve
 * "vencida" y la vista lo muestra como un aviso para que actualicen la hoja. En
 * cuanto corrijan las fechas, el mismo componente pasa solo a cuenta regresiva:
 * no hay una fecha inventada que después haya que recordar cambiar.
 */
export function ventanaProyecto(filas: FilaCBS[], hoy = new Date()): VentanaProyecto {
  const fechas = filas.map((f) => parseFechaHoja(f.fechaFin)).filter((d): d is Date => d !== null);
  if (!fechas.length) return { finISO: null, diasRestantes: null, vencida: false };

  const fin = new Date(Math.max(...fechas.map((d) => d.getTime())));
  // Se compara por fecha de calendario, no por instante: con la hora incluida el
  // número cambia durante el día con la misma data (misma lección que en IPC).
  const truncar = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const dias = Math.round((truncar(fin) - truncar(hoy)) / 86400000);

  return {
    finISO: `${fin.getFullYear()}-${String(fin.getMonth() + 1).padStart(2, '0')}-${String(fin.getDate()).padStart(2, '0')}`,
    diasRestantes: dias,
    vencida: dias < 0,
  };
}

// ── Formato ───────────────────────────────────────────────────────────────────

/** USD compacto para tarjetas y barras: 8,3 M · 973 K · 512. */
export function fmtUSDCorto(v: number): string {
  if (v >= 1_000_000) return `USD ${(v / 1_000_000).toFixed(1).replace('.', ',')} M`;
  if (v >= 1_000)     return `USD ${Math.round(v / 1_000)} K`;
  return `USD ${Math.round(v)}`;
}

/** USD exacto, para la ficha y los tooltips. */
export function fmtUSDExacto(v: number): string {
  return `USD ${Math.round(v).toLocaleString('es-PE')}`;
}

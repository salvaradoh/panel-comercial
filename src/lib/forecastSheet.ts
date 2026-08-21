const FORECAST_SHEET_ID = '1MmRSNiMOKyz5ZHDzC_qrj1hF00edgOmtRvPBEiKtJVY';

const MESES: Record<string, number> = {
  Enero: 1, Febrero: 2, Marzo: 3, Abril: 4, Mayo: 5, Junio: 6,
  Julio: 7, Agosto: 8, Septiembre: 9, Octubre: 10, Noviembre: 11, Diciembre: 12,
};

const RATES: Record<string, number> = { CLP: 950, COP: 4000, PEN: 3.4, MXN: 18, USD: 1 };

/**
 * Compara nombres de ejecutivo entre hojas distintas. No alcanza con comparar
 * texto ni con quitar acentos: la hoja de Forecast escribe "Santiago Cuellar
 * Rivera" donde el roster dice "Santiago Cuellar", y "Aura Avila" donde dice
 * "Aura María Ávila". Se compara por subconjunto de tokens — todos los tokens
 * del nombre más corto tienen que estar en el más largo.
 *
 * Se descartan las iniciales de una sola letra: Cache_Reporte guarda
 * "Aura M. Ávila" y el roster "Aura María Ávila", y esa "M" suelta no aparece
 * en el otro nombre, así que sin quitarla el match fallaba.
 *
 * Verificado contra los datos reales en las dos direcciones: 17 de 17 contra la
 * hoja de Forecast y 17 de 17 contra los nombres canónicos de KAM_NOMBRES, sin
 * ambigüedades en ninguna.
 */
function tokens(nombre: string): string[] {
  return String(nombre || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1);
}

export function mismoEjecutivo(a: string, b: string): boolean {
  const ta = tokens(a), tb = tokens(b);
  if (ta.length === 0 || tb.length === 0) return false;
  const [chico, grande] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  const set = new Set(grande);
  return chico.every(t => set.has(t));
}

export interface ForecastEntry {
  anio: number;
  mes: number;
  pais: string;
  ganado_usd: number;
  abierto_usd: number;
  deals_ganados: number;
  deals_abiertos: number;
}

async function fetchRows(token: string): Promise<unknown[][]> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${FORECAST_SHEET_ID}/values/Forecast!A2:I5000?valueRenderOption=UNFORMATTED_VALUE`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Sheets Forecast API ${res.status}`);
  const json = await res.json();
  return json.values || [];
}

/**
 * Forecast agregado por (año, mes, país). Se mantiene tal cual porque
 * useForecast y useForecastAnual buscan con `.find` sobre esta clave: agregarle
 * el ejecutivo haría que devolvieran solo la primera fila de cada país.
 */
export async function loadForecastSheet(token: string): Promise<ForecastEntry[]> {
  const rows = await fetchRows(token);

  const map = new Map<string, ForecastEntry>();

  for (const row of rows) {
    const anio   = Number(row[0]);
    const mesNum = MESES[String(row[1] || '').trim()] || 0;
    const pais   = String(row[2] || '').trim();
    const estado = String(row[5] || '').trim();
    const moneda = String(row[6] || '').trim();
    const deals  = Number(row[7]) || 0;
    const monto  = parseFloat(String(row[8] || '').replace(',', '.')) || 0;

    if (!anio || !mesNum || pais.includes(';')) continue;
    if (estado !== 'Ganado' && estado !== 'Abierto') continue;

    const key = `${anio}-${mesNum}-${pais}`;
    if (!map.has(key)) {
      map.set(key, { anio, mes: mesNum, pais, ganado_usd: 0, abierto_usd: 0, deals_ganados: 0, deals_abiertos: 0 });
    }

    const entry = map.get(key)!;
    const usd = monto / (RATES[moneda] || 1);

    if (estado === 'Ganado') {
      entry.ganado_usd    += usd;
      entry.deals_ganados += deals;
    } else {
      entry.abierto_usd    += usd;
      entry.deals_abiertos += deals;
    }
  }

  return Array.from(map.values());
}

export interface ForecastEjecutivo {
  anio: number;
  mes: number;
  ejecutivo: string;
  pais: string;
  ganado_usd: number;
  abierto_usd: number;
}

/** Mismo dato, agregado por (año, mes, ejecutivo) — col D de la hoja. */
export async function loadForecastPorEjecutivo(token: string): Promise<ForecastEjecutivo[]> {
  const rows = await fetchRows(token);
  const map = new Map<string, ForecastEjecutivo>();

  for (const row of rows) {
    const anio      = Number(row[0]);
    const mes       = MESES[String(row[1] || '').trim()] || 0;
    const pais      = String(row[2] || '').trim();
    const ejecutivo = String(row[3] || '').trim();
    const estado    = String(row[5] || '').trim();
    const moneda    = String(row[6] || '').trim();
    const monto     = parseFloat(String(row[8] || '').replace(',', '.')) || 0;

    if (!anio || !mes || !ejecutivo || pais.includes(';')) continue;
    // "Sin asignar" no es una persona; no debe sumarse a nadie.
    if (ejecutivo.toLowerCase() === 'sin asignar') continue;
    if (estado !== 'Ganado' && estado !== 'Abierto') continue;

    const key = `${anio}-${mes}-${ejecutivo}`;
    if (!map.has(key)) {
      map.set(key, { anio, mes, ejecutivo, pais, ganado_usd: 0, abierto_usd: 0 });
    }
    const e = map.get(key)!;
    const usd = monto / (RATES[moneda] || 1);
    if (estado === 'Ganado') e.ganado_usd += usd;
    else                     e.abierto_usd += usd;
  }

  return Array.from(map.values());
}

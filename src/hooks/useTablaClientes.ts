import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';

const SHEET_ID = '1bkYaUeqtm2X-fQFQCOR5b8XgWaIOXKWDSb73X9E9MaM';

// Columnas del sheet (índice 0):
// 0=País, 1=PanelID, 2=IDTributario, 3=Nombre, 4=KAM, 5=Tipo, 6=Status, 7=Segmento,
// 8=ScoreRENT, 9=ScoreVENT, 10=ProbRiesgo, 11=TipoPrediccion,
// 12=Monto6mAnt, 13=Monto6mAct, 14=DiasSinCompra, 15=TBP, 16=UltimaCompra,
// 17=FRec, 18=FEng, 19=NPS, 20=FTen, 21=FVig, 22=TotalFacturas, 23=Anos, 24=Meses12m,
// 25=%SaaS, 26=%GiftCard, 27=%Puntos, 28=%SuperCard, 29=%Marketplace,
// 30=FechaAlta, 31=BQActualizado, 32=Industria  (col AG), 33=Dotación USD (col AH)
//
// OJO: el rango del fetch tiene que crecer con la hoja. Estaba en A:AG —justo
// hasta Industria— así que la columna 33 llegaba siempre undefined y el filtro de
// dotación no se activaba nunca. Al agregar una columna hay que mover el rango.
//
// UNFORMATTED_VALUE no es opcional: con FORMATTED_VALUE el locale español
// devuelve los decimales con coma ("22547,5") y Number() da NaN.
//
// Score RENT (8) y Score VENT (9) son excluyentes, no dos scores del mismo
// cliente: los recurrentes puntúan con RENT (factores R/E/T) y los estacionales
// con VENT (factores V/E/T). Por eso cada columna aparece llena en ~la mitad
// de la cartera; no son datos faltantes.

export type TipoCliente = 'estacional' | 'primera_compra' | 'recurrente' | 'perdido_historico';
export type SegmentoCliente = 'A+' | 'A' | 'B' | 'C';

export interface ClienteTabla {
  pais: string;
  panelId: string;
  idTributario: string;
  nombre: string;
  kam: string;
  tipo: TipoCliente;
  status: string;
  segmento: SegmentoCliente;
  scoreEng: number;
  scoreEst: number;
  monto6mAnt: number;
  monto6mAct: number;
  diasSinCompra: number;
  ultimaCompra: string;
  fRec: number;
  fEng: number;
  fTen: number;
  fVig: number;
  totalFacturas: number;
  anos: number;
  fechaAlta: string;  // DD/MM/YYYY — col AE
  // Añadidos para el Comparador
  meses12m: number;
  tbpDias: number;
  probRiesgo: number | null;   // modelo ML — presente en ~42% de la cartera
  tipoPrediccion: string;
  industria: string;
  /** USD facturado en productos de dotación. Hoy solo Colombia; 0 en el resto. */
  usdDotacion: number;
  pctSaas: number;
  pctGiftcard: number;
  pctPuntos: number;
  pctSupercard: number;
  pctMarketplace: number;
}

/** Celda numérica que puede venir vacía: null en vez de 0, para no graficar un dato que no existe. */
function parseNumOrNull(v: unknown): number | null {
  if (v == null || v === '' || v === '-') return null;
  const n = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function parseNum(v: unknown): number {
  if (v == null || v === '' || v === '-') return 0;
  return parseFloat(String(v).replace(',', '.')) || 0;
}

// Google Sheets UNFORMATTED_VALUE returns date cells as Excel serial numbers.
// This converts to "DD/MM/YYYY" so fmtFecha can parse it.
function parseDate(v: unknown): string {
  if (v == null || v === '') return '';
  if (typeof v === 'number') {
    const d = new Date((v - 25569) * 86400 * 1000);
    const dd = d.getUTCDate().toString().padStart(2, '0');
    const mm = (d.getUTCMonth() + 1).toString().padStart(2, '0');
    return `${dd}/${mm}/${d.getUTCFullYear()}`;
  }
  return String(v);
}

function parseRow(r: string[]): ClienteTabla | null {
  if (!r[0] || r[0] === 'País') return null;  // skip header or empty
  const tipo = r[5] as TipoCliente;
  const segmento = r[7] as SegmentoCliente;
  if (!['estacional', 'primera_compra', 'recurrente', 'perdido_historico'].includes(tipo)) return null;

  const kam = r[4] || '';
  return {
    pais: r[0] || '',
    panelId: r[1] || '',
    idTributario: r[2] || '',
    nombre: r[3] || r[2] || '',   // nombre o fallback a ID Tributario
    kam: (kam === '#N/A' || kam === '-') ? '' : kam,
    tipo,
    status: r[6] || '',
    segmento: ['A+', 'A', 'B', 'C'].includes(segmento) ? segmento : 'B',
    scoreEng: parseNum(r[8]),
    scoreEst: parseNum(r[9]),
    monto6mAnt: parseNum(r[12]),
    monto6mAct: parseNum(r[13]),
    diasSinCompra: parseNum(r[14]),
    ultimaCompra: parseDate(r[16]),
    fRec: parseNum(r[17]),
    fEng: parseNum(r[18]),
    fTen: parseNum(r[20]),
    fVig: parseNum(r[21]),
    totalFacturas: parseNum(r[22]),
    anos:          parseNum(r[23]),
    fechaAlta:     parseDate(r[30]),  // col AE
    meses12m:       parseNum(r[24]),
    tbpDias:        parseNum(r[15]),
    probRiesgo:     parseNumOrNull(r[10]),
    tipoPrediccion: String(r[11] ?? ''),
    industria:      String(r[32] ?? ''),
    usdDotacion:    Number(r[33]) || 0,
    pctSaas:        parseNum(r[25]),
    pctGiftcard:    parseNum(r[26]),
    pctPuntos:      parseNum(r[27]),
    pctSupercard:   parseNum(r[28]),
    pctMarketplace: parseNum(r[29]),
  };
}

export function useTablaClientes() {
  const { token } = useAuth();

  return useQuery<ClienteTabla[]>({
    queryKey: ['tabla-clientes'],
    queryFn: async () => {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/A:AH?valueRenderOption=UNFORMATTED_VALUE`;
      const resp = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) {
        const body = await resp.text();
        throw new Error(`Sheets API ${resp.status}: ${body.slice(0, 200)}`);
      }
      const json = await resp.json();
      const rows: string[][] = json.values || [];
      return rows.slice(1).map(parseRow).filter((r): r is ClienteTabla => r !== null);
    },
    enabled: !!token,
    staleTime: 15 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 1,
  });
}

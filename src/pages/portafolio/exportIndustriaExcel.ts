import type { ClienteTabla, TipoCliente } from '../../hooks/useTablaClientes';

interface CeldaResumen { count: number; usd: number }

export interface ResumenExport {
  columnas: string[];
  labelDe: (col: string) => string;
  matriz: Map<string, Map<string, CeldaResumen>>;
  industrias: string[];
  metrica: 'cuentas' | 'usd';
  periodoLabel: string;
  contexto: string;
}

interface DescargarExcelParams {
  todos: ClienteTabla[];
  aniosDisponibles: string[];
  usdDelAnio: (pais: string, panelId: string, anio: string) => number;
  resumen: ResumenExport;
}

const TIPOS_DETALLE: TipoCliente[] = ['recurrente', 'estacional', 'primera_compra'];

/**
 * Genera y descarga el Excel de Industria por País: una hoja "Resumen" (la
 * misma vista que está en pantalla) y una hoja "Detalle" con TODA la cartera
 * clasificada (recurrente+estacional+primera_compra, sin el filtro de tipo
 * de la pantalla) para que se pueda armar cualquier tabla dinámica —
 * confirmado con Samuel: el detalle va sin filtro a propósito.
 *
 * exceljs se importa dinámicamente: es una librería pesada (~1MB) que solo
 * hace falta cuando alguien de verdad hace clic en "Descargar Excel", no en
 * la carga inicial del tab.
 */
export async function descargarExcelIndustria({ todos, aniosDisponibles, usdDelAnio, resumen }: DescargarExcelParams) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Panel Comercial Apprecio';
  wb.created = new Date();

  // ── Resumen: la misma vista que está en pantalla ──────────────────────
  const wsResumen = wb.addWorksheet('Resumen');
  wsResumen.addRow(['Vista activa:', resumen.contexto]);
  wsResumen.addRow(['Métrica:', resumen.metrica === 'usd' ? `Facturación ${resumen.periodoLabel}` : 'Cuentas']);
  wsResumen.addRow([]);

  const headerResumen = wsResumen.addRow(['Industria', ...resumen.columnas.map(resumen.labelDe), 'Total']);
  headerResumen.font = { bold: true };

  resumen.industrias.forEach(ind => {
    const fila = resumen.matriz.get(ind);
    const valores = resumen.columnas.map(col => {
      const cel = fila?.get(col);
      return resumen.metrica === 'usd' ? (cel?.usd ?? 0) : (cel?.count ?? 0);
    });
    const total = valores.reduce((s, v) => s + v, 0);
    wsResumen.addRow([ind, ...valores, total]);
  });
  wsResumen.columns.forEach((col, i) => { col.width = i === 0 ? 42 : 16; });
  if (resumen.metrica === 'usd') {
    wsResumen.getColumn(1).numFmt = undefined;
    for (let i = 2; i <= resumen.columnas.length + 2; i++) wsResumen.getColumn(i).numFmt = '#,##0';
  }

  // ── Detalle: cartera completa clasificada, sin filtro ─────────────────
  const wsDetalle = wb.addWorksheet('Detalle');
  const headerDetalle = wsDetalle.addRow([
    'País', 'Industria', 'Tipo', 'Nombre', 'Panel ID', 'KAM', 'Segmento',
    'USD 12m', ...aniosDisponibles.map(a => `USD ${a}`),
  ]);
  headerDetalle.font = { bold: true };
  wsDetalle.views = [{ state: 'frozen', ySplit: 1 }];
  wsDetalle.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 8 + aniosDisponibles.length } };

  todos
    .filter(c => TIPOS_DETALLE.includes(c.tipo))
    .forEach(c => {
      const id = c.panelId || c.idTributario;
      wsDetalle.addRow([
        c.pais,
        c.industria || 'Sin clasificar',
        c.tipo,
        c.nombre,
        id,
        c.kam || 'Sin ejecutivo',
        c.segmento,
        c.monto6mAct + c.monto6mAnt,
        ...aniosDisponibles.map(a => usdDelAnio(c.pais, id, a)),
      ]);
    });

  wsDetalle.columns.forEach((col, i) => {
    col.width = [10, 42, 15, 38, 14, 20, 10][i] ?? 14;
  });
  for (let i = 8; i <= 8 + aniosDisponibles.length; i++) wsDetalle.getColumn(i).numFmt = '#,##0';

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Industria_por_Pais_${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

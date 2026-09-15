import type {
  ChurnQPais, ClienteChurnQ, MovimientoBase,
} from '../../hooks/useMovimientos';

/**
 * Excel del churn trimestral: tres hojas.
 *
 *   Resumen por trimestre  la matriz que está en pantalla —churn por país— más
 *                          la variación contra el trimestre anterior y el
 *                          movimiento de la base (salieron / entraron)
 *   Clientes perdidos      una fila por empresa contada como churn
 *   Altas y bajas          una fila por empresa que entró o salió de la base
 *
 * Las tres van juntas porque responden la misma pregunta en tres niveles: cuánto
 * cambió, quiénes se perdieron y quiénes entraron o salieron del denominador. En
 * archivos separados hay que cruzarlas a mano para llegar a lo mismo.
 *
 * exceljs se importa dinámicamente (~1MB): solo hace falta cuando alguien hace
 * clic, no en la carga del tab.
 */
export async function descargarExcelChurnQ(
  celdas: ChurnQPais[],
  clientes: ClienteChurnQ[],
  movimientos: MovimientoBase[],
  paises: string[],
  archivo: string,
) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Panel Comercial Apprecio';
  wb.created = new Date();

  const trimestres = [...new Set(celdas.map(c => c.trimestreId))].sort();
  const buscar = (tid: string, pais: string) =>
    celdas.find(c => c.trimestreId === tid && c.pais === pais) ?? null;
  const sumaQ = (tid: string, campo: 'churn' | 'cartera') =>
    paises.reduce((a, p) => a + (buscar(tid, p)?.[campo] ?? 0), 0);

  // ── Hoja 1: resumen por trimestre ──────────────────────────────────────────
  const ws = wb.addWorksheet('Resumen por trimestre');
  ws.addRow(['Churn trimestral — resumen']).font = { bold: true, size: 14 };
  ws.addRow([
    'El denominador son los clientes ACTIVOS en la ventana de silencio de su rama',
    '(recurrente 4 meses, estacional 14), no todos los que compraron alguna vez.',
  ]);
  ws.addRow([]);

  const cab = ws.addRow([
    'Trimestre', ...paises, 'Total', 'Variación', 'Base', 'Salieron', 'Entraron', '% de churn',
  ]);
  cab.font = { bold: true };

  trimestres.forEach((tid, i) => {
    const total = sumaQ(tid, 'churn');
    const base = sumaQ(tid, 'cartera');
    const anterior = i > 0 ? sumaQ(trimestres[i - 1], 'churn') : null;
    const delQ = movimientos.filter(m => m.trimestreId === tid);
    // El primer trimestre de la serie no tiene anterior: su variación y su
    // movimiento de base quedan vacíos en vez de en cero, que se leería como
    // "no se movió nada".
    const hayPrevio = i > 0;
    ws.addRow([
      tid,
      ...paises.map(p => buscar(tid, p)?.churn ?? null),
      total,
      anterior == null ? null : total - anterior,
      base,
      hayPrevio ? -delQ.filter(m => m.movimiento === 'baja').length : null,
      hayPrevio ? delQ.filter(m => m.movimiento === 'alta').length : null,
      base > 0 ? total / base : null,
    ]);
  });
  ws.getColumn(paises.length + 7).numFmt = '0.0%';
  ws.columns.forEach((col, i) => { col.width = i === 0 ? 12 : 12; });

  // ── Hoja 2: clientes perdidos ──────────────────────────────────────────────
  const wsC = wb.addWorksheet('Clientes perdidos');
  wsC.addRow([
    'Trimestre', 'País', 'Ejecutivo', 'ID tributario', 'Cliente', 'Tipo',
    'Una sola compra', 'Compró de', 'Compró hasta', 'Sin comprar desde',
    'USD referencia', 'Meses con compra', 'USD 12m al cierre', 'Trimestre cerrado',
  ]).font = { bold: true };
  clientes.forEach(c => {
    wsC.addRow([
      c.trimestreId ?? '', c.pais, c.kam, c.idTributario ?? c.panelId, c.nombre,
      c.tipoRef || c.rama,
      c.mesesRef === 1 ? 'Sí' : 'No',
      c.refDe ?? '', c.refA ?? '', c.silDe ?? '',
      Math.round(c.usdReferencia || 0), c.mesesRef ?? null,
      Math.round(c.usd12m || 0),
      c.abierta ? 'No · ventana sin cerrar' : 'Sí',
    ]);
  });
  wsC.columns.forEach((col, i) => {
    col.width = [12, 11, 18, 16, 46, 13, 15, 11, 13, 17, 15, 17, 17, 22][i] ?? 14;
  });

  // ── Hoja 3: altas y bajas de la base ───────────────────────────────────────
  const wsM = wb.addWorksheet('Altas y bajas');
  wsM.addRow([
    'Trimestre', 'Movimiento', 'País', 'Ejecutivo', 'Empresa', 'ID panel', 'Tipo', 'USD 12m',
  ]).font = { bold: true };
  movimientos
    .slice()
    // Por trimestre y, dentro de cada uno, las bajas primero: es lo que se mira
    // al abrir la hoja.
    .sort((a, b) => a.trimestreId.localeCompare(b.trimestreId)
                    || (a.movimiento === b.movimiento ? 0 : a.movimiento === 'baja' ? -1 : 1)
                    || a.pais.localeCompare(b.pais)
                    || (b.usd12m || 0) - (a.usd12m || 0))
    .forEach(m => {
      wsM.addRow([
        m.trimestreId, m.movimiento === 'alta' ? 'Entró' : 'Salió',
        m.pais, m.kam, m.nombre, m.panelId, m.tipo, Math.round(m.usd12m || 0),
      ]);
    });
  wsM.columns.forEach((col, i) => { col.width = [12, 12, 11, 18, 46, 14, 13, 14][i] ?? 14; });

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = archivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

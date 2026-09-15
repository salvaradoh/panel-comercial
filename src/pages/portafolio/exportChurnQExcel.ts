import type {
  ChurnQPais, ClienteChurnQ, MovimientoBase,
} from '../../hooks/useMovimientos';
import {
  indexarPuente, puenteDesdeIndice, casoDeChurn, casoDeBaja, llaveEmpresa,
} from './churnPuente';
import { CASOS } from './ComoSeCalculaChurn';

/** El nombre del caso, igual que el que se ve en el panel. */
const ETIQUETA = {
  perdidaNueva: CASOS.perdidaNueva.nombre,
  sigueEnBase: CASOS.sigueEnBase.nombre,
  yaContada: CASOS.yaContada.nombre,
} as const;

/**
 * Excel del churn trimestral: tres hojas.
 *
 *   Resumen por trimestre  la matriz que está en pantalla —churn por país—, cómo
 *                          se reparte su variación entre países, y aparte el
 *                          movimiento de la base (salieron / entraron), que es
 *                          del denominador y no del churn
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
  // El mismo cálculo que el panel, no una copia: si los dos números salieran de
  // lugares distintos, tarde o temprano dirían cosas distintas.
  const ix = indexarPuente(clientes, movimientos);
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

  ws.addRow(['Clientes perdidos por país']).font = { bold: true, size: 12 };
  const cab = ws.addRow([
    'Trimestre', ...paises, 'Total', 'Variación', '% de churn',
    // La base y su movimiento son del DENOMINADOR, no del churn. Van separadas
    // por una columna vacía y con el nombre completo porque pegadas a
    // "Variación" se leen como si la explicaran, y no tienen nada que ver: la
    // variación del churn se explica por país, unas filas más abajo.
    '', 'Base (denominador)', 'Salieron de la base', 'Entraron a la base',
  ]);
  cab.font = { bold: true };

  trimestres.forEach((tid, i) => {
    const total = sumaQ(tid, 'churn');
    const base = sumaQ(tid, 'cartera');
    const anterior = i > 0 ? sumaQ(trimestres[i - 1], 'churn') : null;
    // Las reclasificaciones quedan fuera: son un cliente cambiando de rama sin
    // salir de la cartera, y sumadas acá el total dejaría de cerrar
    // (base anterior − salieron + entraron ≠ base).
    const delQ = movimientos.filter(m =>
      m.trimestreId === tid && m.motivo !== 'reclasificacion');
    // El primer trimestre de la serie no tiene anterior: su variación y su
    // movimiento de base quedan vacíos en vez de en cero, que se leería como
    // "no se movió nada".
    const hayPrevio = i > 0;
    ws.addRow([
      tid,
      ...paises.map(p => buscar(tid, p)?.churn ?? null),
      total,
      anterior == null ? null : total - anterior,
      base > 0 ? total / base : null,
      null,
      base,
      hayPrevio ? -delQ.filter(m => m.movimiento === 'baja').length : null,
      hayPrevio ? delQ.filter(m => m.movimiento === 'alta').length : null,
    ]);
  });
  ws.getColumn(paises.length + 4).numFmt = '0.0%';

  // ── Cómo se reparte la variación ───────────────────────────────────────────
  // Es la pregunta que el bloque de arriba deja abierta: el total subió 93,
  // ¿de dónde salieron? Sin esto hay que restar a mano columna por columna.
  ws.addRow([]);
  ws.addRow(['Variación del churn, por país']).font = { bold: true, size: 12 };
  ws.addRow([
    'Trimestre', ...paises, 'Total',
  ]).font = { bold: true };
  trimestres.forEach((tid, i) => {
    if (i === 0) return;   // sin trimestre anterior no hay variación
    const prev = trimestres[i - 1];
    const dp = paises.map(p =>
      (buscar(tid, p)?.churn ?? 0) - (buscar(prev, p)?.churn ?? 0));
    ws.addRow([`${prev} → ${tid}`, ...dp, dp.reduce((a, b) => a + b, 0)]);
  });

  ws.columns.forEach((col, i) => { col.width = i === 0 ? 16 : 18; });

  // ── Hoja 2: clientes perdidos ──────────────────────────────────────────────
  const wsC = wb.addWorksheet('Clientes perdidos');
  wsC.addRow([
    'Trimestre', 'País', 'Ejecutivo', 'ID tributario', 'Cliente', 'Tipo',
    'Caso', 'Una sola compra', 'Compró de', 'Compró hasta', 'Sin comprar desde',
    'USD referencia', 'Meses con compra', 'USD 12m al cierre', 'Trimestre cerrado',
  ]).font = { bold: true };
  clientes.forEach(c => {
    wsC.addRow([
      c.trimestreId ?? '', c.pais, c.kam, c.idTributario ?? c.panelId, c.nombre,
      c.tipoRef || c.rama,
      c.trimestreId
        ? ETIQUETA[casoDeChurn(ix, c.trimestreId, llaveEmpresa(c.pais, c.panelId))]
        : '',
      c.mesesRef === 1 ? 'Sí' : 'No',
      c.refDe ?? '', c.refA ?? '', c.silDe ?? '',
      Math.round(c.usdReferencia || 0), c.mesesRef ?? null,
      Math.round(c.usd12m || 0),
      c.abierta ? 'No · ventana sin cerrar' : 'Sí',
    ]);
  });
  wsC.columns.forEach((col, i) => {
    col.width = [12, 11, 18, 16, 46, 13, 20, 15, 11, 13, 17, 15, 17, 17, 22][i] ?? 14;
  });

  // ── Hoja 3: altas y bajas de la base ───────────────────────────────────────
  const wsM = wb.addWorksheet('Altas y bajas');
  wsM.addRow([
    'Trimestre', 'Movimiento', 'Caso', 'Motivo', 'Tipo para el churn', 'País',
    'Ejecutivo', 'Empresa', 'ID panel', 'Tipo en el panel', 'USD 12m',
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
        // El caso solo aplica a las salidas reales: un alta no se compara
        // contra el churn, y una reclasificación no es una salida.
        m.movimiento === 'baja' && m.motivo !== 'reclasificacion'
          ? (ETIQUETA[casoDeBaja(ix, m.trimestreId, llaveEmpresa(m.pais, m.panelId))!]
             ?? 'Sin figurar en el churn publicado')
          : '',
        m.motivo === 'reclasificacion' ? 'Cambió de tipo' : 'Movimiento de cartera',
        m.rama ?? '', m.pais, m.kam, m.nombre, m.panelId, m.tipo,
        Math.round(m.usd12m || 0),
      ]);
    });
  wsM.columns.forEach((col, i) => {
    col.width = [12, 12, 20, 22, 12, 11, 18, 46, 14, 13, 14][i] ?? 14;
  });

  // ── Hoja 4: la misma base, abierta por rama ────────────────────────────────
  // En el total un cambio de rama no se ve: el cliente nunca dejó la cartera.
  // Separado, es una baja de una rama y un alta de la otra, y esa columna es la
  // que explica por qué una rama crece mientras la otra encoge sin que entre ni
  // salga nadie. Las dos filas de cada trimestre suman el total de la hoja 1.
  const wsR = wb.addWorksheet('Base por tipo');
  wsR.addRow(['Cómo se movió la base, separando recurrentes de estacionales'])
    .font = { bold: true, size: 14 };
  wsR.addRow([]);
  wsR.addRow([
    'Trimestre', 'Tipo', 'Base anterior', 'Salieron', 'Entraron',
    'Cambió de tipo', 'Base',
  ]).font = { bold: true };

  const baseRama = (tid: string, rama: 'recurrente' | 'estacional') =>
    paises.reduce((a, p) => {
      const c = buscar(tid, p);
      return a + (!c ? 0 : rama === 'recurrente' ? c.carteraRec : c.carteraEst);
    }, 0);

  trimestres.forEach((tid, i) => {
    if (i === 0) return;   // sin trimestre anterior no hay movimiento que contar
    (['recurrente', 'estacional'] as const).forEach(rama => {
      const del = movimientos.filter(m => m.trimestreId === tid && m.rama === rama);
      const cuenta = (mov: string, recl: boolean) =>
        del.filter(m => m.movimiento === mov &&
          (m.motivo === 'reclasificacion') === recl).length;
      wsR.addRow([
        tid, rama === 'recurrente' ? 'Recurrentes' : 'Estacionales',
        baseRama(trimestres[i - 1], rama),
        -cuenta('baja', false),
        cuenta('alta', false),
        cuenta('alta', true) - cuenta('baja', true),
        baseRama(tid, rama),
      ]);
    });
  });
  wsR.columns.forEach((col, i) => { col.width = [12, 14, 14, 11, 11, 16, 11][i] ?? 14; });

  // ── Hoja 5: por qué el churn y las salidas no dan igual ────────────────────
  // Es la pregunta que más se repite al mirar el panel. La relación es exacta:
  //   churn − salieron = (siguen en la base) − (ya contadas) − (sin figurar)
  // La columna "Comprobación" recalcula ese lado derecho para que quien abra el
  // archivo no tenga que creerlo: tiene que dar igual a "Diferencia".
  const wsP = wb.addWorksheet('Churn vs salidas');
  wsP.addRow(['Por qué el churn del trimestre no coincide con los que salieron de la base'])
    .font = { bold: true, size: 14 };
  wsP.addRow([]);
  wsP.addRow([
    'Trimestre', 'Churn', 'Salieron', 'Diferencia', 'En los dos números',
    'En churn, siguen en la base', 'Salieron, ya contadas antes',
    'Salieron sin figurar en churn', 'Comprobación',
  ]).font = { bold: true };
  trimestres.forEach(tid => {
    const p = puenteDesdeIndice(ix, tid);
    if (!p.churn && !p.bajas) return;
    wsP.addRow([
      tid, p.churn, p.bajas, p.churn - p.bajas, p.churnQueSalio,
      p.churnQueSigue, p.bajaYaContada, p.bajaSinChurn,
      p.churnQueSigue - p.bajaYaContada - p.bajaSinChurn,
    ]);
  });
  wsP.addRow([]);
  wsP.addRow(['Casi todas las empresas cuentan en los dos números a la vez: por eso la resta no da una cantidad de empresas.']);
  wsP.addRow(['Y que la diferencia sea 0 no significa que sean las mismas: pueden ser dos grupos distintos del mismo tamaño que se cancelan.']);
  wsP.columns.forEach((col, i) => { col.width = [12, 10, 11, 12, 20, 27, 27, 29, 14][i] ?? 14; });

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

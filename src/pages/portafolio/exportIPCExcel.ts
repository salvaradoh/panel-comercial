import type { IPCResponse } from '../../hooks/useIPC';

/**
 * Excel del Análisis IPC: tres hojas.
 *
 *   Resumen        la foto que está en pantalla (KPIs, semáforo, mix de canales)
 *   Clientes       una fila por cliente A+, con TODAS las columnas del modelo
 *   Interacciones  una fila por interacción — el detalle crudo de la hoja
 *
 * Clientes e Interacciones van SIN los filtros de pantalla (chips de alerta,
 * checkbox de no atendidos) a propósito: es el mismo criterio ya acordado para
 * el export de Industria — el detalle sirve para armar tablas dinámicas, y si
 * llega recortado no se puede. El filtro de PAÍS sí se respeta, porque no es una
 * preferencia de vista: lo impone el rol y el backend ya lo aplicó.
 *
 * exceljs se importa dinámicamente (~1MB): solo hace falta cuando alguien hace
 * clic, no en la carga del tab.
 */
export async function descargarExcelIPC(data: IPCResponse) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Panel Comercial Apprecio';
  wb.created = new Date();

  const { resumen, periodo, clientes, trimestre } = data;
  // Frontend y backend se deployan por separado, así que pueden quedar desfasados:
  // si el navegador tiene la versión con el botón y Cloud Run todavía no devuelve
  // `interacciones`, la hoja sale vacía en vez de romper la descarga entera.
  const interacciones = data.interacciones ?? [];
  const alcance = data.pais ?? 'LATAM · todos los países';
  const pct = (n: number) => (resumen.interacciones ? n / resumen.interacciones : 0);

  // ── Resumen ────────────────────────────────────────────────────────────────
  const ws = wb.addWorksheet('Resumen');
  const titulo = (t: string) => {
    ws.addRow([]);
    const r = ws.addRow([t]);
    r.font = { bold: true, size: 12 };
  };

  ws.addRow(['Análisis IPC — Índice de Presencia Comercial']).font = { bold: true, size: 14 };
  ws.addRow(['Trimestre', trimestre.replace('-', ' ')]);
  ws.addRow(['Alcance', alcance]);
  ws.addRow(['Segmento', data.segmento]);
  ws.addRow(['Período', `${periodo.inicio} a ${periodo.fin}`]);
  ws.addRow(['Avance del trimestre', periodo.cerrado
    ? `Cerrado · ${periodo.dias} días`
    : `Día ${periodo.transcurridos} de ${periodo.dias} · ${periodo.restantes} restantes`]);
  ws.addRow(['Generado', new Date().toLocaleString('es-PE')]);

  titulo('Indicadores');
  ws.addRow(['IPC promedio de la cartera', resumen.ipcPromedio]);
  ws.addRow([`Interacciones ${trimestre.replace('-', ' ')}`, resumen.interacciones]);
  ws.addRow([`Interacciones ${data.trimestreAnterior.replace('-', ' ')}`, resumen.interaccionesPrev]);
  ws.addRow(['Clientes en la vista', resumen.clientes]);
  ws.addRow(['Sin interacción este trimestre', resumen.sinInteraccion]);
  ws.addRow(['Clientes A+ sin ningún registro (fuera de la vista)', resumen.sinRegistro]);
  ws.addRow(['Universo A+ del alcance', resumen.universo]);

  titulo('Semáforo de alerta');
  ws.addRow(['Estado', 'Clientes']).font = { bold: true };
  ws.addRow(['Verde', resumen.verde]);
  ws.addRow(['Amarillo', resumen.amarillo]);
  ws.addRow(['Rojo', resumen.rojo]);

  titulo('Participación por tipo de interacción');
  ws.addRow(['Tipo', 'Interacciones', '% del total']).font = { bold: true };
  const filaMix = ws.rowCount;
  resumen.porTipo.forEach((t) => ws.addRow([t.tipo, t.n, pct(t.n)]));
  for (let i = filaMix + 1; i <= ws.rowCount; i++) ws.getCell(`C${i}`).numFmt = '0%';

  titulo('Meta de puntos del trimestre');
  ws.addRow(['Tipo de cliente', 'Meta']).font = { bold: true };
  Object.entries(data.metaPorTipo).forEach(([tipo, pts]) => ws.addRow([tipo, pts]));

  titulo('Cómo se calcula');
  [
    ['IPC (0-100)', 'puntos acumulados ÷ meta del trimestre × 100'],
    ['Ritmo', 'puntos acumulados ÷ días transcurridos'],
    ['Proyectado', 'puntos acumulados + (ritmo × días restantes)'],
    ['Verde', `proyectado mayor a meta × ${(1 + data.banda).toFixed(2)}`],
    ['Amarillo', `proyectado dentro de ±${Math.round(data.banda * 100)}% de la meta`],
    ['Rojo', `proyectado menor a meta × ${(1 - data.banda).toFixed(2)}`],
  ].forEach((f) => ws.addRow(f));

  ws.getColumn(1).width = 48;
  ws.getColumn(2).width = 34;
  ws.getColumn(3).width = 14;

  // ── Clientes ───────────────────────────────────────────────────────────────
  const wsC = wb.addWorksheet('Clientes');
  wsC.addRow([
    'País', 'Empresa', 'Panel ID', 'Ejecutivo', 'Tipo de cliente', 'Segmento',
    'Puntos', 'Meta', 'IPC (0-100)', 'Proyectado', 'Alerta',
    `Interacciones ${trimestre}`, `Tendencia vs ${data.trimestreAnterior}`,
    'Última interacción', 'Tipo de la última', 'Días sin interacción',
  ]).font = { bold: true };
  wsC.views = [{ state: 'frozen', ySplit: 1 }];
  wsC.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 16 } };

  clientes.forEach((c) => {
    wsC.addRow([
      c.pais, c.empresa, c.panelId, c.kam, c.tipo, c.segmento,
      c.pts, c.meta, c.ipcScore, c.proyectado, c.alerta,
      c.interacciones,
      // `null` = no hay trimestre anterior con el cual comparar. Se escribe el
      // texto y no un 0, que se leería como "no cambió".
      c.tendencia ?? 'sin comparación',
      c.ultimaInteraccion ?? '', c.ultimoTipo,
      c.diasSinInteraccion ?? '',
    ]);
  });
  wsC.columns.forEach((col, i) => { col.width = [10, 44, 12, 26, 15, 10, 9, 8, 12, 12, 11, 16, 20, 18, 16, 18][i] ?? 14; });

  // ── Interacciones ──────────────────────────────────────────────────────────
  const wsI = wb.addWorksheet('Interacciones');
  wsI.addRow([
    'Fecha', 'Hora', 'País', 'Empresa', 'Panel ID', 'Ejecutivo (registro)',
    'Ejecutivo (cartera)', 'Tipo de interacción', 'Canal', 'Tarea',
    'Puntos base', 'Factor', 'Puntos efectivos', 'Trimestre',
    'Tipo de cliente', 'Segmento vigente', 'Segmento en la hoja', 'Fuente', 'ID externo',
  ]).font = { bold: true };
  wsI.views = [{ state: 'frozen', ySplit: 1 }];
  wsI.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 19 } };

  interacciones.forEach((x) => {
    wsI.addRow([
      x.fecha, x.hora, x.pais, x.empresa, x.panelId, x.kam, x.kamCartera,
      x.tipoInteraccion, x.canal, x.tarea,
      x.ptsBase, x.factor, x.pts, x.trimestre,
      x.tipoCliente, x.segmentoVigente, x.segmentoEstampado, x.fuente, x.idExterno,
    ]);
  });
  wsI.columns.forEach((col, i) => { col.width = [12, 14, 10, 44, 12, 26, 22, 18, 14, 30, 12, 8, 15, 12, 15, 15, 18, 10, 38][i] ?? 14; });

  const sufijoPais = data.pais ? `_${data.pais.normalize('NFD').replace(/[̀-ͯ]/g, '')}` : '';
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `IPC_${trimestre}${sufijoPais}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

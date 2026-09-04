/**
 * Vuelca el estado del proyecto CBS en JSON, para que el agente de campañas pueda
 * proponer campañas sobre el proyecto y no solo sobre la cartera.
 *
 * Usa la MISMA lógica que el panel (`src/lib/cbs.ts`), igual que el verificador, así que
 * las cifras del brief y las del tab Proyectos no pueden discrepar.
 *
 * No se ejecuta solo: lo lanza `scripts/cbs-para-campanas.js` de la raíz, que baja la hoja
 * con las credenciales del repo.
 */
import { readFileSync } from 'node:fs';
import {
  parseFilasCBS, resumenFarming, resumenHunting, avancePorTier,
  sponsorsPorPaisDestino, distribucionEstados, embudoConversion, rankingEjecutivos,
  cuentaOportunidades, sumaUSD, estadoDe, ventanaProyecto,
} from '../src/lib/cbs';

const ruta = process.argv[2];
if (!ruta) {
  console.error('Uso: tsx scripts/cbs-para-campanas.ts <volcado.json>');
  process.exit(2);
}

const { headers, filas } = JSON.parse(readFileSync(ruta, 'utf8'));
const base = parseFilasCBS(headers, filas);
const f = base.filas;

const sinTocar = f.filter((x) => estadoDe(x) === 'sin_tocar');
const ranking = rankingEjecutivos(f, 'kamActual');

console.log(JSON.stringify({
  proyecto: 'CBS LATAM → México',
  ventana: ventanaProyecto(f),
  columnas_faltantes: base.faltantes,
  oportunidades: cuentaOportunidades(f),
  filas: f.length,
  usd_total: Math.round(sumaUSD(f)),
  farming: resumenFarming(f),
  hunting: resumenHunting(f),
  embudo: embudoConversion(f),
  estados: distribucionEstados(f),
  por_tier: avancePorTier(f),
  sponsors_por_pais_destino: sponsorsPorPaisDestino(f),
  sin_tocar: {
    cuentas: sinTocar.length,
    usd: Math.round(sumaUSD(sinTocar)),
  },
  ranking_ejecutivos: ranking.map((r) => ({
    nombre: r.nombre, cuentas: r.cuentas, usd: Math.round(r.usd),
    sponsors: r.sponsors, sin_tocar: r.sinTocar, usd_sin_tocar: Math.round(r.usdSinTocar),
  })),
}, null, 1));

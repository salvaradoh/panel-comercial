/**
 * Comprueba que los KPIs de Proyectos → CBS siguen dando lo mismo que el tablero
 * de Looker Studio del que salieron.
 *
 * Importa la MISMA lógica que renderiza el panel (`src/lib/cbs.ts`), no una copia,
 * así que si alguien cambia una definición acá se entera. Por eso `lib/cbs.ts`
 * no importa React ni AuthContext: para que se pueda correr desde Node.
 *
 * No se ejecuta solo: lo lanza `scripts/verificar-cbs.js` de la raíz del repo,
 * que primero baja la hoja con las credenciales de Google y después llama acá.
 *
 *   node scripts/verificar-cbs.js
 */
import { readFileSync } from 'node:fs';
import {
  parseFilasCBS, resumenFarming, resumenHunting, avancePorTier,
  estadoLeadsPorPais, sponsorsPorPaisDestino, distribucionEstados, embudoConversion,
  sumaUSD, ORDEN_ESTADOS, aplicarKamActual, normalizaIdEmpresa, claveKam, FUENTE_KAM_META,
} from '../src/lib/cbs';
import { clavePais } from '../src/lib/paises';

/** Cifras del tablero original, verificadas contra las capturas el 2026-08-25. */
const ESPERADO: Record<string, number> = {
  'Oportunidades': 262, 'En gestión activa': 6, 'Sponsors validados': 35, 'A hunting': 182,
  'Pasaron a BDM': 27, 'Pasaron a KAM': 20, 'En gestión/Reunión': 19,
  'No aplica/No desea': 7, 'Cierre ganado': 4, 'Empresas en gestión': 12, 'Nuevos contactos': 205,
};

const ruta = process.argv[2];
if (!ruta) {
  console.error('Uso: tsx scripts/verificar-cbs.ts <volcado.json>');
  process.exit(2);
}

const { headers, filas, puente = [], cartera = [] } = JSON.parse(readFileSync(ruta, 'utf8'));
const base = parseFilasCBS(headers, filas);
const faltantes = base.faltantes;

// Mismo armado que hace el hook, para verificar el cruce real y no una copia.
const carteraKam = {
  porPanelId: new Map<string, string>(),
  puenteRut: new Map<string, string>(),
  kamListadoCL: new Map<string, string>(),
};
(cartera as string[][]).forEach((r) => {
  const kam = String(r[4] ?? '').trim();
  if (kam) carteraKam.porPanelId.set(`${clavePais(r[0])}||${normalizaIdEmpresa(String(r[1] ?? ''))}`, kam);
});
(puente as string[][]).forEach((r) => {
  const id = String(r[0] ?? '').trim();
  if (!id) return;
  const rut = normalizaIdEmpresa(String(r[3] ?? ''));
  const kam = String(r[4] ?? '').trim();
  if (rut) carteraKam.puenteRut.set(id, rut);
  if (kam) carteraKam.kamListadoCL.set(id, kam);
});
const fs = aplicarKamActual(base.filas, carteraKam);

console.log(`Filas parseadas: ${fs.length}`);
console.log(`Columnas faltantes: ${faltantes.length ? faltantes.join(', ') : 'ninguna'}`);

const f = resumenFarming(fs);
const h = resumenHunting(fs);
const obtenido: Record<string, number> = {
  'Oportunidades': f.oportunidades, 'En gestión activa': f.enGestionActiva,
  'Sponsors validados': f.sponsors, 'A hunting': f.aHunting,
  'Pasaron a BDM': h.pasaronBdm, 'Pasaron a KAM': h.pasaronKam,
  'En gestión/Reunión': h.enGestionReunion, 'No aplica/No desea': h.noAplicaProspeccion,
  'Cierre ganado': h.cierreGanado, 'Empresas en gestión': h.empresasEnGestion,
  'Nuevos contactos': h.nuevosContactos,
};

let fallos = 0;
console.log('\n── KPIs contra el tablero original ──');
for (const k of Object.keys(ESPERADO)) {
  const ok = obtenido[k] === ESPERADO[k];
  if (!ok) fallos++;
  console.log(`${ok ? '  OK  ' : ' FALLA'} ${k.padEnd(20)} esperado ${String(ESPERADO[k]).padStart(4)}  obtenido ${String(obtenido[k]).padStart(4)}`);
}

console.log('\n── Avance por tier (esperado A+ 4/41 · A 8/73 · B 15/95 · C 8/64) ──');
avancePorTier(fs).forEach((t) => console.log(`  ${t.tier.padEnd(9)} ${t.sponsors}/${t.oportunidades}`));

console.log('\n── Sponsors por país destino (esperado MX 21 · PE 6 · CL 4 · EC 3 · COL 1) ──');
sponsorsPorPaisDestino(fs).forEach((d) => console.log(`  ${d.pais.padEnd(5)} ${d.sponsors}`));

console.log('\n── Estado de leads por país (esperado noAplica 3/22/19 · sponsors 8/11/16) ──');
estadoLeadsPorPais(fs).forEach((l) =>
  console.log(`  ${l.pais.padEnd(10)} noAplica=${l.noAplica} sponsors=${l.sponsors}`));

// Invariante del rediseño: los estados son mutuamente excluyentes y cubren todo.
const tramos = distribucionEstados(fs);
const sumaEstados = tramos.reduce((a, t) => a + t.cuentas, 0);
console.log('\n── Estados (deben ser excluyentes y sumar el total de filas) ──');
tramos.forEach((t) => console.log(`  ${t.estado.padEnd(11)} ${String(t.cuentas).padStart(3)}  ${Math.round(t.usd).toLocaleString('en-US').padStart(11)} USD`));
if (sumaEstados !== fs.length) {
  fallos++;
  console.log(` FALLA los estados suman ${sumaEstados} y las filas son ${fs.length}`);
} else {
  console.log(`  OK   suman ${sumaEstados} = filas`);
}
if (ORDEN_ESTADOS.length !== tramos.length) {
  fallos++;
  console.log(' FALLA ORDEN_ESTADOS no cubre todos los estados');
}

// Invariante del embudo: cada etapa es subconjunto de la anterior.
console.log('\n── Embudo (cada etapa ⊆ la anterior) ──');
const etapas = embudoConversion(fs);
etapas.forEach((e, i) => {
  const rompe = i > 0 && e.cuentas > etapas[i - 1].cuentas;
  if (rompe) fallos++;
  console.log(`  ${rompe ? 'FALLA' : ' OK  '} ${e.label.padEnd(17)} ${String(e.cuentas).padStart(4)}  ${
    e.conversion === null ? '   —' : `${Math.round(e.conversion * 100)}%`.padStart(4)}`);
});

// Cobertura del cruce de KAM. Umbral 95%: si cae debajo, algo se rompió en la
// hoja (un cambio de formato del Panel ID, un país nuevo sin puente).
const porFuente = new Map<string, number>();
fs.forEach((f) => porFuente.set(f.kamFuente, (porFuente.get(f.kamFuente) ?? 0) + 1));
console.log('\n── Cruce de KAM vigente ──');
[...porFuente.entries()].forEach(([k, n]) =>
  console.log(`  ${k.padEnd(11)} ${String(n).padStart(3)}  ${FUENTE_KAM_META[k as keyof typeof FUENTE_KAM_META].label}`));
const resueltos = fs.filter((f) => FUENTE_KAM_META[f.kamFuente].confiable).length;
const pct = (resueltos / fs.length) * 100;
console.log(`  cobertura ${resueltos}/${fs.length} = ${pct.toFixed(1)}%`);
if (pct < 95) { fallos++; console.log(' FALLA la cobertura del cruce cayó debajo del 95%'); }
else console.log('  OK   por encima del umbral de 95%');

const desactualizados = fs.filter((f) =>
  FUENTE_KAM_META[f.kamFuente].confiable && f.idKam && claveKam(f.idKam) !== claveKam(f.kamActual)).length;
console.log(`  filas donde la columna 'ID KAM' de la hoja ya no coincide: ${desactualizados}`);

console.log(`\nUSD 12m en el universo: ${Math.round(sumaUSD(fs)).toLocaleString('en-US')}`);
console.log(fallos ? `\n${fallos} comprobación(es) fallaron` : '\nTodo cuadra');
process.exit(fallos ? 1 : 0);

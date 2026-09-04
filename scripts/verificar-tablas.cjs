/**
 * Lint de tablas adaptables.
 *
 * Apilada, cada celda muestra su etiqueta desde `data-label`. Una celda sin
 * etiqueta queda como un valor suelto sin decir de qué es —que es peor que la
 * tabla original—, y ese defecto NO se ve en desktop: solo aparece por debajo de
 * 40rem de contenedor. Por eso se verifica con un script en vez de a ojo.
 *
 * Reglas:
 *  1. Toda <table> necesita un ancestro `.tabla-scroll` (el contenedor de la
 *     consulta). Sin eso, `tabla-apilable` no se activa nunca.
 *  2. En una tabla `tabla-apilable`, toda <td> necesita declarar una de cuatro
 *     cosas: `data-titular` (encabeza la tarjeta), `data-label` (etiqueta),
 *     `data-sin-etiqueta` (columna de acciones, no lleva) o `colSpan` (fila de
 *     estado vacío).
 *
 * Uso: node scripts/verificar-tablas.cjs
 */
const fs = require('fs'), path = require('path');

function walk(d, out = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.tsx')) out.push(p);
  }
  return out;
}

const problemas = [];
let tablas = 0, apilables = 0, celdas = 0, celdasOk = 0;

for (const f of walk('src')) {
  const texto = fs.readFileSync(f, 'utf8');
  const L = texto.split('\n');

  L.forEach((linea, i) => {
    if (!linea.includes('<table')) return;
    tablas++;
    const rel = f.replace('src/', '');

    // Regla 1: ancestro con el contenedor de consulta.
    // El padre es la primera línea de arriba con MENOS sangría; mirar solo la
    // línea anterior no sirve, porque entre el envoltorio y la tabla puede haber
    // hermanos (el <OrdenadorMovil>, un comentario) al mismo nivel.
    const sangria = (linea.match(/^\s*/) || [''])[0].length;
    let padre = null;
    for (let j = i - 1; j >= 0 && j > i - 40; j--) {
      if (!L[j].trim()) continue;
      if (((L[j].match(/^\s*/) || [''])[0]).length < sangria) { padre = L[j]; break; }
    }
    if (!padre || !/tabla-scroll/.test(padre)) {
      problemas.push(`${rel}:${i + 1}  sin ancestro .tabla-scroll` +
        (padre ? ` (padre: ${padre.trim().slice(0, 60)})` : ''));
    }

    if (!/tabla-apilable/.test(linea)) return;
    apilables++;

    // Regla 2: etiquetas en cada celda del cuerpo
    let k = -1;
    for (let j = i; j < L.length; j++) if (L[j].includes('</table>')) { k = j; break; }
    const bloque = L.slice(i, k + 1).join('\n');

    let pos = 0;
    while ((pos = bloque.indexOf('<td', pos)) !== -1) {
      celdas++;
      // Ventana generosa: el atributo puede caer en la línea siguiente cuando la
      // apertura de la celda está partida en varias.
      const ventana = bloque.slice(pos, pos + 260);
      if (/data-label|data-titular|data-sin-etiqueta|colSpan|colspan/.test(ventana)) celdasOk++;
      else {
        const nLinea = i + 1 + bloque.slice(0, pos).split('\n').length - 1;
        problemas.push(`${rel}:${nLinea}  <td sin data-label / data-titular / data-sin-etiqueta`);
      }
      pos += 3;
    }
  });
}

console.log(`tablas: ${tablas}  |  apilables: ${apilables}  |  celdas en apilables: ${celdas} (${celdasOk} etiquetadas)`);
if (problemas.length) {
  console.log(`\n${problemas.length} problema(s):`);
  for (const p of problemas) console.log('  ' + p);
  process.exit(1);
}
console.log('\nsin problemas');

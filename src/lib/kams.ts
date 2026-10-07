/**
 * Traducción de lo que trae `Cache_Reporte` en la columna de KAM a un nombre de persona.
 *
 * Los nombres salen de la hoja `Codigos Vendedores` (`useKamNombres`), no de una lista en
 * el código: esa lista se publicaba en el JavaScript del sitio (hallazgo 3.2 del informe de
 * seguridad del 2026-10-05).
 */

/** Códigos que no son personas: `Cache_Reporte` agrupa ahí la venta sin ejecutivo asignado. */
const ALIAS_OTROS = new Set(['AA', 'EC']);

function sinAcento(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/**
 * Código de KAM → nombre. `Cache_Reporte` a veces trae el primer nombre en lugar del código
 * (así viene de BigQuery para algunos ejecutivos de Perú y Colombia): si no es un código, se
 * busca por primer nombre en la hoja y se acepta solo si hay una única coincidencia.
 */
export function resolverNombreKam(abrev: string, nombres: Record<string, string>): string {
  if (ALIAS_OTROS.has(abrev)) return 'Otros';
  if (nombres[abrev]) return nombres[abrev];
  const k = sinAcento(abrev);
  const hits = Object.values(nombres).filter((n) => sinAcento(n.split(' ')[0]) === k);
  return hits.length === 1 ? hits[0] : abrev;
}

/** Firma estable del mapa de nombres, para usarla en las query keys. */
export function firmaNombres(nombres: Record<string, string>): string {
  return Object.keys(nombres).sort().join(',');
}

export function inicialesKam(nombre: string): string {
  const partes = nombre.trim().split(' ');
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[1][0]).toUpperCase();
}

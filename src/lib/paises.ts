/**
 * Comparación de países tolerante a tildes.
 *
 * Hace falta porque las fuentes NO se ponen de acuerdo en cómo se escribe el
 * nombre, verificado el 2026-08-19:
 *
 *   hoja de roles      Peru   ·  Mexico    (sin tildes)
 *   Cache_Movimientos  Perú   ·  México    (con tildes)
 *   Cache_Ranking      Perú   ·  Mexico    (mezcla)
 *
 * El rol de cada persona sale de la hoja, así que `filterPais` llega como 'Peru'
 * y comparado con `===` no matchea el 'Perú' de los cachés: el ejecutivo peruano
 * veía su cartera vacía. Canonicalizar a una sola forma no alcanza —los cachés
 * discrepan entre ellos—, así que se compara sin tildes y sin mayúsculas.
 */
export function clavePais(p: string | undefined | null): string {
  return String(p ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().trim();
}

export function mismoPais(a: string | undefined | null, b: string | undefined | null): boolean {
  return clavePais(a) === clavePais(b);
}

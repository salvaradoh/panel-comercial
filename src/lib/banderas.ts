/**
 * Códigos de país para las banderas de flagcdn.
 *
 * NO se usan emoji de bandera: Windows nunca incluyó banderas de país en Segoe UI
 * Emoji, así que 🇵🇪 se degrada a las dos letras del indicador regional y en
 * pantalla aparece "PE Perú". Con imágenes se ve igual en todas las plataformas,
 * y es el mismo patrón que ya usa TopNav.
 *
 * Las claves llevan las dos formas —con y sin tilde— porque las novedades se
 * escriben desde el GAS y `Cache_Novedades` guarda "Mexico" sin tilde mientras
 * otras fuentes usan "México". Un lookup con una sola forma deja sin bandera
 * justo a los países que más aparecen.
 */
export const PAIS_CC: Record<string, string> = {
  Chile: 'cl',
  Perú: 'pe',  Peru: 'pe',
  Colombia: 'co',
  México: 'mx', Mexico: 'mx',
  Ecuador: 'ec',
};

/** Los campanazos multi-país vienen como "Chile · Perú". */
export function paisesDe(pais: string): string[] {
  return String(pais || '')
    .split(' · ')
    .map((p) => p.trim())
    .filter(Boolean);
}

export function ccDe(pais: string): string | null {
  return PAIS_CC[pais.trim()] ?? null;
}

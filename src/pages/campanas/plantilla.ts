/**
 * Sistema visual compartido por los correos de campañas.
 *
 * Existe para que el correo de la campaña y el de las cuentas seleccionadas se vean como
 * dos piezas de la misma familia, y para que un cambio de estilo se haga en un solo lugar.
 *
 * Reglas del formato, que explican por qué esto no se parece a la web:
 *  - Todo va en tablas de una columna y con estilos en línea. Es lo único que Gmail,
 *    Outlook y Apple Mail renderizan igual. Nada de flexbox, grid ni clases.
 *  - Los clientes de correo no ejecutan JavaScript ni cargan CSS externo.
 */

/* ------------------------------------------------------------------ tipografía */

/**
 * Los clientes de correo no cargan tipografías propias: Gmail y Outlook descartan tanto
 * `@font-face` como `<link>`. Apple Mail y Mail de iOS sí las cargan, que es donde suele
 * leer la gerencia, así que se pide Inter y se deja detrás una cadena del sistema con
 * métricas casi idénticas: quien la cargue ve Inter y quien no, no nota ningún salto.
 *
 * Por eso el aire "de empresa grande" no lo da el archivo de la tipografía sino la escala:
 * un solo tamaño por jerarquía, interletrado ajustado en los títulos y mucho espacio en
 * blanco. Eso se ve igual en todos los clientes.
 */
export const FUENTE =
  "Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";

/** Números de ancho fijo para que las cifras de las tablas queden alineadas en columna. */
export const FUENTE_CIFRAS =
  "'SF Mono',SFMono-Regular,ui-monospace,'DejaVu Sans Mono',Menlo,Consolas,monospace";

export const TIPO = {
  /** Rótulo pequeño en mayúsculas que encabeza cada sección. */
  rotulo: `600 11px/1.4 ${FUENTE}`,
  titulo: `600 26px/1.25 ${FUENTE}`,
  subtitulo: `600 17px/1.35 ${FUENTE}`,
  cuerpo: `400 15px/1.65 ${FUENTE}`,
  menor: `400 13px/1.6 ${FUENTE}`,
  cifra: `600 22px/1.15 ${FUENTE}`,
  pie: `400 12px/1.65 ${FUENTE}`,
} as const;

/* ---------------------------------------------------------------------- color */

export const COLOR = {
  fondo: '#F1F5F9',
  tarjeta: '#FFFFFF',
  borde: '#E2E8F0',
  bordeSuave: '#F1F5F9',
  tinta: '#0F172A',
  texto: '#334155',
  apagado: '#64748B',
  tenue: '#94A3B8',
  panel: '#F8FAFC',
} as const;

/** A dónde lleva el botón del final. Los tabs del panel son estado interno, no rutas, así
 *  que no hay forma de enlazar directo a Campañas: se entra por la portada. */
export const URL_PANEL = 'https://salvaradoh.github.io/panel-comercial/';

export const escapar = (s: string) =>
  String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/* ------------------------------------------------------------------- piezas */

/** Ancho útil de la tarjeta y su margen interno, en un solo lugar. */
const ANCHO = 640;
const MARGEN = 36;

/**
 * Texto de vista previa: es lo que muestra la bandeja de entrada debajo del asunto.
 * Si no se pone, Gmail rellena con lo primero que encuentre en el HTML, que suele ser
 * basura. Va oculto con el truco de siempre (alto cero y color transparente), más una
 * tira de espacios para que no se cuele el texto que sigue.
 */
export function vistaPrevia(texto: string): string {
  const relleno = '&#8199;&#65279;&nbsp;'.repeat(80);
  return `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;
       font-size:1px;line-height:1px;color:transparent;opacity:0;">${escapar(texto)}${relleno}</div>`;
}

/** Rótulo en mayúsculas que abre una sección. */
export function rotulo(texto: string, color: string = COLOR.apagado): string {
  return `<p style="margin:0 0 6px 0;font:${TIPO.rotulo};letter-spacing:.09em;
             text-transform:uppercase;color:${color};">${escapar(texto)}</p>`;
}

/** Sección de texto con su rótulo. `cuerpo` ya viene escapado o es HTML deliberado. */
export function seccion(titulo: string, cuerpo: string): string {
  return `
    <tr><td style="padding:22px ${MARGEN}px 0 ${MARGEN}px;">
      ${rotulo(titulo)}
      <div style="font:${TIPO.cuerpo};color:${COLOR.texto};">${cuerpo}</div>
    </td></tr>`;
}

/** Línea divisoria de ancho completo dentro de la tarjeta. */
export function division(): string {
  return `
    <tr><td style="padding:26px ${MARGEN}px 0 ${MARGEN}px;">
      <div style="height:1px;background:${COLOR.borde};font-size:0;line-height:0;">&nbsp;</div>
    </td></tr>`;
}

/**
 * Botón. Va como tabla y no como `<a>` suelto porque Outlook ignora el relleno de un
 * enlace: sin la tabla el botón aparece como texto plano subrayado.
 */
export function boton(texto: string, url: string, color: string): string {
  return `
    <tr><td align="center" style="padding:30px ${MARGEN}px 0 ${MARGEN}px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
        <tr><td align="center" bgcolor="${color}" style="border-radius:10px;">
          <a href="${url}" target="_blank"
             style="display:inline-block;padding:14px 30px;border-radius:10px;
                    background:${color};color:#FFFFFF;text-decoration:none;
                    font:600 15px/1 ${FUENTE};letter-spacing:.01em;">${escapar(texto)}</a>
        </td></tr>
      </table>
    </td></tr>`;
}

/** Cierre común: la nota al pie y el enlace de respaldo por si el botón no funciona. */
export function pie(nota: string): string {
  return `
    <tr><td style="padding:30px ${MARGEN}px ${MARGEN}px ${MARGEN}px;">
      <div style="height:1px;background:${COLOR.borde};font-size:0;line-height:0;">&nbsp;</div>
      <p style="margin:18px 0 0 0;font:${TIPO.pie};color:${COLOR.tenue};">${nota}</p>
      <p style="margin:8px 0 0 0;font:${TIPO.pie};color:${COLOR.tenue};">
        Si el botón no funciona, entra a
        <a href="${URL_PANEL}" style="color:${COLOR.apagado};">${URL_PANEL}</a>
      </p>
    </td></tr>`;
}

/**
 * Encabezado: la animación centrada, el rótulo del tipo de campaña y el título.
 * La animación se muestra al tamaño real del archivo, sin estirar (ver animacion-cabecera.ts).
 */
export function encabezado(opts: {
  url: string; ancho: number; alto: number; alt: string; rellenoArriba: number;
  rotuloTexto: string; etiqueta?: { texto: string; color: string; fondo: string };
  titulo: string; color: string;
}): string {
  return `
    <tr><td align="center" style="padding:${opts.rellenoArriba}px ${MARGEN}px 0 ${MARGEN}px;">
      <img src="${opts.url}" width="${opts.ancho}" height="${opts.alto}" alt="${escapar(opts.alt)}"
           style="display:block;width:${opts.ancho}px;height:${opts.alto}px;max-width:100%;
                  border:0;outline:none;text-decoration:none;color:${COLOR.tenue};
                  font:${TIPO.menor};" />
    </td></tr>

    <tr><td align="center" style="padding:18px ${MARGEN}px 0 ${MARGEN}px;">
      <p style="margin:0;font:700 12px/1.3 ${FUENTE};letter-spacing:.13em;
                text-transform:uppercase;color:${opts.color};">${escapar(opts.rotuloTexto)}</p>
      ${opts.etiqueta
        ? `<span style="display:inline-block;margin-top:12px;padding:5px 12px;border-radius:999px;
                 background:${opts.etiqueta.fondo};color:${opts.etiqueta.color};
                 font:600 11px/1.4 ${FUENTE};letter-spacing:.04em;">${escapar(opts.etiqueta.texto)}</span>`
        : ''}
      <h1 style="margin:14px 0 0 0;font:${TIPO.titulo};letter-spacing:-.018em;color:${COLOR.tinta};">
        ${escapar(opts.titulo)}</h1>
    </td></tr>`;
}

/**
 * Envoltura exterior. Devuelve el HTML completo del mensaje.
 *
 * Lleva `<html>` y `<head>` de verdad —no solo la tabla— para poder pedir la tipografía y
 * fijar el ajuste de texto en iOS. Los clientes que descartan el `<head>` igual muestran
 * bien el cuerpo, porque todo lo que importa está en línea.
 */
export function envoltura(opts: {
  titulo: string; vistaPrevia: string; acento: string; contenido: string;
}): string {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapar(opts.titulo)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  /* Solo lo tiene en cuenta el cliente que respete el <head>; el resto ya está en línea. */
  body { margin:0; padding:0; width:100% !important; -webkit-text-size-adjust:100%; }
  img { border:0; line-height:100%; vertical-align:middle; }
  @media (max-width:660px) {
    .tarjeta { width:100% !important; border-radius:0 !important; }
    .margen  { padding-left:22px !important; padding-right:22px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${COLOR.fondo};">
${vistaPrevia(opts.vistaPrevia)}
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
       style="background:${COLOR.fondo};padding:32px 0;">
 <tr><td align="center" style="padding:0 12px;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="${ANCHO}" class="tarjeta"
         style="width:100%;max-width:${ANCHO}px;background:${COLOR.tarjeta};
                border:1px solid ${COLOR.borde};border-radius:18px;overflow:hidden;">
    <tr><td style="height:5px;background:${opts.acento};font-size:0;line-height:0;">&nbsp;</td></tr>
${opts.contenido}
  </table>
 </td></tr>
</table>
</body>
</html>`;
}

export { ANCHO as ANCHO_TARJETA, MARGEN as MARGEN_TARJETA };

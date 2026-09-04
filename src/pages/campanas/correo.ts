import type {
  AccionCuenta, Campana, CuentaBase, Destinatario, Seguimiento,
} from '../../hooks/useCampanas';
import {
  ETIQUETA_INCENTIVO, estiloTipo, metricaDeCampana, montoIncentivo, numero, usd, usdCorto,
} from './formato';
import { CAMPANA, CLIENTES } from './animacion-cabecera';
import {
  COLOR, FUENTE, MARGEN_TARJETA, TIPO, URL_PANEL,
  boton, division, encabezado, envoltura, escapar, pie, rotulo, seccion,
} from './plantilla';

/**
 * Los dos correos de una campaña.
 *
 *  1. `construirCorreo` — el anuncio: qué campaña arranca, por qué, qué se ofrece, qué
 *     incentivo hay y hasta cuándo. Sale recién cuando el C-level la aprobó, así que el
 *     texto asume que la decisión ya está tomada.
 *  2. `construirCorreoClientes` — la lista de cuentas seleccionadas, separada del anuncio
 *     para que el primero se lea de un vistazo y este se pueda usar como material de
 *     trabajo. Va agrupada por ejecutivo, que es como cada quien la va a leer.
 *
 * En español neutro, sin voseo: lo leen equipos de cuatro países.
 */

export interface CorreoArmado {
  asunto: string;
  html: string;
  texto: string;
}

const M = MARGEN_TARJETA;

/** `null` cuando la campaña se decidió sin incentivo: el correo entonces omite el bloque. */
function incentivoEnPalabras(s: Seguimiento): string | null {
  if (s.incentivo_tipo === 'ninguno') return null;
  const partes: string[] = [];
  if (s.incentivo_tipo) partes.push(ETIQUETA_INCENTIVO[s.incentivo_tipo]);
  const monto = montoIncentivo(s.incentivo_tipo, s.incentivo_monto);
  if (monto) partes.push(monto);
  const cabecera = partes.join(' · ');
  if (cabecera && s.incentivo_descripcion) return `${cabecera} — ${s.incentivo_descripcion}`;
  return cabecera || s.incentivo_descripcion || 'Por definir con el área.';
}

function fechaLarga(iso?: string | null): string | null {
  if (!iso) return null;
  return new Date(`${iso}T00:00:00`).toLocaleDateString('es-CL', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
}

/**
 * Fila de cifras destacadas. Se arma como tabla de celdas iguales y no con porcentajes
 * sueltos porque Outlook reparte mal el ancho cuando la cantidad de columnas cambia.
 */
function cifras(items: { rotulo: string; valor: string }[]): string {
  if (!items.length) return '';
  const ancho = Math.floor(100 / items.length);
  const celdas = items.map((it, i) => `
    <td width="${ancho}%" style="padding:16px 18px;vertical-align:top;
        ${i ? `border-left:1px solid ${COLOR.borde};` : ''}">
      <p style="margin:0;font:${TIPO.rotulo};letter-spacing:.09em;text-transform:uppercase;
                color:${COLOR.apagado};">${escapar(it.rotulo)}</p>
      <p style="margin:6px 0 0 0;font:${TIPO.cifra};letter-spacing:-.02em;color:${COLOR.tinta};">
        ${escapar(it.valor)}</p>
    </td>`).join('');
  return `
    <tr><td style="padding:24px ${M}px 0 ${M}px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
             style="border:1px solid ${COLOR.borde};border-radius:14px;background:${COLOR.panel};">
        <tr>${celdas}</tr>
      </table>
    </td></tr>`;
}

/* ============================================================ 1. el anuncio */

export function construirCorreo(
  campana: Campana,
  seg: Seguimiento,
  destinatarios: Destinatario[],
): CorreoArmado {
  const tipo = estiloTipo(campana.tipo);
  const base = campana.base;
  const asunto = `Nueva campaña activa: ${tipo.etiqueta} · ${campana.nombre}`;
  const meta = metricaDeCampana(campana.metrica, campana.tipo);

  const ejecutivos = destinatarios.filter((d) => d.rol !== 'Área de incentivos');
  const fecha = fechaLarga(seg.fecha_objetivo);

  /* -------------------------------------------------------------- texto plano */

  const texto = [
    `NUEVA CAMPAÑA ACTIVA — ${tipo.etiqueta.toUpperCase()}`,
    campana.nombre,
    '',
    'POR QUÉ AHORA',
    campana.senal || '—',
    '',
    'LA BASE',
    base?.clientes != null ? `${numero(base.clientes)} cuentas` : '—',
    base?.arr_6m_usd != null ? `Facturación semestral en juego: ${usd(base.arr_6m_usd)}` : '',
    base?.paises?.length ? `Países: ${base.paises.join(', ')}` : '',
    '',
    'QUÉ CUENTA COMO AVANCE',
    meta,
    '',
    'QUÉ SE OFRECE',
    campana.producto || '—',
    '',
    'CÓMO PLANTEARLO AL CLIENTE',
    campana.pitch || '—',
    '',
    ...(incentivoEnPalabras(seg)
      ? [
        'INCENTIVO PARA EL EQUIPO',
        incentivoEnPalabras(seg) as string,
        seg.incentivo_area ? `Área que lo gestiona: ${seg.incentivo_area}` : '',
        '',
      ]
      : []),
    fecha ? `FECHA OBJETIVO: ${fecha}` : '',
    ejecutivos.length ? `Ejecutivos involucrados: ${ejecutivos.map((e) => e.nombre).join(', ')}` : '',
    '',
    `Seguimiento en el Panel Comercial: ${URL_PANEL}`,
  ].filter((l) => l !== '').join('\n');

  /* --------------------------------------------------------------------- html */

  const contenido = [
    encabezado({
      ...CAMPANA,
      rotuloTexto: 'Nueva campaña activa',
      etiqueta: { texto: tipo.etiqueta, color: tipo.color, fondo: tipo.fondo },
      titulo: campana.nombre,
      color: tipo.color,
    }),

    // El "por qué" va primero y con el cuerpo más grande: es lo que decide si el resto
    // del correo se lee o no.
    campana.senal
      ? `<tr><td style="padding:22px ${M}px 0 ${M}px;">
           <p style="margin:0;font:400 16px/1.7 ${FUENTE};color:${COLOR.texto};">
             ${escapar(campana.senal)}</p>
         </td></tr>`
      : '',

    cifras([
      ...(base?.clientes != null
        ? [{ rotulo: 'La base', valor: `${numero(base.clientes)} cuentas` }] : []),
      ...(base?.arr_6m_usd != null
        ? [{ rotulo: 'En juego (6 m)', valor: usdCorto(base.arr_6m_usd) }] : []),
      ...(fecha ? [{ rotulo: 'Hasta', valor: fecha.replace(/ de \d{4}$/, '') }] : []),
    ]),

    base?.paises?.length
      ? `<tr><td style="padding:10px ${M}px 0 ${M}px;">
           <p style="margin:0;font:${TIPO.menor};color:${COLOR.apagado};">
             Países: ${escapar(base.paises.join(' · '))}</p>
         </td></tr>`
      : '',

    division(),

    // Qué cuenta como avance: sin esto, cada ejecutivo asume una cosa distinta.
    `<tr><td style="padding:22px ${M}px 0 ${M}px;">
       ${rotulo('Qué cuenta como avance')}
       <p style="margin:0;font:${TIPO.subtitulo};color:${COLOR.tinta};">${escapar(meta)}</p>
     </td></tr>`,

    seccion('Qué se ofrece', escapar(campana.producto || '—')),

    campana.pitch
      ? `<tr><td style="padding:22px ${M}px 0 ${M}px;">
           ${rotulo('Cómo plantearlo al cliente')}
           <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
             <tr>
               <td width="3" style="background:${tipo.color};font-size:0;line-height:0;
                   border-radius:2px;">&nbsp;</td>
               <td style="padding:2px 0 2px 16px;">
                 <p style="margin:0;font:400 15px/1.7 ${FUENTE};color:${COLOR.texto};">
                   ${escapar(campana.pitch)}</p>
               </td>
             </tr>
           </table>
         </td></tr>`
      : '',

    // El incentivo cierra el mensaje: es la razón por la que esto es una campaña y no un
    // instructivo. Se destaca en verde, el único color que no es el del tipo de campaña.
    // Si se decidió sin incentivo el bloque no aparece: un recuadro que diga "sin premio"
    // resta más de lo que informa.
    incentivoEnPalabras(seg)
      ? `<tr><td style="padding:26px ${M}px 0 ${M}px;">
       <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
              style="background:#ECFDF5;border:1px solid #A7F3D0;border-radius:14px;">
         <tr><td style="padding:18px 20px;">
           ${rotulo('Incentivo para el equipo', '#047857')}
           <p style="margin:0;font:400 15px/1.65 ${FUENTE};color:#065F46;">
             ${escapar(incentivoEnPalabras(seg) as string)}</p>
           ${seg.incentivo_area
             ? `<p style="margin:10px 0 0 0;font:${TIPO.menor};color:#047857;">
                  Lo gestiona ${escapar(seg.incentivo_area)}${
                    seg.incentivo_contacto ? ` · ${escapar(seg.incentivo_contacto)}` : ''}</p>`
             : ''}
         </td></tr>
       </table>
     </td></tr>`
      : '',

    ejecutivos.length
      ? `<tr><td style="padding:26px ${M}px 0 ${M}px;">
           ${rotulo(`Ejecutivos involucrados (${ejecutivos.length})`)}
           <p style="margin:0;font:${TIPO.menor};color:${COLOR.texto};">
             ${escapar(ejecutivos.map((e) => e.nombre).join(' · '))}</p>
         </td></tr>`
      : '',

    boton('Abrir el Panel Comercial', URL_PANEL, tipo.color),

    pie('Campaña generada desde el Panel Comercial a partir del análisis de cartera. '
      + 'Las cifras corresponden al corte del brief y se actualizan cada semana.'),
  ].join('\n');

  const html = envoltura({
    titulo: asunto,
    vistaPrevia: campana.senal || campana.producto || tipo.etiqueta,
    acento: tipo.color,
    contenido,
  });

  return { asunto, html, texto };
}

/* ================================================ 2. las cuentas seleccionadas */

/**
 * Tope de cuentas que se listan en el correo.
 *
 * No es una decisión estética: el HTML va en base64 dentro del mensaje y una lista muy
 * larga hincha el correo hasta que Gmail lo recorta con "[Mensaje recortado]", que es
 * justo perder el final. Lo que no entra se consulta en el panel, y el correo lo dice.
 */
const TOPE_CUENTAS = 60;

/**
 * Clave con la que se cruza una cuenta contra su acción. Es la misma que usa el backend
 * para cruzar el snapshot contra la cartera: (país, panel_id). Nunca id_tributario.
 */
export function claveCuenta(c: { pais: string; panel_id?: string | number | null }): string {
  return `${c.pais}||${c.panel_id}`;
}

/**
 * @param acciones  qué hacer con cada cuenta, por clave (país||panel_id). Viene de
 *   `/api/campanas/avance`. Si no se pasa, el correo sale sin la línea de acción — que es
 *   lo que corresponde cuando el avance todavía no cargó: mejor sin consejo que con uno
 *   inventado.
 * @param accionGeneral  recomendación de la campaña entera, para encabezar la lista.
 */
export function construirCorreoClientes(
  campana: Campana,
  seg: Seguimiento,
  acciones?: Map<string, AccionCuenta | null | undefined>,
  accionGeneral?: string,
): CorreoArmado {
  const tipo = estiloTipo(campana.tipo);
  const meta = metricaDeCampana(campana.metrica, campana.tipo);
  const asunto = `Cuentas seleccionadas · ${campana.nombre}`;
  const fecha = fechaLarga(seg.fecha_objetivo);

  const todas = campana.cuentas ?? [];
  // De mayor a menor facturación: si hay que cortar, que sobre lo de menos peso.
  const ordenadas = [...todas].sort(
    (a, b) => (b.monto_6m_usd ?? 0) - (a.monto_6m_usd ?? 0),
  );
  const listadas = ordenadas.slice(0, TOPE_CUENTAS);
  const recortadas = todas.length - listadas.length;

  // Agrupadas por ejecutivo, que es como cada quien va a leer la lista.
  const porKam = new Map<string, CuentaBase[]>();
  for (const c of listadas) {
    const k = c.kam?.trim() || 'Sin ejecutivo asignado';
    if (!porKam.has(k)) porKam.set(k, []);
    porKam.get(k)!.push(c);
  }
  const grupos = [...porKam.entries()].sort((a, b) => b[1].length - a[1].length);

  /* -------------------------------------------------------------- texto plano */

  const lineasTexto: string[] = [
    `CUENTAS SELECCIONADAS — ${campana.nombre}`,
    `${numero(todas.length)} cuentas · ${meta}`,
    fecha ? `Fecha objetivo: ${fecha}` : '',
    '',
    ...(accionGeneral ? ['POR DÓNDE EMPEZAR', accionGeneral, ''] : []),
  ];
  for (const [kam, cuentas] of grupos) {
    lineasTexto.push(`${kam.toUpperCase()} (${cuentas.length})`);
    for (const c of cuentas) {
      lineasTexto.push(
        `  · ${c.nombre} — ${c.pais}${
          c.monto_6m_usd != null ? ` — ${usd(c.monto_6m_usd)}` : ''}`,
      );
      const a = acciones?.get(claveCuenta(c));
      if (a?.texto) lineasTexto.push(`      ${a.texto}`);
    }
    lineasTexto.push('');
  }
  if (recortadas > 0) {
    lineasTexto.push(`(${numero(recortadas)} cuentas más en el panel.)`, '');
  }
  lineasTexto.push(`Lista completa y seguimiento: ${URL_PANEL}`);
  const texto = lineasTexto.join('\n');

  /* --------------------------------------------------------------------- html */

  const filaCuenta = (c: CuentaBase) => {
    const accion = acciones?.get(claveCuenta(c));
    return `
    <tr>
      <td style="padding:9px 0 ${accion ? '2px' : '9px'} 0;border-top:1px solid ${COLOR.bordeSuave};
                 font:400 14px/1.45 ${FUENTE};color:${COLOR.tinta};">${escapar(c.nombre)}</td>
      <td align="right" style="padding:9px 0 ${accion ? '2px' : '9px'} 12px;
                 border-top:1px solid ${COLOR.bordeSuave};
                 font:${TIPO.menor};color:${COLOR.apagado};white-space:nowrap;">${escapar(c.pais)}</td>
      <td align="right" style="padding:9px 0 ${accion ? '2px' : '9px'} 12px;
                 border-top:1px solid ${COLOR.bordeSuave};
                 font:400 13px/1.45 ${FUENTE};color:${COLOR.texto};white-space:nowrap;">
        ${c.monto_6m_usd != null ? escapar(usdCorto(c.monto_6m_usd)) : '—'}</td>
    </tr>` + (accion ? `
    <tr>
      <td colspan="3" style="padding:0 0 10px 0;font:400 12.5px/1.5 ${FUENTE};
                 color:${COLOR.apagado};">${escapar(accion.texto)}</td>
    </tr>` : '');
  };

  const bloquesKam = grupos.map(([kam, cuentas]) => {
    const suma = cuentas.reduce((t, c) => t + (c.monto_6m_usd ?? 0), 0);
    return `
    <tr><td style="padding:26px ${M}px 0 ${M}px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
          <td style="font:600 15px/1.4 ${FUENTE};color:${COLOR.tinta};">${escapar(kam)}</td>
          <td align="right" style="font:${TIPO.menor};color:${COLOR.apagado};white-space:nowrap;">
            ${cuentas.length} ${cuentas.length === 1 ? 'cuenta' : 'cuentas'}
            ${suma > 0 ? ` · ${escapar(usdCorto(suma))}` : ''}</td>
        </tr>
      </table>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
             style="margin-top:8px;">
        ${cuentas.map(filaCuenta).join('')}
      </table>
    </td></tr>`;
  }).join('\n');

  const contenido = [
    encabezado({
      ...CLIENTES,
      rotuloTexto: 'Cuentas seleccionadas',
      etiqueta: { texto: tipo.etiqueta, color: tipo.color, fondo: tipo.fondo },
      titulo: campana.nombre,
      color: tipo.color,
    }),

    `<tr><td style="padding:22px ${M}px 0 ${M}px;">
       <p style="margin:0;font:400 16px/1.7 ${FUENTE};color:${COLOR.texto};">
         Estas son las cuentas que entran en la campaña. Cada una suma cuando
         <strong style="color:${COLOR.tinta};">${escapar(meta.toLowerCase())}</strong>${
           fecha ? `, antes del ${escapar(fecha)}` : ''}.</p>
     </td></tr>`,

    cifras([
      { rotulo: 'Cuentas', valor: numero(todas.length) },
      ...(campana.base?.arr_6m_usd != null
        ? [{ rotulo: 'En juego (6 m)', valor: usdCorto(campana.base.arr_6m_usd) }] : []),
      { rotulo: 'Ejecutivos', valor: String(grupos.length) },
    ]),

    accionGeneral
      ? `<tr><td style="padding:24px ${M}px 0 ${M}px;">
           <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
                  style="background:${COLOR.panel};border:1px solid ${COLOR.borde};
                         border-radius:14px;">
             <tr><td style="padding:16px 18px;">
               ${rotulo('Por dónde empezar')}
               <p style="margin:0;font:400 14px/1.6 ${FUENTE};color:${COLOR.texto};">
                 ${escapar(accionGeneral)}</p>
             </td></tr>
           </table>
         </td></tr>`
      : '',

    division(),
    bloquesKam,

    recortadas > 0
      ? `<tr><td style="padding:24px ${M}px 0 ${M}px;">
           <p style="margin:0;font:${TIPO.menor};color:${COLOR.apagado};">
             Se listan las ${numero(listadas.length)} cuentas de mayor facturación.
             Las otras ${numero(recortadas)} están en el panel.</p>
         </td></tr>`
      : '',

    boton('Ver la lista completa', URL_PANEL, tipo.color),

    pie('La selección sale del análisis de cartera del Panel Comercial. '
      + 'Si una cuenta no corresponde, se puede quitar desde el panel y la base se recalcula.'),
  ].join('\n');

  const html = envoltura({
    titulo: asunto,
    vistaPrevia: `${numero(todas.length)} cuentas · ${meta}`,
    acento: tipo.color,
    contenido,
  });

  return { asunto, html, texto };
}

/**
 * MIME para la API de Gmail.
 *
 * `multipart/alternative` con el texto plano primero y el HTML después: el orden importa,
 * porque el cliente muestra la última parte que sepa interpretar.
 *
 * El base64 se corta en líneas de 76 caracteres porque es lo que exige RFC 2045; sin eso,
 * algunos servidores rechazan el mensaje.
 */
export function construirMime(para: string[], correo: CorreoArmado, de?: string): string {
  const alt = `=_alt_${Math.random().toString(36).slice(2)}`;

  const b64 = (s: string) => {
    const bytes = new TextEncoder().encode(s);
    let bin = '';
    bytes.forEach((b) => { bin += String.fromCharCode(b); });
    return btoa(bin);
  };
  const enLineas = (s: string) => (s.match(/.{1,76}/g) ?? []).join('\r\n');

  const mensaje = [
    ...(de ? [`From: ${de}`] : []),
    `To: ${para.join(', ')}`,
    `Subject: =?UTF-8?B?${b64(correo.asunto)}?=`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${alt}"`,
    '',
    `--${alt}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    enLineas(b64(correo.texto)),
    '',
    `--${alt}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    enLineas(b64(correo.html)),
    '',
    `--${alt}--`,
  ].join('\r\n');

  return b64(mensaje).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

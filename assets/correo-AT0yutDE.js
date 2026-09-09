import{c as e,d as t,f as n,l as r,o as i,r as a,s as o}from"./formato-DgX8wXLE.js";var s=`https://salvaradoh.github.io/panel-comercial/correo`,c={url:`${s}/campaign-v3.gif`,ancho:300,alto:270,rellenoArriba:26,alt:`Nueva campaña`},l={url:`${s}/clients-v3.gif`,ancho:214,alto:132,rellenoArriba:30,alt:`Cuentas seleccionadas`},u=`Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif`,d={rotulo:`600 11px/1.4 ${u}`,titulo:`600 26px/1.25 ${u}`,subtitulo:`600 17px/1.35 ${u}`,cuerpo:`400 15px/1.65 ${u}`,menor:`400 13px/1.6 ${u}`,cifra:`600 22px/1.15 ${u}`,pie:`400 12px/1.65 ${u}`},f={fondo:`#F1F5F9`,tarjeta:`#FFFFFF`,borde:`#E2E8F0`,bordeSuave:`#F1F5F9`,tinta:`#0F172A`,texto:`#334155`,apagado:`#64748B`,tenue:`#94A3B8`,panel:`#F8FAFC`},p=`https://salvaradoh.github.io/panel-comercial/`,m=e=>String(e??``).replace(/&/g,`&amp;`).replace(/</g,`&lt;`).replace(/>/g,`&gt;`).replace(/"/g,`&quot;`);function h(e){let t=`&#8199;&#65279;&nbsp;`.repeat(80);return`<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;
       font-size:1px;line-height:1px;color:transparent;opacity:0;">${m(e)}${t}</div>`}function g(e,t=f.apagado){return`<p style="margin:0 0 6px 0;font:${d.rotulo};letter-spacing:.09em;
             text-transform:uppercase;color:${t};">${m(e)}</p>`}function _(e,t){return`
    <tr><td style="padding:22px 36px 0 36px;">
      ${g(e)}
      <div style="font:${d.cuerpo};color:${f.texto};">${t}</div>
    </td></tr>`}function v(){return`
    <tr><td style="padding:26px 36px 0 36px;">
      <div style="height:1px;background:${f.borde};font-size:0;line-height:0;">&nbsp;</div>
    </td></tr>`}function y(e,t,n){return`
    <tr><td align="center" style="padding:30px 36px 0 36px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
        <tr><td align="center" bgcolor="${n}" style="border-radius:10px;">
          <a href="${t}" target="_blank"
             style="display:inline-block;padding:14px 30px;border-radius:10px;
                    background:${n};color:#FFFFFF;text-decoration:none;
                    font:600 15px/1 ${u};letter-spacing:.01em;">${m(e)}</a>
        </td></tr>
      </table>
    </td></tr>`}function b(e){return`
    <tr><td style="padding:30px 36px 36px 36px;">
      <div style="height:1px;background:${f.borde};font-size:0;line-height:0;">&nbsp;</div>
      <p style="margin:18px 0 0 0;font:${d.pie};color:${f.tenue};">${e}</p>
      <p style="margin:8px 0 0 0;font:${d.pie};color:${f.tenue};">
        Si el botón no funciona, entra a
        <a href="${p}" style="color:${f.apagado};">${p}</a>
      </p>
    </td></tr>`}function x(e){return`
    <tr><td align="center" style="padding:${e.rellenoArriba}px 36px 0 36px;">
      <img src="${e.url}" width="${e.ancho}" height="${e.alto}" alt="${m(e.alt)}"
           style="display:block;width:${e.ancho}px;height:${e.alto}px;max-width:100%;
                  border:0;outline:none;text-decoration:none;color:${f.tenue};
                  font:${d.menor};" />
    </td></tr>

    <tr><td align="center" style="padding:18px 36px 0 36px;">
      <p style="margin:0;font:700 12px/1.3 ${u};letter-spacing:.13em;
                text-transform:uppercase;color:${e.color};">${m(e.rotuloTexto)}</p>
      ${e.etiqueta?`<span style="display:inline-block;margin-top:12px;padding:5px 12px;border-radius:999px;
                 background:${e.etiqueta.fondo};color:${e.etiqueta.color};
                 font:600 11px/1.4 ${u};letter-spacing:.04em;">${m(e.etiqueta.texto)}</span>`:``}
      <h1 style="margin:14px 0 0 0;font:${d.titulo};letter-spacing:-.018em;color:${f.tinta};">
        ${m(e.titulo)}</h1>
    </td></tr>`}function S(e){return`<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${m(e.titulo)}</title>
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
<body style="margin:0;padding:0;background:${f.fondo};">
${h(e.vistaPrevia)}
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
       style="background:${f.fondo};padding:32px 0;">
 <tr><td align="center" style="padding:0 12px;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="640" class="tarjeta"
         style="width:100%;max-width:640px;background:${f.tarjeta};
                border:1px solid ${f.borde};border-radius:18px;overflow:hidden;">
    <tr><td style="height:5px;background:${e.acento};font-size:0;line-height:0;">&nbsp;</td></tr>
${e.contenido}
  </table>
 </td></tr>
</table>
</body>
</html>`}var C=36;function w(t){if(t.incentivo_tipo===`ninguno`)return null;let n=[];t.incentivo_tipo&&n.push(a[t.incentivo_tipo]);let r=e(t.incentivo_tipo,t.incentivo_monto);r&&n.push(r);let i=n.join(` · `);return i&&t.incentivo_descripcion?`${i} — ${t.incentivo_descripcion}`:i||t.incentivo_descripcion||`Por definir con el área.`}function T(e){return e?new Date(`${e}T00:00:00`).toLocaleDateString(`es-CL`,{day:`2-digit`,month:`long`,year:`numeric`}):null}function E(e){if(!e.length)return``;let t=Math.floor(100/e.length),n=e.map((e,n)=>`
    <td width="${t}%" style="padding:16px 18px;vertical-align:top;
        ${n?`border-left:1px solid ${f.borde};`:``}">
      <p style="margin:0;font:${d.rotulo};letter-spacing:.09em;text-transform:uppercase;
                color:${f.apagado};">${m(e.rotulo)}</p>
      <p style="margin:6px 0 0 0;font:${d.cifra};letter-spacing:-.02em;color:${f.tinta};">
        ${m(e.valor)}</p>
    </td>`).join(``);return`
    <tr><td style="padding:24px ${C}px 0 ${C}px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
             style="border:1px solid ${f.borde};border-radius:14px;background:${f.panel};">
        <tr>${n}</tr>
      </table>
    </td></tr>`}function D(e,a,s){let l=i(e.tipo),h=e.base,D=`Nueva campaña activa: ${l.etiqueta} · ${e.nombre}`,O=o(e.metrica,e.tipo),k=s.filter(e=>e.rol!==`Área de incentivos`),A=T(a.fecha_objetivo),j=[`NUEVA CAMPAÑA ACTIVA — ${l.etiqueta.toUpperCase()}`,e.nombre,``,`POR QUÉ AHORA`,e.senal||`—`,``,`LA BASE`,h?.clientes==null?`—`:`${r(h.clientes)} cuentas`,h?.arr_6m_usd==null?``:`Facturación semestral en juego: ${t(h.arr_6m_usd)}`,h?.paises?.length?`Países: ${h.paises.join(`, `)}`:``,``,`QUÉ CUENTA COMO AVANCE`,O,``,`QUÉ SE OFRECE`,e.producto||`—`,``,`CÓMO PLANTEARLO AL CLIENTE`,e.pitch||`—`,``,...w(a)?[`INCENTIVO PARA EL EQUIPO`,w(a),a.incentivo_area?`Área que lo gestiona: ${a.incentivo_area}`:``,``]:[],A?`FECHA OBJETIVO: ${A}`:``,k.length?`Ejecutivos involucrados: ${k.map(e=>e.nombre).join(`, `)}`:``,``,`Seguimiento en el Panel Comercial: ${p}`].filter(e=>e!==``).join(`
`),M=[x({...c,rotuloTexto:`Nueva campaña activa`,etiqueta:{texto:l.etiqueta,color:l.color,fondo:l.fondo},titulo:e.nombre,color:l.color}),e.senal?`<tr><td style="padding:22px ${C}px 0 ${C}px;">
           <p style="margin:0;font:400 16px/1.7 ${u};color:${f.texto};">
             ${m(e.senal)}</p>
         </td></tr>`:``,E([...h?.clientes==null?[]:[{rotulo:`La base`,valor:`${r(h.clientes)} cuentas`}],...h?.arr_6m_usd==null?[]:[{rotulo:`En juego (6 m)`,valor:n(h.arr_6m_usd)}],...A?[{rotulo:`Hasta`,valor:A.replace(/ de \d{4}$/,``)}]:[]]),h?.paises?.length?`<tr><td style="padding:10px ${C}px 0 ${C}px;">
           <p style="margin:0;font:${d.menor};color:${f.apagado};">
             Países: ${m(h.paises.join(` · `))}</p>
         </td></tr>`:``,v(),`<tr><td style="padding:22px ${C}px 0 ${C}px;">
       ${g(`Qué cuenta como avance`)}
       <p style="margin:0;font:${d.subtitulo};color:${f.tinta};">${m(O)}</p>
     </td></tr>`,_(`Qué se ofrece`,m(e.producto||`—`)),e.pitch?`<tr><td style="padding:22px ${C}px 0 ${C}px;">
           ${g(`Cómo plantearlo al cliente`)}
           <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
             <tr>
               <td width="3" style="background:${l.color};font-size:0;line-height:0;
                   border-radius:2px;">&nbsp;</td>
               <td style="padding:2px 0 2px 16px;">
                 <p style="margin:0;font:400 15px/1.7 ${u};color:${f.texto};">
                   ${m(e.pitch)}</p>
               </td>
             </tr>
           </table>
         </td></tr>`:``,w(a)?`<tr><td style="padding:26px ${C}px 0 ${C}px;">
       <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
              style="background:#ECFDF5;border:1px solid #A7F3D0;border-radius:14px;">
         <tr><td style="padding:18px 20px;">
           ${g(`Incentivo para el equipo`,`#047857`)}
           <p style="margin:0;font:400 15px/1.65 ${u};color:#065F46;">
             ${m(w(a))}</p>
           ${a.incentivo_area?`<p style="margin:10px 0 0 0;font:${d.menor};color:#047857;">
                  Lo gestiona ${m(a.incentivo_area)}${a.incentivo_contacto?` · ${m(a.incentivo_contacto)}`:``}</p>`:``}
         </td></tr>
       </table>
     </td></tr>`:``,k.length?`<tr><td style="padding:26px ${C}px 0 ${C}px;">
           ${g(`Ejecutivos involucrados (${k.length})`)}
           <p style="margin:0;font:${d.menor};color:${f.texto};">
             ${m(k.map(e=>e.nombre).join(` · `))}</p>
         </td></tr>`:``,y(`Abrir el Panel Comercial`,p,l.color),b(`Campaña generada desde el Panel Comercial a partir del análisis de cartera. Las cifras corresponden al corte del brief y se actualizan cada semana.`)].join(`
`);return{asunto:D,html:S({titulo:D,vistaPrevia:e.senal||e.producto||l.etiqueta,acento:l.color,contenido:M}),texto:j}}var O=60;function k(e){return`${e.pais}||${e.panel_id}`}function A(e,a,s,c){let h=i(e.tipo),_=o(e.metrica,e.tipo),w=`Cuentas seleccionadas · ${e.nombre}`,D=T(a.fecha_objetivo),A=e.cuentas??[],j=[...A].sort((e,t)=>(t.monto_6m_usd??0)-(e.monto_6m_usd??0)).slice(0,O),M=A.length-j.length,N=new Map;for(let e of j){let t=e.kam?.trim()||`Sin ejecutivo asignado`;N.has(t)||N.set(t,[]),N.get(t).push(e)}let P=[...N.entries()].sort((e,t)=>t[1].length-e[1].length),F=[`CUENTAS SELECCIONADAS — ${e.nombre}`,`${r(A.length)} cuentas · ${_}`,D?`Fecha objetivo: ${D}`:``,``,...c?[`POR DÓNDE EMPEZAR`,c,``]:[]];for(let[e,n]of P){F.push(`${e.toUpperCase()} (${n.length})`);for(let e of n){F.push(`  · ${e.nombre} — ${e.pais}${e.monto_6m_usd==null?``:` — ${t(e.monto_6m_usd)}`}`);let n=s?.get(k(e));n?.texto&&F.push(`      ${n.texto}`)}F.push(``)}M>0&&F.push(`(${r(M)} cuentas más en el panel.)`,``),F.push(`Lista completa y seguimiento: ${p}`);let I=F.join(`
`),L=e=>{let t=s?.get(k(e));return`
    <tr>
      <td style="padding:9px 0 ${t?`2px`:`9px`} 0;border-top:1px solid ${f.bordeSuave};
                 font:400 14px/1.45 ${u};color:${f.tinta};">${m(e.nombre)}</td>
      <td align="right" style="padding:9px 0 ${t?`2px`:`9px`} 12px;
                 border-top:1px solid ${f.bordeSuave};
                 font:${d.menor};color:${f.apagado};white-space:nowrap;">${m(e.pais)}</td>
      <td align="right" style="padding:9px 0 ${t?`2px`:`9px`} 12px;
                 border-top:1px solid ${f.bordeSuave};
                 font:400 13px/1.45 ${u};color:${f.texto};white-space:nowrap;">
        ${e.monto_6m_usd==null?`—`:m(n(e.monto_6m_usd))}</td>
    </tr>`+(t?`
    <tr>
      <td colspan="3" style="padding:0 0 10px 0;font:400 12.5px/1.5 ${u};
                 color:${f.apagado};">${m(t.texto)}</td>
    </tr>`:``)},R=P.map(([e,t])=>{let r=t.reduce((e,t)=>e+(t.monto_6m_usd??0),0);return`
    <tr><td style="padding:26px ${C}px 0 ${C}px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
          <td style="font:600 15px/1.4 ${u};color:${f.tinta};">${m(e)}</td>
          <td align="right" style="font:${d.menor};color:${f.apagado};white-space:nowrap;">
            ${t.length} ${t.length===1?`cuenta`:`cuentas`}
            ${r>0?` · ${m(n(r))}`:``}</td>
        </tr>
      </table>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
             style="margin-top:8px;">
        ${t.map(L).join(``)}
      </table>
    </td></tr>`}).join(`
`),z=[x({...l,rotuloTexto:`Cuentas seleccionadas`,etiqueta:{texto:h.etiqueta,color:h.color,fondo:h.fondo},titulo:e.nombre,color:h.color}),`<tr><td style="padding:22px ${C}px 0 ${C}px;">
       <p style="margin:0;font:400 16px/1.7 ${u};color:${f.texto};">
         Estas son las cuentas que entran en la campaña. Cada una suma cuando
         <strong style="color:${f.tinta};">${m(_.toLowerCase())}</strong>${D?`, antes del ${m(D)}`:``}.</p>
     </td></tr>`,E([{rotulo:`Cuentas`,valor:r(A.length)},...e.base?.arr_6m_usd==null?[]:[{rotulo:`En juego (6 m)`,valor:n(e.base.arr_6m_usd)}],{rotulo:`Ejecutivos`,valor:String(P.length)}]),c?`<tr><td style="padding:24px ${C}px 0 ${C}px;">
           <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
                  style="background:${f.panel};border:1px solid ${f.borde};
                         border-radius:14px;">
             <tr><td style="padding:16px 18px;">
               ${g(`Por dónde empezar`)}
               <p style="margin:0;font:400 14px/1.6 ${u};color:${f.texto};">
                 ${m(c)}</p>
             </td></tr>
           </table>
         </td></tr>`:``,v(),R,M>0?`<tr><td style="padding:24px ${C}px 0 ${C}px;">
           <p style="margin:0;font:${d.menor};color:${f.apagado};">
             Se listan las ${r(j.length)} cuentas de mayor facturación.
             Las otras ${r(M)} están en el panel.</p>
         </td></tr>`:``,y(`Ver la lista completa`,p,h.color),b(`La selección sale del análisis de cartera del Panel Comercial. Si una cuenta no corresponde, se puede quitar desde el panel y la base se recalcula.`)].join(`
`);return{asunto:w,html:S({titulo:w,vistaPrevia:`${r(A.length)} cuentas · ${_}`,acento:h.color,contenido:z}),texto:I}}function j(e,t,n){let r=`=_alt_${Math.random().toString(36).slice(2)}`,i=e=>{let t=new TextEncoder().encode(e),n=``;return t.forEach(e=>{n+=String.fromCharCode(e)}),btoa(n)},a=e=>(e.match(/.{1,76}/g)??[]).join(`\r
`);return i([...n?[`From: ${n}`]:[],`To: ${e.join(`, `)}`,`Subject: =?UTF-8?B?${i(t.asunto)}?=`,`MIME-Version: 1.0`,`Content-Type: multipart/alternative; boundary="${r}"`,``,`--${r}`,`Content-Type: text/plain; charset=UTF-8`,`Content-Transfer-Encoding: base64`,``,a(i(t.texto)),``,`--${r}`,`Content-Type: text/html; charset=UTF-8`,`Content-Transfer-Encoding: base64`,``,a(i(t.html)),``,`--${r}--`].join(`\r
`)).replace(/\+/g,`-`).replace(/\//g,`_`).replace(/=+$/,``)}export{j as i,D as n,A as r,k as t};
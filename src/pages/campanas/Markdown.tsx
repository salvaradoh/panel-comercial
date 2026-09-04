import { useMemo } from 'react';
import { ACENTO } from './formato';

/**
 * El brief viene en Markdown acotado (encabezados, viñetas, negritas, código inline).
 * Se renderiza a elementos de React en vez de inyectar HTML: nada de innerHTML con texto
 * que se generó fuera de la app. Lo que no reconoce cae a párrafo plano.
 */

export function inline(texto: string, key: string) {
  const partes = texto.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
  return partes.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) {
      return <strong key={`${key}-${i}`} className="font-semibold text-slate-900">{p.slice(2, -2)}</strong>;
    }
    if (p.startsWith('`') && p.endsWith('`')) {
      return (
        <code key={`${key}-${i}`} className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[0.85em] text-slate-700">
          {p.slice(1, -1)}
        </code>
      );
    }
    return <span key={`${key}-${i}`}>{p}</span>;
  });
}

export function Markdown({ texto, acento = ACENTO }: { texto: string; acento?: string }) {
  const bloques = useMemo(() => {
    const out: React.ReactNode[] = [];
    let lista: string[] = [];

    const cerrarLista = () => {
      if (!lista.length) return;
      out.push(
        <ul key={`ul-${out.length}`} className="my-2 space-y-1.5 pl-5">
          {lista.map((li, i) => (
            <li key={i} className="relative text-[13.5px] leading-relaxed text-slate-700">
              <span className="absolute -left-4 top-[0.55em] h-1.5 w-1.5 rounded-full" style={{ background: acento }} aria-hidden="true" />
              {inline(li, `li-${out.length}-${i}`)}
            </li>
          ))}
        </ul>,
      );
      lista = [];
    };

    texto.split('\n').forEach((linea, idx) => {
      const l = linea.trim();
      if (!l) { cerrarLista(); return; }

      const item = l.match(/^[-*]\s+(.*)$/);
      if (item) { lista.push(item[1]); return; }
      cerrarLista();

      if (l.startsWith('### ')) {
        out.push(<h4 key={idx} className="mt-4 mb-1 text-[13px] font-semibold tracking-tight text-slate-800">{inline(l.slice(4), `h4-${idx}`)}</h4>);
      } else if (l.startsWith('## ')) {
        out.push(<h3 key={idx} className="mt-5 mb-2 text-[15px] font-semibold tracking-tight text-slate-900">{inline(l.slice(3), `h3-${idx}`)}</h3>);
      } else if (l.startsWith('# ')) {
        out.push(<h2 key={idx} className="mt-5 mb-2 text-base font-semibold tracking-tight text-slate-900">{inline(l.slice(2), `h2-${idx}`)}</h2>);
      } else if (/^[-—_]{3,}$/.test(l)) {
        out.push(<hr key={idx} className="my-4 border-slate-200" />);
      } else {
        out.push(<p key={idx} className="my-2 text-[13.5px] leading-relaxed text-slate-700">{inline(l, `p-${idx}`)}</p>);
      }
    });
    cerrarLista();
    return out;
  }, [texto, acento]);

  return <div>{bloques}</div>;
}

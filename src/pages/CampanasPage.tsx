import { useMemo, useState } from 'react';
import { useBriefCampanas } from '../hooks/useCampanas';

const ACENTO = '#7C3AED';

/* --------------------------------------------------------------- markdown

   El brief viene en Markdown acotado (encabezados, viñetas, negritas, código
   inline). Se renderiza a elementos de React en vez de inyectar HTML: nada de
   innerHTML con texto que se generó fuera de la app. Lo que no reconoce cae a
   párrafo plano. */

function inline(texto: string, key: string) {
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

function Markdown({ texto }: { texto: string }) {
  const bloques = useMemo(() => {
    const out: React.ReactNode[] = [];
    let lista: string[] = [];

    const cerrarLista = () => {
      if (!lista.length) return;
      out.push(
        <ul key={`ul-${out.length}`} className="my-2 space-y-1.5 pl-5">
          {lista.map((li, i) => (
            <li key={i} className="relative text-[13.5px] leading-relaxed text-slate-700">
              <span className="absolute -left-4 top-[0.55em] h-1.5 w-1.5 rounded-full" style={{ background: ACENTO }} aria-hidden="true" />
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
  }, [texto]);

  return <div>{bloques}</div>;
}

/* ------------------------------------------------------------------ piezas */

function Pregunta({ pregunta, respuesta }: { pregunta: string; respuesta: string }) {
  const [abierta, setAbierta] = useState(false);
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <button
        onClick={() => setAbierta((v) => !v)}
        aria-expanded={abierta}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50"
      >
        <span className="text-[13.5px] font-medium text-slate-800">{pregunta}</span>
        <span
          className="shrink-0 text-slate-400 transition-transform duration-200"
          style={{ transform: abierta ? 'rotate(90deg)' : 'none' }}
          aria-hidden="true"
        >
          ▸
        </span>
      </button>
      {abierta && (
        <div className="border-t border-slate-100 px-4 pb-3 pt-1">
          <Markdown texto={respuesta} />
        </div>
      )}
    </div>
  );
}

function Vacio({ motivo }: { motivo?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      <p className="text-[14px] font-medium text-slate-800">Todavía no hay un brief publicado</p>
      <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-slate-500">
        El brief se genera con el comando <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[12px]">/campanas</code>{' '}
        y se publica en la hoja <span className="font-medium">Cache_Campanas</span>. Una vez publicado aparece acá.
      </p>
      {motivo && <p className="mt-3 font-mono text-[11px] text-slate-400">{motivo}</p>}
    </div>
  );
}

/* -------------------------------------------------------------------- vista */

export function CampanasPage() {
  const { data: brief, isLoading, error } = useBriefCampanas();
  const errorObj = error as Error | null;
  const esForbidden = errorObj?.message.includes('403');

  return (
    <div className="py-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Campañas comerciales</h1>
          <p className="mt-0.5 text-[13px] text-slate-500">
            Cambios de la cartera global y campañas propuestas, con base objetivo y producto.
          </p>
        </div>
        {brief && !brief.sin_publicar && (
          <div className="text-right">
            <span className="block text-[11.5px] tabular-nums text-slate-400">
              {new Date(brief.generado_en!).toLocaleString('es-CL', {
                day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
              })}
            </span>
            {brief.semana_id && (
              <span className="block font-mono text-[11px] text-slate-400">{brief.semana_id}</span>
            )}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <span
            className="h-5 w-5 animate-spin rounded-full border-2 border-t-transparent"
            style={{ borderColor: ACENTO, borderTopColor: 'transparent' }}
            aria-label="Cargando"
          />
        </div>
      ) : errorObj ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-[13.5px] font-medium text-amber-900">
            {esForbidden ? 'Esta vista es solo para Admin.' : 'No se pudo leer el brief.'}
          </p>
          <p className="mt-1 font-mono text-[11.5px] break-all text-amber-700">{errorObj.message}</p>
        </div>
      ) : !brief || brief.sin_publicar ? (
        <Vacio motivo={brief?.motivo} />
      ) : (
        <>
          <section aria-label="Brief de campañas" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <Markdown texto={brief.markdown ?? ''} />
          </section>

          {(brief.preguntas?.length ?? 0) > 0 && (
            <section aria-label="Preguntas frecuentes sobre la cartera" className="mt-5">
              <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-slate-500">
                Preguntas frecuentes
              </h2>
              <div className="space-y-2">
                {brief.preguntas!.map((p, i) => (
                  <Pregunta key={i} pregunta={p.pregunta} respuesta={p.respuesta} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

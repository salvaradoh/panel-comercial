import { useState } from 'react';
import { useProyectoCBS } from '../../hooks/useProyectoCBS';
import { CBS_URL, CBS_HOJA } from '../../lib/cbs';
import { useTrack } from '../../hooks/useTrack';
import { FarmingCBSTab } from './FarmingCBSTab';
import { HuntingCBSTab } from './HuntingCBSTab';

type VistaCBS = 'farming' | 'hunting';

const VISTAS: { id: VistaCBS; label: string }[] = [
  { id: 'farming', label: 'Farming CBS a MX' },
  { id: 'hunting', label: 'Hunting CBS a MX' },
];

export function ProyectoCBS() {
  const [vista, setVista] = useState<VistaCBS>('farming');
  const { datos, isLoading, error } = useProyectoCBS();
  const { track } = useTrack();

  function cambiar(v: VistaCBS) {
    setVista(v);
    track(`proyectos:cbs:${v}`);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Pill nav, mismo patrón que PortafolioNav */}
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit" role="tablist" aria-label="Vistas del proyecto CBS">
          {VISTAS.map((v) => (
            <button
              key={v.id}
              role="tab"
              aria-selected={vista === v.id}
              onClick={() => cambiar(v.id)}
              className={`px-5 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95 ${
                vista === v.id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
        <a
          href={CBS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-slate-400 hover:text-[#E11D48] transition-colors underline underline-offset-2"
        >
          Abrir hoja «{CBS_HOJA}» ↗
        </a>
      </div>

      {/* La vista SIEMPRE renderiza un estado: react-query cachea los errores 30
          min, y un `return null` acá haría desaparecer el tablero sin decir nada. */}
      {isLoading && (
        <div className="flex items-center justify-center h-48">
          <span className="animate-spin w-5 h-5 rounded-full border-2 border-[#E11D48] border-t-transparent" />
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
          <p className="font-semibold text-red-700 mb-1">No se pudo leer la hoja del proyecto</p>
          <p className="text-sm text-red-600">
            Se lee en vivo con tu sesión de Google. Verificá que tengas acceso a{' '}
            <a href={CBS_URL} target="_blank" rel="noopener noreferrer" className="underline">
              «{CBS_HOJA}»
            </a>{' '}
            y volvé a entrar al panel si tu sesión venció.
          </p>
          <p className="text-xs text-red-500 font-mono mt-2 break-all">{(error as Error).message}</p>
        </div>
      )}

      {datos && datos.faltantes.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-800">
          <p className="font-semibold">La hoja cambió de estructura</p>
          <p className="text-xs mt-1">
            Estas columnas ya no existen y sus cifras salen en cero:{' '}
            <span className="font-mono">{datos.faltantes.join(', ')}</span>
          </p>
        </div>
      )}

      {datos && datos.filas.length === 0 && (
        <div className="py-12 text-center text-sm text-slate-400">
          La hoja «{CBS_HOJA}» no tiene filas todavía.
        </div>
      )}

      {datos && datos.filas.length > 0 && (
        vista === 'farming'
          ? <FarmingCBSTab filas={datos.filas} />
          : <HuntingCBSTab filas={datos.filas} />
      )}
    </div>
  );
}

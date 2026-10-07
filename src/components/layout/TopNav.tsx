import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { PresenceBar } from '../ui/PresenceBar';
import { useEjecutivos } from '../../hooks/useEquipo';
import type { UserRoleData } from '../../hooks/useUserRole';

const FLAG_CC: Record<string, string> = {
  Chile: 'cl', Perú: 'pe', Peru: 'pe', Colombia: 'co', México: 'mx', Mexico: 'mx',
};

const PAISES = ['Chile', 'Colombia', 'México', 'Perú'];

interface TopNavProps {
  onLogout: () => void;
  isAdmin?: boolean;
  viewAs?: UserRoleData | null;
  onViewAs?: (exec: UserRoleData | null) => void;
  tickerVisible?: boolean;
  onTickerVisible?: (visible: boolean) => void;
}

/**
 * Cierra un menú al presionar Escape o al tocar fuera.
 *
 * Deliberadamente NO usa `useTrampaDeFoco`: eso es para diálogos, donde lo de
 * atrás no existe. Estos son menús —el usuario de teclado debe poder tabular
 * hacia afuera— y atraparle el foco sería un error de accesibilidad, no una
 * mejora.
 */
function useCierreDeMenu(abierto: boolean, cerrar: () => void) {
  useEffect(() => {
    if (!abierto) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') cerrar(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [abierto, cerrar]);
}

export function TopNav({ onLogout, isAdmin, viewAs, onViewAs, tickerVisible, onTickerVisible }: TopNavProps) {
  const { user } = useAuth();
  const ejecutivos = useEjecutivos();
  const [open, setOpen] = useState(false);
  const [perfilAbierto, setPerfilAbierto] = useState(false);
  const cerrarPerfil = useRef(() => setPerfilAbierto(false)).current;

  useCierreDeMenu(open, () => setOpen(false));
  useCierreDeMenu(perfilAbierto, cerrarPerfil);

  return (
    <>
      {/* px-4 en móvil y px-6 desde sm: el valor de hoy queda intacto en desktop.
          Ese patrón —valor móvil primero, `sm:` restaurando lo actual— se repite
          en todo el shell, y es lo que hace verificable que desktop no cambió. */}
      <header className="bg-white border-b border-slate-200 px-4 sm:px-6 h-14 flex items-center justify-between relative z-20 gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <img
            src="https://empresas.apprecio.com/hs-fs/hubfs/ezgif.com-optimize.gif?width=195&height=195&name=ezgif.com-optimize.gif"
            alt="Apprecio"
            className="w-8 h-8 rounded-lg object-cover flex-shrink-0"
          />
          {/* El logo ya dice Apprecio; en un teléfono el título es lo primero que
              sobra, y son ~210px que necesitan el avatar y el menú. */}
          <span className="hidden sm:inline text-base font-bold text-slate-800 truncate">
            Reportería Global Apprecio
          </span>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          {/* Los avatares de quién está en línea son contexto agradable, no
              información de trabajo: son lo segundo en ceder el espacio. */}
          <div className="hidden md:flex">
            <PresenceBar />
          </div>

          {/* Selector de impersonación — solo admins */}
          {isAdmin && (
            <div className="relative">
              {viewAs ? (
                <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-full px-3 py-1">
                  {/* En móvil el banner ámbar de abajo ya dice a quién se está
                      viendo, así que acá el nombre es repetido y solo estorba. */}
                  <span className="hidden sm:inline text-xs font-medium text-amber-700">
                    Viendo como {viewAs.nombre}
                  </span>
                  <button
                    onClick={() => onViewAs?.(null)}
                    className="text-amber-500 hover:text-amber-700 transition-colors sm:ml-1 grid place-items-center w-6 h-6 -m-0.5"
                    aria-label="Salir de vista ejecutivo"
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                      <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                    </svg>
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setOpen(v => !v)}
                  aria-expanded={open}
                  aria-label="Ver como ejecutivo"
                  className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-[#0097A7] border border-slate-200 hover:border-[#0097A7] rounded-full px-2.5 sm:px-3 py-1.5 min-h-8 transition-all"
                >
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M2 14c0-3.314 2.686-5 6-5s6 1.686 6 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  <span className="hidden sm:inline">Ver como ejecutivo</span>
                </button>
              )}

              {/* Dropdown selector */}
              {open && !viewAs && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setOpen(false)}
                  />
                  {/* max-w-[calc(100vw-2rem)] evita que en un teléfono angosto los
                      256px del menú se salgan por el borde derecho. */}
                  <div className="absolute right-0 top-full mt-2 w-64 max-w-[calc(100vw-2rem)] bg-white border border-slate-200 rounded-2xl shadow-xl z-20 overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-100">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Seleccionar ejecutivo</p>
                    </div>
                    <div className="overflow-y-auto max-h-80">
                      {PAISES.map(pais => {
                        const execs = ejecutivos.filter(e => e.pais === pais);
                        if (!execs.length) return null;
                        return (
                          <div key={pais}>
                            <div className="flex items-center gap-2 px-4 py-2 bg-slate-50">
                              <img
                                src={`https://flagcdn.com/16x12/${FLAG_CC[pais] ?? 'un'}.png`}
                                alt={pais}
                                className="rounded-sm"
                              />
                              <span className="text-xs font-semibold text-slate-500">{pais}</span>
                            </div>
                            {execs.map(exec => (
                              <button
                                key={exec.kamId}
                                onClick={() => { onViewAs?.(exec); setOpen(false); }}
                                className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2"
                              >
                                <span className="w-6 h-6 rounded-full bg-[#0097A7]/10 text-[#0097A7] text-xs font-bold flex items-center justify-center flex-shrink-0">
                                  {exec.nombre.split(' ').map(p => p[0]).slice(0, 2).join('')}
                                </span>
                                {exec.nombre}
                              </button>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          <div className="hidden sm:block w-px h-4 bg-slate-200" />

          {/* El avatar pasa a ser botón con menú. En móvil es la única vía al
              nombre y a Salir; en desktop es una comodidad que se suma —el
              nombre y Salir siguen en línea como hasta ahora, así que no hay
              regresión. Un solo marcado, no dos cabeceras. */}
          <div className="relative">
            <button
              onClick={() => setPerfilAbierto(v => !v)}
              aria-expanded={perfilAbierto}
              aria-label={`Menú de ${user?.name ?? 'perfil'}`}
              // 40px en móvil (cerca de los 44 recomendados para el pulgar) y exactamente
              // los 32px de la imagen en desktop, así el header no se mueve ni un píxel
              // respecto de como estaba.
              className="grid place-items-center w-10 h-10 sm:w-8 sm:h-8 rounded-full hover:bg-slate-100 transition-colors"
            >
              {user?.picture ? (
                <img
                  src={user.picture}
                  alt=""
                  className="w-8 h-8 rounded-full"
                  referrerPolicy="no-referrer"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-[#0097A7] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  {user?.name?.charAt(0).toUpperCase() ?? '?'}
                </div>
              )}
            </button>

            {perfilAbierto && (
              <>
                <div className="fixed inset-0 z-10" onClick={cerrarPerfil} />
                <div className="absolute right-0 top-full mt-2 w-56 max-w-[calc(100vw-2rem)] bg-white border border-slate-200 rounded-2xl shadow-xl z-20 overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100">
                    <p className="text-sm font-semibold text-slate-700 truncate">{user?.name}</p>
                    <p className="text-xs text-slate-400 truncate">{user?.email}</p>
                  </div>
                  {onTickerVisible && (
                    <label className="flex items-center justify-between gap-3 px-4 py-3 text-sm text-slate-600
                                      hover:bg-slate-50 transition-colors cursor-pointer border-b border-slate-100">
                      <span>Barra de novedades</span>
                      {/* Checkbox nativo: trae foco, teclado y el estado que
                          anuncia el lector de pantalla, sin nada que escribir. */}
                      <input
                        type="checkbox"
                        checked={tickerVisible ?? true}
                        onChange={e => onTickerVisible(e.target.checked)}
                        className="w-4 h-4 accent-[#0097A7] cursor-pointer flex-shrink-0"
                      />
                    </label>
                  )}
                  <button
                    onClick={() => { cerrarPerfil(); onLogout(); }}
                    className="w-full text-left px-4 py-3 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    Cerrar sesión
                  </button>
                </div>
              </>
            )}
          </div>

          <span className="hidden sm:inline text-sm text-slate-600 truncate max-w-[12rem]">{user?.name}</span>
          <button
            onClick={onLogout}
            className="hidden sm:inline text-xs text-slate-400 hover:text-slate-600 transition-colors"
            aria-label="Cerrar sesión"
          >
            Salir
          </button>
        </div>
      </header>

      {/* Banner de impersonación */}
      {viewAs && (
        <div className="bg-amber-400 px-4 sm:px-6 py-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-amber-900 text-[11px] sm:text-xs font-semibold">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="flex-shrink-0" aria-hidden="true">
            <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 3a2 2 0 110 4 2 2 0 010-4zm0 8a5 5 0 01-4-2c0-1.333 2.667-2 4-2s4 .667 4 2a5 5 0 01-4 2z" fill="currentColor"/>
          </svg>
          Vista como {viewAs.nombre} · {viewAs.pais}
          <button
            onClick={() => onViewAs?.(null)}
            className="sm:ml-2 underline hover:no-underline px-1 min-h-6"
          >
            Salir
          </button>
        </div>
      )}
    </>
  );
}

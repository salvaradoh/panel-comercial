import { useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { PresenceBar } from '../ui/PresenceBar';
import { EXEC_LIST } from '../../hooks/useUserRole';
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
}

export function TopNav({ onLogout, isAdmin, viewAs, onViewAs }: TopNavProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <>
      <header className="bg-white border-b border-slate-200 px-6 h-14 flex items-center justify-between relative z-20">
        <div className="flex items-center gap-3">
          <img
            src="https://empresas.apprecio.com/hs-fs/hubfs/ezgif.com-optimize.gif?width=195&height=195&name=ezgif.com-optimize.gif"
            alt="Apprecio"
            className="w-8 h-8 rounded-lg object-cover"
          />
          <span className="text-base font-bold text-slate-800">Reportería Global Apprecio</span>
        </div>

        <div className="flex items-center gap-4">
          <PresenceBar />

          {/* Selector de impersonación — solo admins */}
          {isAdmin && (
            <div className="relative">
              {viewAs ? (
                <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-full px-3 py-1">
                  <span className="text-xs font-medium text-amber-700">
                    Viendo como {viewAs.nombre}
                  </span>
                  <button
                    onClick={() => onViewAs?.(null)}
                    className="text-amber-500 hover:text-amber-700 transition-colors ml-1"
                    aria-label="Salir de vista ejecutivo"
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                    </svg>
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setOpen(v => !v)}
                  className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-[#0097A7] border border-slate-200 hover:border-[#0097A7] rounded-full px-3 py-1.5 transition-all"
                >
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M2 14c0-3.314 2.686-5 6-5s6 1.686 6 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  Ver como ejecutivo
                </button>
              )}

              {/* Dropdown selector */}
              {open && !viewAs && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl z-20 overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-100">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Seleccionar ejecutivo</p>
                    </div>
                    <div className="overflow-y-auto max-h-80">
                      {PAISES.map(pais => {
                        const execs = EXEC_LIST.filter(e => e.pais === pais);
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

          <div className="w-px h-4 bg-slate-200" />
          {user?.picture ? (
            <img
              src={user.picture}
              alt={user.name}
              className="w-8 h-8 rounded-full"
              referrerPolicy="no-referrer"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-[#0097A7] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {user?.name?.charAt(0).toUpperCase() ?? '?'}
            </div>
          )}
          <span className="text-sm text-slate-600">{user?.name}</span>
          <button
            onClick={onLogout}
            className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
            aria-label="Cerrar sesión"
          >
            Salir
          </button>
        </div>
      </header>

      {/* Banner de impersonación */}
      {viewAs && (
        <div className="bg-amber-400 px-6 py-2 flex items-center justify-center gap-3 text-amber-900 text-xs font-semibold">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 3a2 2 0 110 4 2 2 0 010-4zm0 8a5 5 0 01-4-2c0-1.333 2.667-2 4-2s4 .667 4 2a5 5 0 01-4 2z" fill="currentColor"/>
          </svg>
          Vista como {viewAs.nombre} · {viewAs.pais}
          <button
            onClick={() => onViewAs?.(null)}
            className="ml-2 underline hover:no-underline"
          >
            Salir
          </button>
        </div>
      )}
    </>
  );
}

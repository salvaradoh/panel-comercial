import { useAuth } from '../../auth/AuthContext';
import { PresenceBar } from '../ui/PresenceBar';

interface TopNavProps {
  onLogout: () => void;
}

export function TopNav({ onLogout }: TopNavProps) {
  const { user } = useAuth();
  return (
    <header className="bg-white border-b border-slate-200 px-6 h-14 flex items-center justify-between">
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
  );
}

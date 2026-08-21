import { usePresence } from '../../hooks/usePresence';

export function PresenceBar() {
  const online = usePresence();

  if (online.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-slate-400">{online.length} en línea</span>
      <div className="flex -space-x-1.5">
        {online.slice(0, 5).map((u) => (
          <div
            key={u.email}
            className="w-6 h-6 rounded-full border-2 border-white overflow-hidden flex-shrink-0"
            title={u.name}
          >
            {u.picture ? (
              <img src={u.picture} alt={u.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-full h-full bg-[#0097A7] flex items-center justify-center text-white text-[8px] font-bold">
                {u.name?.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        ))}
        {online.length > 5 && (
          <div className="w-6 h-6 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-[8px] text-slate-500 font-bold">
            +{online.length - 5}
          </div>
        )}
      </div>
    </div>
  );
}

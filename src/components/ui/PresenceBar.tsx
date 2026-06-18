import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { apiFetch } from '../../api/client';

interface OnlineUser {
  name: string;
  email: string;
  picture?: string;
}

const HEARTBEAT_MS = 30_000;

export function PresenceBar() {
  const { user, token } = useAuth();
  const [online, setOnline] = useState<OnlineUser[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const esRef = useRef<EventSource | null>(null);

  const userId = user?.email ?? '';

  // SSE: token como query param (EventSource no soporta headers)
  useEffect(() => {
    if (!token || !userId) return;

    const es = new EventSource(`/api/presence/stream?token=${encodeURIComponent(token)}`);
    esRef.current = es;

    es.onmessage = (e) => {
      try { setOnline(JSON.parse(e.data)); } catch {}
    };
    es.onerror = () => es.close();

    return () => { es.close(); esRef.current = null; };
  }, [token, userId]);

  // Heartbeat + desregistro al salir
  useEffect(() => {
    if (!token || !userId || !user) return;

    const sendHeartbeat = () => {
      apiFetch('/api/presence/heartbeat', {
        method: 'POST',
        body: JSON.stringify({ userId, name: user.name, picture: user.picture, email: user.email }),
      }).catch(() => {});
    };

    sendHeartbeat();
    intervalRef.current = setInterval(sendHeartbeat, HEARTBEAT_MS);

    const onUnload = () => {
      navigator.sendBeacon(`/api/presence/${encodeURIComponent(userId)}`);
    };
    window.addEventListener('beforeunload', onUnload);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      window.removeEventListener('beforeunload', onUnload);
      apiFetch(`/api/presence/${encodeURIComponent(userId)}`, { method: 'DELETE' }).catch(() => {});
    };
  }, [token, userId, user]);

  if (online.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-slate-400">{online.length} en línea</span>
      <div className="flex -space-x-1.5">
        {online.slice(0, 5).map((u) => (
          <div key={u.email} className="w-6 h-6 rounded-full border-2 border-white overflow-hidden flex-shrink-0" title={u.name}>
            {u.picture
              ? <img src={u.picture} alt={u.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              : (
                <div className="w-full h-full bg-[#0097A7] flex items-center justify-center text-white text-[8px] font-bold">
                  {u.name?.charAt(0).toUpperCase()}
                </div>
              )
            }
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

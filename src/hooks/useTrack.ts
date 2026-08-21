import { useCallback, useEffect, useRef } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useRolesPorLocal } from './useUserRole';

const PROJECT    = 'gen-lang-client-0399006381';
const COLLECTION = 'actividad_dashboard';
const FS_BASE    = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/${COLLECTION}`;

/**
 * Se trackea a TODO el que entra, salvo los roles de dirección. El criterio es
 * una lista de exclusión y no una de inclusión: así queda registrado también
 * quien todavía no figura en la hoja `Codigos Vendedores`, que es justamente lo
 * que interesa ver mientras se reparte el acceso al panel.
 *
 * La comparación va contra la parte local del email, no contra el email
 * completo: la hoja tiene un solo dominio por persona y varios entran con el
 * otro. Sin eso, un Admin entrando por su cuenta @dcanje no matchearía y se
 * autotrackearía — es el agujero que tenía la lista de emails anterior.
 *
 * La presencia en vivo no pasa por acá: usePresence registra a todos.
 */
const ROLES_EXCLUIDOS = new Set(['country manager', 'c-level', 'c level', 'admin']);

export function seTrackea(rol: string | undefined | null): boolean {
  if (!rol) return true;                     // sin rol en la hoja → se trackea
  return !ROLES_EXCLUIDOS.has(rol.trim().toLowerCase());
}

function getSessionId(): string {
  const key = 'dash_session_id';
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    sessionStorage.setItem(key, id);
  }
  return id;
}

interface Pendiente { evento: string; detalle?: string; ts: number }

export function useTrack() {
  const { user, token } = useAuth();
  const { data: rolesPorLocal, isLoading: rolesLoading } = useRolesPorLocal();
  const sessionId = useRef(getSessionId()).current;

  const localEmail = (user?.email ?? '').toLowerCase().split('@')[0];
  const rol = rolesPorLocal?.[localEmail];

  // Resolver el rol implica leer un Sheet, así que tarda. Los eventos previos se
  // guardan con su timestamp real y se envían al resolverse, en vez de
  // descartarlos: el primero de la sesión es el tab de aterrizaje.
  const pendientes = useRef<Pendiente[]>([]);

  const enviar = useCallback((evento: string, detalle: string | undefined, ts: number) => {
    if (!token || !user?.email) return;
    fetch(FS_BASE, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          email:      { stringValue: user.email },
          nombre:     { stringValue: user.name ?? '' },
          evento:     { stringValue: evento },
          detalle:    { stringValue: detalle ?? '' },
          ts:         { integerValue: String(ts) },
          session_id: { stringValue: sessionId },
        },
      }),
    }).catch(() => {});
  }, [token, user, sessionId]);

  const track = useCallback((evento: string, detalle?: string) => {
    if (!token || !user?.email) return;
    const ts = Date.now();

    if (rolesLoading) {
      pendientes.current.push({ evento, detalle, ts });
      return;
    }
    if (!seTrackea(rol)) return;
    enviar(evento, detalle, ts);
  }, [token, user, rolesLoading, rol, enviar]);

  // Descarga de la cola cuando el rol ya se conoce; si está excluido, se
  // descarta sin enviar nada.
  useEffect(() => {
    if (rolesLoading || pendientes.current.length === 0) return;
    const cola = pendientes.current;
    pendientes.current = [];
    if (!seTrackea(rol)) return;
    cola.forEach(p => enviar(p.evento, p.detalle, p.ts));
  }, [rolesLoading, rol, enviar]);

  return { track };
}

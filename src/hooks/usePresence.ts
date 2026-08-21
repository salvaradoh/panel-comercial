import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext';

const PROJECT    = 'gen-lang-client-0399006381';
const COLLECTION = 'presencia_dashboard';
const FS_BASE    = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/${COLLECTION}`;
const HEARTBEAT_MS = 30_000;
const TTL_MS       = 5 * 60 * 1000; // 5 min sin heartbeat = offline

export interface PresenceUser {
  name:     string;
  email:    string;
  picture?: string;
}

const fsStr = (v: string) => ({ stringValue: v });
const fsInt = (v: number) => ({ integerValue: String(v) });
const getStr = (fields: Record<string, unknown>, k: string) =>
  (fields?.[k] as { stringValue?: string })?.stringValue ?? '';
const getInt = (fields: Record<string, unknown>, k: string) =>
  Number((fields?.[k] as { integerValue?: string })?.integerValue ?? 0);

export function usePresence(): PresenceUser[] {
  const { user, token } = useAuth();
  const [online, setOnline] = useState<PresenceUser[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!token || !user?.email) return;

    const docId  = encodeURIComponent(user.email);
    const docUrl = `${FS_BASE}/${docId}`;
    const mask   = ['name', 'email', 'picture', 'lastSeen']
      .map(f => `updateMask.fieldPaths=${f}`).join('&');

    const writePresence = () =>
      fetch(`${docUrl}?${mask}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            name:     fsStr(user.name ?? ''),
            email:    fsStr(user.email),
            picture:  fsStr(user.picture ?? ''),
            lastSeen: fsInt(Date.now()),
          },
        }),
      }).catch(() => {});

    const readPresence = () =>
      fetch(FS_BASE, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : Promise.reject())
        .then((json: { documents?: { fields: Record<string, unknown> }[] }) => {
          const now = Date.now();
          setOnline(
            (json.documents ?? [])
              .filter(doc => now - getInt(doc.fields, 'lastSeen') < TTL_MS)
              .map(doc => ({
                name:    getStr(doc.fields, 'name'),
                email:   getStr(doc.fields, 'email'),
                picture: getStr(doc.fields, 'picture') || undefined,
              }))
          );
        })
        .catch(() => {});

    const removePresence = (keepalive = false) =>
      fetch(docUrl, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
        ...(keepalive ? { keepalive: true } : {}),
      }).catch(() => {});

    // Registrar y comenzar polling
    writePresence();
    readPresence();
    timerRef.current = setInterval(() => { writePresence(); readPresence(); }, HEARTBEAT_MS);

    // Limpiar al cerrar tab/ventana
    const onUnload = () => removePresence(true);
    window.addEventListener('beforeunload', onUnload);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      window.removeEventListener('beforeunload', onUnload);
      removePresence();
    };
  }, [token, user]);

  return online;
}

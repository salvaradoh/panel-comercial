import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { useAuth } from '../auth/AuthContext';

const PROJECT    = 'gen-lang-client-0399006381';
const COLLECTION = 'preferencias_dashboard';
const FS_BASE    = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/${COLLECTION}`;

/**
 * Preferencias de visualización del usuario.
 *
 * Para agregar una: sumarla acá con su valor por defecto y listo — el guardado,
 * la sincronización y la lectura ya funcionan para cualquier booleano.
 */
export interface Preferencias {
  /** Existe la barra lateral de Novedades. Se apaga desde el menú del perfil y
      libera los 226px que la página le reserva a la derecha. */
  tickerNovedades: boolean;
  /** La barra muestra el feed. Apagado, queda solo su encabezado con el
      interruptor: se corta el movimiento —que es lo que cansa la vista— sin
      tener que ir a un menú para recuperarlo.
      Ocultar y colapsar son cosas distintas a propósito: una libera espacio, la
      otra solo calma la pantalla y deja el control a mano. */
  tickerExpandido: boolean;
}

const DEFECTO: Preferencias = {
  tickerNovedades: true,
  tickerExpandido: true,
};

/**
 * Se guarda en DOS lados a propósito.
 *
 * `localStorage` es el que manda al dibujar: se lee sincrónicamente antes del
 * primer render, así la barra nunca aparece medio segundo para después
 * esconderse —que es justamente lo que molestaba a la vista.
 *
 * Firestore es el que hace que la preferencia siga al usuario entre la laptop,
 * el celular y otro navegador. Llega más tarde y, cuando llega, actualiza. El
 * costo es una lectura por sesión y una escritura por cambio: contra las ~12.000
 * lecturas diarias que ya hace el heartbeat de presencia, es ruido.
 *
 * El estado vive a nivel de módulo y no en un Context: lo consumen el shell y el
 * menú del perfil, que están en ramas distintas del árbol, y un store externo
 * evita tener que envolver la app para dos booleanos.
 */
let estado: Preferencias = DEFECTO;
const oyentes = new Set<() => void>();

function emitir() {
  for (const f of oyentes) f();
}

function suscribir(f: () => void) {
  oyentes.add(f);
  return () => { oyentes.delete(f); };
}

function claveLocal(email: string) {
  return `dash_prefs_${email.toLowerCase()}`;
}

function leerLocal(email: string): Preferencias {
  try {
    const crudo = localStorage.getItem(claveLocal(email));
    if (!crudo) return DEFECTO;
    // Se mezcla con el defecto para que una preferencia agregada después no
    // quede `undefined` en quien tenga guardada una versión vieja.
    return { ...DEFECTO, ...JSON.parse(crudo) };
  } catch {
    // Modo incógnito o almacenamiento bloqueado: se sigue con los defectos.
    return DEFECTO;
  }
}

function escribirLocal(email: string, prefs: Preferencias) {
  try {
    localStorage.setItem(claveLocal(email), JSON.stringify(prefs));
  } catch { /* sin almacenamiento: queda solo en memoria y en Firestore */ }
}

/** Firestore tipa cada campo; acá todas las preferencias son booleanas. */
function aFirestore(prefs: Preferencias) {
  const fields: Record<string, { booleanValue: boolean }> = {};
  for (const [k, v] of Object.entries(prefs)) fields[k] = { booleanValue: !!v };
  return { fields };
}

function deFirestore(doc: unknown): Partial<Preferencias> {
  const fields = (doc as { fields?: Record<string, { booleanValue?: boolean }> })?.fields;
  if (!fields) return {};
  const out: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (typeof v?.booleanValue === 'boolean') out[k] = v.booleanValue;
  }
  return out as Partial<Preferencias>;
}

let emailCargado: string | null = null;

export function usePreferencias() {
  const { user, token } = useAuth();
  const email = user?.email ?? '';
  const prefs = useSyncExternalStore(suscribir, () => estado);

  // Carga: primero lo local (sincrónico, sin parpadeo) y después Firestore.
  useEffect(() => {
    if (!email || emailCargado === email) return;
    emailCargado = email;
    estado = leerLocal(email);
    emitir();

    if (!token) return;
    fetch(`${FS_BASE}/${encodeURIComponent(email)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => (r.ok ? r.json() : null))
      .then(doc => {
        if (!doc) return;                       // 404: nunca guardó nada
        const remoto = deFirestore(doc);
        if (Object.keys(remoto).length === 0) return;
        estado = { ...estado, ...remoto };
        escribirLocal(email, estado);
        emitir();
      })
      .catch(() => { /* sin red: queda lo local */ });
  }, [email, token]);

  const cambiar = useCallback(<K extends keyof Preferencias>(clave: K, valor: Preferencias[K]) => {
    if (estado[clave] === valor) return;
    estado = { ...estado, [clave]: valor };
    emitir();
    if (!email) return;
    escribirLocal(email, estado);
    if (!token) return;
    // PATCH crea el documento si no existe, así que no hace falta un POST previo.
    fetch(`${FS_BASE}/${encodeURIComponent(email)}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(aFirestore(estado)),
    }).catch(() => { /* quedó guardado local; se reintenta al próximo cambio */ });
  }, [email, token]);

  return { prefs, cambiar };
}

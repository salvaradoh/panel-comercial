import { useCallback, useRef, useState } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { useAuth } from '../auth/AuthContext';
import { INDUSTRIA_SHEET_ID } from './useIndustriaViva';

/**
 * Corrige la Industria de una empresa directo en "Industria — Cartera por
 * País", desde la ficha de cuenta del panel.
 *
 * El token normal del panel es de solo lectura (`spreadsheets.readonly`) — no
 * alcanza para escribir. Mismo patrón que `useEnviarCorreo` con `gmail.send`:
 * autorización incremental, se pide recién cuando alguien guarda una edición,
 * no a todo el equipo en el login.
 */
const SPREADSHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

export interface EdicionIndustria {
  tab: string;
  fila: number;
  industria: string;
}

export function useEditarIndustria() {
  const { user } = useAuth();
  const tokenEscritura = useRef<string | null>(null);
  const pendiente = useRef<{ ok: (t: string) => void; falla: (e: Error) => void } | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const pedirPermiso = useGoogleLogin({
    flow: 'implicit',
    scope: SPREADSHEETS_SCOPE,
    onSuccess: (r) => {
      tokenEscritura.current = r.access_token;
      pendiente.current?.ok(r.access_token);
      pendiente.current = null;
    },
    onError: (e) => {
      pendiente.current?.falla(new Error(`No se autorizó la edición: ${e.error_description ?? e.error ?? 'cancelado'}`));
      pendiente.current = null;
    },
    onNonOAuthError: () => {
      pendiente.current?.falla(new Error('Se cerró la ventana de permisos sin autorizar.'));
      pendiente.current = null;
    },
  });

  const obtenerToken = useCallback((): Promise<string> => {
    if (tokenEscritura.current) return Promise.resolve(tokenEscritura.current);
    return new Promise<string>((ok, falla) => {
      pendiente.current = { ok, falla };
      pedirPermiso();
    });
  }, [pedirPermiso]);

  const guardar = useCallback(async ({ tab, fila, industria }: EdicionIndustria) => {
    setGuardando(true);
    setError(null);
    try {
      const token = await obtenerToken();
      const hoy = new Date().toISOString().slice(0, 10);
      const fuenteNota = `Corrección manual: ${user?.email ?? 'ejecutivo'} · ${hoy}`;
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${INDUSTRIA_SHEET_ID}/values:batchUpdate`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          valueInputOption: 'RAW',
          data: [
            // Confianza queda en "alta": lo confirmó una persona a mano, no una
            // búsqueda web — es la fuente más confiable que hay.
            { range: `${tab}!D${fila}:E${fila}`, values: [[industria, 'alta']] },
            { range: `${tab}!G${fila}`, values: [[fuenteNota]] },
          ],
        }),
      });
      if (!res.ok) {
        const cuerpo = await res.text();
        // Un 401/403 acá suele ser el token de escritura vencido o el usuario
        // sin permiso de Editor en la hoja — no un bug del panel.
        if (res.status === 401) tokenEscritura.current = null;
        throw new Error(`Sheets API ${res.status}: ${cuerpo.slice(0, 300)}`);
      }
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      setError(err);
      throw err;
    } finally {
      setGuardando(false);
    }
  }, [obtenerToken, user]);

  return { guardar, guardando, error };
}

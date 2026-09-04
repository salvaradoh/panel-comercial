import { useCallback, useRef, useState } from 'react';
import { useGoogleLogin } from '@react-oauth/google';

/**
 * Envía un correo con la API de Gmail, como el usuario que está en sesión.
 *
 * El token normal del panel **no** sirve: se pide con scopes de solo lectura
 * (spreadsheets, drive, datastore). Enviar correo necesita `gmail.send`, y agregarlo al
 * login general obligaría a **todos** —incluidos los ejecutivos, que nunca mandan
 * correos— a volver a pasar por la pantalla de consentimiento.
 *
 * Por eso se usa autorización incremental: el permiso se pide en el momento en que un
 * Admin decide enviar, y solo a esa persona. El token que devuelve se usa para ese envío
 * y se guarda en memoria por si manda varias campañas seguidas; muere con la pestaña.
 */

const GMAIL_SEND = 'https://www.googleapis.com/auth/gmail.send';
const ENDPOINT = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';

export interface ResultadoEnvio { id: string; threadId?: string }

export function useEnviarCorreo() {
  const tokenGmail = useRef<string | null>(null);
  const pendiente = useRef<{ ok: (t: string) => void; falla: (e: Error) => void } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const pedirPermiso = useGoogleLogin({
    flow: 'implicit',
    scope: GMAIL_SEND,
    onSuccess: (r) => {
      tokenGmail.current = r.access_token;
      pendiente.current?.ok(r.access_token);
      pendiente.current = null;
    },
    onError: (e) => {
      pendiente.current?.falla(new Error(`No se autorizó el envío: ${e.error_description ?? e.error ?? 'cancelado'}`));
      pendiente.current = null;
    },
    // El popup cerrado a mano no dispara onError en todos los navegadores.
    onNonOAuthError: () => {
      pendiente.current?.falla(new Error('Se cerró la ventana de permisos sin autorizar.'));
      pendiente.current = null;
    },
  });

  const obtenerToken = useCallback((): Promise<string> => {
    if (tokenGmail.current) return Promise.resolve(tokenGmail.current);
    return new Promise<string>((ok, falla) => {
      pendiente.current = { ok, falla };
      pedirPermiso();
    });
  }, [pedirPermiso]);

  const enviar = useCallback(async (raw: string): Promise<ResultadoEnvio> => {
    setEnviando(true);
    setError(null);
    try {
      const token = await obtenerToken();
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw }),
      });
      if (!res.ok) {
        const cuerpo = await res.text();
        // Un 401 acá suele ser el token de Gmail vencido, no una falta de permiso.
        if (res.status === 401) tokenGmail.current = null;
        throw new Error(`Gmail respondió ${res.status}: ${cuerpo.slice(0, 300)}`);
      }
      return (await res.json()) as ResultadoEnvio;
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      setError(err);
      throw err;
    } finally {
      setEnviando(false);
    }
  }, [obtenerToken]);

  return { enviar, enviando, error, yaAutorizado: () => Boolean(tokenGmail.current) };
}

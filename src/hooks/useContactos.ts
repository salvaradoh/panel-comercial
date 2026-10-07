import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';

/**
 * Contactos de HubSpot del cliente, para la ficha del menú Clientes.
 *
 * Se lee **la hoja de HubSpot en vivo**, no un caché: la hoja está compartida con
 * toda la empresa, así que cada usuario la puede leer con su propio token igual
 * que el resto del dashboard. Antes esto pasaba por un `Cache_Contactos` que
 * escribía el GAS, y se eliminó: agregaba hasta un día de atraso y un paso diario
 * al refresco, sin ganar nada.
 *
 * La carga es PEREZOSA (`habilitado` sigue a que haya una ficha abierta) y luego
 * queda en memoria 10 minutos, así que abrir varias fichas seguidas no repite el
 * pedido.
 *
 * LA LLAVE ES EL ID TRIBUTARIO y las dos fuentes lo escriben distinto: el
 * dashboard usa '11111111-1' y HubSpot '111111111' sin separadores. Por eso se
 * normaliza a solo alfanuméricos — sin eso el cruce da CERO.
 *
 * Un cliente puede tener VARIOS contactos (129 de 300 los tienen, uno llega a 18),
 * así que devuelve una lista.
 *
 * Cobertura medida el 2026-08-19: de las 1.277 filas de HubSpot, **650 no traen ID
 * tributario** y no hay con qué cruzarlas. Sobre el dashboard eso cubre Chile 196
 * de 1.079 (18,2%), Perú 81, Colombia 52, México 16. Un cliente sin contactos es
 * lo normal, no un error.
 */
const HUBSPOT_SHEET_ID = '1pH0mqBDI32xfmhIT0IuuBe0wattXiOX1T94UX2dwqcI';
// El rango tiene que ser contiguo, así que se pide C..L y se usan cuatro:
//   C ID Tributario (la llave) · E Nombre Completo · F Email · K Cargo · L Área
// D, G, H, I y J se ignoran.
const RANGO = 'Clientes Hubspot!C2:L3000';

export interface Contacto {
  nombre: string;
  email: string;
  /** Cargo y área vienen al 100% en las filas cruzables (627 de 627). */
  cargo: string;
  area: string;
}

/** Solo alfanuméricos y en mayúscula: '11.111.111-1' → '111111111'. */
export function claveIdTrib(v: string | undefined | null): string {
  return String(v ?? '').toUpperCase().replace(/[^0-9A-Z]/g, '');
}

type Indice = Record<string, Contacto[]>;

export function useContactos(idTributario: string | undefined, habilitado: boolean) {
  const { token } = useAuth();

  const { data, isLoading, error } = useQuery<Indice>({
    queryKey: ['contactos-hubspot'],
    queryFn: async () => {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${HUBSPOT_SHEET_ID}`
        + `/values/${encodeURIComponent(RANGO)}?valueRenderOption=UNFORMATTED_VALUE`;
      const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!resp.ok) throw new Error(`Sheets API ${resp.status}`);
      const json = await resp.json();
      const filas: unknown[][] = json.values || [];

      const idx: Indice = {};
      for (const f of filas) {
        const k = claveIdTrib(String(f[0] ?? ''));   // C
        const nombre = String(f[2] ?? '').trim();    // E
        const email  = String(f[3] ?? '').trim();    // F
        const cargo  = String(f[8] ?? '').trim();    // K
        const area   = String(f[9] ?? '').trim();    // L
        if (!k || (!nombre && !email)) continue;
        const lista = idx[k] ?? (idx[k] = []);
        // HubSpot repite filas; el mismo nombre y mail no aporta dos veces.
        if (!lista.some(c => c.nombre === nombre && c.email === email)) {
          lista.push({ nombre, email, cargo, area });
        }
      }
      return idx;
    },
    enabled: !!token && habilitado,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 1,
  });

  const contactos = useMemo<Contacto[]>(() => {
    const k = claveIdTrib(idTributario);
    return data && k ? (data[k] ?? []) : [];
  }, [data, idTributario]);

  return { contactos, isLoading, error };
}

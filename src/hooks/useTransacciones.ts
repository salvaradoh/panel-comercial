import { useMemo } from 'react';
import { useCacheSheet } from './useCacheSheet';
import { clavePais } from '../lib/paises';

/**
 * Últimas transacciones por cliente, para la sección de la ficha en Clientes.
 *
 * La hoja se carga PEREZOSAMENTE: `enabled` sigue a si hay una ficha abierta, así
 * que quien nunca abre una no paga la descarga. Son ~27.000 transacciones (1 MB),
 * un cuarto de lo que ya pesa Cache_Churn, y una vez traída sirve para todas las
 * fichas de la sesión.
 *
 * Formato compacto en la hoja —`[fecha, producto, usd, local, folio]` en vez de objetos—
 * porque con objetos el JSON casi se triplica.
 *
 * EXCLUYE MARKETPLACE, igual que el resto del análisis de clientes: si no, la
 * ficha podría mostrar una venta reciente mientras el mismo panel dice "120 días
 * sin comprar", y eso se lee como un bug.
 */
type FilaCruda = [string, string, number, number, string];

interface CacheTransacciones {
  generado: string;
  porCliente: number;
  clientes: Record<string, FilaCruda[]>;
}

export interface Transaccion {
  fecha: string;      // 'YYYY-MM-DD'
  producto: string;   // Puntos · Gift Card · SaaS
  usd: number;
  /** Monto en la moneda del país. 0 si la fila viene del payload anterior. */
  local: number;
  /**
   * Folio de la factura. Solo Chile y México: no existe fuente de folios para
   * Colombia ni Perú, así que ahí viene vacío. Un mismo folio puede repetirse en
   * varias filas — es una factura con más de una línea de producto.
   */
  folio: string;
}

export interface TransaccionesCliente {
  trx: Transaccion[];
  /** Fecha del último refresco del caché, para poder decirlo en la ficha. */
  generado: string | null;
  /** Cuántas guarda el caché por cliente: el tope, no lo que tiene este cliente. */
  tope: number;
}

export function useTransacciones(
  pais: string | undefined,
  panelId: string | undefined,
  habilitado: boolean,
) {
  const { data, isLoading, error } = useCacheSheet<CacheTransacciones>(
    'Cache_Transacciones', habilitado);

  const resultado = useMemo<TransaccionesCliente>(() => {
    if (!data || !pais || !panelId) return { trx: [], generado: null, tope: 0 };
    // La clave se arma igual que en el GAS: país sin tildes y en minúscula. Las
    // fuentes discrepan entre 'Mexico' y 'México', así que normalizar de los dos
    // lados es lo único que garantiza que la ficha encuentre sus transacciones.
    const k = `${clavePais(pais)}|${String(panelId).trim()}`;
    const filas = data.clientes?.[k] ?? [];
    return {
      trx: filas.map(([fecha, producto, usd, local, folio]) => ({
        fecha, producto,
        usd: Number(usd) || 0, local: Number(local) || 0,
        folio: String(folio ?? ''),
      })),
      generado: data.generado ?? null,
      tope: Number(data.porCliente) || 0,
    };
  }, [data, pais, panelId]);

  return { ...resultado, isLoading, error };
}

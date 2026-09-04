import { useMemo } from 'react';
import { useSheetTabla } from './useSheetTabla';
import { useTablaClientes } from './useTablaClientes';
import {
  CBS_SPREADSHEET_ID, CBS_RANGO, CBS_PUENTE_CL_RANGO,
  parseFilasCBS, aplicarKamActual, normalizaIdEmpresa,
} from '../lib/cbs';
import type { DatosCBS, CarteraKam } from '../lib/cbs';
import { clavePais } from '../lib/paises';

/**
 * Lee la hoja del proyecto CBS en vivo y le pega el KAM vigente.
 *
 * Son tres fuentes y ninguna sobra:
 *   1. `BBDD para MX` — el proyecto.
 *   2. La cartera del panel (`useTablaClientes`) — de dónde sale el KAM vigente.
 *      Se reutiliza el hook que ya usan Clientes y Segmentación, así que
 *      comparten la misma entrada de caché de react-query: quien entra por
 *      cualquiera de los dos tabs no vuelve a descargar la hoja.
 *   3. `Clientes + KAMs CL` — puente ID Empresa → RUT, porque el Panel ID de
 *      Chile es el RUT y no el correlativo que usa la hoja del proyecto.
 *
 * Toda la lógica está en `lib/cbs.ts`, sin React, para poder verificarla desde
 * Node con `node scripts/verificar-cbs.js`.
 */
export function useProyectoCBS() {
  const hoja     = useSheetTabla(CBS_SPREADSHEET_ID, CBS_RANGO);
  const puente   = useSheetTabla(CBS_SPREADSHEET_ID, CBS_PUENTE_CL_RANGO);
  const clientes = useTablaClientes();

  const datos = useMemo<DatosCBS | undefined>(() => {
    if (!hoja.data) return undefined;
    const base = parseFilasCBS(hoja.data.headers, hoja.data.filas);

    // El cruce es opcional: si la cartera o el puente todavía no cargaron —o
    // fallaron— la vista igual se dibuja con el KAM de la hoja marcado como
    // "sin confirmar". Es preferible a dejar el tablero en blanco.
    if (!clientes.data) return base;

    const cartera: CarteraKam = {
      porPanelId: new Map(
        clientes.data
          .filter((c) => c.kam)
          .map((c) => [`${clavePais(c.pais)}||${normalizaIdEmpresa(c.panelId)}`, c.kam]),
      ),
      puenteRut:    new Map(),
      kamListadoCL: new Map(),
    };

    // Pestaña `Clientes + KAMs CL`: ID Empresa | Nombre | Razón Social | Rut | Kam | ...
    if (puente.data) {
      puente.data.filas.forEach((r) => {
        const id = String(r[0] ?? '').trim();
        if (!id) return;
        const rut = normalizaIdEmpresa(String(r[3] ?? ''));
        const kam = String(r[4] ?? '').trim();
        if (rut) cartera.puenteRut.set(id, rut);
        if (kam) cartera.kamListadoCL.set(id, kam);
      });
    }

    return { ...base, filas: aplicarKamActual(base.filas, cartera) };
  }, [hoja.data, puente.data, clientes.data]);

  return {
    ...hoja,
    datos,
    /** true mientras el KAM vigente todavía no se pudo cruzar. */
    cruceCargando: clientes.isLoading,
    cruceFallo: Boolean(clientes.error),
  };
}

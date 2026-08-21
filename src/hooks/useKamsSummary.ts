import { useMemo } from 'react';
import { useTablaClientes } from './useTablaClientes';
import type { ClienteTabla } from './useTablaClientes';

export interface KamSummary {
  pais: string;
  nombre: string;
  rol: string;
  clientes: number;
  activos: number;
  recurrentes: number;
  estacionales: number;
  primera_compra: number;
  perdidos: number;
  nuevos_anio: number;
  pct_recurrencia: number;
  facturas_prom: number;
  vol_6m_prom: number;
  dias_sc_prom: number;
  score_ret_prom: number;
  ticket_unitario: number;
}

function getScore(c: ClienteTabla): number {
  return (c.tipo === 'estacional' || c.tipo === 'primera_compra') ? c.scoreEst : c.scoreEng;
}

function getAltaYear(fechaAlta: string): number | null {
  if (!fechaAlta) return null;
  // parseDate ya convirtió seriales de Excel a "DD/MM/YYYY"
  const dmy = fechaAlta.match(/^\d{1,2}\/\d{1,2}\/(\d{4})/);
  if (dmy) return parseInt(dmy[1], 10) || null;
  return null;
}

export function useKamsSummary(anio: number, roles?: Record<string, string>) {
  const { data: clientes, isLoading, isError } = useTablaClientes();

  const data = useMemo(() => {
    if (!clientes) return undefined;
    const rolesMap = roles ?? {};

    const groups = new Map<string, ClienteTabla[]>();
    for (const c of clientes) {
      const kamNombre = c.kam || 'Otros';
      const key = `${c.pais}\x00${kamNombre}`;
      const list = groups.get(key);
      if (list) list.push(c);
      else groups.set(key, [c]);
    }

    const kams: KamSummary[] = [];

    groups.forEach((list, key) => {
      const sep    = key.indexOf('\x00');
      const pais   = key.slice(0, sep);
      const nombre = key.slice(sep + 1);

      const perdidos      = list.filter(c => c.tipo === 'perdido_historico').length;
      const activos       = list.length - perdidos;
      const activeList    = list.filter(c => c.tipo !== 'perdido_historico');
      const recurrentes   = list.filter(c => c.tipo === 'recurrente').length;
      const estacionales  = list.filter(c => c.tipo === 'estacional').length;
      const primera_compra = list.filter(c => c.tipo === 'primera_compra').length;
      // Nuevos = clientes activos cuya Fecha Alta cae en el año seleccionado
      const nuevos_anio   = activeList.filter(c => getAltaYear(c.fechaAlta) === anio).length;

      const n = activeList.length || 1;
      const sumFacturas = activeList.reduce((s, c) => s + c.totalFacturas, 0);
      const sumVol      = activeList.reduce((s, c) => s + c.monto6mAct, 0);
      const sumDias     = activeList.reduce((s, c) => s + c.diasSinCompra, 0);
      const sumScore    = activeList.reduce((s, c) => s + getScore(c), 0);

      const facturas_prom   = sumFacturas / n;
      const vol_6m_prom     = sumVol / n;
      const dias_sc_prom    = sumDias / n;
      const score_ret_prom  = sumScore / n;
      // ticket: volumen 6M promedio dividido por facturas promedio del período
      const ticket_unitario = facturas_prom > 0 ? Math.round(vol_6m_prom / facturas_prom) : 0;

      kams.push({
        pais,
        nombre,
        rol: rolesMap[nombre] ?? 'KAM',
        clientes:        list.length,
        activos,
        recurrentes,
        estacionales,
        primera_compra,
        perdidos,
        nuevos_anio,
        pct_recurrencia:  activos > 0 ? recurrentes / activos : 0,
        facturas_prom:    Math.round(facturas_prom * 10) / 10,
        vol_6m_prom:      Math.round(vol_6m_prom),
        dias_sc_prom:     Math.round(dias_sc_prom),
        score_ret_prom:   Math.round(score_ret_prom * 100) / 100,
        ticket_unitario,
      });
    });

    kams.sort((a, b) => a.pais.localeCompare(b.pais) || b.activos - a.activos);
    return { kams };
  }, [clientes, anio, roles]);

  return { data, isLoading, isError };
}

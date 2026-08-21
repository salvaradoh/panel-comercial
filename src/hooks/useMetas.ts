import { useMemo } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import type { MetasResponse, PaisData } from './types';

const SPREADSHEET_ID = import.meta.env.VITE_DASHBOARD_SPREADSHEET_ID as string;

// Índices de columna en Cache_Reporte (0-based, igual que el GAS)
const C = {
  anio: 0, mes: 1, semana: 2, nivel: 3, pais: 4,
  meta_usd: 6, avance_usd: 7, proy_sem: 8, proy_mes: 9,
  avance_a_ant: 10, meta_men: 11, avance_men: 12,
  avance_men_ant: 13, cierre_men_ant: 14,
} as const;

function normalizePais(p: string): string {
  return p.trim()
    .replace(/^Mexico$/i, 'México')
    .replace(/^Peru$/i, 'Perú');
}

// Carga todas las filas de Cache_Reporte una sola vez (React Query las cachea 30 min).
function useCacheReporteRows() {
  const { token } = useAuth();
  return useQuery<string[][]>({
    queryKey: ['cache-reporte-rows'],
    queryFn: async () => {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/Cache_Reporte!A2:R5000?valueRenderOption=FORMATTED_VALUE`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`Cache_Reporte ${res.status}`);
      const json = await res.json();
      return (json.values || []) as string[][];
    },
    enabled: !!token && !!SPREADSHEET_ID,
    staleTime: 5 * 60 * 1000,
    gcTime:   30 * 60 * 1000,
    retry: 1,
  });
}

export function useMetas(anio: number, mes: number, semana: number) {
  const { data: allRows, isLoading: rowsLoading } = useCacheReporteRows();

  return useQuery<MetasResponse>({
    queryKey: ['metas', anio, mes, semana],
    queryFn: () => {
      const semStr = semana > 0 ? `Semana ${semana}` : null;

      // Filas del período: nivel=pais, año+mes coinciden
      const periodRows = (allRows ?? []).filter(row =>
        row[C.nivel] === 'pais' &&
        Number(row[C.anio]) === anio &&
        Number(row[C.mes])  === mes &&
        (semStr === null || row[C.semana] === semStr)
      );

      // Para semana=0 usar la última semana disponible del mes para leer avance_men
      const sourceRows = semStr !== null ? periodRows : (() => {
        const semanas = ['Semana 4', 'Semana 3', 'Semana 2', 'Semana 1'];
        for (const s of semanas) {
          const rows = (allRows ?? []).filter(row =>
            row[C.nivel] === 'pais' &&
            Number(row[C.anio]) === anio &&
            Number(row[C.mes])  === mes &&
            row[C.semana] === s
          );
          if (rows.length > 0) return rows;
        }
        return periodRows;
      })();

      const paises: PaisData[] = sourceRows.map(row => {
        const avance = semana === 0 ? Number(row[C.avance_men])  || 0
                                    : Number(row[C.avance_usd])  || 0;
        const meta   = semana === 0 ? Number(row[C.meta_men])    || 0
                                    : Number(row[C.meta_usd])    || 0;
        const proySem = Number(row[C.proy_sem]) || 0;
        const proyMes = Number(row[C.proy_mes]) || 0;
        // semana=0 → YoY mensual (col 13); semana>0 → YoY de esa semana específica (col 10)
        const antRef = semana === 0
          ? Number(row[C.avance_men_ant]) || 0
          : Number(row[C.avance_a_ant])   || 0;
        return {
          pais:          normalizePais(row[C.pais] ?? ''),
          avance, meta,
          pct:           meta > 0 ? avance / meta : 0,
          serie:         [],
          mesAnterior:   Number(row[C.cierre_men_ant]) || 0,
          avanceYoY:     antRef,
          varYoY:        avance - antRef,
          varYoYPct:     antRef > 0
                           ? ((avance - antRef) / antRef) * 100
                           : undefined,
          proyeccionSem: proySem > 0 ? proySem : undefined,
          proyeccionMes: proyMes > 0 ? proyMes : undefined,
        } satisfies PaisData;
      }).filter(p => p.meta > 0 || p.avance > 0);

      // Semanas disponibles para el mes (desde las filas cargadas)
      const semanasDisponibles = Array.from(
        new Set(
          (allRows ?? [])
            .filter(row =>
              row[C.nivel] === 'pais' &&
              Number(row[C.anio]) === anio &&
              Number(row[C.mes])  === mes &&
              Number(row[C.avance_usd]) > 0
            )
            .map(row => Number(String(row[C.semana]).replace('Semana ', '')))
            .filter(n => n > 0)
        )
      ).sort((a, b) => a - b);

      return { paises, semanasDisponibles, periodo: { anio, mes, semana } };
    },
    enabled: !!allRows && !rowsLoading,
    staleTime: 15 * 60 * 1000,
    gcTime:    30 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
}

/**
 * Devuelve el avance mensual correcto (col avance_men, fuente Tabla_Avance_Total_Pais)
 * para cada país y cada mes del año dado.
 * Clave del mapa interior: "YYYY-M" donde M es el mes 0-indexed (compatible con getMonthKey
 * en RegionSparkCard). Ejemplo: julio 2026 → "2026-6".
 */
export function usePaisesAvanceMensual(anio: number): Record<string, Record<string, number>> {
  const { data: allRows } = useCacheReporteRows();

  return useMemo<Record<string, Record<string, number>>>(() => {
    if (!allRows) return {};
    const result: Record<string, Record<string, number>> = {};
    const semanas = ['Semana 4', 'Semana 3', 'Semana 2', 'Semana 1'];

    for (let mes = 1; mes <= 12; mes++) {
      let sourceRows: string[][] = [];
      for (const s of semanas) {
        const rows = allRows.filter(row =>
          row[C.nivel] === 'pais' &&
          Number(row[C.anio]) === anio &&
          Number(row[C.mes])  === mes &&
          row[C.semana] === s
        );
        if (rows.length > 0) { sourceRows = rows; break; }
      }
      for (const row of sourceRows) {
        const pais = normalizePais(row[C.pais] ?? '');
        const avance = Number(row[C.avance_men]) || 0;
        if (!pais || avance === 0) continue;
        if (!result[pais]) result[pais] = {};
        // Key format matches getMonthKey() in RegionSparkCard: "YYYY-(mes-1)" (0-indexed month)
        result[pais][`${anio}-${mes - 1}`] = avance;
      }
    }
    return result;
  }, [allRows, anio]);
}

export interface MensualPoint { avance: number; meta: number; avanceAnt: number; cierreAnt: number; }

/** Devuelve avance_men + meta_men + avance_men_ant + cierre_men_ant por país y mes. Clave: "YYYY-M" (mes 0-indexed). */
export function usePaisesMensual(anio: number): Record<string, Record<string, MensualPoint>> {
  const { data: allRows } = useCacheReporteRows();

  return useMemo<Record<string, Record<string, MensualPoint>>>(() => {
    if (!allRows) return {};
    const result: Record<string, Record<string, MensualPoint>> = {};
    const semanas = ['Semana 4', 'Semana 3', 'Semana 2', 'Semana 1'];

    for (let mes = 1; mes <= 12; mes++) {
      let sourceRows: string[][] = [];
      for (const s of semanas) {
        const rows = allRows.filter(row =>
          row[C.nivel] === 'pais' &&
          Number(row[C.anio]) === anio &&
          Number(row[C.mes])  === mes &&
          row[C.semana] === s
        );
        if (rows.length > 0) { sourceRows = rows; break; }
      }
      for (const row of sourceRows) {
        const pais = normalizePais(row[C.pais] ?? '');
        const avance     = Number(row[C.avance_men])     || 0;
        const meta       = Number(row[C.meta_men])       || 0;
        const avanceAnt  = Number(row[C.avance_men_ant]) || 0;
        const cierreAnt  = Number(row[C.cierre_men_ant]) || avanceAnt;
        if (!pais) continue;
        if (!result[pais]) result[pais] = {};
        result[pais][`${anio}-${mes - 1}`] = { avance, meta, avanceAnt, cierreAnt };
      }
    }
    return result;
  }, [allRows, anio]);
}

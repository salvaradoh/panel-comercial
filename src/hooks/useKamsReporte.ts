import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import { resolverNombreKam } from '../lib/kams';

const SPREADSHEET_ID = import.meta.env.VITE_DASHBOARD_SPREADSHEET_ID as string;

// Reutiliza la misma query key que useMetas — React Query comparte la caché
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
    gcTime: 30 * 60 * 1000,
    retry: 1,
  });
}

export interface KamReporte {
  pais: string;
  nombre: string;
  meta: number;
  avance: number;
  proy: number;
  ant: number;
  pct: number;
  varYoY: number;       // avance - ant (diferencia vs año anterior mismo período)
  consistencia: number; // 0-4: cuántas semanas cumplió ≥80% de su meta semanal
}

export function normPais(p: string) {
  return p.trim().replace(/^Mexico$/i, 'México').replace(/^Peru$/i, 'Perú');
}

// "BACK" es un alias que cambia según el país
const BACK_POR_PAIS: Record<string, string> = {
  'chile': 'Johanna Calzada',
  // "Diana Duran", sin D final. Estaba escrito "Durand" solo acá: la hoja de
  // roles, KAM_NOMBRES y la hoja de Forecast usan "Duran", así que su avance
  // mensual no matcheaba y la vista "Yo" le mostraba $0 teniendo $308K.
  'perú':  'Diana Duran',
  'peru':  'Diana Duran',
};

export function resolverAbrev(abrev: string, pais: string): string {
  if (abrev.toLowerCase() === 'back') {
    return BACK_POR_PAIS[pais.toLowerCase()] ?? abrev;
  }
  return resolverNombreKam(abrev);
}

export function useKamsReporte(anio: number, mes: number, semana: number) {
  const { data: allRows, isLoading } = useCacheReporteRows();

  return useQuery<KamReporte[]>({
    queryKey: ['kams-reporte', anio, mes, semana],
    queryFn: () => {
      const kamRows = (allRows ?? []).filter(row =>
        row[3] === 'kam' &&
        Number(row[0]) === anio &&
        Number(row[1]) === mes
      );

      if (semana > 0) {
        const semStr = `Semana ${semana}`;
        return kamRows
          .filter(row => row[2] === semStr)
          .map(row => {
            const meta   = Number(row[6]) || 0;
            const avance = Number(row[7]) || 0;
            const proy   = Number(row[8]) || 0;
            const ant    = Number(row[10]) || 0;
            const abrev  = String(row[5] ?? '').trim();
            const pct    = meta > 0 ? avance / meta : 0;
            const pais   = normPais(row[4] ?? '');
            return {
              pais,
              nombre:       resolverAbrev(abrev, pais),
              meta, avance, proy, ant, pct,
              varYoY:       avance - ant,
              consistencia: pct >= 0.8 ? 1 : 0,
            };
          })
          .filter(k => k.nombre);
      }

      // ── Vista mensual ────────────────────────────────────────────────────────
      //
      // Dos cosas que antes salían mal y se corrigen acá:
      //
      // 1. `ant` sumaba las 4 semanas del año pasado, o sea comparaba los días
      //    corridos de este mes contra el mes COMPLETO del año anterior. A día 10
      //    eso mostraba a un ejecutivo −$220K cuando el país entero mostraba −$130K,
      //    porque el país sí compara hasta la semana equivalente. Ahora el KAM
      //    también corta en la semana actual.
      //
      // 2. La proyección sumaba `proy_sem`, que es lineal por días: para una semana
      //    ya cerrada proyecta su propio avance, así que el total del mes daba
      //    exactamente igual al avance. Ahora se proyecta con el factor YoY del
      //    propio KAM — el mismo método que usa el país.
      const hoy = new Date();
      const esMesActual = hoy.getFullYear() === anio && hoy.getMonth() + 1 === mes;
      const semanaDeDia = (d: number) => (d <= 7 ? 1 : d <= 14 ? 2 : d <= 21 ? 3 : 4);
      // En un mes ya cerrado se compara contra el mes completo (corte = 4)
      const semanaCorte = esMesActual ? semanaDeDia(hoy.getDate()) : 4;

      interface AccEntry {
        pais: string; nombre: string;
        meta: number; avance: number;
        /** Año anterior acumulado sólo hasta la semana de corte — base de la comparación */
        antHastaCorte: number;
        /** Año anterior del mes completo — numerador del factor de proyección */
        antMesCompleto: number;
        weeklyPcts: number[];
      }
      const acc = new Map<string, AccEntry>();

      for (const row of kamRows) {
        const pais   = normPais(row[4] ?? '');
        const abrev  = String(row[5] ?? '').trim();
        if (!abrev) continue;
        const nombre = resolverAbrev(abrev, pais);
        const key    = `${pais}||${nombre}`;
        const meta   = Number(row[6]) || 0;
        const avance = Number(row[7]) || 0;
        const ant    = Number(row[10]) || 0;
        const semNum = parseInt(String(row[2] ?? '').replace(/\D+/g, ''), 10) || 0;

        if (!acc.has(key)) {
          acc.set(key, { pais, nombre, meta: 0, avance: 0, antHastaCorte: 0, antMesCompleto: 0, weeklyPcts: [] });
        }
        const e = acc.get(key)!;
        e.meta   += meta;
        e.avance += avance;
        e.antMesCompleto += ant;
        if (semNum > 0 && semNum <= semanaCorte) e.antHastaCorte += ant;
        if (meta > 0) e.weeklyPcts.push(avance / meta);
      }

      // Para el respaldo lineal cuando no hay base del año anterior
      const diasEnMes    = new Date(anio, mes, 0).getDate();
      const diasTransMes = esMesActual ? hoy.getDate() : diasEnMes;

      return Array.from(acc.values()).map(k => {
        const pct = k.meta > 0 ? k.avance / k.meta : 0;
        const consistencia = k.weeklyPcts.filter(p => p >= 0.8).length;
        // Factor YoY: cuánto del mes del año pasado quedaba por delante a esta altura.
        // Si el KAM no vendió nada en ese período del año pasado no hay factor posible;
        // ahí se proyecta linealmente por días transcurridos, igual que hace el GAS.
        const factorYoY = k.antHastaCorte > 0 ? k.antMesCompleto / k.antHastaCorte : 0;
        const proy = factorYoY > 0
          ? Math.round(k.avance * factorYoY)
          : (diasTransMes > 0 ? Math.round((k.avance / diasTransMes) * diasEnMes) : k.avance);
        return {
          pais: k.pais, nombre: k.nombre,
          meta: k.meta, avance: k.avance, proy, ant: k.antHastaCorte,
          pct, varYoY: k.avance - k.antHastaCorte, consistencia,
        };
      });
    },
    enabled: !!allRows && !isLoading,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
}

// Serie semanal de un KAM para el año completo (48 puntos: 12 meses × 4 semanas)
// Reutiliza el mismo cache de Cache_Reporte — no hace requests adicionales
const SEM_DAY: Record<string, number> = {
  'Semana 1': 7, 'Semana 2': 14, 'Semana 3': 21, 'Semana 4': 28,
};

export function useKamSerie(nombre: string, anio: number) {
  const { data: allRows, isLoading } = useCacheReporteRows();

  return useQuery<{ time: string; value: number }[]>({
    queryKey: ['kam-serie', nombre, anio],
    queryFn: () => {
      // Lookup mes→day→avance desde Cache_Reporte
      const lookup = new Map<string, number>();
      for (const row of allRows ?? []) {
        if (row[3] !== 'kam') continue;
        if (Number(row[0]) !== anio) continue;
        const day = SEM_DAY[row[2] ?? ''];
        if (!day) continue;
        const pais = normPais(row[4] ?? '');
        const abrev = String(row[5] ?? '').trim();
        if (!abrev) continue;
        if (resolverAbrev(abrev, pais) !== nombre) continue;
        const mes = Number(row[1]);
        lookup.set(`${mes}-${day}`, Number(row[7]) || 0);
      }

      // Encontrar el primer mes con datos reales (no generar zeros previos)
      let firstMes = 0;
      for (const row of allRows ?? []) {
        if (row[3] !== 'kam' || Number(row[0]) !== anio) continue;
        if (!SEM_DAY[row[2] ?? '']) continue;
        const pais = normPais(row[4] ?? '');
        const abrev = String(row[5] ?? '').trim();
        if (!abrev || resolverAbrev(abrev, pais) !== nombre) continue;
        const mes = Number(row[1]);
        if (!firstMes || mes < firstMes) firstMes = mes;
      }

      if (!firstMes) return []; // sin datos → MiniSparkline mostrará "Sin datos"

      // Generar desde el primer mes activo hasta Diciembre, value=0 si no hay datos
      const result: { time: string; value: number }[] = [];
      for (let m = firstMes; m <= 12; m++) {
        for (const day of [7, 14, 21, 28]) {
          const time = `${anio}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          result.push({ time, value: lookup.get(`${m}-${day}`) ?? 0 });
        }
      }
      return result;
    },
    enabled: !!allRows && !isLoading,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

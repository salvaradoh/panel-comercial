import { useQuery } from '@tanstack/react-query';
import { useCacheReporteRows } from './useCacheReporteRows';
import { normPais, resolverAbrev } from './useKamsReporte';
import { useKamNombres } from './useEquipo';
import { firmaNombres } from '../lib/kams';
import { mismoEjecutivo } from '../lib/forecastSheet';

export interface KamMensual {
  /** Avance real del ejecutivo por mes (1-12) */
  avanceByMes: Record<number, number>;
  /** Mismo mes del año anterior, mes completo */
  prevByMes: Record<number, number>;
}

/**
 * Avance mensual de UN ejecutivo y su comparable del año anterior, armados desde
 * Cache_Reporte.
 *
 * Cache_Reporte guarda una fila por (año, mes, semana, kam): la col 7 es el
 * avance de esa semana y la col 10 el del año anterior. Sumar las 4 semanas da
 * el mes. Se suman TODAS las semanas —no se corta en la semana actual— porque
 * este gráfico compara meses completos; el corte por semana equivalente es cosa
 * del cálculo de YoY del leaderboard.
 */
export function useKamMensual(nombre: string | undefined, anio: number) {
  const { data: allRows, isLoading } = useCacheReporteRows();
  const nombres = useKamNombres();

  return useQuery<KamMensual>({
    queryKey: ['kam-mensual', nombre ?? '', anio, firmaNombres(nombres)],
    queryFn: () => {
      const avanceByMes: Record<number, number> = {};
      const prevByMes:   Record<number, number> = {};
      for (let m = 1; m <= 12; m++) { avanceByMes[m] = 0; prevByMes[m] = 0; }

      for (const row of allRows ?? []) {
        if (row[3] !== 'kam') continue;
        if (Number(row[0]) !== anio) continue;
        const mes = Number(row[1]);
        if (!mes || mes < 1 || mes > 12) continue;
        const abrev = String(row[5] ?? '').trim();
        if (!abrev) continue;
        const pais = normPais(row[4] ?? '');
        // Comparación tolerante, no `!==`: resolverAbrev devuelve el nombre de la
        // hoja de códigos y el roster a veces lo escribe distinto (con o sin
        // tilde, segundo nombre completo). Con igualdad exacta, algunos
        // ejecutivos verían un avance de 0.
        if (!mismoEjecutivo(resolverAbrev(abrev, pais, nombres), nombre!)) continue;

        avanceByMes[mes] += Number(row[7]) || 0;
        prevByMes[mes]   += Number(row[10]) || 0;
      }
      return { avanceByMes, prevByMes };
    },
    enabled: !!allRows && !isLoading && !!nombre,
    staleTime: 10 * 60 * 1000,
    gcTime:    30 * 60 * 1000,
  });
}

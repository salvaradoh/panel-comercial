import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import { loadForecastPorEjecutivo, mismoEjecutivo } from '../lib/forecastSheet';

/**
 * Forecast HubSpot de UN ejecutivo, por mes (1-12).
 *
 * La hoja de Forecast trae el dueño del deal en su columna `Ejecutivo`, así que
 * el desglose por persona existe; lo que faltaba era leerlo. El nombre se
 * compara con `mismoEjecutivo` porque las dos hojas escriben distinto la misma
 * persona ("Santiago Cuellar" vs "Santiago Cuellar Rivera").
 *
 * Ojo: la hoja hoy solo tiene datos de 2026. Para otros años devuelve ceros, que
 * es lo correcto — no hay forecast cargado, no es un error.
 */
export function useForecastKam(anio: number, nombre: string | undefined) {
  const { token } = useAuth();

  return useQuery<Record<number, number>>({
    queryKey: ['forecast-kam', anio, nombre ?? ''],
    queryFn: async () => {
      const entries = await loadForecastPorEjecutivo(token!);
      const porMes: Record<number, number> = {};
      for (let m = 1; m <= 12; m++) porMes[m] = 0;

      for (const e of entries) {
        if (e.anio !== anio) continue;
        if (!mismoEjecutivo(e.ejecutivo, nombre!)) continue;
        porMes[e.mes] += e.ganado_usd + e.abierto_usd;
      }
      return porMes;
    },
    enabled: !!token && !!nombre,
    staleTime: 30 * 60 * 1000,
    gcTime:    60 * 60 * 1000,
  });
}

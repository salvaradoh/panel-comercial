import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import { loadForecastSheet } from '../lib/forecastSheet';

const PAISES_LATAM = ['Chile', 'Perú', 'Colombia', 'México', 'Ecuador'];

export interface ForecastMes {
  mes: number;
  forecast_usd: number;
  por_pais: Record<string, number>;
}

export interface ForecastAnualResponse {
  meses: ForecastMes[];
  anio: number;
}

export function useForecastAnual(anio: number) {
  const { token } = useAuth();

  return useQuery<ForecastAnualResponse>({
    queryKey: ['forecast-anual', anio],
    queryFn: async () => {
      const entries = await loadForecastSheet(token!);
      const meses: ForecastMes[] = [];

      for (let mes = 1; mes <= 12; mes++) {
        const por_pais: Record<string, number> = {};
        let total = 0;
        for (const pais of PAISES_LATAM) {
          const entry = entries.find(e => e.anio === anio && e.mes === mes && e.pais === pais);
          const forecast = (entry?.ganado_usd ?? 0) + (entry?.abierto_usd ?? 0);
          por_pais[pais] = forecast;
          total += forecast;
        }
        meses.push({ mes, forecast_usd: total, por_pais });
      }

      return { meses, anio };
    },
    enabled: !!token,
    staleTime: 30 * 60 * 1000,
    gcTime:    60 * 60 * 1000,
  });
}

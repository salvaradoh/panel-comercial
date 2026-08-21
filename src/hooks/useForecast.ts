import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import { loadForecastSheet } from '../lib/forecastSheet';

const PAISES_LATAM = ['Chile', 'Perú', 'Colombia', 'México', 'Ecuador'];

export interface ForecastPais {
  pais: string;
  ganado_usd: number;
  abierto_usd: number;
  deals_ganados: number;
  deals_abiertos: number;
}

interface ForecastResponse {
  paises: ForecastPais[];
  periodo: { anio: number; mes: number };
}

export function useForecast(anio: number, mes: number) {
  const { token } = useAuth();

  return useQuery<ForecastResponse>({
    queryKey: ['forecast', anio, mes],
    queryFn: async () => {
      const entries = await loadForecastSheet(token!);
      const paises = PAISES_LATAM.map(pais => {
        const entry = entries.find(e => e.anio === anio && e.mes === mes && e.pais === pais);
        return {
          pais,
          ganado_usd:    entry?.ganado_usd    ?? 0,
          abierto_usd:   entry?.abierto_usd   ?? 0,
          deals_ganados: entry?.deals_ganados  ?? 0,
          deals_abiertos: entry?.deals_abiertos ?? 0,
        };
      });
      return { paises, periodo: { anio, mes } };
    },
    enabled: !!token,
    staleTime: 30 * 60 * 1000,
    gcTime:    60 * 60 * 1000,
  });
}

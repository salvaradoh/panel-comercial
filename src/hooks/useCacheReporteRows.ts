import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';

const SPREADSHEET_ID = import.meta.env.VITE_DASHBOARD_SPREADSHEET_ID as string;

export function useCacheReporteRows() {
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

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';

/**
 * Brief de campañas. Ruta solo-Admin (el backend responde 403 a cualquier otro rol).
 *
 * El brief no se genera acá ni en el backend: lo genera el comando /campanas y lo publica
 * en la hoja Cache_Campanas. Esta vista solo muestra la última publicación, así que no
 * hay nada que esperar ni tokens que gastar al abrir el tab.
 */

export interface PreguntaCampanas {
  pregunta: string;
  respuesta: string;
}

export interface BriefCampanas {
  sin_publicar: boolean;
  motivo?: string;
  generado_en?: string;
  huella?: string;
  semana_id?: string;
  markdown?: string;
  preguntas?: PreguntaCampanas[];
  versiones_publicadas?: number;
}

export function useBriefCampanas() {
  return useQuery<BriefCampanas>({
    queryKey: ['campanas-brief'],
    queryFn: () => apiFetch<BriefCampanas>('/api/campanas/brief'),
    staleTime: 10 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: 0,
  });
}

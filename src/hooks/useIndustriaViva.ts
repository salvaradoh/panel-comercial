import { useMemo } from 'react';
import { useSheetTabla } from './useSheetTabla';

/**
 * Lee en vivo la hoja "Industria — Cartera por País" (una pestaña por país,
 * columnas País/Panel ID/Nombre/Industria/Confianza/Descripción/Fuente).
 *
 * Es la MISMA hoja que `cartera-clientes` (Apps Script) usa para inyectar la
 * col AG "Industria" en la hoja maestra del dashboard — pero ese camino solo
 * se actualiza cuando alguien corre "🔄 Actualizar Cartera" a mano. Leyendo
 * esta hoja directo (con el token del usuario, mismo patrón que `BBDD para
 * MX` en CBS — ver useSheetTabla) el panel ve una corrección o un alta de
 * campanazo al toque, sin esperar ese paso manual.
 */
export const INDUSTRIA_SHEET_ID = '1Ifk2oMQdOurR-7U1eoALGeMHja44THBXX4q3dzDjaEA';

export const INDUSTRIA_TABS = ['México', 'Chile', 'Colombia', 'Perú'] as const;

// Misma taxonomía cerrada que el dropdown de la hoja y que usa
// _novSyncIndustria en dashboard-clevel/Novedades.js — si se agrega una
// categoría hay que tocar los tres lugares.
export const TAXONOMIA_INDUSTRIA = [
  'Educación', 'Salud', 'Banca y Servicios Financieros', 'Seguros', 'Fintech y Pasarelas de Pago',
  'Consumo Masivo', 'Retail',
  'Agroindustrial', 'Automotriz', 'Tecnología', 'Telecomunicaciones', 'Entretenimiento',
  'Energía, Oil and Gas', 'Minería y Contratistas', 'Inmobiliario',
  'Materiales de Construcción y Derivados, Fabricación de Maquinarias', 'Industria Textil',
  'Transporte y Logística', 'Turismo Aerolíneas / Agencias de Viajes', 'Outsourcing / Call Centers',
  'Laboratorios', 'Investigación de Mercado', 'Agencias de Marketing y Comunicaciones',
  'Consultoría/Auditoría', 'Restaurantes/Gastronomía', 'Incentivos y Beneficios Corporativos',
  'Servicios y Otros',
] as const;

export interface IndustriaFila {
  /** Número de fila real en la pestaña (1-indexed, cabecera = fila 1) — hace falta para editar esa celda puntual. */
  fila: number;
  tab: string;
  industria: string;
  confianza: string;
  descripcion: string;
  fuente: string;
}

const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const clave = (pais: string, panelId: string) => sinTildes(pais) + '|' + sinTildes(panelId).trim();

export function useIndustriaViva() {
  // Un useSheetTabla por pestaña — son 4 llamadas fijas, no un loop dinámico,
  // porque los hooks no pueden llamarse condicionalmente.
  const mx = useSheetTabla(INDUSTRIA_SHEET_ID, 'México!A:G');
  const cl = useSheetTabla(INDUSTRIA_SHEET_ID, 'Chile!A:G');
  const co = useSheetTabla(INDUSTRIA_SHEET_ID, 'Colombia!A:G');
  const pe = useSheetTabla(INDUSTRIA_SHEET_ID, 'Perú!A:G');

  const resultados = [
    { tab: 'México', q: mx }, { tab: 'Chile', q: cl }, { tab: 'Colombia', q: co }, { tab: 'Perú', q: pe },
  ];

  const mapa = useMemo(() => {
    const m = new Map<string, IndustriaFila>();
    resultados.forEach(({ tab, q }) => {
      if (!q.data) return;
      q.data.filas.forEach((r, i) => {
        const pais = r[0] || '', panelId = r[1] || '', industria = r[3] || '';
        if (!panelId || !industria) return;
        m.set(clave(pais, panelId), {
          fila: i + 2, // +1 por la cabecera, +1 porque i es 0-indexed
          tab,
          industria,
          confianza: r[4] || '',
          descripcion: r[5] || '',
          fuente: r[6] || '',
        });
      });
    });
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mx.data, cl.data, co.data, pe.data]);

  return {
    buscar: (pais: string, panelId: string) => mapa.get(clave(pais, panelId)),
    isLoading: resultados.some(r => r.q.isLoading),
  };
}

import { useCacheSheet } from './useCacheSheet';
import type { CarteraRichResponse } from './types';

function scoreToSegmento(score: number): 'A+' | 'A' | 'B' | 'C' {
  if (score >= 3.5) return 'A+';
  if (score >= 3.0) return 'A';
  if (score >= 2.0) return 'B';
  return 'C';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getPeriodo(p: any) {
  if (p.periodo && typeof p.periodo === 'object' && !Array.isArray(p.periodo)) return p.periodo;
  if (Array.isArray(p.periodos) && p.periodos.length > 0) return p.periodos[p.periodos.length - 1];
  return null;
}


/**
 * fProd y fMargen del score de segmentación estacional.
 *
 * El caché guarda el `score` ya correcto (BigQuery lo calcula con los cuatro
 * factores) pero solo persiste el desglose de fVol y fMeses. Estos dos se
 * derivan de datos que sí están en el caché, y la reconstrucción da exacto:
 *   score = fVol×0.50 + fProd×0.25 + fMeses×0.125 + fMargen×0.125
 *
 * fProd sale del producto con más volumen — no de `catPrincipal`, cuyo texto no
 * coincide con las etiquetas del cálculo original ("Puntos Apprecio" vs "Puntos").
 */
function fProdDe(se: any): number | undefined {
  if (!se) return undefined;
  const cats = [
    { vol: Number(se.volSaas || 0),      pts: 4 },
    { vol: Number(se.volPuntos || 0),    pts: 3 },
    { vol: Number(se.volSupercard || 0), pts: 2 },
    { vol: Number(se.volGiftcard || 0),  pts: 1 },
  ];
  const dom = cats.reduce((mejor, c) => (c.vol > mejor.vol ? c : mejor), cats[0]);
  return dom.vol > 0 ? dom.pts : 1;
}

/** margenPct viene en porcentaje (25 = 25%); los cortes son 40 / 20 / 8. */
function fMargenDe(se: any): number | undefined {
  if (!se) return undefined;
  const pct = Number(se.margenPct || 0);
  return pct >= 40 ? 4 : pct >= 20 ? 3 : pct >= 8 ? 2 : 1;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transformRaw(data: any): CarteraRichResponse {
  const estPaises = ((data.estacionales?.paises || []) as any[])
    .filter((p: any) => p.pais)
    .map((p: any) => {
      const per = getPeriodo(p);
      return {
        pais: p.pais,
        churnPct: per?.totales?.churn_pct ?? per?.churn_pct ?? 0,
        periodo: per?.label ?? per?.mesNombre ?? '',
        kams: ((per?.kams || []) as any[]).map((k: any) => ({
          kam: k.kam,
          base: Number(k.base || 0),
          ret: Number(k.ret || 0),
          churn: Number(k.churn || 0),
          churnPct: Number(k.churn_pct || (k.base > 0 ? k.churn / k.base : 0)),
          retPct: Number(k.ret_pct || (k.base > 0 ? k.ret / k.base : 0)),
          volumen: Number(k.volumen || 0),
          factPerd: Number(k.fact_perd || 0),
          pctVtaPerd: Number(k.pct_vta_perd || 0),
          churn1ra: Number(k.churn1ra || 0),
          scoreEst: (() => {
            const scores = ([...(k.clientesChurn || []), ...(k.clientesRetenidos || [])] as any[])
              .map((c: any) => Number(c.scoreEstacional?.score || 0))
              .filter((s: number) => s > 0);
            return scores.length > 0
              ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length * 100) / 100
              : 0;
          })(),
          porTipo: {
            estacional: k.porTipo?.estacional || {},
            puntual: k.porTipo?.puntual || {},
            primera_compra: k.porTipo?.primera_compra || {},
          },
          clientesChurn: ((k.clientesChurn || []) as any[]).map((c: any) => ({
            empresa: c.nombre || c.empresa || '',
            volumen: Number(c.volumen || 0),
            factPerd: Number(c.monto || c.fact_perd || 0),
            ultimaCompra: c.ultimaCompra || c.ultima_compra || '',
            diasSinCompra: Number(c.diasSinCompra || c.dias_sin_compra || 0),
            subSeg: c.subSeg || '',
            score: Number(c.scoreEstacional?.score || 0),
            segmento: scoreToSegmento(Number(c.scoreEstacional?.score || 0)),
            catPrincipal: c.scoreEstacional?.catPrincipal || '',
            // Desglose del score de segmentación (fVol/fProd/fMeses/fMargen).
            // Antes se descartaba y la tabla de Segmentación salía sin datos.
            segVol:     Number(c.monto || 0),
            segFVol:    c.scoreEstacional?.fVol    != null ? Number(c.scoreEstacional.fVol)    : undefined,
            segFProd:   c.scoreEstacional?.fProd   != null ? Number(c.scoreEstacional.fProd)   : fProdDe(c.scoreEstacional),
            segFMeses:  c.scoreEstacional?.fMeses  != null ? Number(c.scoreEstacional.fMeses)  : undefined,
            segFMargen: c.scoreEstacional?.fMargen != null ? Number(c.scoreEstacional.fMargen) : fMargenDe(c.scoreEstacional),
            scoreVNT: c.scoreVNT?.score != null ? Number(c.scoreVNT.score) : undefined,
            fE: c.scoreVNT?.fE ?? c.fE ?? undefined,
            fN: c.scoreVNT?.fN ?? c.fN ?? undefined,
            fT: c.scoreVNT?.fT ?? c.fT ?? undefined,
            npsRaw: c.scoreVNT?.npsRaw != null ? Number(c.scoreVNT.npsRaw) : null,
            caida: c.scoreVNT?.caida != null ? Number(c.scoreVNT.caida) : null,
            señalesEng: Array.isArray(c.scoreVNT?.señalesEng) ? c.scoreVNT.señalesEng as string[] : [],
            ctxE: (c.scoreVNT?.ctxE ?? c.ctxE ?? '') as string,
          })),
          clientesRetenidos: ((k.clientesRetenidos || []) as any[]).map((c: any) => ({
            empresa: c.nombre || c.empresa || '',
            volumen: Number(c.volumen || 0),
            subSeg: c.subSeg || '',
            score: Number(c.scoreEstacional?.score || 0),
            segmento: scoreToSegmento(Number(c.scoreEstacional?.score || 0)),
            // Desglose del score de segmentación (fVol/fProd/fMeses/fMargen).
            // Antes se descartaba y la tabla de Segmentación salía sin datos.
            segVol:     Number(c.monto || 0),
            segFVol:    c.scoreEstacional?.fVol    != null ? Number(c.scoreEstacional.fVol)    : undefined,
            segFProd:   c.scoreEstacional?.fProd   != null ? Number(c.scoreEstacional.fProd)   : fProdDe(c.scoreEstacional),
            segFMeses:  c.scoreEstacional?.fMeses  != null ? Number(c.scoreEstacional.fMeses)  : undefined,
            segFMargen: c.scoreEstacional?.fMargen != null ? Number(c.scoreEstacional.fMargen) : fMargenDe(c.scoreEstacional),
            scoreVNT: c.scoreVNT?.score != null ? Number(c.scoreVNT.score) : undefined,
            ultimaCompra: c.ultimaCompra || c.ultima_compra || '',
            diasSinCompra: Number(c.diasSinCompra || c.dias_sin_compra || 0),
            fE: c.scoreVNT?.fE ?? c.fE ?? undefined,
            fN: c.scoreVNT?.fN ?? c.fN ?? undefined,
            fT: c.scoreVNT?.fT ?? c.fT ?? undefined,
            npsRaw: c.scoreVNT?.npsRaw != null ? Number(c.scoreVNT.npsRaw) : null,
            caida: c.scoreVNT?.caida != null ? Number(c.scoreVNT.caida) : null,
            señalesEng: Array.isArray(c.scoreVNT?.señalesEng) ? c.scoreVNT.señalesEng as string[] : [],
            ctxE: (c.scoreVNT?.ctxE ?? c.ctxE ?? '') as string,
          })),
        })),
        totales: per?.totales || null,
      };
    });

  const recPaises = ((data.recurrentes?.paises || []) as any[])
    .filter((p: any) => p.pais && (p.error == null || (p.kams && p.kams.length)))
    .map((p: any) => ({
      pais: p.pais,
      resumen: p.resumen || {},
      kams: ((p.kams || []) as any[]).map((k: any) => ({
        kam: k.kam || k.nombre || '',
        base: Number(k.cartera || k.base || k.total || 0),
        saludables: Number(k.saludables || 0),
        monitorear: Number(k.monitorear || 0),
        enRiesgo: Number(k.enRiesgo || k.en_riesgo || 0),
        criticos: Number(k.criticos || 0),
        scorePromedio: Number(k.score || k.scorePromedio || k.score_promedio || 0),
        montoPerdido: Number(k.montoPerdido || k.monto_perdido || 0),
        caidaUSD: Number(k.caidaUSD || k.lostPerdido || k.montoPerdido || k.monto_perdido || 0),
        clientes: ((k.clientesAlerta || k.clientes || []) as any[]).slice(0, 50).map((c: any) => ({
          empresa: c.nombre || c.empresa || c.nombreStr || '',
          score: Number(c.score || c.scoreRent || c.scoreTotal || 0),
          segmento: scoreToSegmento(Number(c.score || c.scoreRent || 0)),
          diasSinCompra: Number(c.diasSinCompra || c.dias_sin_compra || 0),
          ultimaCompra: c.ultimaCompra || c.ultima_compra || '',
          volumen: Number(c.montoTotal || c.volumen || c.vol || 0),
          tipo: c.tipo || c.tipoCliente || 'recurrente',
          fR: c.fR != null ? Number(c.fR) : undefined,
          fE: c.fE != null ? Number(c.fE) : undefined,
          fN: c.fN != null ? Number(c.fN) : undefined,
          fT: c.fT != null ? Number(c.fT) : undefined,
          npsRaw: c.npsRaw != null ? Number(c.npsRaw) : null,
          monto6m: c.monto6m != null ? Number(c.monto6m) : null,
          monto6mAnt: c.monto6mAnt != null ? Number(c.monto6mAnt) : null,
          detalleEngagement: (c.detalleEngagement ?? '') as string,
          ctxE: (c.ctxE ?? '') as string,
        })),
        clientesPH: ((k.clientesPerdidosHistoricos || []) as any[]).slice(0, 50).map((c: any) => ({
          empresa: c.nombre || c.empresa || '',
          score: Number(c.scoreEstacional?.score || 0),
          segmento: scoreToSegmento(Number(c.scoreEstacional?.score || 0)),
          diasSinCompra: Number(c.diasSinCompra || 0),
          volumen: Number(c.montoTotal || c.volumen || 0),
          tipo: 'perdido_historico' as const,
          fR: c.fR != null ? Number(c.fR) : undefined,
          fE: c.fE != null ? Number(c.fE) : undefined,
          fN: c.fN != null ? Number(c.fN) : undefined,
          fT: c.fT != null ? Number(c.fT) : undefined,
        })),
      })),
    }));

  return {
    anioSig: data.anioSig,
    estacionales: {
      globales: data.estacionales?.globales || {},
      paises: estPaises,
    },
    recurrentes: {
      globales: {
        ...(data.recurrentes?.globales || {}),
        totalPH: Number(data.recurrentes?.globales?.perdidosHistoricos || 0),
      },
      paises: recPaises,
    },
  };
}

export function useCacheChurn() {
  const raw = useCacheSheet<unknown>('Cache_Churn');
  return {
    ...raw,
    data: raw.data ? transformRaw(raw.data) : undefined,
  };
}

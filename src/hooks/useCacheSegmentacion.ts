import { useCacheSheet } from './useCacheSheet';
import type { SegmentacionResponse, KamSegmentacion, ClienteSegmentacion } from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transformRaw(data: any): SegmentacionResponse {
  const conteos = { 'A+': 0, A: 0, B: 0, C: 0 };
  const clientes: SegmentacionResponse['clientes'] = [];

  const paises = ((data.paises || []) as any[]).map((p: any) => {
    const kams: KamSegmentacion[] = ((p.kams || []) as any[]).map((k: any) => {
      const kamClientes: ClienteSegmentacion[] = ((k.clientes || []) as any[]).map((c: any) => {
        const seg = (c.seg || c.segmento || 'C') as 'A+' | 'A' | 'B' | 'C';
        if (conteos[seg] !== undefined) conteos[seg]++;
        const entry = {
          cliente: c.nombre || c.empresa || '',
          kam: k.kam || '',
          pais: p.pais || '',
          segmento: seg,
          score: Number(c.score || 0),
          vol: Number(c.vol || c.volumen || 0),
          ptVol: c.ptVol != null ? Number(c.ptVol) : undefined,
          ptMeses: c.ptMeses != null ? Number(c.ptMeses) : undefined,
          ptUsrInc: c.ptUsrInc != null ? Number(c.ptUsrInc) : undefined,
          ptFee: c.ptFee != null ? Number(c.ptFee) : undefined,
        };
        clientes.push(entry);
        return {
          cliente: entry.cliente,
          segmento: seg,
          score: entry.score,
          vol: entry.vol,
          meses: c.meses != null ? Number(c.meses) : undefined,
          ptVol: entry.ptVol,
          ptMeses: entry.ptMeses,
          ptUsrInc: entry.ptUsrInc,
          ptFee: entry.ptFee,
        };
      });

      let kAP = 0, kA = 0, kB = 0, kC = 0;
      kamClientes.forEach(c => {
        if (c.segmento === 'A+') kAP++;
        else if (c.segmento === 'A') kA++;
        else if (c.segmento === 'B') kB++;
        else kC++;
      });

      return {
        kam: k.kam || '',
        total: Number(k.total || kamClientes.length),
        aPlus: Number(k.aPlus ?? kAP),
        a: Number(k.a ?? kA),
        b: Number(k.b ?? kB),
        c: Number(k.c ?? kC),
        vol: Number(k.vol || 0),
        clientes: kamClientes,
      };
    });

    return {
      pais: p.pais || '',
      total: Number(p.total || kams.reduce((s, k) => s + k.total, 0)),
      aPlus: Number(p.aPlus ?? kams.reduce((s, k) => s + k.aPlus, 0)),
      a: Number(p.a ?? kams.reduce((s, k) => s + k.a, 0)),
      b: Number(p.b ?? kams.reduce((s, k) => s + k.b, 0)),
      c: Number(p.c ?? kams.reduce((s, k) => s + k.c, 0)),
      vol: Number(p.vol || kams.reduce((s, k) => s + k.vol, 0)),
      kams,
    };
  });

  const g = data.globales || {};
  const totalClientes = paises.reduce((s, p) => s + p.total, 0);
  const totalVol = paises.reduce((s, p) => s + p.vol, 0);

  return {
    clientes,
    conteos: {
      'A+': g.aPlus || conteos['A+'],
      A: g.a || conteos.A,
      B: g.b || conteos.B,
      C: g.c || conteos.C,
    },
    globales: {
      total: g.total || totalClientes,
      vol: g.vol || totalVol,
    },
    paises,
    fechaCalculo: data.fechaCalculo || '',
  };
}

export function useCacheSegmentacion(enabled = true) {
  const raw = useCacheSheet<unknown>('Cache_Segmentacion18', enabled);
  return {
    ...raw,
    data: raw.data ? transformRaw(raw.data) : undefined,
  };
}

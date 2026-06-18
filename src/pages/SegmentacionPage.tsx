import { DotMatrix } from '../components/charts/DotMatrix';
import type { SegmentacionResponse } from '../hooks/types';

const MOCK: SegmentacionResponse = {
  clientes: [
    ...Array.from({ length: 12 }, (_, i) => ({
      cliente: `Cliente A+ ${i + 1}`,
      kam: i % 2 === 0 ? 'CF' : 'BC',
      segmento: 'A+' as const,
      score: 95 + i,
      vol: 500_000 + i * 10_000,
    })),
    ...Array.from({ length: 20 }, (_, i) => ({
      cliente: `Cliente A ${i + 1}`,
      kam: i % 3 === 0 ? 'MS' : i % 3 === 1 ? 'JG' : 'DD',
      segmento: 'A' as const,
      score: 80 + i,
      vol: 200_000 + i * 5_000,
    })),
    ...Array.from({ length: 30 }, (_, i) => ({
      cliente: `Cliente B ${i + 1}`,
      kam: 'Felipe',
      segmento: 'B' as const,
      score: 60 + i,
      vol: 100_000 + i * 2_000,
    })),
    ...Array.from({ length: 15 }, (_, i) => ({
      cliente: `Cliente C ${i + 1}`,
      kam: 'Ander',
      segmento: 'C' as const,
      score: 30 + i,
      vol: 50_000 + i * 1_000,
    })),
  ],
  conteos: { 'A+': 12, A: 20, B: 30, C: 15 },
};

const KAMS = ['CF', 'BC', 'MS', 'JG', 'DD', 'Felipe', 'Ander'];

export function SegmentacionPage() {
  return (
    <div className="p-6 flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-slate-700">Segmentación de Clientes</h2>
      <DotMatrix clientes={MOCK.clientes} kams={KAMS} />
    </div>
  );
}

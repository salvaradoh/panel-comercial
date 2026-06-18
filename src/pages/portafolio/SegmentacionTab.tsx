import { useSegmentacion } from '../../hooks/useSegmentacion';
import { DotMatrix } from '../../components/charts/DotMatrix';
import { Card } from '../../components/ui/Card';

interface SegmentacionTabProps {
  tipo: 'estacionales' | 'recurrentes';
}

export function SegmentacionTab({ tipo }: SegmentacionTabProps) {
  const { data, isLoading } = useSegmentacion();

  if (isLoading) {
    return <div className="h-64 bg-slate-100 rounded-2xl animate-pulse" />;
  }

  if (!data || data.clientes.length === 0) {
    return (
      <Card>
        <div className="py-8 text-center">
          <p className="text-slate-500 text-sm font-medium">Sin datos de segmentación</p>
          <p className="text-slate-400 text-xs mt-2">
            La sheet <code className="bg-slate-100 px-1 rounded">Cache_Segmentacion18</code> no tiene datos o no está compartida.
          </p>
          <p className="text-slate-400 text-xs mt-1">
            Ejecutar <code className="bg-slate-100 px-1 rounded">generarCacheSegmentacion()</code> en GAS para generarla.
          </p>
        </div>
      </Card>
    );
  }

  const kams = [...new Set(data.clientes.map((c) => c.kam))];

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold">
        Segmentación {tipo === 'estacionales' ? 'Estacional (Score 1-4)' : 'IPC (Score 1-4)'} — A+/A/B/C
      </p>
      <DotMatrix clientes={data.clientes} kams={kams} />
    </div>
  );
}

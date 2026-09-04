import { useAncho } from '../hooks/useAncho';

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  min?: number;
  max?: number;
  labels?: string[];
  showDots?: boolean;
  showArea?: boolean;
}

export function Sparkline({
  data,
  width = 80,
  height = 28,
  color = '#0097A7',
  min,
  max,
  labels,
  showDots = true,
  showArea = true,
}: SparklineProps) {
  if (!data || data.length < 2) {
    return <svg width={width} height={height} />;
  }

  const pad = 3;
  const w = width  - pad * 2;
  const h = height - pad * 2;

  const lo = min ?? Math.min(...data);
  const hi = max ?? Math.max(...data);
  const range = hi - lo || 1;

  const x = (i: number) => pad + (i / (data.length - 1)) * w;
  const y = (v: number) => pad + h - ((v - lo) / range) * h;

  const points = data.map((v, i) => `${x(i)},${y(v)}`).join(' ');
  const areaPath = `M${x(0)},${y(data[0])} ` +
    data.map((v, i) => `L${x(i)},${y(v)}`).join(' ') +
    ` L${x(data.length - 1)},${pad + h} L${x(0)},${pad + h} Z`;

  const last  = data[data.length - 1];
  const first = data[0];
  const trend = last >= first ? color : '#ef4444';

  return (
    <svg width={width} height={height} style={{ display: 'block', overflow: 'visible' }}>
      {showArea && (
        <path d={areaPath} fill={trend} fillOpacity={0.08} stroke="none" />
      )}
      <polyline
        points={points}
        fill="none"
        stroke={trend}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {showDots && data.map((v, i) => {
        const isLast = i === data.length - 1;
        if (!isLast && data.length > 6) return null;
        return (
          <circle key={i} cx={x(i)} cy={y(v)} r={isLast ? 2.5 : 1.8}
            fill={trend} stroke="white" strokeWidth={1} />
        );
      })}
      {/* Se saltean etiquetas cuando no hay ancho para todas: con 8 semanas en
          ~250px, "08-W2" y "08-W3" se pisaban y quedaba un borrón ilegible.
          El paso se calcula del ancho real, no de un número fijo, y la PRIMERA y
          la ÚLTIMA se dibujan siempre: son las que dan el rango del gráfico. */}
      {labels && (() => {
        const anchoMin = 34;                        // px que ocupa "08-W3" a 7px, con aire
        const paso = Math.max(1, Math.ceil((labels.length * anchoMin) / width));
        return labels.map((lbl, i) => {
          const ultima = i === labels.length - 1;
          if (!ultima && i % paso !== 0) return null;
          // Si la última cae pegada a una que ya se dibujó, se omite esa.
          if (!ultima && paso > 1 && labels.length - 1 - i < paso) return null;
          return (
            <text key={i} x={x(i)} y={height - 1} fontSize={7}
              textAnchor={i === 0 ? 'start' : ultima ? 'end' : 'middle'}
              fill="#94a3b8" fontFamily="system-ui">
              {lbl}
            </text>
          );
        });
      })()}
    </svg>
  );
}

// Versión grande para el panel de detalle
export function SparklinePanel({
  data,
  labels,
  color = '#0097A7',
  title,
}: {
  data: number[];
  labels?: string[];
  color?: string;
  title?: string;
}) {
  if (!data || data.length < 2) return null;

  const last  = data[data.length - 1];
  const first = data[0];
  const pct   = first !== 0 ? ((last - first) / first) * 100 : 0;
  const up     = last >= first;

  // El <svg> lleva un ancho en píxeles, no un viewBox, así que un número fijo
  // desborda en pantallas angostas. Se mide el contenedor: en desktop da los
  // ~460px de siempre y en un teléfono se ajusta, sin encoger las etiquetas.
  const { ref, ancho } = useAncho<HTMLDivElement>();

  return (
    <div>
      {title && (
        <div className="flex items-center justify-between mb-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{title}</p>
          <span className={`text-[11px] font-bold tabular-nums ${up ? 'text-emerald-500' : 'text-red-400'}`}>
            {up ? '▲' : '▼'} {Math.abs(pct).toFixed(1)}%
          </span>
        </div>
      )}
      <div ref={ref} className="bg-slate-50 rounded-xl px-2 pt-2 pb-1">
        <Sparkline
          data={data}
          // 220px venían de cuando el panel de detalle era una columna angosta.
          // Ahora es un overlay de ~500px y el gráfico se dibujaba en un tercio
          // del espacio, apretando las etiquetas del eje hasta que se pisaban.
          // El 460 quedó como ancho de diseño: es el que se usa hasta que la
          // medición llega, y el tope cuando hay espacio de sobra.
          width={Math.min(460, ancho ?? 460)}
          height={72}
          color={color}
          labels={labels}
          showDots
          showArea
        />
      </div>
    </div>
  );
}

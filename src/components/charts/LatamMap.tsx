import { useState } from 'react';
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
  Marker,
} from 'react-simple-maps';
import { Card } from '../ui/Card';
import type { PaisData } from '../../hooks/types';

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

const COUNTRY_CODES: Record<string, string> = {
  Chile: '152',
  Perú: '604',
  Peru: '604',
  Colombia: '170',
  México: '484',
  Mexico: '484',
  Ecuador: '218',
};

const COUNTRY_CENTROIDS: Record<string, [number, number]> = {
  Chile: [-71, -35],
  Perú: [-76, -10],
  Peru: [-76, -10],
  Colombia: [-74, 4],
  México: [-102, 24],
  Mexico: [-102, 24],
  Ecuador: [-78, -2],
};

const FLAG_CC: Record<string, string> = {
  Chile: 'cl',
  Perú: 'pe',
  Peru: 'pe',
  Colombia: 'co',
  México: 'mx',
  Mexico: 'mx',
  Ecuador: 'ec',
};

interface LatamMapProps {
  data: PaisData[];
  onSelectPais?: (pais: string) => void;
}

export function LatamMap({ data, onSelectPais }: LatamMapProps) {
  const [hovered, setHovered] = useState<string | null>(null);

  const maxAvance = Math.max(...data.map((d) => d.avance), 1);

  function bubbleRadius(avance: number) {
    return 8 + (avance / maxAvance) * 22;
  }

  const highlightCodes = new Set(data.map((d) => COUNTRY_CODES[d.pais]).filter(Boolean));

  return (
    <Card className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-slate-700">Avance LATAM</h3>
      <div className="flex gap-4">
        <div className="flex-1 min-h-0" style={{ height: 320 }}>
          <ComposableMap
            projection="geoMercator"
            projectionConfig={{ center: [-80, -5], scale: 340 }}
            style={{ width: '100%', height: '100%' }}
          >
            <ZoomableGroup>
              <Geographies geography={GEO_URL}>
                {({ geographies }) =>
                  geographies.map((geo) => {
                    const code = String(geo.id);
                    const isHighlighted = highlightCodes.has(code);
                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        style={{
                          default: {
                            fill: isHighlighted ? '#E0F7FA' : '#f1f5f9',
                            stroke: '#cbd5e1',
                            strokeWidth: 0.5,
                            outline: 'none',
                          },
                          hover: {
                            fill: isHighlighted ? '#B2EBF2' : '#e2e8f0',
                            outline: 'none',
                          },
                          pressed: { outline: 'none' },
                        }}
                      />
                    );
                  })
                }
              </Geographies>
              {data.map((d) => {
                const coords = COUNTRY_CENTROIDS[d.pais];
                if (!coords) return null;
                const r = bubbleRadius(d.avance);
                const isHovered = hovered === d.pais;
                return (
                  <Marker key={d.pais} coordinates={coords}>
                    <circle
                      r={r}
                      fill="#0097A7"
                      fillOpacity={isHovered ? 0.85 : 0.6}
                      stroke="#0097A7"
                      strokeWidth={1.5}
                      style={{ cursor: 'pointer', transition: 'all 0.15s' }}
                      onMouseEnter={() => setHovered(d.pais)}
                      onMouseLeave={() => setHovered(null)}
                      onClick={() => onSelectPais?.(d.pais)}
                      role="button"
                      aria-label={`${d.pais}: ${(d.pct * 100).toFixed(0)}% de meta`}
                    />
                    {isHovered && (
                      <text
                        textAnchor="middle"
                        dy={-r - 4}
                        style={{
                          fontSize: 10,
                          fill: '#0f172a',
                          fontWeight: 600,
                          pointerEvents: 'none',
                        }}
                      >
                        {d.pais} {(d.pct * 100).toFixed(0)}%
                      </text>
                    )}
                  </Marker>
                );
              })}
            </ZoomableGroup>
          </ComposableMap>
        </div>

        {/* Tabla lateral */}
        <div className="w-36 flex flex-col gap-2 justify-center">
          {data
            .slice()
            .sort((a, b) => b.avance - a.avance)
            .map((d) => {
              const cc = FLAG_CC[d.pais];
              const delta = (d.pct - 1) * 100;
              return (
                <button
                  key={d.pais}
                  className="flex items-center gap-2 text-left hover:bg-slate-50 rounded-lg px-2 py-1 transition-all active:scale-[0.99] w-full"
                  onClick={() => onSelectPais?.(d.pais)}
                  aria-label={`Ver detalle de ${d.pais}`}
                >
                  {cc && (
                    <img
                      src={`https://flagcdn.com/24x18/${cc}.png`}
                      width={20}
                      height={15}
                      alt={d.pais}
                      className="rounded-sm"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-700 truncate">{d.pais}</p>
                    <p
                      className={`text-xs tabular-nums font-medium ${
                        delta >= 0 ? 'text-emerald-600' : 'text-red-500'
                      }`}
                    >
                      {delta >= 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}%
                    </p>
                  </div>
                </button>
              );
            })}
        </div>
      </div>
    </Card>
  );
}

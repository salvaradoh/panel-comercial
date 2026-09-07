import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Card } from '../../components/ui';
import type { FilaCBS, EstadoCBS } from '../../lib/cbs';
import {
  avancePorTier, opcionesDe, distribucionEstados, embudoConversion, rankingEjecutivos,
  ventanaProyecto, estadoDe, usdDe, sumaUSD, cuentaOportunidades, FUENTE_KAM_META,
  ESTADO_META, fmtUSDCorto, fmtUSDExacto, fmtPct, fmtNum,
} from '../../lib/cbs';
import {
  KpiCBS, Selector, TierChip, Paginador, SinDatos, CabeceraCBS, AlertaAccionable, ChipFiltro,
} from './ui';
import { EmbudoConversion, BarraEstados } from './EmbudoCBS';
import { RankingEjecutivosCBS } from './RankingEjecutivosCBS';
import { FichaCuentaCBS } from './FichaCuentaCBS';

const POR_PAGINA = 25;

type OrdenTabla = 'usd' | 'razonSocial' | 'segmentacion' | 'kamActual';

interface Props { filas: FilaCBS[] }

export function FarmingCBSTab({ filas }: Props) {
  const [pais, setPais]     = useState('');
  const [kam, setKam]       = useState('');
  const [tier, setTier]     = useState('');
  const [estado, setEstado] = useState<EstadoCBS | null>(null);
  const [orden, setOrden]   = useState<OrdenTabla>('usd');
  const [pagina, setPagina] = useState(0);
  const [ficha, setFicha]   = useState<FilaCBS | null>(null);

  const opciones = useMemo(() => ({
    paises: opcionesDe(filas, 'paisOrigen'),
    kams:   opcionesDe(filas, 'kamActual'),
    tiers:  opcionesDe(filas, 'segmentacion'),
  }), [filas]);

  /** Filtros de contexto: mandan sobre TODA la página, agregados incluidos. */
  const enContexto = useMemo(() => filas.filter((f) =>
    (!pais || f.paisOrigen === pais) &&
    (!kam  || f.kamActual === kam) &&
    (!tier || f.segmentacion === tier)
  ), [filas, pais, kam, tier]);

  /** El estado solo acota la tabla: la barra de estados tiene que seguir mostrando el todo. */
  const enTabla = useMemo(() => {
    const base = estado ? enContexto.filter((f) => estadoDe(f) === estado) : enContexto;
    const copia = [...base];
    if (orden === 'usd') copia.sort((a, b) => usdDe(b) - usdDe(a));
    else copia.sort((a, b) => String(a[orden]).localeCompare(String(b[orden]), 'es'));
    return copia;
  }, [enContexto, estado, orden]);

  const tramos  = useMemo(() => distribucionEstados(enContexto), [enContexto]);
  const embudo  = useMemo(() => embudoConversion(enContexto), [enContexto]);
  const ranking = useMemo(() => rankingEjecutivos(enContexto, 'kamActual'), [enContexto]);
  const tiers   = useMemo(() => avancePorTier(enContexto), [enContexto]);
  const ventana = useMemo(() => ventanaProyecto(enContexto), [enContexto]);

  const oportunidades = cuentaOportunidades(enContexto);
  const conSponsor    = enContexto.filter((f) => f.sponsors > 0);
  const usdTotal      = sumaUSD(enContexto);
  const sinTocar      = enContexto.filter((f) => estadoDe(f) === 'sin_tocar');
  const kamsEnCero    = ranking.filter((r) => r.sponsors === 0);

  const pagActual = Math.min(pagina, Math.max(0, Math.ceil(enTabla.length / POR_PAGINA) - 1));
  const pageRows  = enTabla.slice(pagActual * POR_PAGINA, (pagActual + 1) * POR_PAGINA);

  const filtrar = (set: (v: string) => void) => (v: string) => { set(v); setPagina(0); };
  const cambiarEstado = (e: EstadoCBS | null) => { setEstado(e); setPagina(0); };
  const ordenar = (k: OrdenTabla) => { setOrden(k); setPagina(0); };

  const hayFiltro = Boolean(pais || kam || tier || estado);

  return (
    <div className="space-y-5">
      <CabeceraCBS
        titulo="Farming · activación de sponsors"
        bajada="CBS LATAM: Perú · Chile · Colombia → México"
        ventana={ventana}
      />

      {/* Alertas: solo se dibujan si hay algo que hacer. Una alerta en cero es ruido. */}
      {(sinTocar.length > 0 || kamsEnCero.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {sinTocar.length > 0 && (
            <AlertaAccionable
              icono="○"
              texto={`${sinTocar.length} cuentas sin ninguna marca de gestión`}
              detalle={`${fmtUSDCorto(sumaUSD(sinTocar))} de facturación anual sin trabajar`}
              onAccion={() => cambiarEstado('sin_tocar')}
              textoAccion="Ver cuáles"
            />
          )}
          {kamsEnCero.length > 0 && (
            <AlertaAccionable
              tono="amber"
              icono="!"
              texto={`${kamsEnCero.length} ejecutivos sin ningún sponsor validado`}
              detalle={`${kamsEnCero.reduce((a, r) => a + r.cuentas, 0)} cuentas entre todos · ${
                kamsEnCero.slice(0, 3).map((r) => r.nombre).join(', ')}${kamsEnCero.length > 3 ? '…' : ''}`}
            />
          )}
        </div>
      )}

      {/* Filtros de contexto */}
      <div className="flex flex-wrap items-end gap-4">
        <Selector label="País origen"  value={pais} options={opciones.paises} onChange={filtrar(setPais)} />
        <Selector label="KAM vigente"  value={kam}  options={opciones.kams}   onChange={filtrar(setKam)} />
        <Selector label="Segmentación" value={tier} options={opciones.tiers}  onChange={filtrar(setTier)} />
        {hayFiltro && (
          <div className="flex flex-wrap gap-2 pb-2">
            {pais   && <ChipFiltro label={pais} onQuitar={() => setPais('')} />}
            {kam    && <ChipFiltro label={kam}  onQuitar={() => setKam('')} />}
            {tier   && <ChipFiltro label={tier} onQuitar={() => setTier('')} />}
            {estado && <ChipFiltro label={ESTADO_META[estado].label} onQuitar={() => cambiarEstado(null)} />}
          </div>
        )}
      </div>

      {/* KPIs: cuentas y plata juntas, porque la historia cambia según cuál mires */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCBS label="USD en juego"    valor={fmtUSDCorto(usdTotal)}
                sub={`${oportunidades} oportunidades`} acento="#475569" />
        <KpiCBS label="Avance"          valor={fmtPct(oportunidades ? conSponsor.length / oportunidades : 0)}
                sub={`${conSponsor.length} sponsors de ${oportunidades}`} acento="#475569" />
        <KpiCBS label="USD con sponsor" valor={fmtUSDCorto(sumaUSD(conSponsor))}
                sub="Decisor confirmado" acento="#16A34A" />
        <KpiCBS label="USD sin tocar"   valor={fmtUSDCorto(sumaUSD(sinTocar))}
                sub={`${sinTocar.length} cuentas`} acento="#E11D48" />
      </div>

      <BarraEstados tramos={tramos} activo={estado} onEstado={cambiarEstado} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <EmbudoConversion etapas={embudo} />

        <Card>
          <h3 className="text-sm font-bold text-slate-700 mb-3">Dónde está el valor</h3>
          {tiers.length === 0 ? <SinDatos /> : (
            <div className="tabla-scroll">
              <table className="w-full text-sm tabla-apilable-vp">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wide text-slate-400 border-b border-slate-100">
                    <th className="text-left  font-medium pb-2">Tier</th>
                    <th className="text-right font-medium pb-2">USD 12m</th>
                    <th className="text-right font-medium pb-2 pl-3">Avance</th>
                  </tr>
                </thead>
                <tbody>
                  {tiers.map((t) => {
                    const usd = sumaUSD(enContexto.filter((f) => f.segmentacion === t.tier));
                    const share = usdTotal ? usd / usdTotal : 0;
                    return (
                      <tr key={t.tier} className="border-b border-slate-50 last:border-0">
                        <td data-titular className="py-2 pr-3"><TierChip tier={t.tier} /></td>
                        <td data-label="USD 12m" className="py-2 text-right" title={fmtUSDExacto(usd)}>
                          <div className="tabular-nums font-semibold text-slate-800">{fmtUSDCorto(usd)}</div>
                          {/* Cuánto del valor total concentra este tier */}
                          <div className="h-1 w-full bg-slate-100 rounded-full mt-1 overflow-hidden">
                            <div className="h-full rounded-full bg-slate-300" style={{ width: `${share * 100}%` }} />
                          </div>
                        </td>
                        <td data-label="Avance" className="py-2 pl-3 text-right tabular-nums text-slate-500 whitespace-nowrap">
                          {t.sponsors}/{t.oportunidades}
                          <span className="text-slate-400"> · {fmtPct(t.avance)}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <RankingEjecutivosCBS
        filas={ranking}
        titulo="Avance por KAM"
        etiquetaVacia="Ninguna cuenta con KAM asignado en este recorte."
      />

      {/* Detalle */}
      <Card>
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
          <h3 className="text-sm font-bold text-slate-700">
            Cuentas
            {estado && <span className="text-slate-400 font-normal"> · {ESTADO_META[estado].label}</span>}
          </h3>
          <span className="text-[11px] text-slate-400">Clic en una fila para abrir la ficha</span>
        </div>
        {enTabla.length === 0 ? <SinDatos /> : (
          <>
            <div className="overflow-x-auto tabla-scroll">
              <table className="w-full text-sm min-w-[760px] tabla-apilable">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wide text-slate-400 border-b border-slate-100">
                    <Th k="razonSocial"  cur={orden} onSort={ordenar} align="left">Razón social</Th>
                    <Th k="segmentacion" cur={orden} onSort={ordenar} align="left">Tier</Th>
                    <Th k="kamActual"    cur={orden} onSort={ordenar} align="left">KAM</Th>
                    <th className="text-left font-medium pb-2 pr-3">Estado</th>
                    <Th k="usd"          cur={orden} onSort={ordenar} align="right">USD 12m</Th>
                    <th className="text-left font-medium pb-2 pl-3">Contacto</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((f, i) => {
                    const meta = ESTADO_META[estadoDe(f)];
                    const usd = usdDe(f);
                    const abierta = ficha === f;
                    return (
                      <tr
                        key={`${f.idEmpresa}-${f.paisOrigen}-${i}`}
                        onClick={() => setFicha(abierta ? null : f)}
                        className={`border-b border-slate-50 last:border-0 cursor-pointer transition-colors ${
                          abierta ? 'bg-rose-50/60' : 'hover:bg-slate-50/60'
                        }`}
                      >
                        <td data-titular className="py-2 pr-3 text-slate-700 max-w-[230px] truncate" title={f.razonSocial}>
                          {f.razonSocial || '—'}
                        </td>
                        <td data-label="Tier" className="py-2 pr-3"><TierChip tier={f.segmentacion} /></td>
                        <td data-label="KAM" className="py-2 pr-3 whitespace-nowrap">
                          {f.kamActual
                            ? <span className="text-slate-600">{f.kamActual}</span>
                            : <span className="text-slate-300">Sin asignar</span>}
                          {/* Un asterisco marca el dato que NO viene de la cartera
                              vigente: el ranking señala personas, así que la
                              procedencia tiene que estar a la vista. */}
                          {!FUENTE_KAM_META[f.kamFuente].confiable && f.kamActual && (
                            <span className="text-amber-500 ml-0.5"
                                  title={FUENTE_KAM_META[f.kamFuente].label}>*</span>
                          )}
                        </td>
                        <td data-label="Estado" className="py-2 pr-3">
                          {/* Color + texto: nunca solo el punto */}
                          <span className="inline-flex items-center gap-1.5 text-[11px] whitespace-nowrap"
                                style={{ color: meta.color }}>
                            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: meta.color }} />
                            {meta.label}
                          </span>
                        </td>
                        <td data-label="USD 12m" className="py-2 pl-3 text-right tabular-nums text-slate-700 whitespace-nowrap"
                            title={fmtUSDExacto(usd)}>
                          {usd > 0 ? fmtUSDCorto(usd) : <span className="text-slate-300">—</span>}
                        </td>
                        <td data-label="Contacto" className="py-2 pl-3 text-slate-500 text-[12px] max-w-[190px] truncate"
                            title={f.correoContacto || f.contactoActual}>
                          {f.contactoActual || <span className="text-slate-300">Sin contacto</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Paginador pagina={pagActual} porPagina={POR_PAGINA} total={enTabla.length} onPagina={setPagina} />
          </>
        )}
      </Card>

      <p className="text-[11px] text-slate-400 text-center pb-2">
        Facturación convertida a USD con el tipo de cambio de la casa
        (CLP 950 · COP 4.000 · PEN 3,4), el mismo que produce <code>MONTO_USD</code> en BigQuery.
        {' '}{fmtNum(enContexto.filter((f) => usdDe(f) === 0).length)} cuentas sin facturación registrada.
        <br />
        El KAM sale de cruzar el Panel ID contra la cartera vigente del panel, no de la
        columna <code>ID KAM</code> de la hoja, que está desactualizada.
        {' '}{fmtNum(enContexto.filter((f) => !FUENTE_KAM_META[f.kamFuente].confiable).length)} cuentas
        sin confirmar (marcadas con *).
      </p>

      {ficha && <FichaCuentaCBS fila={ficha} onClose={() => setFicha(null)} />}
    </div>
  );
}

function Th({ k, cur, onSort, align, children }: {
  k: OrdenTabla; cur: OrdenTabla; onSort: (k: OrdenTabla) => void;
  align: 'left' | 'right'; children: ReactNode;
}) {
  const activo = cur === k;
  return (
    <th
      onClick={() => onSort(k)}
      aria-sort={activo ? 'descending' : 'none'}
      className={`font-medium pb-2 cursor-pointer select-none hover:text-slate-600 transition-colors
                  ${align === 'right' ? 'text-right pl-3' : 'text-left pr-3'}`}
    >
      <span className={activo ? 'text-[#E11D48]' : ''}>{children}</span>
      <span className={activo ? 'text-[#E11D48]' : 'opacity-30'}>{activo ? ' ↓' : ' ↕'}</span>
    </th>
  );
}

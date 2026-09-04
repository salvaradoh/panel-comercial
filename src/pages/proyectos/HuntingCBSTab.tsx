import { useMemo, useState } from 'react';
import { Card } from '../../components/ui';
import type { FilaCBS } from '../../lib/cbs';
import {
  resumenHunting, opcionesDe, rankingEjecutivos, ventanaProyecto,
  usdDe, sumaUSD, fmtUSDCorto, fmtUSDExacto, fmtNum,
} from '../../lib/cbs';
import {
  KpiCBS, Selector, TierChip, Paginador, SinDatos, Flag,
  CabeceraCBS, AlertaAccionable, ChipFiltro,
} from './ui';
import { RankingEjecutivosCBS } from './RankingEjecutivosCBS';
import { FichaCuentaCBS } from './FichaCuentaCBS';

const POR_PAGINA = 25;

interface Props { filas: FilaCBS[] }

export function HuntingCBSTab({ filas }: Props) {
  const [pais, setPais] = useState('');
  const [bdm, setBdm]   = useState('');
  const [pagSeg, setPagSeg] = useState(0);
  const [ficha, setFicha]   = useState<FilaCBS | null>(null);

  const opciones = useMemo(() => ({
    paises: opcionesDe(filas, 'paisOrigen'),
    bdms:   opcionesDe(filas, 'idKamBdm'),
  }), [filas]);

  const visibles = useMemo(() => filas.filter((f) =>
    (!pais || f.paisOrigen === pais) &&
    (!bdm  || f.idKamBdm === bdm)
  ), [filas, pais, bdm]);

  const r       = useMemo(() => resumenHunting(visibles), [visibles]);
  const ranking = useMemo(() => rankingEjecutivos(visibles, 'idKamBdm'), [visibles]);
  const ventana = useMemo(() => ventanaProyecto(visibles), [visibles]);

  /** Etapa 1: las cuentas efectivamente derivadas a un KAM o BDM de destino. */
  const derivadas = useMemo(
    () => [...visibles.filter((f) => f.idKamBdm !== '')].sort((a, b) => usdDe(b) - usdDe(a)),
    [visibles],
  );
  /** Etapa 2: las que entraron a prospección fría. */
  const cuentasHunting = useMemo(
    () => [...visibles.filter((f) => f.contactosHunting > 0)].sort((a, b) => usdDe(b) - usdDe(a)),
    [visibles],
  );
  /** Marcadas a hunting pero todavía sin nadie asignado: el cuello de botella. */
  const sinDerivar = useMemo(
    () => visibles.filter((f) => f.aHunting > 0 && f.idKamBdm === ''),
    [visibles],
  );

  const pagActual = Math.min(pagSeg, Math.max(0, Math.ceil(derivadas.length / POR_PAGINA) - 1));
  const segPage = derivadas.slice(pagActual * POR_PAGINA, (pagActual + 1) * POR_PAGINA);

  const filtrar = (set: (v: string) => void) => (v: string) => { set(v); setPagSeg(0); };
  const hayFiltro = Boolean(pais || bdm);

  return (
    <div className="space-y-5">
      <CabeceraCBS
        titulo="Hunting · derivación y prospección"
        bajada="Perú · Chile · Colombia → México"
        ventana={ventana}
      />

      {sinDerivar.length > 0 && (
        <AlertaAccionable
          tono="amber"
          icono="→"
          texto={`${sinDerivar.length} cuentas marcadas a hunting sin BDM asignado`}
          detalle={`${fmtUSDCorto(sumaUSD(sinDerivar))} esperando que alguien las tome`}
        />
      )}

      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-4">
        <Selector label="País origen" value={pais} options={opciones.paises} onChange={filtrar(setPais)} />
        <Selector label="ID KAM/BDM"  value={bdm}  options={opciones.bdms}   onChange={filtrar(setBdm)} />
        {hayFiltro && (
          <div className="flex flex-wrap gap-2 pb-2">
            {pais && <ChipFiltro label={pais} onQuitar={() => setPais('')} />}
            {bdm  && <ChipFiltro label={bdm}  onQuitar={() => setBdm('')} />}
          </div>
        )}
      </div>

      {/* ── Etapa 1 · derivación ── */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wide text-white bg-violet-600 rounded-lg px-2 py-1">
            Etapa 1
          </span>
          <h3 className="text-sm font-bold text-slate-700">Derivación a KAM o BDM</h3>
          <span className="text-[11px] text-slate-400">Qué pasó con los sponsors validados</span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          <KpiCBS label="Sponsors validados"  valor={fmtNum(r.sponsors)}   acento="#16A34A" />
          <KpiCBS label="Pasaron a BDM"       valor={fmtNum(r.pasaronBdm)} acento="#7C3AED" />
          <KpiCBS label="Pasaron a KAM"       valor={fmtNum(r.pasaronKam)} acento="#7C3AED" />
          <KpiCBS label="En gestión/Reunión"  valor={fmtNum(r.enGestionReunion)} />
          <KpiCBS label="No aplica/No desea"  valor={fmtNum(r.noAplicaProspeccion)} acento="#94A3B8" />
          <KpiCBS label="Cierre ganado"       valor={fmtNum(r.cierreGanado)} acento="#16A34A"
                  sub={fmtUSDCorto(sumaUSD(visibles.filter((f) => f.cierreGanado > 0)))} />
        </div>

        <RankingEjecutivosCBS
          filas={ranking}
          titulo="Avance por KAM/BDM de destino"
          etiquetaVacia="Todavía no hay cuentas derivadas con este recorte."
        />

        <Card>
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
            <h3 className="text-sm font-bold text-slate-700">Cuentas derivadas</h3>
            <span className="text-[11px] text-slate-400">Clic en una fila para abrir la ficha</span>
          </div>
          {derivadas.length === 0 ? (
            <SinDatos mensaje="Ninguna cuenta derivada a KAM o BDM con estos filtros." />
          ) : (
            <>
              <div className="overflow-x-auto tabla-scroll">
                <table className="w-full text-sm min-w-[880px] tabla-apilable">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-wide text-slate-400 border-b border-slate-100">
                      <th className="text-left  font-medium pb-2 pr-3">Razón social</th>
                      <th className="text-left  font-medium pb-2 pr-3">Destino</th>
                      <th className="text-right font-medium pb-2 pl-3">USD 12m</th>
                      <th className="text-right font-medium pb-2 pl-3">Secuencia</th>
                      <th className="text-right font-medium pb-2 pl-3">WhatsApp</th>
                      <th className="text-right font-medium pb-2 pl-3">Reunión</th>
                      <th className="text-left  font-medium pb-2 pl-4">Seguimiento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {segPage.map((f, i) => {
                      const abierta = ficha === f;
                      const usd = usdDe(f);
                      return (
                        <tr
                          key={`${f.idEmpresa}-${i}`}
                          onClick={() => setFicha(abierta ? null : f)}
                          className={`border-b border-slate-50 last:border-0 cursor-pointer transition-colors ${
                            abierta ? 'bg-rose-50/60' : 'hover:bg-slate-50/60'
                          }`}
                        >
                          <td data-titular className="py-2 pr-3 text-slate-700 max-w-[200px] truncate" title={f.razonSocial}>
                            {f.razonSocial || '—'}
                          </td>
                          <td data-label="Destino" className="py-2 pr-3 whitespace-nowrap">
                            <span className="text-slate-700">{f.idKamBdm}</span>
                            <span className="text-slate-400 text-[12px]"> · {f.paisDestino || '—'}</span>
                          </td>
                          <td data-label="USD 12m" className="py-2 pl-3 text-right tabular-nums text-slate-700 whitespace-nowrap"
                              title={fmtUSDExacto(usd)}>
                            {usd > 0 ? fmtUSDCorto(usd) : <span className="text-slate-300">—</span>}
                          </td>
                          <td data-label="Secuencia" className="py-2 pl-3 text-right"><Flag v={f.envioSecuenciaHunting} /></td>
                          <td data-label="WhatsApp" className="py-2 pl-3 text-right"><Flag v={f.whatsappHunting} /></td>
                          <td data-label="Reunión" className="py-2 pl-3 text-right"><Flag v={f.enGestionReunion} /></td>
                          <td data-label="Seguimiento" className="py-2 pl-4 text-slate-500 text-[12px] max-w-[240px] truncate"
                              title={f.seguimiento}>
                            {f.seguimiento || <span className="text-slate-300">—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Paginador pagina={pagActual} porPagina={POR_PAGINA} total={derivadas.length} onPagina={setPagSeg} />
            </>
          )}
        </Card>
      </section>

      {/* ── Etapa 2 · prospección ── */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wide text-white bg-[#E11D48] rounded-lg px-2 py-1">
            Etapa 2
          </span>
          <h3 className="text-sm font-bold text-slate-700">Prospección en frío</h3>
          <span className="text-[11px] text-slate-400">Cuentas sin sponsor que pasaron al BDM</span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <KpiCBS label="A hunting" valor={fmtNum(r.aHunting)} acento="#F59E0B"
                  sub={fmtUSDCorto(sumaUSD(visibles.filter((f) => f.aHunting > 0)))} />
          <KpiCBS label="Empresas en prospección" valor={fmtNum(r.empresasEnGestion)}
                  sub={`de ${fmtNum(r.aHunting)} derivadas`} />
          <KpiCBS label="Nuevos contactos" valor={fmtNum(r.nuevosContactos)} acento="#16A34A"
                  sub="Encontrados en esas empresas" />
        </div>

        <Card>
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
            <h3 className="text-sm font-bold text-slate-700">Cuentas en prospección</h3>
            <span className="text-[11px] text-slate-400">Clic en una fila para abrir la ficha</span>
          </div>
          {cuentasHunting.length === 0 ? (
            <SinDatos mensaje="Ninguna cuenta en prospección con estos filtros." />
          ) : (
            <div className="overflow-x-auto tabla-scroll">
              <table className="w-full text-sm min-w-[820px] tabla-apilable">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wide text-slate-400 border-b border-slate-100">
                    <th className="text-left  font-medium pb-2 pr-3">Razón social</th>
                    <th className="text-left  font-medium pb-2 pr-3">Tier</th>
                    <th className="text-right font-medium pb-2 pl-3">USD 12m</th>
                    <th className="text-right font-medium pb-2 pl-3">Secuencia</th>
                    <th className="text-right font-medium pb-2 pl-3">WhatsApp</th>
                    <th className="text-right font-medium pb-2 pl-3">Contactos</th>
                    <th className="text-left  font-medium pb-2 pl-4">Seguimiento</th>
                  </tr>
                </thead>
                <tbody>
                  {cuentasHunting.map((f, i) => {
                    const abierta = ficha === f;
                    const usd = usdDe(f);
                    return (
                      <tr
                        key={`${f.idEmpresa}-${i}`}
                        onClick={() => setFicha(abierta ? null : f)}
                        className={`border-b border-slate-50 last:border-0 cursor-pointer transition-colors ${
                          abierta ? 'bg-rose-50/60' : 'hover:bg-slate-50/60'
                        }`}
                      >
                        <td data-titular className="py-2 pr-3 text-slate-700 max-w-[210px] truncate" title={f.razonSocial}>
                          {f.razonSocial || '—'}
                        </td>
                        <td data-label="Tier" className="py-2 pr-3"><TierChip tier={f.segmentacion} /></td>
                        <td data-label="USD 12m" className="py-2 pl-3 text-right tabular-nums text-slate-700 whitespace-nowrap"
                            title={fmtUSDExacto(usd)}>
                          {usd > 0 ? fmtUSDCorto(usd) : <span className="text-slate-300">—</span>}
                        </td>
                        <td data-label="Secuencia" className="py-2 pl-3 text-right"><Flag v={f.envioSecuenciaHunting} /></td>
                        <td data-label="WhatsApp" className="py-2 pl-3 text-right"><Flag v={f.whatsappHunting} /></td>
                        <td data-label="Contactos" className="py-2 pl-3 text-right tabular-nums text-slate-700 font-semibold">
                          {f.nuevosContactos || <span className="text-slate-300 font-normal">—</span>}
                        </td>
                        <td data-label="Seguimiento" className="py-2 pl-4 text-slate-500 text-[12px] max-w-[260px] truncate"
                            title={f.seguimiento}>
                          {f.seguimiento || <span className="text-slate-300">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </section>

      {ficha && <FichaCuentaCBS fila={ficha} onClose={() => setFicha(null)} />}
    </div>
  );
}

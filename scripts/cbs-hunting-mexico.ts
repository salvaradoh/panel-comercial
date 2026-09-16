/**
 * Filas por empresa del pool de Hunting a México, para armar una campaña con seguimiento.
 *
 * Usa `parseFilasCBS`, `estadoDe` y `usdDe` de `lib/cbs.ts` —la misma librería que dibuja
 * el tab Proyectos— para que la campaña no contradiga lo que el tab muestra. Escribir un
 * criterio propio acá daría números distintos para el mismo proyecto.
 *
 * Uso: npx tsx scripts/cbs-hunting-mexico.ts <archivo.json con {headers, filas}>
 */
import { readFileSync } from 'node:fs';
import { parseFilasCBS, estadoDe, usdDe } from '../src/lib/cbs';

const crudo = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const { filas } = parseFilasCBS(crudo.headers, crudo.filas);

/** Etapa de prospección dentro del hunting, por precedencia de lo más avanzado. */
function etapa(f: (typeof filas)[number]): string {
  if (f.cierreGanado > 0) return 'cierre ganado';
  if (f.enGestionReunion > 0) return 'en reunión';
  if (f.empresasEnGestion > 0) return 'en gestión';
  if (f.envioSecuenciaHunting > 0 || f.whatsappHunting > 0) return 'secuencia enviada';
  if (f.nuevosContactos > 0 || f.contactosHunting > 0) return 'contacto identificado';
  if (f.noAplicaProspeccion > 0) return 'no aplica';
  return 'sin contactar';
}

const hunting = filas.filter((f) => estadoDe(f) === 'hunting');
const porEtapa: Record<string, { n: number; usd: number }> = {};
for (const f of hunting) {
  const e = etapa(f);
  porEtapa[e] = porEtapa[e] || { n: 0, usd: 0 };
  porEtapa[e].n++;
  porEtapa[e].usd += usdDe(f);
}

console.log(JSON.stringify({
  total_filas: filas.length,
  hunting: hunting.length,
  usd_hunting: Math.round(hunting.reduce((a, f) => a + usdDe(f), 0)),
  por_etapa: porEtapa,
  filas: hunting.map((f) => ({
    id_empresa: f.idEmpresa,
    nombre: f.nombreEmpresa || f.razonSocial,
    pais_origen: f.paisOrigen,
    pais_destino: f.paisDestino,
    comercial_destino: f.comercialDestino,
    kam: f.kamActual || f.idKam,
    usd: Math.round(usdDe(f)),
    etapa: etapa(f),
    contacto: f.contactoActual,
    correo: f.correoContacto,
  })),
}, null, 1));

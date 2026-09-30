# Panel Comercial — frontend

La interfaz del panel que usa el equipo comercial.
Producción: **https://salvaradoh.github.io/panel-comercial/**

## Levantarlo

```bash
npm install --legacy-peer-deps
npm run dev
```

**`--legacy-peer-deps` no es opcional.** `react-simple-maps` declara peer React 18
y el proyecto está en React 19; sin ese flag falla con ERESOLVE y parece que el
repo está roto.

Falta un archivo: **`.env.local`**, que no está versionado porque lleva el token
del Apps Script. Pedíselo a Samuel. El resto de las variables ya están en
`.env.production`.

## Publicar

No hay nada que correr: **al pushear a `main`, GitHub Actions buildea y publica**.
El progreso se ve en la pestaña *Actions*. Tarda un par de minutos, y Pages puede
demorar otro minuto en servir lo nuevo.

Si el build falla, no se publica nada — `npm run build` corre `tsc -b` primero.

## Verificar antes de pushear

```bash
npm run build      # la ÚNICA verificación que sirve acá
```

**No uses `npx tsc --noEmit`**: el `tsconfig.json` de la raíz tiene `"files": []`,
así que sale con exit 0 aunque el código no compile.

## El tab de Churn

| Archivo | Qué es |
|---|---|
| `src/pages/portafolio/MovimientosTab.tsx` | La vista entera: gráfico, tablas, detalle por trimestre |
| `src/pages/portafolio/ComoSeCalculaChurn.tsx` | El modal "¿Cómo se calcula?" |
| `src/components/layout/ClientesSubNav.tsx` | La barra de sub-tabs |
| `src/hooks/useMovimientos.ts` | De dónde salen los datos (no es diseño) |
| `src/pages/portafolio/exportChurnQExcel.ts` | El Excel que descarga el botón |

## Convenciones que conviene no romper

- **Acento del panel**: `#0097A7`.
- **`tabular-nums`** en toda cifra que se alinee en columna.
- **Tablas en móvil**: no se maquetan dos veces. La misma `<table>` se apila en
  tarjetas por CSS con `tabla-apilable` (o `tabla-apilable-vp` si vive en una
  columna angosta de escritorio). Toda `<td>` necesita `data-label`,
  `data-titular` o `data-sin-etiqueta` — lo verifica
  `node scripts/verificar-tablas.cjs`, corrélo.
- **Nunca `100vh`**: en el teléfono no descuenta la barra de URL. Usá
  `.shell-alto` o `.alto-modal`.
- **Los ids de los tabs no se renombran** aunque cambie la etiqueta: alimentan la
  analítica y renombrarlos parte la serie histórica. Por eso el tab que dice
  "Churn" sigue teniendo id `movimientos`, y el que dice "Priorización" sigue
  siendo `cuentas-clave`.

## De dónde sale este repo

El código vive también en `dashboard-v2/frontend` del repo `automatizador-ia`, y
se sincroniza con `git subtree`. Si tocás algo acá, avisá para que se traiga del
otro lado antes de que las dos copias se separen.

import { paisesDe, ccDe } from '../../lib/banderas';

interface Props {
  /** "Perú" o "Chile · Perú" para los campanazos multi-país. */
  pais: string;
  /** Muestra el nombre al lado de la bandera. */
  conNombre?: boolean;
  className?: string;
}

/**
 * Bandera de país como imagen, no como emoji.
 *
 * Windows no trae banderas de país en su fuente de emoji: 🇵🇪 se degrada a las
 * letras del indicador regional y en pantalla se lee "PE Perú". flagcdn se ve
 * igual en todas las plataformas y es lo que ya usa TopNav.
 *
 * Si el país no está en el mapa se cae al nombre en texto en vez de dibujar una
 * bandera equivocada.
 */
export function BanderaPais({ pais, conNombre = false, className = '' }: Props) {
  const partes = paisesDe(pais);
  if (!partes.length) return null;

  const conocidos = partes.filter((p) => ccDe(p));
  if (!conocidos.length) {
    return <span className={className}>{partes.join(' · ')}</span>;
  }

  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      {conocidos.map((p) => (
        <img
          key={p}
          src={`https://flagcdn.com/16x12/${ccDe(p)}.png`}
          alt={conNombre ? '' : p}
          width={12}
          height={9}
          loading="lazy"
          className="rounded-[1px] shrink-0"
        />
      ))}
      {conNombre && <span className="truncate">{partes.join(' · ')}</span>}
    </span>
  );
}

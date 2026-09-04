import { useEffect, useRef, useState } from 'react';

/**
 * Mide el ancho real de un elemento y lo mantiene al día.
 *
 * Para gráficos en SVG que reciben su ancho en píxeles: sin esto hay que elegir
 * un número fijo, que en desktop sobra y en un teléfono desborda. Escalar el SVG
 * con `viewBox` tampoco sirve acá, porque encogería también las etiquetas del
 * eje —a 330px de ancho quedarían al 72% de su tamaño, ilegibles.
 *
 * Devuelve `null` hasta la primera medición, para que quien lo use dibuje con su
 * ancho de diseño en el primer render y no con un 0.
 */
export function useAncho<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [ancho, setAncho] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const medir = () => setAncho(el.clientWidth);
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return { ref, ancho };
}

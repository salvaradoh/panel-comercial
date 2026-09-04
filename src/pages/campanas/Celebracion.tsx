import { useEffect, useRef } from 'react';
// Build liviano a propósito: el completo trae el motor de expresiones, que pesa ~250 KB
// y evalúa código con `eval` directo. Nada de eso hace falta para un confeti, y el eval
// sería un problema el día que el sitio tenga una CSP estricta.
import lottie, { type AnimationItem } from 'lottie-web/build/player/lottie_light';
import animacion from '../../assets/celebracion.json';

/**
 * Se dispara una sola vez, cuando una campaña pasa a cerrada. La animación va empaquetada
 * en el bundle (src/assets/celebracion.json) y no se pide a ningún CDN: el frontend se
 * sirve desde GitHub Pages y tiene que ser autocontenido.
 *
 * Respeta prefers-reduced-motion: si el usuario pidió menos movimiento, no se monta.
 */
export function Celebracion({ onFin }: { onFin: () => void }) {
  const contenedor = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reducido = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reducido || !contenedor.current) {
      const t = setTimeout(onFin, 400);
      return () => clearTimeout(t);
    }

    let anim: AnimationItem | null = null;
    try {
      anim = lottie.loadAnimation({
        container: contenedor.current,
        renderer: 'svg',
        loop: false,
        autoplay: true,
        animationData: animacion,
      });
      anim.addEventListener('complete', onFin);
    } catch {
      // Si la animación falla, no bloquea nada: se cierra igual.
      const t = setTimeout(onFin, 400);
      return () => clearTimeout(t);
    }

    return () => { anim?.destroy(); };
  }, [onFin]);

  return (
    <div
      className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center"
      aria-hidden="true"
    >
      <div ref={contenedor} className="h-64 w-64" />
    </div>
  );
}

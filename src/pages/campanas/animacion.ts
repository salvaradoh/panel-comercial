import { useReducedMotion } from 'motion/react';

/**
 * Entrada escalonada, según make-interfaces-feel-better:
 * `opacity 0 → 1`, `y 12 → 0`, `blur 4px → 0`, ~100 ms entre elementos, spring con
 * bounce 0 (el bounce siempre es 0).
 *
 * Solo para entradas infrecuentes —abrir el tab, un estado vacío—, nunca para hovers de
 * fila ni cambios repetidos de pestaña.
 *
 * Con `prefers-reduced-motion` se va el desplazamiento y el desenfoque y queda solo el
 * fundido: la señal se mantiene, el movimiento no.
 */
export function useEntrada(indice: number) {
  const reducido = useReducedMotion();

  if (reducido) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      transition: { duration: 0.2, delay: Math.min(indice, 6) * 0.03 },
    };
  }

  return {
    initial: { opacity: 0, y: 12, filter: 'blur(4px)' },
    animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
    transition: {
      type: 'spring' as const,
      duration: 0.3,
      bounce: 0,
      // ~100 ms entre elementos, con tope para que el último no entre tardísimo.
      delay: Math.min(indice, 8) * 0.1,
    },
  };
}

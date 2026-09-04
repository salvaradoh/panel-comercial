import { useEffect, type RefObject } from 'react';

const FOCUSABLES = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled])',
  'select:not([disabled])', 'textarea:not([disabled])', 'iframe',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Mantiene el foco dentro de un diálogo mientras está abierto y lo devuelve al elemento
 * que lo abrió al cerrarse.
 *
 * Un contenedor con `aria-modal="true"` le dice al lector de pantalla que lo de atrás no
 * existe, pero el navegador igual deja tabular hacia afuera: sin esto, el usuario de
 * teclado sale del panel sin darse cuenta y queda navegando una página que, para su
 * lector, está oculta.
 */
export function useTrampaDeFoco(ref: RefObject<HTMLElement | null>, activo: boolean) {
  useEffect(() => {
    if (!activo) return;
    const previo = document.activeElement as HTMLElement | null;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !ref.current) return;
      const nodos = Array.from(ref.current.querySelectorAll<HTMLElement>(FOCUSABLES))
        .filter((n) => n.offsetParent !== null || n.tagName === 'IFRAME');
      if (!nodos.length) return;

      const primero = nodos[0];
      const ultimo = nodos[nodos.length - 1];
      const actual = document.activeElement;

      // Shift+Tab desde el primero salta al último, y Tab desde el último vuelve al primero.
      if (e.shiftKey && (actual === primero || !ref.current.contains(actual))) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && actual === ultimo) {
        e.preventDefault();
        primero.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      // Solo si el foco quedó suelto en el body: si el usuario ya movió el foco a otra
      // cosa a propósito, no se le arrebata.
      if (document.activeElement === document.body) previo?.focus?.();
    };
  }, [ref, activo]);
}

// Registro global del logout para poder llamarlo desde fuera de React
// (por ejemplo desde el QueryCache.onError del cliente de React Query)
let _logout: (() => void) | null = null;

export function registerLogout(fn: () => void) {
  _logout = fn;
}

export function triggerLogout() {
  _logout?.();
}

// URL relativa por defecto — funciona tanto en localhost:8080 como en ngrok/producción
export const API_URL = (import.meta.env.VITE_API_URL as string) || '';

let idToken: string | null = null;

export function setAuthToken(token: string) {
  idToken = token;
}

export function clearAuthToken() {
  idToken = null;
}

/** Como apiFetch pero para respuestas binarias (imágenes) con el token del usuario. */
export async function apiBlob(path: string, token: string): Promise<Blob> {
  const res = await fetch(`${API_URL}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.blob();
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: HeadersInit = {
    ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
    ...init?.headers,
  };
  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

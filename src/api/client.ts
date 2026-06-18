// URL relativa por defecto — funciona tanto en localhost:8080 como en ngrok/producción
const API_URL = (import.meta.env.VITE_API_URL as string) || '';

let idToken: string | null = null;

export function setAuthToken(token: string) {
  idToken = token;
}

export function clearAuthToken() {
  idToken = null;
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

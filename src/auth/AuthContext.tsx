import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { setAuthToken, clearAuthToken } from '../api/client';
import { jwtDecode } from 'jwt-decode';
import { registerLogout } from './authStore';

const SESSION_KEY = 'apprecio_auth';

interface User {
  email: string;
  name: string;
  picture?: string;
}

interface StoredAuth {
  token: string;
  user: User;
  exp: number; // Unix timestamp de expiración
}

interface AuthContextValue {
  user: User | null;
  token: string | null;
  login: (token: string, user: User, expiresAt?: number) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function loadStoredAuth(): { token: string; user: User } | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const stored: StoredAuth = JSON.parse(raw);
    // Verificar que el token no haya expirado (con 60s de margen)
    if (Date.now() / 1000 > stored.exp - 60) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    return { token: stored.token, user: stored.user };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);

  // Restaurar sesión al cargar
  useEffect(() => {
    const stored = loadStoredAuth();
    if (stored) {
      setAuthToken(stored.token);
      setToken(stored.token);
      setUser(stored.user);
    }
  }, []);

  // Registrar logout globalmente para que el QueryCache pueda llamarlo
  useEffect(() => {
    registerLogout(logout);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function login(accessToken: string, u: User, expiresAt?: number) {
    // expiresAt en ms; si no viene, intentar decodificar JWT o usar default 1h
    let exp: number;
    if (expiresAt) {
      exp = Math.floor(expiresAt / 1000);
    } else {
      exp = Math.floor(Date.now() / 1000) + 3600;
      try {
        const decoded = jwtDecode<{ exp?: number }>(accessToken);
        if (decoded.exp) exp = decoded.exp;
      } catch {}
    }

    const stored: StoredAuth = { token: accessToken, user: u, exp };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(stored));
    setAuthToken(accessToken);
    setToken(accessToken);
    setUser(u);
  }

  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
    clearAuthToken();
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

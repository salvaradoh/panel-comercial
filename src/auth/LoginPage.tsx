import { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import type { CredentialResponse } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';
import { useAuth } from './AuthContext';

interface GoogleJwt {
  email: string;
  name: string;
  picture?: string;
  hd?: string;
}

const ALLOWED_DOMAIN = 'apprecio.com';

export function LoginPage() {
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);

  function handleSuccess(resp: CredentialResponse) {
    if (!resp.credential) return;
    try {
      const decoded = jwtDecode<GoogleJwt>(resp.credential);
      if (!decoded.email?.endsWith('@' + ALLOWED_DOMAIN)) {
        setError(`Acceso restringido a cuentas @${ALLOWED_DOMAIN}`);
        return;
      }
      login(resp.credential, { email: decoded.email, name: decoded.name, picture: decoded.picture });
    } catch {
      setError('Error al verificar el token');
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-md p-10 flex flex-col items-center gap-6 w-80">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-800">Apprecio</h1>
          <p className="text-sm text-slate-500 mt-1">Dashboard C-Level</p>
        </div>
        <GoogleLogin
          onSuccess={handleSuccess}
          onError={() => setError('Error de autenticación')}
          theme="outline"
          size="large"
          text="signin_with"
          auto_select
          use_fedcm_for_prompt
        />
        {error && (
          <p className="text-sm text-red-600 text-center" role="alert">{error}</p>
        )}
      </div>
    </div>
  );
}

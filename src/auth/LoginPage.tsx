import { useCallback, useEffect, useRef, useState } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { useAuth } from './AuthContext';

const ALLOWED_DOMAINS = ['apprecio.com', 'dcanje.com'];
const SHEETS_SCOPE    = 'https://www.googleapis.com/auth/spreadsheets.readonly';
const DATASTORE_SCOPE = 'https://www.googleapis.com/auth/datastore';
const DRIVE_SCOPE     = 'https://www.googleapis.com/auth/drive.readonly';

// ── DOT MAP ──────────────────────────────────────────────────────────────────
// Normalized coords: x = (lon + 120) / 86, y = (32 − lat) / 87
// Bounding box: 120°W–34°W  ·  32°N–55°S
type Pt = [number, number];

function pip(px: number, py: number, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi)
      inside = !inside;
  }
  return inside;
}

const MEXICO: Pt[] = [
  [0.035, 0.000], [0.270, 0.000], [0.285, 0.082],
  [0.395, 0.138], [0.365, 0.190], [0.188, 0.205],
  [0.158, 0.158], [0.118, 0.108], [0.098, 0.036],
];

const COLOMBIA: Pt[] = [
  [0.488, 0.270], [0.702, 0.220], [0.732, 0.322],
  [0.702, 0.372], [0.622, 0.398], [0.545, 0.398],
  [0.488, 0.382], [0.488, 0.322],
];

const PERU: Pt[] = [
  [0.438, 0.382], [0.592, 0.382], [0.628, 0.464],
  [0.628, 0.582], [0.512, 0.582], [0.484, 0.534],
  [0.438, 0.462],
];

// Chile — widened slightly for visual clarity (it's naturally ~3° wide)
const CHILE: Pt[] = [
  [0.522, 0.572], [0.628, 0.572], [0.642, 0.630],
  [0.628, 0.785], [0.602, 0.945], [0.566, 1.000],
  [0.528, 0.958], [0.538, 0.825], [0.545, 0.695],
  [0.528, 0.632],
];

// Other LATAM land — displayed faded
const OTHER_POLYS: Pt[][] = [
  // Central America bridge
  [[0.365, 0.190], [0.445, 0.265], [0.490, 0.282], [0.490, 0.338], [0.422, 0.298], [0.342, 0.238]],
  // Venezuela + Guyana strip
  [[0.702, 0.220], [0.845, 0.248], [0.905, 0.318], [0.862, 0.372], [0.732, 0.342], [0.702, 0.298]],
  // Ecuador
  [[0.452, 0.350], [0.522, 0.350], [0.522, 0.432], [0.452, 0.412]],
  // Brazil (large)
  [
    [0.592, 0.370], [0.862, 0.370], [0.968, 0.465],
    [0.968, 0.655], [0.852, 0.800], [0.722, 0.832],
    [0.642, 0.800], [0.628, 0.702], [0.642, 0.630],
    [0.628, 0.582], [0.592, 0.462],
  ],
  // Bolivia
  [[0.592, 0.494], [0.712, 0.494], [0.712, 0.635], [0.642, 0.658], [0.592, 0.635]],
  // Paraguay + Uruguay
  [[0.712, 0.795], [0.845, 0.795], [0.845, 0.865], [0.758, 0.878], [0.712, 0.845]],
  // Argentina
  [
    [0.642, 0.658], [0.845, 0.800], [0.845, 0.915],
    [0.758, 0.965], [0.642, 0.915], [0.612, 0.982],
    [0.566, 0.958], [0.602, 0.862], [0.628, 0.800],
    [0.642, 0.702],
  ],
];

function renderDotMap(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const { width: W, height: H } = canvas;
  ctx.clearRect(0, 0, W, H);

  const STEP = 13, R = 2.5;
  const BRAND = 'rgba(192,85,125,0.82)';
  const DIM   = 'rgba(155,105,185,0.22)';

  for (let cy = STEP / 2; cy < H; cy += STEP) {
    for (let cx = STEP / 2; cx < W; cx += STEP) {
      const nx = cx / W, ny = cy / H;
      let color: string | null = null;

      if (pip(nx, ny, MEXICO) || pip(nx, ny, COLOMBIA) || pip(nx, ny, PERU) || pip(nx, ny, CHILE)) {
        color = BRAND;
      } else if (OTHER_POLYS.some(p => pip(nx, ny, p))) {
        color = DIM;
      }

      if (color) {
        ctx.beginPath();
        ctx.arc(cx, cy, R, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      }
    }
  }
}

// Country label positions as % of the left panel (matching dot clusters)
const COUNTRY_LABELS = [
  { name: 'México',   left: '10%', top: '7%'  },
  { name: 'Colombia', left: '58%', top: '30%' },
  { name: 'Perú',     left: '50%', top: '45%' },
  { name: 'Chile',    left: '55%', top: '72%' },
];

// ── COMPONENT ─────────────────────────────────────────────────────────────────
export function LoginPage() {
  const { login }  = useAuth();
  const [error,    setError  ] = useState<string | null>(null);
  const [loading,  setLoading] = useState(false);
  const [hovered,  setHovered] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const panelRef  = useRef<HTMLDivElement>(null);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current, panel = panelRef.current;
    if (!canvas || !panel) return;
    const { clientWidth: w, clientHeight: h } = panel;
    canvas.width  = w;
    canvas.height = h;
    renderDotMap(canvas);
  }, []);

  useEffect(() => {
    redraw();
    window.addEventListener('resize', redraw);
    return () => window.removeEventListener('resize', redraw);
  }, [redraw]);

  const googleLogin = useGoogleLogin({
    flow: 'implicit',
    scope: `openid email profile ${SHEETS_SCOPE} ${DATASTORE_SCOPE} ${DRIVE_SCOPE}`,
    onSuccess: async (tokenResponse) => {
      setLoading(true);
      setError(null);
      try {
        const userInfo = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        }).then(r => r.json());

        if (!ALLOWED_DOMAINS.some(d => userInfo.email?.endsWith('@' + d))) {
          setError(`Acceso restringido a cuentas @apprecio.com o @dcanje.com`);
          return;
        }

        const expiresAt = Date.now() + (tokenResponse.expires_in ?? 3600) * 1000;
        login(tokenResponse.access_token, {
          email: userInfo.email,
          name: userInfo.name,
          picture: userInfo.picture,
        }, expiresAt);
      } catch {
        setError('Error al obtener información de usuario');
      } finally {
        setLoading(false);
      }
    },
    onError: () => setError('Error de autenticación'),
  });

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif',
      overflow: 'hidden',
    }}>

      {/* ── LEFT PANEL ── */}
      <aside
        ref={panelRef}
        aria-hidden="true"
        className="ap-login-aside"
        style={{
          position: 'relative',
          background: 'linear-gradient(148deg, #FFD0DA 0%, #F2D2FF 52%, #E4C6FF 100%)',
          overflow: 'hidden',
        }}
      >
        {/* dot map fills the panel */}
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        />

        {/* country name labels on top of dots */}
        {COUNTRY_LABELS.map(c => (
          <div
            key={c.name}
            style={{
              position: 'absolute',
              left: c.left,
              top: c.top,
              background: 'rgba(255,255,255,0.52)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.78)',
              borderRadius: '20px',
              padding: '5px 13px',
              pointerEvents: 'none',
            }}
          >
            <span style={{
              fontSize: '12px',
              fontWeight: 600,
              color: '#4A1540',
              letterSpacing: '0.01em',
            }}>{c.name}</span>
          </div>
        ))}

        {/* bottom overlay — eyebrow + headline + tagline */}
        <div style={{
          position: 'absolute',
          bottom: 0, left: 0, right: 0,
          padding: '0 48px 44px',
          background: 'linear-gradient(to top, rgba(240,210,255,0.90) 0%, transparent 100%)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <div style={{ width: '22px', height: '2.5px', background: '#B04878', borderRadius: '2px' }} />
            <span style={{
              fontSize: '10.5px',
              fontWeight: 700,
              letterSpacing: '0.13em',
              textTransform: 'uppercase' as const,
              color: '#B04878',
            }}>Apprecio · LATAM</span>
          </div>
          <h2 style={{
            fontSize: '26px',
            fontWeight: 700,
            color: '#3A1040',
            letterSpacing: '-0.02em',
            margin: '0 0 8px',
            lineHeight: 1.2,
            textWrap: 'balance',
          } as React.CSSProperties}>
            Inteligencia comercial<br />en toda la región.
          </h2>
          <p style={{ fontSize: '13px', color: '#7A4A8A', margin: 0, lineHeight: 1.5 }}>
            Visibilidad de churn y retención en Chile, Perú, Colombia y México.
          </p>
        </div>
      </aside>

      {/* ── RIGHT PANEL ── */}
      <main className="ap-login-main" style={{ background: '#FEFEFE' }}>
        <div className="ap-login-form">

          {/* logo */}
          <img
            src="https://estudios.apprecio.com/hubfs/logos/Apprecio-logo-rojo.png"
            alt="Apprecio"
            className="ap-logo"
          />

          <h1 style={{
            fontSize: '27px',
            fontWeight: 700,
            color: '#1A0A28',
            letterSpacing: '-0.025em',
            margin: '0 0 7px',
          }}>Inicia sesión</h1>

          <p style={{
            fontSize: '13.5px',
            color: '#6D5A80',
            margin: '0 0 36px',
            lineHeight: 1.5,
          }}>
            Panel Comercial · Solo para{' '}
            <span style={{ color: '#B04878', fontWeight: 500 }}>@apprecio.com</span>
            {' '}y{' '}
            <span style={{ color: '#B04878', fontWeight: 500 }}>@dcanje.com</span>
          </p>

          {/* Google button */}
          <button
            onClick={() => googleLogin()}
            disabled={loading}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              width: '100%',
              padding: '13px 20px',
              background: hovered && !loading
                ? 'linear-gradient(135deg, #FFE6EE 0%, #F5E0FF 100%)'
                : '#F8F4FC',
              border: `1.5px solid ${hovered && !loading ? '#B04878' : '#E5D8F0'}`,
              borderRadius: '10px',
              color: '#2D1040',
              fontSize: '14px',
              fontWeight: 500,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease',
              opacity: loading ? 0.6 : 1,
              boxShadow: hovered && !loading
                ? '0 2px 14px rgba(176,72,120,0.14)'
                : '0 1px 4px rgba(0,0,0,0.05)',
            }}
          >
            {loading ? (
              <span style={{
                width: '17px', height: '17px',
                border: '2px solid #E5D8F0',
                borderTopColor: '#B04878',
                borderRadius: '50%',
                display: 'inline-block',
                animation: 'apSpin 0.7s linear infinite',
                flexShrink: 0,
              }} />
            ) : (
              <svg width="17" height="17" viewBox="0 0 18 18" aria-hidden="true" style={{ flexShrink: 0 }}>
                <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
                <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
                <path fill="#FBBC05" d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.348 2.826.957 4.039l3.007-2.332z"/>
                <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z"/>
              </svg>
            )}
            <span>{loading ? 'Conectando…' : 'Continuar con Google'}</span>
          </button>

          {error && (
            <p role="alert" style={{
              fontSize: '12.5px',
              color: '#B03050',
              textAlign: 'center',
              marginTop: '14px',
              padding: '10px 14px',
              background: '#FFF0F4',
              border: '1px solid #FFD0DC',
              borderRadius: '8px',
              lineHeight: 1.5,
            }}>{error}</p>
          )}

          <p style={{
            fontSize: '11px',
            color: '#8A7A9A',
            textAlign: 'center',
            marginTop: '32px',
          }}>
            © 2026 Apprecio · Solo uso interno
          </p>
        </div>
      </main>

      <style>{`
        @keyframes apSpin { to { transform: rotate(360deg); } }
        button:focus-visible { outline: 2px solid #B04878; outline-offset: 2px; }

        .ap-logo {
          height: 44px;
          display: block;
          margin: 0 auto 36px;
        }

        .ap-login-aside {
          flex: 0 0 55%;
        }

        .ap-login-main {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px;
        }

        .ap-login-form {
          width: 100%;
          max-width: 340px;
          text-align: center;
        }

        @media (max-width: 768px) {
          .ap-login-aside { display: none !important; }
          .ap-login-main {
            padding: 48px 24px 40px;
            background: linear-gradient(160deg, #FFF5F8 0%, #FAF5FF 100%) !important;
            min-height: 100vh;
          }
          .ap-login-form { max-width: 100%; }
          .ap-logo { height: 40px; }
        }

        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>
    </div>
  );
}

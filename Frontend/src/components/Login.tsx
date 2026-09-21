import { useState } from 'react';
import ForestIcon from '@mui/icons-material/Forest';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { T } from '../theme';
import { login, type AuthUser } from '../services/api';

export function Login({ onLogin }: { onLogin: (user: AuthUser) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [focused, setFocused] = useState<'user' | 'pwd' | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      onLogin(await login(username, password));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de connexion');
    } finally {
      setBusy(false);
    }
  };

  const inputStyle = (field: 'user' | 'pwd'): React.CSSProperties => ({
    width: '100%',
    padding: '12px 13px 12px 42px',
    borderRadius: 11,
    fontSize: 14,
    background: 'rgba(255,255,255,0.04)',
    border: `1.5px solid ${focused === field ? T.green : error ? T.red : 'rgba(255,255,255,0.1)'}`,
    color: T.text,
    outline: 'none',
    transition: 'border-color .2s',
  });

  const iconStyle = (field: 'user' | 'pwd'): React.CSSProperties => ({
    position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
    color: focused === field ? T.green : T.dim,
    display: 'flex', alignItems: 'center', transition: 'color .2s', pointerEvents: 'none',
  });

  return (
    <div style={{
      position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: `radial-gradient(900px 600px at 20% 10%, #12263a 0%, ${T.bg} 55%)`,
      overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', width: 440, height: 440, borderRadius: '50%', background: 'rgba(16,185,129,0.08)', filter: 'blur(90px)', top: '-12%', left: '-6%' }} />
      <div style={{ position: 'absolute', width: 320, height: 320, borderRadius: '50%', background: 'rgba(56,189,248,0.07)', filter: 'blur(70px)', bottom: '4%', right: '6%' }} />

      <form onSubmit={submit} style={{
        position: 'relative', zIndex: 1, width: 372,
        background: 'rgba(17,26,38,0.82)', border: `1px solid ${T.borderStrong}`,
        borderRadius: 22, padding: '42px 44px 38px',
        display: 'flex', flexDirection: 'column', gap: 13,
        backdropFilter: 'blur(18px)', boxShadow: '0 30px 70px rgba(0,0,0,0.5)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <ForestIcon style={{ fontSize: 40, color: T.greenLite }} />
          <div>
            <div style={{ fontSize: 21, fontWeight: 700, color: T.text, letterSpacing: '-0.01em', lineHeight: 1.1 }}>IFN 2026</div>
            <div style={{ fontSize: 11.5, color: T.muted }}>Inventaire Forestier National</div>
          </div>
        </div>

        <div style={{ fontSize: 12.5, color: T.dim, marginBottom: 8 }}>
          Indicateurs dendrométriques &amp; carte des placettes — DRANEF Rabat-Salé-Kénitra
        </div>

        <div style={{ position: 'relative' }}>
          <span style={iconStyle('user')}><PersonOutlineIcon style={{ fontSize: 18 }} /></span>
          <input placeholder="Utilisateur" value={username} autoFocus
            onChange={e => setUsername(e.target.value)}
            onFocus={() => setFocused('user')} onBlur={() => setFocused(null)}
            style={inputStyle('user')} />
        </div>

        <div style={{ position: 'relative' }}>
          <span style={iconStyle('pwd')}><LockOutlinedIcon style={{ fontSize: 18 }} /></span>
          <input type="password" placeholder="Mot de passe" value={password}
            onChange={e => setPassword(e.target.value)}
            onFocus={() => setFocused('pwd')} onBlur={() => setFocused(null)}
            style={inputStyle('pwd')} />
        </div>

        {error && <div style={{ color: T.red, fontSize: 12.5 }}>{error}</div>}

        <button type="submit" disabled={busy} style={{
          marginTop: 10, padding: '12px 0', borderRadius: 11, border: 'none',
          background: busy ? '#0b7c5b' : `linear-gradient(135deg, ${T.greenLite}, ${T.green})`,
          color: '#04170f', fontWeight: 700, fontSize: 14,
          cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.75 : 1,
        }}>
          {busy ? 'Connexion…' : 'Se connecter'}
        </button>
      </form>
    </div>
  );
}

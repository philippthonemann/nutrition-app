import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { SUPABASE_URL, SUPABASE_KEY } from '../lib/supabase-config.js';

const panel = { background: '#111', color: '#f0f0f0', border: '1px solid #333', borderRadius: 12, padding: 24, width: '100%', maxWidth: 390 };
const button = { padding: '12px 16px', borderRadius: 8, border: 0, background: '#c8f135', color: '#080808', cursor: 'pointer' };

export default function AuthGate({ children }) {
  const [state, setState] = useState({ loading: true, user: null, error: '' });
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    let generation = 0;
    const check = async (session, current) => {
      const apply = next => {
        if (active && current === generation) setState(next);
      };
      if (!session) {
        apply({ loading: false, user: null, error: '' });
        return;
      }
      try {
        // Use the same immutable token for both checks. A simultaneous auth event
        // must not swap credentials between user validation and the RLS request.
        const token = session.access_token;
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (error || !user?.email_confirmed_at || user.is_anonymous) throw new Error('session');
        const response = await fetch(`${SUPABASE_URL}/rest/v1/app_owner?select=user_id&user_id=eq.${encodeURIComponent(user.id)}`, {
          headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` },
          cache: 'no-store', signal: AbortSignal.timeout(15000),
        });
        if (!response.ok) throw new Error('membership');
        const owners = await response.json();
        if (!Array.isArray(owners) || !owners.some(owner => owner.user_id === user.id)) throw new Error('membership');
        apply({ loading: false, user, error: '' });
      } catch {
        apply({ loading: false, user: null, error: 'Die Sitzung konnte nicht bestätigt werden. Lade die Seite erneut. Falls der Login-Link bereits verwendet wurde, benötigst du einen neuen Link.' });
      }
    };
    // INITIAL_SESSION is emitted after the SDK finishes processing the mail URL.
    // Do not race it with an additional getSession() initialization.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const current = ++generation;
      if (active) setState(previous => ({ ...previous, loading: Boolean(session), user: session ? previous.user : null }));
      setTimeout(() => { if (active && current === generation) void check(session, current); }, 0);
    });
    const linkError = new URLSearchParams(window.location.hash.slice(1)).get('error_code');
    if (linkError) setMessage('Dieser Login-Link ist abgelaufen oder wurde bereits verwendet. Fordere einen neuen Link an und öffne ihn einmal auf diesem Gerät.');
    return () => { active = false; generation++; subscription.unsubscribe(); };
  }, []);

  async function login(event) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: false, emailRedirectTo: window.location.origin },
      });
      setMessage(error?.status === 429
        ? 'Das E-Mail-Versandlimit ist erreicht. Bitte warte etwa eine Stunde, bevor du einen neuen Link anforderst.'
        : error ? 'Der Login-Link konnte nicht gesendet werden. Bitte versuche es später erneut.'
        : 'Falls dein Konto freigeschaltet ist, erhältst du einen Login-Link. Öffne nur den neuesten Link einmal auf diesem Gerät.');
    } catch {
      setMessage('Anmeldung derzeit nicht möglich. Bitte versuche es erneut.');
    } finally { setBusy(false); }
  }

  if (state.user) return <div key={state.user.id}>
    <div style={{ background: '#080808', padding: 12, textAlign: 'right' }}>
      <button style={button} onClick={async () => {
        setState({ loading: false, user: null, error: '' });
        await supabase.auth.signOut({ scope: 'local' });
      }}>Abmelden</button>
    </div>
    {children}
  </div>;

  return <main style={{ minHeight: '100vh', background: '#080808', display: 'grid', placeItems: 'center', padding: 20, fontFamily: 'sans-serif' }}>
    <section style={panel}>
      <h1 style={{ color: '#c8f135' }}>Nutrition</h1>
      {state.loading ? <p>Sitzung wird geprüft…</p> : <>
        <p>Deine private Nutrition-App. Melde dich mit deinem freigeschalteten Konto an.</p>
        {state.error && <p role="alert">{state.error}</p>}
        <form onSubmit={login} style={{ display: 'grid', gap: 16 }}>
          <label htmlFor="login-email">E-Mail-Adresse</label>
          <input id="login-email" type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} style={{ padding: 12, fontSize: 16 }} />
          <button style={button} disabled={busy}>{busy ? 'Wird gesendet…' : 'Login-Link anfordern'}</button>
        </form>
        <p role="status">{message}</p>
      </>}
    </section>
  </main>;
}

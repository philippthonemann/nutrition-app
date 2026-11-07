import { useEffect, useState } from 'react';
import { supabase } from './supabase';

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
    const check = async session => {
      const current = ++generation;
      if (!session) {
        if (active) setState({ loading: false, user: null, error: '' });
        return;
      }
      const { data: { user }, error } = await supabase.auth.getUser();
      const result = user && !error && user.email_confirmed_at && !user.is_anonymous
        ? await supabase.from('app_owner').select('user_id').eq('user_id', user.id).maybeSingle()
        : { data: null, error: error || new Error('Unbestätigtes Konto') };
      if (!active || current !== generation) return;
      if (result.error || !result.data) {
        setState({ loading: false, user: null, error: 'Dieses Konto hat keinen Zugriff oder die Prüfung ist derzeit nicht möglich.' });
        return;
      }
      setState({ loading: false, user, error: '' });
    };
    // Defer API calls outside the auth callback to avoid the auth client's lock.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setState(previous => ({ ...previous, user: null, loading: Boolean(session) }));
      setTimeout(() => { if (active) void check(session); }, 0);
    });
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) setState({ loading: false, user: null, error: 'Sitzung konnte nicht geladen werden.' });
      else void check(data.session);
    });
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
      setMessage(error ? 'Anmeldung nicht möglich. Bitte prüfe deine E-Mail und versuche es später erneut.' : 'Falls dein Konto freigeschaltet ist, erhältst du einen Login-Link per E-Mail.');
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

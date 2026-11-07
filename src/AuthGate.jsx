import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { SUPABASE_URL, SUPABASE_KEY } from '../lib/supabase-config.js';

const panel = { background: '#111', color: '#f0f0f0', border: '1px solid #333', borderRadius: 12, padding: 24, width: '100%', maxWidth: 390 };
const button = { padding: '12px 16px', borderRadius: 8, border: 0, background: '#c8f135', color: '#080808', cursor: 'pointer' };

export default function AuthGate({ children }) {
  const [state, setState] = useState({ loading: true, user: null, error: '' });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState('password');
  const [showPasswordSetup, setShowPasswordSetup] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
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
      if (mode === 'password') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        setPassword('');
        if (error) setMessage(error.status === 429 ? 'Zu viele Anmeldeversuche. Bitte versuche es später erneut.' : 'Anmeldung fehlgeschlagen. Prüfe E-Mail und Passwort. Falls noch kein Passwort gesetzt ist, lege es zuerst in deiner angemeldeten Mac-Sitzung fest.');
        return;
      }
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

  async function savePassword(event) {
    event.preventDefault();
    if (newPassword !== confirmation) {
      setPasswordMessage('Die Passwörter stimmen nicht überein.');
      return;
    }
    setBusy(true);
    setPasswordMessage('');
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      setPasswordMessage(error ? 'Passwort konnte nicht gespeichert werden. Nutze mindestens 12 Zeichen. Falls Supabase eine erneute Anmeldung verlangt, ist zuerst ein frischer Login nötig.' : 'Passwort gespeichert. Du kannst dich jetzt auf deinem iPhone mit E-Mail und Passwort anmelden.');
      if (!error) { setNewPassword(''); setConfirmation(''); }
    } catch {
      setPasswordMessage('Passwort konnte derzeit nicht gespeichert werden. Bitte versuche es erneut.');
    } finally { setBusy(false); }
  }

  if (state.user) return <div key={state.user.id}>
    <div style={{ background: '#080808', padding: 12, textAlign: 'right' }}>
      <button style={{ ...button, marginRight: 8 }} onClick={() => { setShowPasswordSetup(!showPasswordSetup); setPasswordMessage(''); }}>Passwort festlegen</button>
      <button style={button} onClick={async () => {
        setState({ loading: false, user: null, error: '' });
        await supabase.auth.signOut({ scope: 'local' });
      }}>Abmelden</button>
    </div>
    {showPasswordSetup && <section style={{ ...panel, boxSizing: 'border-box', margin: '16px auto', fontFamily: 'sans-serif' }}>
      <h2>Passwort festlegen</h2>
      <p>Damit meldest du dich auf weiteren Geräten ohne Login-Mail an.</p>
      <form onSubmit={savePassword} style={{ display: 'grid', gap: 12 }}>
        <label htmlFor="new-password">Neues Passwort (mindestens 12 Zeichen)</label>
        <input id="new-password" type="password" autoComplete="new-password" minLength={12} required value={newPassword} onChange={event => setNewPassword(event.target.value)} style={{ padding: 12, fontSize: 16 }} />
        <label htmlFor="confirm-password">Passwort wiederholen</label>
        <input id="confirm-password" type="password" autoComplete="new-password" minLength={12} required value={confirmation} onChange={event => setConfirmation(event.target.value)} style={{ padding: 12, fontSize: 16 }} />
        <button style={button} disabled={busy}>{busy ? 'Wird gespeichert…' : 'Passwort speichern'}</button>
      </form>
      <p role="status">{passwordMessage}</p>
    </section>}
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
          {mode === 'password' && <>
            <label htmlFor="login-password">Passwort</label>
            <input id="login-password" type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} style={{ padding: 12, fontSize: 16 }} />
          </>}
          <button style={button} disabled={busy}>{busy ? 'Bitte warten…' : mode === 'password' ? 'Anmelden' : 'Login-Link anfordern'}</button>
          <button type="button" disabled={busy} style={{ ...button, background: '#333', color: '#eee' }} onClick={() => { setMode(mode === 'password' ? 'link' : 'password'); setPassword(''); setMessage(''); }}>{mode === 'password' ? 'Stattdessen per E-Mail-Link anmelden' : 'Mit Passwort anmelden'}</button>
        </form>
        <p role="status">{message}</p>
      </>}
    </section>
  </main>;
}

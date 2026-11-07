import { SUPABASE_URL, SUPABASE_KEY } from './supabase-config.js';

// Validate the token with Supabase Auth, then check the server-managed allowlist.
// Neither decoded JWT claims nor user-editable metadata authorize access.
export async function requireOwner(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  const match = /^Bearer ([^\s]+)$/i.exec(req.headers?.authorization || '');
  if (!match) {
    res.status(401).json({ error: 'Anmeldung erforderlich.' });
    return null;
  }
  const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${match[1]}` };
  try {
    const auth = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers, signal: AbortSignal.timeout(10000),
    });
    if (!auth.ok) {
      res.status(auth.status >= 500 ? 503 : 401).json({ error: 'Anmeldung konnte nicht bestätigt werden.' });
      return null;
    }
    const user = await auth.json();
    if (!user.id || !user.email_confirmed_at || user.is_anonymous) {
      res.status(403).json({ error: 'Kein Zugriff.' });
      return null;
    }
    const allowed = await fetch(`${SUPABASE_URL}/rest/v1/app_owner?select=user_id&user_id=eq.${encodeURIComponent(user.id)}`, {
      headers, signal: AbortSignal.timeout(10000),
    });
    if (!allowed.ok) throw new Error('Allowlist unavailable');
    const owners = await allowed.json();
    if (!Array.isArray(owners) || !owners.some(owner => owner.user_id === user.id)) {
      res.status(403).json({ error: 'Kein Zugriff.' });
      return null;
    }
    return user;
  } catch {
    res.status(503).json({ error: 'Anmeldung derzeit nicht überprüfbar.' });
    return null;
  }
}

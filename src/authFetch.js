import { supabase } from './supabase';

export async function authFetch(url, options = {}) {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session) throw new Error('Bitte melde dich erneut an.');
  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${session.access_token}`);
  const response = await fetch(url, { ...options, headers, cache: 'no-store' });
  if (response.status === 401) throw new Error('Deine Sitzung ist abgelaufen. Bitte erneut anmelden.');
  if (response.status === 403) throw new Error('Kein Zugriff auf diese private App.');
  return response;
}

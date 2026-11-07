import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import InfoTip from './InfoTip.jsx';
import { trackingStatus, goalOnDate } from './tracking.js';

export default function DailyCompletion({ date, calories, hasMeals, goal, onChange }) {
  const [record, setRecord] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [historicalGoal, setHistoricalGoal] = useState(goal);
  useEffect(() => {
    let active = true;
    setRecord(null); setHistoricalGoal(goal); setMessage('');
    supabase.from('daily_tracking').select('*').eq('date',date).maybeSingle().then(({data,error}) => {
      if (active) { setRecord(data); if (error) setMessage('Tagesstatus konnte nicht geladen werden.'); }
    });
    supabase.from('goals').select('calories,created_at').order('created_at').then(({data}) => {
      if (active) setHistoricalGoal(goalOnDate(date,(data || []).map(item => ({...item,day:new Date(item.created_at).toLocaleDateString('sv-SE')})),goal));
    });
    return () => { active = false; };
  },[date,goal]);
  const target = record?.calorie_goal || historicalGoal;
  const status = trackingStatus(calories, hasMeals, record, target);
  async function save(completion) {
    setBusy(true); setMessage('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('session');
      const { data,error } = await supabase.from('daily_tracking').upsert({ user_id:session.user.id,date,completion,calorie_goal:Math.max(1,Math.round(target)) },{ onConflict:'user_id,date' }).select().single();
      if (error) throw error;
      setRecord(data);
      onChange?.(data);
      window.dispatchEvent(new Event("nutrition-tracking-updated"));
    } catch { setMessage('Status konnte nicht gespeichert werden. Bitte erneut versuchen.'); }
    finally { setBusy(false); }
  }
  return <section className="q-card q-day-completion">
    <div className="q-day-status"><strong>{status === 'complete' ? 'Vollständig' : status === 'incomplete' ? 'Unvollständig' : 'Noch kein Log'}</strong><InfoTip label="Tagesstatus erklärt">Ab {Math.ceil(target * 2/3)} kcal wird dieser Tag automatisch als vollständig eingestuft und in Ernährungsdurchschnitte aufgenommen. Das ist eine Schätzung. Du kannst den Status unten manuell ändern.</InfoTip></div>
    <details className="q-day-options"><summary>Status ändern</summary><div className="q-answer-buttons">{[['auto','Auto'],['complete','Vollständig'],['incomplete','Unvollständig']].map(([value,label]) => <button key={value} disabled={busy} aria-pressed={(record?.completion || 'auto') === value} onClick={() => save(value)}>{label}</button>)}</div></details>
    {message && <p role="alert">{message}</p>}
  </section>;
}

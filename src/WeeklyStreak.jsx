import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { summarizeDays } from './tracking.js';
import Icon from './Icon.jsx';
import InfoTip from './InfoTip.jsx';

const dateKey = date => date.toLocaleDateString('sv-SE');
export default function WeeklyStreak({ goal, refresh }) {
  const [completed,setCompleted] = useState([]);
  const [revision,setRevision] = useState(0);
  useEffect(() => {const update=()=>setRevision(value=>value+1);window.addEventListener('nutrition-tracking-updated',update);return()=>window.removeEventListener('nutrition-tracking-updated',update);},[]);
  const [loaded,setLoaded] = useState(false);
  const [error,setError] = useState(false);
  const monday = new Date(); monday.setHours(0,0,0,0); monday.setDate(monday.getDate()-(monday.getDay()+6)%7);
  const start = dateKey(monday);
  useEffect(() => {
    let active = true;
    Promise.all([supabase.from('meals').select('date,calories,protein,carbs,fat').gte('date',start),supabase.from('daily_tracking').select('*').gte('date',start),supabase.from('goals').select('calories,created_at').order('created_at')]).then(([meals,records,goals]) => {
      if(!active) return;
      if(meals.error || records.error || goals.error) {setError(true);return;}
      const days = summarizeDays(meals.data || [],records.data || [],(goals.data || []).map(item => ({...item,day:dateKey(new Date(item.created_at))})),goal);
      setCompleted(Object.keys(days).filter(date => days[date].status === 'complete' && date <= dateKey(new Date())));
      setLoaded(true);setError(false);
    }).catch(() => {if(active) setError(true);});
    return () => {active=false;};
  },[start,goal,refresh,revision]);
  return <section className="q-week-streak" aria-label="Vollständiges Tracking diese Woche">
    <div className="q-week-heading"><span><Icon name="flame" size={18}/> Deine Woche</span><span>{error ? 'Nicht verfügbar' : loaded ? `${completed.length}/7 Tage` : '…'} <InfoTip label="Wochenserie erklärt">Die Flamme markiert vollständig erfasste Tage dieser Kalenderwoche. Grundlage sind die automatische ⅔-Regel oder deine manuelle Bestätigung.</InfoTip></span></div>
    <div className="q-week-days">{['Mo','Di','Mi','Do','Fr','Sa','So'].map((name,index) => {
      const date = new Date(monday);date.setDate(date.getDate()+index);const key=dateKey(date);const done=completed.includes(key);
      return <div key={name} className={done?'is-complete':''} aria-label={`${name}: ${done?'vollständig':'nicht vollständig'}`}><span>{name}</span><i>{done?<Icon name="flame" size={16}/>:date.getDate()}</i></div>;
    })}</div>
  </section>;
}

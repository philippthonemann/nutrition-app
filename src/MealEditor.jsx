import { useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';
import { authFetch } from './authFetch';
import { mealEditPreview } from '../lib/meal-edit.js';

export default function MealEditor({ meal,onSaved,onClose }) {
  const dialog=useRef(null);
  const [text,setText]=useState('');
  const [preview,setPreview]=useState(null);
  const [version,setVersion]=useState(meal.edit_version || 0);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  useEffect(()=>{const node=dialog.current;node.showModal();return()=>node.close();},[]);
  function scale(factor) {try{setPreview(mealEditPreview(meal,{type:'scale',factor}));setVersion(meal.edit_version || 0);setMessage('');}catch(error){setMessage(error.message);}}
  async function recalculate(event) {
    event.preventDefault();setBusy(true);setMessage('');setPreview(null);
    try {
      const response=await authFetch('/api/meal-edit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({meal_id:meal.id,instruction:text})});
      const data=await response.json();if(!response.ok) throw new Error(data.error || 'Berechnung fehlgeschlagen.');
      setPreview(data.preview);setVersion(data.version);
    }catch(error){setMessage(error.message);}finally{setBusy(false);}
  }
  async function save() {
    setBusy(true);setMessage('');
    try {
      const {data,error}=await supabase.from('meals').update({...preview,edit_version:version+1}).eq('id',meal.id).eq('edit_version',version).select().single();
      if(error || !data) throw new Error('Nicht gespeichert. Der Eintrag wurde möglicherweise inzwischen geändert. Bitte schließen und erneut öffnen.');
      onSaved(data);window.dispatchEvent(new Event('nutrition-tracking-updated'));onClose();
    }catch(error){setMessage(error.message);}finally{setBusy(false);}
  }
  return <dialog className="q-meal-editor" ref={dialog} aria-labelledby="meal-edit-title" onCancel={event=>{event.preventDefault();if(!busy) onClose();}}>
    <header><h2 id="meal-edit-title">Mahlzeit bearbeiten</h2><button aria-label="Schließen" disabled={busy} onClick={onClose}>×</button></header>
    <p>{meal.name}</p><div className="q-edit-portions"><button disabled={busy} onClick={()=>scale(.5)}>Halbe Portion</button><button disabled={busy} onClick={()=>scale(2)}>Doppelte Portion</button></div>
    <form onSubmit={recalculate}><label>Was möchtest du ändern?<textarea disabled={busy} autoFocus maxLength={1000} value={text} onChange={event=>{setText(event.target.value);setPreview(null);}} placeholder="z. B. füge 30 g Mandeln hinzu"/></label><button disabled={busy || !text.trim()}>{busy?'Wird bearbeitet…':'Änderung berechnen'}</button></form>
    {message && <p role="alert">{message}</p>}
    {preview && <section className="q-edit-preview"><h3>Vorschau</h3><strong>{meal.calories} → {preview.calories} kcal</strong><p>P {preview.protein} g · KH {preview.carbs} g · F {preview.fat} g</p><p>{preview.edit_note}</p><button disabled={busy} onClick={save}>Änderung speichern</button></section>}
    <button className="q-edit-cancel" disabled={busy} onClick={onClose}>Abbrechen</button>
  </dialog>;
}

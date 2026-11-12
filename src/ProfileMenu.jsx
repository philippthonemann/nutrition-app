import { useContext, useEffect, useRef, useState } from 'react';
import { AccountSettingsContext } from './AccountSettingsContext';
import { supabase } from './supabase';

async function avatarImage(file) {
  if (file.size > 20000000) throw new Error('Bitte ein Foto unter 20 MB wählen.');
  const url = URL.createObjectURL(file);
  try {
    const image = new Image(); image.src = url; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
    const size = Math.min(image.naturalWidth,image.naturalHeight);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0,0,256,256);
    ctx.drawImage(image,(image.naturalWidth-size)/2,(image.naturalHeight-size)/2,size,size,0,0,256,256);
    const result = canvas.toDataURL('image/jpeg',.75);
    if (result.length > 100000) throw new Error('Foto zu groß. Bitte anderes Foto wählen.');
    return result;
  } finally { URL.revokeObjectURL(url); }
}

export default function ProfileMenu({ shopping = false }) {
  const { userId,settings } = useContext(AccountSettingsContext);
  const [open,setOpen] = useState(false);
  const [avatar,setAvatar] = useState(null);
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState('');
  const root = useRef(null);
  useEffect(() => {
    let active = true;
    supabase.from('user_profile').select('avatar_data_url').maybeSingle().then(({data}) => {if(active) setAvatar(data?.avatar_data_url || null);});
    return () => {active=false;};
  },[userId]);
  useEffect(() => {
    if (!open) return;
    const close = event => { if (!root.current?.contains(event.target)) setOpen(false); };
    const escape = event => {if(event.key === 'Escape') setOpen(false);};
    document.addEventListener('pointerdown',close); document.addEventListener('keydown',escape);
    return () => {document.removeEventListener('pointerdown',close); document.removeEventListener('keydown',escape);};
  },[open]);
  async function upload(event) {
    const file = event.target.files?.[0]; if(!file) return;
    setBusy(true);setMessage('');
    try {
      const dataUrl = await avatarImage(file);
      const {error} = await supabase.from('user_profile').upsert({user_id:userId,avatar_data_url:dataUrl});
      if(error) throw error;
      setAvatar(dataUrl);
    } catch(error) {setMessage(error.message || 'Profilfoto konnte nicht gespeichert werden.');}
    finally {setBusy(false);event.target.value='';}
  }
  return <div className="q-profile" ref={root}>
    <button className="q-avatar" aria-label="Profil und Einstellungen öffnen" aria-expanded={open} onClick={() => setOpen(!open)}>{avatar ? <img src={avatar} alt="Dein Profilfoto"/> : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="8" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3"/></svg>}</button>
    {open && <section className="q-profile-panel" aria-label="Dein Profil">
      <h2>Dein Profil</h2>
      
      {!shopping && <a href="/?tab=goals" className="q-avatar-upload">Tagesziele</a>}
      <label className="q-avatar-upload">{busy ? 'Foto wird gespeichert…' : 'Profilfoto hochladen'}<input type="file" accept="image/*" disabled={busy} onChange={upload}/></label>
      {message && <p role="alert">{message}</p>}
      {settings}
    </section>}
  </div>;
}


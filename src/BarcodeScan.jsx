import { useEffect, useRef, useState } from 'react';
import { authFetch } from './authFetch';
import { validBarcode } from '../lib/barcode.js';
import Icon from './Icon.jsx';

export default function BarcodeScan({ onAdd }) {
  const video = useRef(null);
  const controls = useRef(null);
  const stopped = useRef(true);
  const generation = useRef(0);
  const [scanning,setScanning] = useState(false);
  const [code,setCode] = useState('');
  const [product,setProduct] = useState(null);
  const [quantity,setQuantity] = useState(100);
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState('');
  const stop = () => {
    stopped.current=true;controls.current?.stop();controls.current=null;
    video.current?.srcObject?.getTracks().forEach(track => track.stop());
    setScanning(false);
  };
  useEffect(() => () => { generation.current++;stopped.current=true;controls.current?.stop();video.current?.srcObject?.getTracks().forEach(track => track.stop()); },[]);
  async function lookup(value) {
    stop();setProduct(null);setMessage('');
    const normalized = value.replace(/\s/g,'');
    if(!validBarcode(normalized)) {setMessage('Bitte einen gültigen EAN-/UPC-Barcode eingeben.');return;}
    const request = ++generation.current;setBusy(true);
    try {
      const response = await authFetch(`/api/products?barcode=${encodeURIComponent(normalized)}`);
      const data = await response.json();
      if(!response.ok) throw new Error(data.error || 'Produktsuche fehlgeschlagen.');
      if(request !== generation.current) return;
      if(!data.products?.length) setMessage('Kein Produkt mit vollständigen Nährwerten gefunden. Nutze stattdessen Foto, Beschreibung oder manuelle Eingabe.');
      else {setProduct(data.products[0]);setQuantity(100);}
    } catch(error) {if(request===generation.current) setMessage(error.message);}
    finally {if(request===generation.current) setBusy(false);}
  }
  async function start() {
    stop();setMessage('');setProduct(null);stopped.current=false;setScanning(true);
    try {
      const { BrowserMultiFormatOneDReader } = await import('@zxing/browser');
      if(stopped.current) return;
      const reader = new BrowserMultiFormatOneDReader();
      const scanner = await reader.decodeFromConstraints({video:{facingMode:{ideal:'environment'}},audio:false},video.current,(result,_error,scannerControls) => {
        const value=result?.getText();
        if(value && !stopped.current && validBarcode(value)) {scannerControls.stop();setCode(value);void lookup(value);}
      });
      if(stopped.current) scanner.stop();else controls.current=scanner;
    } catch {stop();setMessage('Kamera nicht verfügbar oder Zugriff nicht erlaubt. Du kannst die Zahl unter dem Barcode unten eingeben.');}
  }
  async function add() {
    if(!product || busy) return;
    const amount=Number(quantity);if(!(amount>0 && amount<=10000)) return;
    setBusy(true);setMessage('');
    try {
      const values=Object.fromEntries(Object.entries(product.per100g).map(([key,value]) => [key,Math.round(value*amount/100)]));
      await onAdd({ ...values,name:`${product.brand} ${product.name} (${amount} ${product.basis || 'g'})`.trim(),estimated:false });
    } catch {setMessage('Speichern fehlgeschlagen. Bitte erneut versuchen.');}
    finally {setBusy(false);}
  }
  return <section className="q-card q-barcode-scan">
    <h3>Barcode scannen</h3>
    <video ref={video} muted playsInline hidden={!scanning}/>
    {scanning ? <button onClick={stop}>Kamera schließen</button> : <button disabled={busy} onClick={start}><Icon name="camera" size={18}/> Kamera starten</button>}
    <form onSubmit={event => {event.preventDefault();void lookup(code);}}><label>Oder Barcode-Zahl eingeben<input inputMode="numeric" autoComplete="off" value={code} onChange={event => setCode(event.target.value)} placeholder="z. B. 400…"/></label><button disabled={busy}>{busy?'Wird gesucht…':'Produkt suchen'}</button></form>
    {message && <p role="status">{message}</p>}
    {product && <div className="q-barcode-product"><h4>{product.name}</h4><p>{product.brand}</p><a href={product.url} target="_blank" rel="noreferrer">Quelle: Open Food Facts</a><p>{product.per100g.calories} kcal · P {product.per100g.protein} · C {product.per100g.carbs} · F {product.per100g.fat} / 100 {product.basis || 'g'}</p><label>Gegessene Menge ({product.basis || 'g'})<input type="number" min="1" max="10000" value={quantity} onChange={event => setQuantity(event.target.value)}/></label><button onClick={add} disabled={busy || !(Number(quantity)>0 && Number(quantity)<=10000)}>Bestätigen & hinzufügen</button></div>}
  </section>;
}

import {useCallback,useEffect,useState} from 'react';
import {supabase} from './supabase';
import {applyAction,CATEGORIES} from '../lib/shopping.js';

const empty=()=>({base:[],queue:[],catalog:{ingredients:[],products:[],prices:[],recipes:[],recipeIngredients:[],units:[],research:[]}});
const read=key=>{try{const saved=JSON.parse(localStorage.getItem(key));return saved&&Array.isArray(saved.base)&&Array.isArray(saved.queue)&&saved.catalog?saved:empty();}catch{return empty();}};
const lock=(name,run)=>navigator.locks ? navigator.locks.request(name,run) : Promise.resolve().then(run);
export function project(state) {
  const rows=structuredClone(state.base);
  for(const op of state.queue) {
    let list=rows.find(l=>l.id===op.listId);
    if(!list&&op.action.type==='create') {list={id:op.listId,document:{name:op.action.name,retailer:'REWE',categories:CATEGORIES,items:[],archived:false}};rows.push(list);}
    if(list) list.document=applyAction(list.document,op.action);
  }
  return rows;
}
async function all(table) {
  const rows=[];
  for(let from=0;;from+=500) {
    const {data,error}=await supabase.from(table).select('*').order(table==='food_units'?'code':table==='shopping_price_cache'?'query_key':'id').range(from,from+499).abortSignal(AbortSignal.timeout(15000));
    if(error) throw error;
    rows.push(...data);
    if(data.length<500) return rows;
  }
}
export default function useShopping(userId) {
  const key=`nutrition:shopping:v1:${userId}`;
  const [state,setState]=useState(()=>read(key));
  const [status,setStatus]=useState('Lädt …');
  const [error,setError]=useState('');
  const write=useCallback(async change=>lock(key,()=>{
    const next=change(read(key));
    // Persist first: a failed storage write must not pretend an offline edit was saved.
    localStorage.setItem(key,JSON.stringify(next));setState(next);
    window.dispatchEvent(new Event('shopping-local-change'));
    return next;
  }),[key]);
  const sync=useCallback(async()=>{
    if(!navigator.onLine) {setStatus('Offline · Änderungen bleiben auf diesem Gerät');return;}
    await lock(`${key}:sync`,async()=>{
      try {
        let current=read(key);
        if(current.queue.length) setStatus('Synchronisiert …');
        while(current.queue.length) {
          const op=current.queue[0];
          const {data,error:failure}=await supabase.rpc('shopping_mutate',{p_list_id:op.listId,p_operation_id:op.id,p_action:op.action}).abortSignal(AbortSignal.timeout(15000));
          if(failure) throw failure;
          current=await write(s=>({...s,queue:s.queue.filter(o=>o.id!==op.id),base:[...s.base.filter(l=>l.id!==op.listId),{id:op.listId,document:data}]}));
        }
        const base=await all('shopping_lists');
        await write(s=>({...s,base}));setStatus('Synchronisiert');setError('');
      } catch {setStatus('Auf diesem Gerät gespeichert');setError('Synchronisierung ausstehend. Deine Änderungen bleiben erhalten. Erneut versuchen, sobald die Verbindung stabil ist.');}
    });
  },[key,write]);
  const refreshCatalog=useCallback(async()=>{
    try {
      const tables=['food_ingredients','food_products','food_price_observations','food_recipes','food_recipe_ingredients','food_units','shopping_price_cache'];
      const values=await Promise.all(tables.map(all));
      await write(s=>({...s,catalog:Object.fromEntries(['ingredients','products','prices','recipes','recipeIngredients','units','research'].map((name,i)=>[name,values[i]]))}));
    } catch {setError('Lebensmitteldaten konnten nicht aktualisiert werden. Vorhandene Daten und Richtpreise bleiben nutzbar.');}
  },[write]);
  useEffect(()=>{
    let active=true;
    const refresh=()=>{if(active)setState(read(key));};
    const online=()=>{void sync();void refreshCatalog();};
    window.addEventListener('storage',refresh);window.addEventListener('shopping-local-change',refresh);window.addEventListener('online',online);
    void sync();void refreshCatalog();
    const timer=setInterval(()=>void sync(),20000);
    return()=>{active=false;clearInterval(timer);window.removeEventListener('storage',refresh);window.removeEventListener('shopping-local-change',refresh);window.removeEventListener('online',online);};
  },[key,sync,refreshCatalog]);
  const mutate=async(listId,action)=>{
    try {await write(s=>({...s,queue:[...s.queue,{id:crypto.randomUUID(),listId,action}]}));setStatus('Auf diesem Gerät gespeichert');void sync();return true;}
    catch {setError('Gerätespeicher nicht verfügbar oder voll. Änderung wurde nicht übernommen.');return false;}
  };
  return {lists:project(state),catalog:state.catalog,pending:state.queue.length,status,error,mutate,sync,refreshCatalog};
}

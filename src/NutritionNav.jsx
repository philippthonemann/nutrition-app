import Icon from './Icon.jsx';

const entries = [
  ['today','home','Heute'], ['coach','coach','Coach'],
  ['scan','plus','Hinzufügen'], ['week','chart','Analytics'],
  ['shopping','basket','Einkaufen'],
];
export default function NutritionNav({active,onNavigate,onAdd}) {
  function navigate(key) {
    if(key==='scan'&&onAdd){onAdd();return;}
    if(onNavigate&&key!=='shopping'){onNavigate(key);return;}
    window.location.href=key==='shopping'?'/einkaufen':key==='today'?'/':`/?tab=${key}`;
  }
  return <nav className="nutrition-nav" aria-label="Hauptnavigation"><div>{entries.map(([key,icon,label])=><button key={key} className={key==='scan'?'q-nav-add':'q-nav-link'} aria-label={key==='scan'?(onAdd?'Artikel hinzufügen':'Mahlzeit hinzufügen'):label} aria-current={active===key?'page':undefined} onClick={()=>navigate(key)}><Icon name={icon} size={key==='scan'?28:22}/>{key!=='scan'&&<span>{label}</span>}</button>)}</div></nav>;
}

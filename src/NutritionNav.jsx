import Icon from './Icon.jsx';

const entries = [
  ['today','home','Heute'], ['coach','coach','Coach'],
  ['scan','plus','Hinzufügen'], ['week','chart','Analytics'],
  ['goals','target','Ziele'],
];
export function BottomNav({ entries, active, label }) {
  return <nav className="nutrition-nav" aria-label={label}>
    <div>{entries.map(({ key, icon, title, action, primary }) =>
      <button key={key} type="button" className={primary ? 'q-nav-add' : 'q-nav-link'}
        aria-label={title} aria-current={active === key ? 'page' : undefined} onClick={action}>
        <Icon name={icon} size={primary ? 28 : 22}/>
        {!primary && <span>{title}</span>}
      </button>
    )}</div>
  </nav>;
}

export default function NutritionNav({ active, onNavigate }) {
  return <BottomNav label="Nutrition-Navigation" active={active} entries={entries.map(([key, icon, title]) => ({
    key, icon, title: key === 'scan' ? 'Mahlzeit hinzufügen' : title,
    primary: key === 'scan', action: () => onNavigate(key),
  }))}/>;
}

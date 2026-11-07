import { useId } from 'react';

export function ProgressGauge({ value, goal, label, unit = 'g' }) {
  const id = useId();
  const percent = goal > 0 ? Math.max(0, value / goal * 100) : 0;
  const fill = Math.min(percent, 100);
  return <div className="q-gauge" role="img" aria-label={`${label}: ${Math.round(value)} ${unit}, ${Math.round(percent)} Prozent des Ziels von ${goal} ${unit}`}>
    <svg viewBox="0 0 120 100" aria-hidden="true">
      <defs><linearGradient id={id}><stop stopColor="#eaf3f4"/><stop offset="1" stopColor="#a4bec6"/></linearGradient></defs>
      <path className="q-gauge-track" d="M24 80a45 45 0 1 1 72 0" pathLength="100"/>
      <path className="q-gauge-fill" stroke={`url(#${id})`} d="M24 80a45 45 0 1 1 72 0" pathLength="100" strokeDasharray={`${fill} 100`}/>
      <text x="60" y="57" textAnchor="middle" className="q-gauge-number">{Math.round(percent)}<tspan fontSize="10">%</tspan></text>
      <text x="60" y="74" textAnchor="middle" className="q-gauge-caption">vom Tagesziel</text>
    </svg>
    <div className="q-gauge-label">{label}</div>
    <div className="q-gauge-value">{Math.round(value)} <span>/ {goal} {unit}</span></div>
  </div>;
}

export function TargetScale({ value, goal }) {
  const percentage = goal > 0 ? Math.max(0, value / goal * 100) : 0;
  const position = Math.min(percentage, 100);
  return <div className="q-target-scale" aria-label={`${Math.round(percentage)} Prozent des Tagesziels`}>
    <div className="q-scale-marker" style={{ left: `${position}%` }}><span>{Math.round(percentage)}%</span><i/></div>
    <div className="q-scale-track"><span style={{ width: `${position}%` }}/></div>
    <div className="q-scale-ends"><span>0</span><span>Tagesziel · {goal} kcal</span></div>
  </div>;
}

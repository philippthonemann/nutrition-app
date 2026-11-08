export default function InfoTip({ label = 'Weitere Informationen', children }) {
  return <details className="q-info-tip" onPointerEnter={event => { if (event.pointerType === 'mouse') event.currentTarget.open = true; }} onPointerLeave={event => { if (event.pointerType === 'mouse' && !event.currentTarget.matches(':focus-within')) event.currentTarget.open = false; }}><summary aria-label={label}>i</summary><span role="note" className="q-info-content">{children}</span></details>;
}


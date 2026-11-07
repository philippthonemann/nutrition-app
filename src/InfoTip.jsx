export default function InfoTip({ label = 'Weitere Informationen', children }) {
  return <details className="q-info-tip"><summary aria-label={label}>i</summary><span role="note" className="q-info-content">{children}</span></details>;
}

const paths = {
  flame: 'M12 3c2 4-1 5 2 8 1-2 2-3 2-4 5 6 4 14-4 14S3 14 7 9c0 3 1 4 2 5-1-5 3-7 3-11Z',
  strength: 'M3 8v8m3-10v12m12-12v12m3-10v8M6 12h12',
  leaf: 'M20 4C8 2 2 9 6 16c4 7 15 2 14-12ZM6 18l10-10',
  drop: 'M12 3 5 13a8 8 0 1 0 14 0Z',
  grain: 'M12 21V3m0 7C4 10 5 4 5 4s7 0 7 6Zm0 6c-8 0-7-6-7-6s7 0 7 6Zm0-6c8 0 7-6 7-6s-7 0-7 6Zm0 6c8 0 7-6 7-6s-7 0-7 6Z',
  cube: 'm12 3 9 5v9l-9 5-9-5V8Zm-9 5 9 5 9-5m-9 5v9',
  coffee: 'M4 8h12v9a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4Zm12 1h2a3 3 0 0 1 0 6h-2M7 3v2m5-2v2',
  glass: 'M6 3h12l-2 9a4 4 0 0 1-8 0Zm6 13v5m-4 0h8',
  camera: 'M8 6l2-3h4l2 3h5v14H3V6Zm8 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  utensils: 'M4 3v7a3 3 0 0 0 6 0V3M7 3v18m13-18c-5 2-5 8 0 9v9m0-18v9',
  edit: 'm4 16 12-12 4 4L8 20H4Zm10-10 4 4',
  sparkles: 'm12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5ZM20 2v4m-2-2h4',
  bolt: 'm13 2-9 12h7l-1 8 10-13h-7Z',
  clock: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM12 7v5l3 2',
  target: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-4 0a5 5 0 1 1-10 0 5 5 0 0 1 10 0Zm-5-1v2',
  calendar: 'M4 5h16v16H4ZM8 2v6m8-6v6M4 10h16',
  check: 'm5 12 4 4L19 6',
  wallet: 'M3 6h17v15H3V6Zm0 0V4h15v2m-3 6h6v5h-6Z',
};

export default function Icon({ name = 'sparkles', size = 20, label, ...props }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden={label ? undefined : true} role={label ? 'img' : undefined} aria-label={label} style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }} {...props}><path d={paths[name] || paths.sparkles}/></svg>;
}

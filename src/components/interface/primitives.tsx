import { ReactNode, useEffect, useState } from 'react';

export function Switch({ checked, onChange, label, id }: { checked: boolean; onChange: (v: boolean) => void; label: string; id?: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} id={id} className="switch" data-on={checked ? '1' : '0'} onClick={() => onChange(!checked)}>
      <span className="switch__knob" />
    </button>
  );
}

export function Row({ label, hint, children }: { label: ReactNode; hint?: ReactNode; children?: ReactNode }) {
  return (
    <div className="row">
      <div className="row__label"><span>{label}</span>{hint ? <small>{hint}</small> : null}</div>
      <div className="row__ctl">{children}</div>
    </div>
  );
}

export function Slider({ value, min, max, step, onChange, label, format }: { value: number; min: number; max: number; step: number; onChange: (v: number) => void; label: string; format?: (v: number) => string }) {
  return (
    <div className="slider">
      <input type="range" min={min} max={max} step={step} value={value} aria-label={label} onChange={(e) => onChange(parseFloat(e.target.value))} />
      <output>{format ? format(value) : value}</output>
    </div>
  );
}

export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { id: T; label: ReactNode; title?: string }[]; label: string }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} type="button" className="seg__btn" aria-pressed={value === o.id} title={o.title} onClick={() => onChange(o.id)}>{o.label}</button>
      ))}
    </div>
  );
}

/** Campo numérico que só confirma ao sair do campo ou com Enter (evita reconstruir a cena a cada tecla). */
export function NumField({ value, onCommit, min, max, step, unit, label }: { value: number; onCommit: (v: number) => void; min: number; max: number; step: number; unit?: string; label: string }) {
  const [txt, setTxt] = useState(String(value));
  useEffect(() => setTxt(String(Math.round(value * 1000) / 1000)), [value]);
  const commit = () => {
    const n = parseFloat(txt.replace(',', '.'));
    if (!isFinite(n)) { setTxt(String(value)); return; }
    const c = Math.min(max, Math.max(min, n));
    setTxt(String(c));
    if (Math.abs(c - value) > 1e-9) onCommit(c);
  };
  return (
    <span className="num">
      <input type="text" inputMode="decimal" aria-label={label} value={txt} onChange={(e) => setTxt(e.target.value)} onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'ArrowUp') { e.preventDefault(); onCommit(Math.min(max, +(value + step).toFixed(4))); } if (e.key === 'ArrowDown') { e.preventDefault(); onCommit(Math.max(min, +(value - step).toFixed(4))); } }} />
      {unit ? <i>{unit}</i> : null}
    </span>
  );
}

export function Badge({ kind }: { kind: 'confirmado' | 'estimado' | 'esquematico' }) {
  const t = { confirmado: 'Confirmado', estimado: 'Estimado', esquematico: 'Esquemático' }[kind];
  return <span className="badge" data-kind={kind}>{t}</span>;
}

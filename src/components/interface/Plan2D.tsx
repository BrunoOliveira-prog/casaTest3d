import { useMemo, useState } from 'react';
import { useStore } from '../../state/store';
import { derive } from '../../data/house/derive';
import { fmtArea, fmtM } from '../../utils/format';
import { MATERIAL_LABEL, SRC_LABEL } from '../../data/config';
import { Badge } from './primitives';

const FLOOR_FILL: Record<string, string> = { madeira: '#e4cfa9', porcelanato: '#e3e1db', cimenticio: '#cfd0cb' };

/** Alternativa 2D (SVG) usada quando o WebGL não está disponível ou o contexto é perdido. */
export function Plan2D() {
  const model = useStore((s) => s.model);
  const set = useStore((s) => s.set);
  const [sel, setSel] = useState<string | null>(null);
  const d = useMemo(() => derive(model), [model]);
  const b = d.bbox;
  const pad = 1.4;
  const x0 = b.min[0] - pad, z0 = b.min[2] - pad, w = b.size[0] + pad * 2, h = b.size[2] + pad * 2;
  const room = sel ? d.roomById.get(sel) : null;

  return (
    <div className="fallback">
      <header className="fallback__head">
        <div>
          <h1>Raio-X Arquitetônico</h1>
          <p>Modo 2D — a visualização 3D não pôde ser iniciada.</p>
        </div>
        <button type="button" className="btn btn--primary" onClick={() => set({ webglFailed: false, canvasKey: useStore.getState().canvasKey + 1 })}>Tentar o 3D novamente</button>
      </header>
      <div className="fallback__body">
        <svg className="plan2d" viewBox={`${x0} ${z0} ${w} ${h}`} role="img" aria-label="Planta baixa 2D da casa em U com pátio central">
          <rect x={x0} y={z0} width={w} height={h} fill="#eeece6" />
          {d.rooms.map((r) => (
            <polygon key={r.id} points={r.polygon.map((p) => p.join(',')).join(' ')} fill={r.id === 'R-PATIO' ? '#d9ddd2' : FLOOR_FILL[r.floor]} stroke={sel === r.id ? '#2f7f6f' : 'none'} strokeWidth={0.08}
              tabIndex={0} role="button" aria-label={`${r.name}, ${fmtArea(r.area)}`} onClick={() => setSel(r.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSel(r.id); }} style={{ cursor: 'pointer' }} />
          ))}
          {d.model.furniture.filter((f) => f.kind !== 'plant').map((f) => (
            <rect key={f.id} x={f.x - f.w / 2} y={f.z - f.d / 2} width={f.w} height={f.d} fill="#ffffff" fillOpacity={0.55} stroke="#9a968c" strokeWidth={0.02} pointerEvents="none" />
          ))}
          {d.walls.map((wl) => {
            const ax = wl.a[0] + wl.dx * wl.s0, az = wl.a[1] + wl.dz * wl.s0, bx = wl.a[0] + wl.dx * wl.s1, bz = wl.a[1] + wl.dz * wl.s1;
            return <line key={wl.id} x1={ax} y1={az} x2={bx} y2={bz} stroke="#26302d" strokeWidth={wl.t} strokeLinecap="butt" />;
          })}
          {d.walls.flatMap((wl) => wl.dopenings.map((o) => {
            const ax = wl.a[0] + wl.dx * o.s0, az = wl.a[1] + wl.dz * o.s0, bx = wl.a[0] + wl.dx * o.s1, bz = wl.a[1] + wl.dz * o.s1;
            return <line key={o.id} x1={ax} y1={az} x2={bx} y2={bz} stroke={o.type === 'door' ? '#eeece6' : '#7fc1d8'} strokeWidth={o.type === 'door' ? wl.t + 0.01 : wl.t * 0.45} />;
          }))}
          {d.rooms.map((r) => (
            <text key={`t-${r.id}`} x={r.centroid[0]} y={r.centroid[1]} fontSize={0.34} textAnchor="middle" fill="#202422" pointerEvents="none" style={{ fontWeight: 600 }}>{r.name}</text>
          ))}
          <g transform={`translate(${x0 + 0.6}, ${z0 + 1.2})`} aria-hidden="true"><path d="M0 0.5 0.3 -0.4 0.6 0.5 0.3 0.3z" fill="#202422" /><text x={0.3} y={-0.55} fontSize={0.3} textAnchor="middle">N</text></g>
          <g transform={`translate(${x0 + w - 3.2}, ${z0 + h - 0.5})`} aria-hidden="true"><line x1={0} y1={0} x2={2} y2={0} stroke="#202422" strokeWidth={0.05} /><text x={0} y={-0.15} fontSize={0.28}>2 m</text></g>
        </svg>
        <aside className="fallback__side">
          {room ? (
            <div className="card">
              <h2 className="card__title">{room.name}</h2>
              <dl className="dl">
                <dt>Área</dt><dd>{fmtArea(room.area)}</dd>
                <dt>Nominal</dt><dd>{room.nominal[1] ? `${fmtM(room.nominal[0])} × ${fmtM(room.nominal[1])} m` : `${fmtM(room.nominal[0])} m`}</dd>
                <dt>Piso</dt><dd>{MATERIAL_LABEL[room.floor] ?? room.floor}</dd>
                <dt>Fonte</dt><dd><Badge kind={room.src} /> <small>{SRC_LABEL[room.src]}</small></dd>
              </dl>
            </div>
          ) : <p className="note">Selecione um ambiente na planta para ver os detalhes.</p>}
          <ul className="list list--btn">
            {d.rooms.map((r) => (<li key={r.id}><button type="button" className="item" aria-current={sel === r.id} onClick={() => setSel(r.id)}><span>{r.name}</span><small>{fmtArea(r.area)}</small></button></li>))}
          </ul>
          <p className="note">Visualização arquitetônica. Elementos não documentados são estimativos.</p>
        </aside>
      </div>
    </div>
  );
}

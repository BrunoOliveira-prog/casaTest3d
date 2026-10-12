import { useStore, Axis } from '../../../state/store';
import { Row, Segmented, Slider, Switch } from '../primitives';
import { fmtM } from '../../../utils/format';
import { IFlip } from '../icons';

export function SectionTab() {
  const on = useStore((s) => s.sectionOn);
  const axis = useStore((s) => s.sectionAxis);
  const pos = useStore((s) => s.sectionPos);
  const flip = useStore((s) => s.sectionFlip);
  const rig = useStore((s) => s.rig);
  const view = useStore((s) => s.view);
  const set = useStore((s) => s.set);
  const requestCamera = useStore((s) => s.requestCamera);

  const b = rig?.derived.bbox;
  const i = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
  const lo = b ? b.min[i] - (axis === 'y' ? 0 : 0.5) : 0, hi = b ? b.max[i] + (axis === 'y' ? 0.2 : 0.5) : 1;
  const meters = lo + (hi - lo) * pos;
  const recam = () => { if (view === 'corte') window.setTimeout(() => requestCamera({ kind: 'view', view: 'corte' }), 0); };

  return (
    <div className="stack">
      <section>
        <h2 className="h">Plano de corte</h2>
        <Row label="Ativar corte" hint="recorta a geometria de verdade (render e sombras)"><Switch checked={on} onChange={(v) => set({ sectionOn: v })} label="Plano de corte" /></Row>
        <Row label="Eixo">
          <Segmented<Axis> label="Eixo do corte" value={axis} onChange={(v) => { set({ sectionAxis: v, sectionOn: true }); recam(); }}
            options={[{ id: 'x', label: 'X', title: 'Leste–oeste' }, { id: 'y', label: 'Y', title: 'Altura (planta cortada)' }, { id: 'z', label: 'Z', title: 'Norte–sul' }]} />
        </Row>
        <Row label="Posição" hint={`${fmtM(meters)} m no eixo ${axis.toUpperCase()}`}>
          <Slider value={pos} min={0} max={1} step={0.001} onChange={(v) => set({ sectionPos: v, sectionOn: true })} label="Posição do plano de corte" format={(v) => `${Math.round(v * 100)}%`} />
        </Row>
        <div className="btns">
          <button type="button" className="btn" onClick={() => { set({ sectionFlip: !flip, sectionOn: true }); recam(); }}><IFlip />Inverter lado</button>
          <button type="button" className="btn" onClick={() => { set({ sectionAxis: 'z', sectionPos: 0.5, sectionFlip: false, sectionOn: view === 'corte' }); recam(); }}>Redefinir corte</button>
        </div>
        <p className="note">
          Eixo X corta de leste a oeste, Y é um corte horizontal (planta cortada) e Z corta de norte a sul. O lado removido é o que fica
          {flip ? ' antes' : ' depois'} do plano. <strong>Limitação:</strong> as faces cortadas não recebem preenchimento (“capping”); a casa aparece oca no corte.
        </p>
        {view !== 'corte' && <button type="button" className="btn btn--primary" onClick={() => useStore.getState().setView('corte')}>Ir para a vista Corte</button>}
      </section>
    </div>
  );
}

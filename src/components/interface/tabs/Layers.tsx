import { useMemo } from 'react';
import { useStore } from '../../../state/store';
import { LayerDef, layersFor, PRESETS, QUALITY, QualityId } from '../../../data/config';
import { Row, Segmented, Slider, Switch } from '../primitives';

export function LayersTab() {
  const model = useStore((s) => s.model);
  const layers = useStore((s) => s.layers);
  const preset = useStore((s) => s.preset);
  const setLayer = useStore((s) => s.setLayer);
  const setPreset = useStore((s) => s.setPreset);
  const xray = useStore((s) => s.xray);
  const xrayOpacity = useStore((s) => s.xrayOpacity);
  const explodeOn = useStore((s) => s.explodeOn);
  const explodeAmount = useStore((s) => s.explodeAmount);
  const guides = useStore((s) => s.guides);
  const lighting = useStore((s) => s.lighting);
  const quality = useStore((s) => s.quality);
  const backdrop = useStore((s) => s.backdrop);
  const flow = useStore((s) => s.flow);
  const labels = useStore((s) => s.labels);
  const view = useStore((s) => s.view);
  const set = useStore((s) => s.set);
  const setExplode = useStore((s) => s.setExplode);

  const groups = useMemo(() => {
    const out: { name: string; items: LayerDef[] }[] = [];
    for (const l of layersFor(model)) {
      let g = out.find((x) => x.name === l.group);
      if (!g) { g = { name: l.group, items: [] }; out.push(g); }
      g.items.push(l);
    }
    return out;
  }, [model]);

  return (
    <div className="stack">
      <section>
        <h2 className="h">Predefinições</h2>
        <div className="chips" role="group" aria-label="Predefinições de camadas">
          {PRESETS.map((p) => (
            <button key={p.id} type="button" className="chip" aria-pressed={preset === p.id} onClick={() => setPreset(p.id)}>{p.name}</button>
          ))}
        </div>
        <p className="note">A visibilidade final de cada elemento combina: camada ligada, etapa já construída na linha do tempo e regras da vista atual.</p>
      </section>

      {groups.map((g) => (
        <section key={g.name}>
          <h2 className="h">{g.name}</h2>
          <ul className="list">
            {g.items.map((l) => (
              <li key={l.id} className="list__row">
                <span className="swatch" style={{ background: l.color }} aria-hidden="true" />
                <label htmlFor={`lay-${l.id}`}>{l.name}</label>
                <Switch id={`lay-${l.id}`} checked={layers[l.id] !== false} onChange={(v) => setLayer(l.id, v)} label={`Camada: ${l.name}`} />
              </li>
            ))}
          </ul>
        </section>
      ))}

      <section>
        <h2 className="h">Raio-X</h2>
        <Row label="Transparência" hint={view === 'instalacoes' ? 'sempre ativa na vista Instalações' : undefined}><Switch checked={xray} onChange={(v) => set({ xray: v })} label="Raio-X" /></Row>
        <Row label="Opacidade das superfícies"><Slider value={xrayOpacity} min={0.08} max={0.8} step={0.01} onChange={(v) => set({ xrayOpacity: v })} label="Opacidade do raio-X" format={(v) => `${Math.round(v * 100)}%`} /></Row>
      </section>

      <section>
        <h2 className="h">Vista explodida</h2>
        <Row label="Separar grupos"><Switch checked={explodeOn} onChange={(v) => setExplode(v)} label="Vista explodida" /></Row>
        <Row label="Intensidade"><Slider value={explodeAmount} min={0.1} max={1} step={0.01} onChange={(v) => set({ explodeAmount: v, explodeOn: true })} label="Intensidade da explosão" format={(v) => `${Math.round(v * 100)}%`} /></Row>
        <Row label="Linhas-guia"><Switch checked={guides} onChange={(v) => set({ guides: v })} label="Linhas-guia da explosão" /></Row>
      </section>

      <section>
        <h2 className="h">Cena</h2>
        <Row label="Iluminação"><Segmented label="Iluminação" value={lighting} onChange={(v) => set({ lighting: v })} options={[{ id: 'dia', label: 'Dia' }, { id: 'tarde', label: 'Fim de tarde' }]} /></Row>
        <Row label="Fundo"><Segmented label="Fundo da cena" value={backdrop} onChange={(v) => set({ backdrop: v })} options={[{ id: 'ceu', label: 'Céu' }, { id: 'estudio', label: 'Estúdio' }]} /></Row>
        <Row label="Qualidade" hint="Média: oclusão de ambiente. Alta: + vidro com transmissão, bloom e sombras 4K. Reduz sozinha se travar.">
          <Segmented<QualityId> label="Qualidade gráfica" value={quality} onChange={(v) => set({ quality: v })} options={(Object.keys(QUALITY) as QualityId[]).map((k) => ({ id: k, label: QUALITY[k].label }))} />
        </Row>
        <Row label="Rótulos ancorados"><Switch checked={labels} onChange={(v) => set({ labels: v })} label="Rótulos" /></Row>
        <Row label="Partículas de fluxo" hint="água e esgoto, quando a instalação está pronta"><Switch checked={flow} onChange={(v) => set({ flow: v })} label="Partículas de fluxo" /></Row>
      </section>
    </div>
  );
}

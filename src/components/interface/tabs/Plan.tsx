import { useRef } from 'react';
import { useStore } from '../../../state/store';
import type { Params } from '../../../data/house/types';
import { Row, NumField, Segmented, Slider, Switch } from '../primitives';
import { downloadText, fmtM } from '../../../utils/format';
import { IDownload, IUpload } from '../icons';

interface PField { key: keyof Params; label: string; unit: string; min: number; max: number; step: number; hint?: string }
const FIELDS: PField[] = [
  { key: 'ceilingBase', label: 'Pé-direito (base dos telhados baixos)', unit: 'm', min: 2.2, max: 4, step: 0.05, hint: 'ficha: 2,80 m' },
  { key: 'ridgeMax', label: 'Altura máxima da cumeeira', unit: 'm', min: 3.2, max: 7, step: 0.05, hint: 'ficha: 4,90 m' },
  { key: 'roofThick', label: 'Espessura do telhado', unit: 'm', min: 0.06, max: 0.4, step: 0.01 },
  { key: 'wallExtT', label: 'Espessura das paredes externas', unit: 'm', min: 0.14, max: 0.4, step: 0.01 },
  { key: 'wallMidT', label: 'Espessura das paredes intermediárias', unit: 'm', min: 0.1, max: 0.3, step: 0.01 },
  { key: 'wallIntT', label: 'Espessura das paredes internas', unit: 'm', min: 0.08, max: 0.2, step: 0.01 },
  { key: 'slabThick', label: 'Espessura do radier', unit: 'm', min: 0.08, max: 0.4, step: 0.01 },
  { key: 'footingW', label: 'Largura da sapata', unit: 'm', min: 0.3, max: 1.2, step: 0.05 },
  { key: 'footingDepth', label: 'Profundidade da sapata', unit: 'm', min: 0.3, max: 1.5, step: 0.05 },
  { key: 'eyeHeight', label: 'Altura dos olhos (modo interior)', unit: 'm', min: 1.2, max: 2, step: 0.05 },
];

export function PlanTab() {
  const model = useStore((s) => s.model);
  const overrides = useStore((s) => s.overrides);
  const planOverlay = useStore((s) => s.planOverlay);
  const planOpacity = useStore((s) => s.planOpacity);
  const planImage = useStore((s) => s.planImage);
  const calib = useStore((s) => s.calib);
  const view = useStore((s) => s.view);
  const importErrors = useStore((s) => s.importErrors);
  const customBase = useStore((s) => s.customBase);
  const set = useStore((s) => s.set);
  const patchParams = useStore((s) => s.patchParams);
  const setOverrides = useStore((s) => s.setOverrides);
  const resetAll = useStore((s) => s.resetAll);
  const importModel = useStore((s) => s.importModel);
  const setView = useStore((s) => s.setView);
  const file = useRef<HTMLInputElement>(null);
  const real = useRef<HTMLInputElement>(null);

  const k = overrides.planScale ?? 1;
  const measured = calib.pts.length === 2 ? Math.hypot(calib.pts[0][0] - calib.pts[1][0], calib.pts[0][1] - calib.pts[1][1]) : null;
  const colors = overrides.colors ?? {};
  const setColor = (key: 'reboco' | 'madeira' | 'telha' | 'esquadria', v: string | undefined) => {
    const c = { ...colors };
    if (v) c[key] = v; else delete c[key];
    setOverrides({ ...overrides, colors: c });
  };

  const applyCalib = () => {
    const r = parseFloat((real.current?.value ?? '').replace(',', '.'));
    if (!measured || !isFinite(r) || r <= 0.1) { set({ toast: 'Informe a distância real (em metros) entre os dois pontos.' }); return; }
    const nk = Math.min(3, Math.max(0.3, k * (r / measured)));
    setOverrides({ ...overrides, planScale: nk });
    set({ calib: { active: false, pts: [] }, toast: `Escala ajustada: fator ${fmtM(nk, 3)}.` });
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    const text = await f.text();
    importModel(text);
    if (file.current) file.current.value = '';
  };

  return (
    <div className="stack">
      <h2 className="panel-title">Planta e parâmetros</h2>
      <section>
        <h2 className="h">Imagem de referência</h2>
        <p className="note">Mostrada por baixo do modelo na vista Planta, para conferir a reconstrução. O desenho original tem escalas diferentes em X e Z; a imagem é esticada para casar com as cotas totais.</p>
        <Row label="Sobrepor na vista Planta"><Switch checked={planOverlay} onChange={(v) => set({ planOverlay: v })} label="Sobrepor imagem de referência" /></Row>
        <Row label="Opacidade"><Slider value={planOpacity} min={0} max={1} step={0.01} onChange={(v) => set({ planOpacity: v })} label="Opacidade da imagem de referência" format={(v) => `${Math.round(v * 100)}%`} /></Row>
        <Row label="Imagem">
          <Segmented label="Imagem de referência" value={planImage} onChange={(v) => set({ planImage: v })} options={[{ id: 'planta', label: 'Planta' }, { id: 'planta-mobiliada', label: 'Mobiliada' }, { id: 'cobertura', label: 'Cobertura' }]} />
        </Row>
        {view !== 'planta' && <button type="button" className="btn" onClick={() => setView('planta')}>Abrir vista Planta</button>}
      </section>

      <section>
        <h2 className="h">Calibração por distância conhecida</h2>
        <p className="note">Nenhuma medida real foi informada, então a escala é provisória (15,80 × 12,20 m pela ficha). Se você souber uma distância real, calibre aqui.</p>
        <Row label="Fator de escala atual" hint="1,000 = ficha original"><span className="mono">{fmtM(k, 3)}</span></Row>
        {!calib.active ? (
          <div className="btns">
            <button type="button" className="btn btn--primary" onClick={() => { if (view !== 'planta') setView('planta'); set({ calib: { active: true, pts: [] }, planOverlay: true }); }}>Calibrar na planta</button>
            {k !== 1 && <button type="button" className="btn" onClick={() => setOverrides({ ...overrides, planScale: undefined })}>Voltar a 1,000</button>}
          </div>
        ) : (
          <div className="callout">
            <p><strong>Passo {calib.pts.length < 2 ? calib.pts.length + 1 : 3} de 3.</strong> {calib.pts.length < 2 ? `Clique no ponto ${calib.pts.length + 1} na planta (vista de cima).` : 'Informe a distância real entre os pontos e aplique.'}</p>
            {measured !== null && <p>Distância no modelo: <strong>{fmtM(measured)} m</strong></p>}
            <div className="inline">
              <input ref={real} className="input" inputMode="decimal" placeholder="Distância real (m)" aria-label="Distância real entre os dois pontos, em metros" disabled={measured === null} />
              <button type="button" className="btn btn--primary" disabled={measured === null} onClick={applyCalib}>Aplicar</button>
              <button type="button" className="btn" onClick={() => set({ calib: { active: false, pts: [] } })}>Cancelar</button>
            </div>
          </div>
        )}
      </section>

      <section>
        <h2 className="h">Parâmetros estimados <span className="tag">editáveis</span></h2>
        <p className="note">Valores não confirmados pela planta. Alterar reconstrói o modelo; Enter ou sair do campo confirma.</p>
        {FIELDS.map((f) => (
          <Row key={f.key} label={f.label} hint={f.hint}>
            <NumField label={f.label} value={model.params[f.key]} min={f.min} max={f.max} step={f.step} unit={f.unit} onCommit={(v) => patchParams({ [f.key]: v })} />
          </Row>
        ))}
        <Row label="Inclinação do telhado central" hint="ficha: 8–10°; modelo: 17% ≈ 9,6°">
          <NumField label="Inclinação do telhado central em porcentagem" value={Math.round(Math.abs(model.roofs.find((r) => r.id === 'RC')?.plane.gz ?? 0.17) * k * 1000) / 10} min={4} max={30} step={1} unit="%" onCommit={(v) => setOverrides({ ...overrides, slopeCentral: v / 100 })} />
        </Row>
        <div className="btns"><button type="button" className="btn" onClick={() => setOverrides({ planScale: overrides.planScale, colors: overrides.colors })}>Restaurar parâmetros</button></div>
      </section>

      <section>
        <h2 className="h">Cores</h2>
        {([['reboco', 'Reboco das paredes'], ['madeira', 'Madeira dos revestimentos'], ['telha', 'Telhado metálico'], ['esquadria', 'Esquadrias']] as const).map(([key, label]) => (
          <Row key={key} label={label}>
            <span className="inline">
              <input type="color" aria-label={`Cor: ${label}`} value={colors[key] ?? { reboco: '#ffffff', madeira: '#ffffff', telha: '#ffffff', esquadria: '#1c1d1f' }[key]} onChange={(e) => setColor(key, e.target.value)} />
              <button type="button" className="btn btn--tiny" onClick={() => setColor(key, undefined)} disabled={!colors[key]}>Padrão</button>
            </span>
          </Row>
        ))}
        <p className="note">As cores multiplicam as texturas procedurais; branco mantém a cor original.</p>
      </section>

      <section>
        <h2 className="h">Hipóteses e conflitos da planta</h2>
        <ul className="hyp">
          {model.assumptions.map((a) => (<li key={a.id}><b>{a.id}</b><span>{a.text}</span></li>))}
        </ul>
      </section>

      <section>
        <h2 className="h">Dados do modelo</h2>
        <p className="note">O modelo é um JSON único (fonte de verdade). {customBase ? 'Você está usando um modelo importado.' : 'Você está usando o modelo padrão.'} Ajustes ficam salvos neste navegador.</p>
        <div className="btns">
          <button type="button" className="btn" onClick={() => downloadText('casa-de-campo.json', JSON.stringify(model, null, 2))}><IDownload />Exportar JSON</button>
          <button type="button" className="btn" onClick={() => file.current?.click()}><IUpload />Importar JSON</button>
          <button type="button" className="btn btn--danger" onClick={() => { if (window.confirm('Restaurar o modelo padrão e descartar ajustes salvos?')) resetAll(); }}>Restaurar padrão</button>
        </div>
        <input ref={file} type="file" accept="application/json,.json" className="sr-only" tabIndex={-1} aria-label="Importar arquivo JSON do modelo" onChange={(e) => onFile(e.target.files?.[0])} />
        {importErrors && (
          <div className="callout callout--err" role="alert">
            <p><strong>Não foi possível importar.</strong> Corrija e tente de novo:</p>
            <ul>{importErrors.slice(0, 12).map((e, i) => <li key={i}>{e}</li>)}</ul>
            {importErrors.length > 12 && <p>… e mais {importErrors.length - 12} problema(s).</p>}
          </div>
        )}
      </section>
    </div>
  );
}

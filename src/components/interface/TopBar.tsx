import type { ReactNode } from 'react';
import { useStore, ViewMode } from '../../state/store';
import { IClose, ICamera, ICube, IExplode, IHelp, ILabel, IMoon, IPanel, IPipe, IPlan, ISection, ISun, IWalk, IXray } from './icons';
import { STAGES, stageOfProgress } from '../../data/config';

const VIEWS: { id: ViewMode; label: string; key: string; icon: ReactNode; hint: string }[] = [
  { id: 'geral', label: 'Geral', key: '1', icon: <ICube />, hint: 'Vista externa em perspectiva' },
  { id: 'planta', label: 'Planta', key: '2', icon: <IPlan />, hint: 'Vista ortogonal superior com imagem de referência' },
  { id: 'corte', label: 'Corte', key: '3', icon: <ISection />, hint: 'Plano de corte real nos eixos X, Y ou Z' },
  { id: 'instalacoes', label: 'Instalações', key: '4', icon: <IPipe />, hint: 'Redes esquemáticas com paredes translúcidas' },
  { id: 'interior', label: 'Interior', key: '5', icon: <IWalk />, hint: 'Caminhe dentro da casa (WASD)' },
];

export function TopBar() {
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  const xray = useStore((s) => s.xray);
  const explodeOn = useStore((s) => s.explodeOn);
  const labels = useStore((s) => s.labels);
  const lighting = useStore((s) => s.lighting);
  const panelOpen = useStore((s) => s.panelOpen);
  const progress = useStore((s) => s.progress);
  const set = useStore((s) => s.set);
  const setExplode = useStore((s) => s.setExplode);
  const capture = useStore((s) => s.capture);
  const stage = STAGES[stageOfProgress(progress)];
  const done = progress >= 0.999;

  return (
    <header className="topbar" data-panel={panelOpen ? '1' : '0'}>
      <div className="brand">
        <h1>Raio-X Arquitetônico</h1>
        <p>Casa de campo térrea em U · {done ? 'obra concluída' : `etapa ${stage.n} de 5 — ${stage.name}`}</p>
      </div>
      <nav className="views" aria-label="Vistas">
        {VIEWS.map((v) => (
          <button key={v.id} type="button" className="chip chip--view" aria-pressed={view === v.id} title={`${v.hint} (${v.key})`} onClick={() => setView(v.id)}>
            {v.icon}<span>{v.label}</span>
          </button>
        ))}
      </nav>
      <div className="tools" role="toolbar" aria-label="Ferramentas">
        <button type="button" className="icon-btn" aria-pressed={xray} aria-label="Raio-X (X)" title="Raio-X: paredes e cobertura translúcidas (X)" onClick={() => set({ xray: !xray })} disabled={view === 'interior'}><IXray /></button>
        <button type="button" className="icon-btn" aria-pressed={explodeOn} aria-label="Vista explodida (E)" title="Vista explodida (E)" onClick={() => setExplode(!explodeOn)} disabled={view === 'interior'}><IExplode /></button>
        <button type="button" className="icon-btn" aria-pressed={labels} aria-label="Rótulos (L)" title="Rótulos ancorados (L)" onClick={() => set({ labels: !labels })}><ILabel /></button>
        <button type="button" className="icon-btn" aria-pressed={lighting === 'tarde'} aria-label={lighting === 'dia' ? 'Trocar para fim de tarde' : 'Trocar para dia'} title={lighting === 'dia' ? 'Iluminação: dia (clique para fim de tarde)' : 'Iluminação: fim de tarde (clique para dia)'} onClick={() => set({ lighting: lighting === 'dia' ? 'tarde' : 'dia' })}>{lighting === 'dia' ? <ISun /> : <IMoon />}</button>
        <button type="button" className="icon-btn" aria-label="Salvar imagem PNG (C)" title="Salvar imagem PNG da cena 3D (C) — sem a interface" onClick={() => capture?.()} disabled={!capture}><ICamera /></button>
        <button type="button" className="icon-btn" aria-label="Ajuda e atalhos (?)" title="Ajuda e atalhos (?)" onClick={() => set({ helpOpen: true })}><IHelp /></button>
        <button type="button" className="icon-btn" aria-pressed={panelOpen} aria-label={panelOpen ? 'Fechar painel lateral ([)' : 'Abrir painel lateral ([)'} title="Painel lateral ([)" onClick={() => set({ panelOpen: !panelOpen })}>{panelOpen ? <IClose /> : <IPanel />}</button>
      </div>
    </header>
  );
}

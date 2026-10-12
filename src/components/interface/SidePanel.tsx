import { useRef } from 'react';
import { useStore, Tab } from '../../state/store';
import { LayersTab } from './tabs/Layers';
import { SectionTab } from './tabs/Section';
import { PlacesTab } from './tabs/Places';
import { InspectTab } from './tabs/Inspect';
import { PlanTab } from './tabs/Plan';

const TABS: { id: Tab; label: string }[] = [
  { id: 'camadas', label: 'Camadas' },
  { id: 'corte', label: 'Corte' },
  { id: 'locais', label: 'Locais' },
  { id: 'inspecao', label: 'Inspeção' },
  { id: 'planta', label: 'Ajustes' },
];

export function SidePanel() {
  const open = useStore((s) => s.panelOpen);
  const tab = useStore((s) => s.tab);
  const set = useStore((s) => s.set);
  const selected = useStore((s) => s.selected);
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  const onKey = (e: React.KeyboardEvent, i: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const n = (i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length;
    set({ tab: TABS[n].id }); refs.current[TABS[n].id]?.focus(); e.preventDefault();
  };

  return (
    <aside className="side-panel" data-open={open ? '1' : '0'} aria-label="Painel de controle" aria-hidden={!open} {...(!open ? { inert: true } : {})}>
      <div className="tabs" role="tablist" aria-label="Seções do painel">
        {TABS.map((t, i) => (
          <button key={t.id} ref={(el) => { refs.current[t.id] = el; }} role="tab" title={t.id === 'planta' ? 'Planta e parâmetros' : undefined} id={`tab-${t.id}`} aria-selected={tab === t.id} aria-controls={`tabpanel-${t.id}`} tabIndex={tab === t.id ? 0 : -1}
            className="tab" onClick={() => set({ tab: t.id })} onKeyDown={(e) => onKey(e, i)}>
            {t.label}{t.id === 'inspecao' && selected ? <i className="tab__dot" aria-label="elemento selecionado" /> : null}
          </button>
        ))}
      </div>
      <div className="panel-body" role="tabpanel" id={`tabpanel-${tab}`} aria-labelledby={`tab-${tab}`} tabIndex={0}>
        {tab === 'camadas' && <LayersTab />}
        {tab === 'corte' && <SectionTab />}
        {tab === 'locais' && <PlacesTab />}
        {tab === 'inspecao' && <InspectTab />}
        {tab === 'planta' && <PlanTab />}
      </div>
      <footer className="panel-foot">Visualização arquitetônica. Elementos não documentados são estimativos.</footer>
    </aside>
  );
}

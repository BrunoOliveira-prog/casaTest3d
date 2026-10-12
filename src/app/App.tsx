import { useEffect } from 'react';
import { Viewer } from '../components/viewer/Viewer';
import { LabelsOverlay } from '../components/viewer/Labels';
import { TopBar } from '../components/interface/TopBar';
import { SidePanel } from '../components/interface/SidePanel';
import { Timeline } from '../components/interface/Timeline';
import { Help, InteriorHud, Legend, Notice, Toast } from '../components/interface/Overlays';
import { Plan2D } from '../components/interface/Plan2D';
import { useStore } from '../state/store';
import { MOBILE_BP, PANEL_W, TIMELINE_H } from '../utils/layout';

function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) {
        if (!(t.tagName === 'INPUT' && (t as HTMLInputElement).type === 'range' && e.key === ' ')) return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const st = useStore.getState();
      const interior = st.view === 'interior';
      switch (e.key) {
        case '1': st.setView('geral'); break;
        case '2': st.setView('planta'); break;
        case '3': st.setView('corte'); break;
        case '4': st.setView('instalacoes'); break;
        case '5': st.setView('interior'); break;
        case ' ': if (t && t.tagName === 'BUTTON') return; e.preventDefault(); st.togglePlay(); break;
        case 'x': case 'X': if (!interior) st.set({ xray: !st.xray }); break;
        case 'e': case 'E': if (!interior) st.setExplode(!st.explodeOn); break;
        case 'l': case 'L': st.set({ labels: !st.labels }); break;
        case 'c': case 'C': st.capture?.(); break;
        case '[': st.set({ panelOpen: !st.panelOpen }); break;
        case '?': st.set({ helpOpen: !st.helpOpen }); break;
        case 'ArrowRight': if (!interior) { st.setProgress(st.progress + 0.02); st.set({ playing: false }); } break;
        case 'ArrowLeft': if (!interior) { st.setProgress(st.progress - 0.02); st.set({ playing: false }); } break;
        case 'Escape':
          if (st.helpOpen) st.set({ helpOpen: false });
          else if (st.calib.active) st.set({ calib: { active: false, pts: [] } });
          else if (st.selected || st.selectedRoom) st.select(null);
          break;
        default: return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

export function App() {
  const failed = useStore((s) => s.webglFailed);
  const view = useStore((s) => s.view);
  useShortcuts();

  useEffect(() => {
    const r = document.documentElement.style;
    r.setProperty('--panel-w', `${PANEL_W}px`); r.setProperty('--timeline-h', `${TIMELINE_H}px`); r.setProperty('--mobile-bp', `${MOBILE_BP}px`);
  }, []);

  if (failed) {
    return (
      <div className="app">
        <Plan2D />
        <Notice /><Toast />
      </div>
    );
  }
  return (
    <div className="app" data-view={view}>
      <Viewer />
      <LabelsOverlay />
      <div id="hover-tip" className="hover-tip" data-show="0" aria-hidden="true" />
      <TopBar />
      <SidePanel />
      <Legend />
      <Timeline />
      <InteriorHud />
      <Notice />
      <Toast />
      <Help />
    </div>
  );
}

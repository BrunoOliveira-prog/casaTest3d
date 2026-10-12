import { useEffect, useRef } from 'react';
import { useStore } from '../../state/store';
import { layersFor } from '../../data/config';
import { fpInput } from '../../scene/cameras/fpState';
import { IClose, ITarget, IWalk } from './icons';

export function Legend() {
  const view = useStore((s) => s.view);
  const model = useStore((s) => s.model);
  const panelOpen = useStore((s) => s.panelOpen);
  if (view === 'interior') return null;
  const sys = layersFor(model).filter((l) => l.id.startsWith('sys:'));
  return (
    <aside className="legend" data-panel={panelOpen ? '1' : '0'} aria-label="Legenda">
      <div className="legend__group">
        <b>Certeza do dado</b>
        <span><i className="dot" data-kind="confirmado" />Confirmado pela planta</span>
        <span><i className="dot" data-kind="estimado" />Estimado</span>
        <span><i className="dot" data-kind="esquematico" />Esquemático</span>
      </div>
      {view === 'instalacoes' && (
        <div className="legend__group">
          <b>Instalações</b>
          {sys.map((l) => (<span key={l.id}><i className="dot" style={{ background: l.color }} />{l.name}</span>))}
        </div>
      )}
    </aside>
  );
}

export function Notice() {
  const seen = useStore((s) => s.noticeSeen);
  const set = useStore((s) => s.set);
  if (seen) return null;
  return (
    <div className="notice" role="status">
      <p><strong>Visualização arquitetônica.</strong> Elementos não documentados são estimativos.</p>
      <button type="button" className="btn btn--primary" onClick={() => set({ noticeSeen: true })}>Entendi</button>
    </div>
  );
}

export function Toast() {
  const toast = useStore((s) => s.toast);
  const set = useStore((s) => s.set);
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => set({ toast: null }), 4200);
    return () => window.clearTimeout(t);
  }, [toast, set]);
  return <div className="toast" data-show={toast ? '1' : '0'} role="status" aria-live="polite">{toast}</div>;
}

export function Help() {
  const open = useStore((s) => s.helpOpen);
  const set = useStore((s) => s.set);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (open) ref.current?.focus(); }, [open]);
  if (!open) return null;
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="help-title" onClick={() => set({ helpOpen: false })}>
      <div className="modal__box" ref={ref} tabIndex={-1} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === 'Escape') set({ helpOpen: false }); }}>
        <header><h2 id="help-title">Como explorar</h2><button type="button" className="icon-btn" aria-label="Fechar ajuda" onClick={() => set({ helpOpen: false })}><IClose /></button></header>
        <div className="modal__body">
          <h3>Mouse e toque</h3>
          <p>Arraste para girar, role (ou pince) para aproximar, botão direito (ou dois dedos) para deslocar. Clique em um elemento para ver os detalhes na aba Inspeção.</p>
          <h3>Atalhos</h3>
          <dl className="keys">
            <dt>1 – 5</dt><dd>Geral, Planta, Corte, Instalações, Interior</dd>
            <dt>Espaço</dt><dd>Reproduzir / pausar a construção</dd>
            <dt>← →</dt><dd>Recuar / avançar a linha do tempo (fora do modo interior)</dd>
            <dt>X</dt><dd>Raio-X</dd>
            <dt>E</dt><dd>Vista explodida</dd>
            <dt>L</dt><dd>Rótulos</dd>
            <dt>C</dt><dd>Salvar imagem PNG</dd>
            <dt>[</dt><dd>Mostrar / ocultar painel lateral</dd>
            <dt>W A S D</dt><dd>Caminhar no modo interior (Shift corre; setas giram)</dd>
            <dt>Esc</dt><dd>Sair do modo interior, soltar o mouse ou limpar seleção</dd>
            <dt>?</dt><dd>Esta ajuda</dd>
          </dl>
          <h3>Sobre os dados</h3>
          <p>A casa foi reconstruída a partir de uma planta, fachadas e uma ficha geradas por IA. Tudo que a planta não mostra (estrutura, instalações, alturas, mobiliário) é <strong>estimativo ou esquemático</strong> e está marcado como tal. Não use para execução de obra.</p>
        </div>
      </div>
    </div>
  );
}

/** HUD do modo interior + controles virtuais para toque. */
export function InteriorHud() {
  const view = useStore((s) => s.view);
  const locked = useStore((s) => s.pointerLocked);
  const setView = useStore((s) => s.setView);
  const joy = useRef<HTMLDivElement>(null);
  const look = useRef<HTMLDivElement>(null);
  const touch = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;

  useEffect(() => {
    if (view !== 'interior') return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !document.pointerLockElement) setView('geral'); };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); fpInput.moveX = 0; fpInput.moveY = 0; };
  }, [view, setView]);

  useEffect(() => {
    if (view !== 'interior') return;
    const el = joy.current, lk = look.current;
    if (!el || !lk) return;
    let jid = -1, lid = -1, lx = 0, ly = 0;
    const knob = el.firstElementChild as HTMLElement;
    const jmove = (e: PointerEvent) => {
      if (e.pointerId !== jid) return;
      const r = el.getBoundingClientRect();
      let dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2), dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
      const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; }
      fpInput.moveX = dx; fpInput.moveY = dy; fpInput.run = l > 0.95;
      knob.style.transform = `translate(${dx * 34}px, ${dy * 34}px)`;
      useStore.getState().set({});
    };
    const jdown = (e: PointerEvent) => { jid = e.pointerId; el.setPointerCapture(e.pointerId); jmove(e); };
    const jup = (e: PointerEvent) => { if (e.pointerId !== jid) return; jid = -1; fpInput.moveX = 0; fpInput.moveY = 0; fpInput.run = false; knob.style.transform = ''; };
    const ldown = (e: PointerEvent) => { lid = e.pointerId; lx = e.clientX; ly = e.clientY; lk.setPointerCapture(e.pointerId); };
    const lmove = (e: PointerEvent) => {
      if (e.pointerId !== lid) return;
      fpInput.lookDX += e.clientX - lx; fpInput.lookDY += e.clientY - ly; lx = e.clientX; ly = e.clientY;
      useStore.getState().set({});
    };
    const lup = (e: PointerEvent) => { if (e.pointerId === lid) lid = -1; };
    el.addEventListener('pointerdown', jdown); el.addEventListener('pointermove', jmove); el.addEventListener('pointerup', jup); el.addEventListener('pointercancel', jup);
    lk.addEventListener('pointerdown', ldown); lk.addEventListener('pointermove', lmove); lk.addEventListener('pointerup', lup); lk.addEventListener('pointercancel', lup);
    return () => {
      el.removeEventListener('pointerdown', jdown); el.removeEventListener('pointermove', jmove); el.removeEventListener('pointerup', jup); el.removeEventListener('pointercancel', jup);
      lk.removeEventListener('pointerdown', ldown); lk.removeEventListener('pointermove', lmove); lk.removeEventListener('pointerup', lup); lk.removeEventListener('pointercancel', lup);
    };
  }, [view]);

  if (view !== 'interior') return null;
  const requestLock = () => {
    const c = document.querySelector('.viewer canvas') as HTMLCanvasElement | null;
    try { c?.requestPointerLock(); } catch { /* navegador sem suporte: segue com arrastar */ }
  };
  return (
    <>
      <div className="fp-hud" role="region" aria-label="Modo interior">
        <p><IWalk /> <strong>Modo interior.</strong> {touch ? 'Use o joystick para andar e arraste à direita para olhar.' : 'WASD ou setas para andar, Shift para correr, arraste para olhar.'}</p>
        <div className="btns">
          {!touch && <button type="button" className="btn" onClick={requestLock} aria-pressed={locked}><ITarget />{locked ? 'Mouse capturado (Esc solta)' : 'Capturar mouse'}</button>}
          <button type="button" className="btn btn--primary" onClick={() => setView('geral')}>Voltar à vista externa (Esc)</button>
        </div>
      </div>
      <div className="fp-touch" data-touch={touch ? '1' : '0'}>
        <div className="joy" ref={joy} aria-label="Joystick para caminhar" role="group"><div className="joy__knob" /></div>
        <div className="lookpad" ref={look} aria-label="Área para olhar ao redor" role="group"><span>olhar</span></div>
      </div>
    </>
  );
}

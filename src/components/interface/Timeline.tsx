import { useStore } from '../../state/store';
import { STAGES, STAGE_SPAN, SEQUENCE_SECONDS, stageOfProgress } from '../../data/config';
import { IPause, IPlay, IRestart } from './icons';

const SPEEDS = [0.5, 1, 2, 4];

export function Timeline() {
  const progress = useStore((s) => s.progress);
  const playing = useStore((s) => s.playing);
  const speed = useStore((s) => s.speed);
  const panelOpen = useStore((s) => s.panelOpen);
  const setProgress = useStore((s) => s.setProgress);
  const togglePlay = useStore((s) => s.togglePlay);
  const restart = useStore((s) => s.restart);
  const set = useStore((s) => s.set);
  const idx = stageOfProgress(progress);
  const stage = STAGES[idx];
  const done = progress >= 0.999;

  return (
    <section className="timeline" data-panel={panelOpen ? '1' : '0'} aria-label="Linha do tempo da construção">
      <div className="timeline__top">
        <div className="timeline__btns">
          <button type="button" className="icon-btn icon-btn--dark" aria-label={playing ? 'Pausar' : 'Reproduzir'} title={`${playing ? 'Pausar' : 'Reproduzir'} (espaço)`} onClick={togglePlay}>{playing ? <IPause /> : <IPlay />}</button>
          <button type="button" className="icon-btn" aria-label="Reiniciar do começo" title="Reiniciar do começo" onClick={restart}><IRestart /></button>
          <label className="speed">
            <span className="sr-only">Velocidade</span>
            <select value={speed} aria-label="Velocidade da reprodução" onChange={(e) => set({ speed: parseFloat(e.target.value) })}>
              {SPEEDS.map((s) => <option key={s} value={s}>{s}×</option>)}
            </select>
          </label>
        </div>
        <ol className="stages">
          {STAGES.map((s, i) => (
            <li key={s.id}>
              <button type="button" className="stage" aria-current={idx === i && !done ? 'step' : undefined} data-done={progress >= (i + 1) * STAGE_SPAN - 1e-6 ? '1' : '0'} title={`Ir para o fim da etapa ${s.n}: ${s.name}`}
                onClick={() => set({ progress: Math.min(1, (i + 1) * STAGE_SPAN), playing: false })}>
                <b>{s.n}</b><span>{s.short}</span>
              </button>
            </li>
          ))}
        </ol>
        <div className="timeline__pct" aria-live="off">{Math.round(progress * 100)}%</div>
      </div>
      <input type="range" className="timeline__range" min={0} max={1000} step={1} value={Math.round(progress * 1000)}
        aria-label="Progresso da construção" aria-valuetext={`${Math.round(progress * 100)}% — ${stage.name}`}
        onChange={(e) => set({ progress: parseInt(e.target.value, 10) / 1000, playing: false })} />
      <p className="timeline__desc"><strong>{done ? 'Obra concluída.' : `Etapa ${stage.n} — ${stage.name}.`}</strong> {stage.description} <span className="muted">Duração total: {SEQUENCE_SECONDS} s.</span></p>
    </section>
  );
}

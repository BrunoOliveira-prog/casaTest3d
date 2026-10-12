import { useStore } from '../../../state/store';
import { MATERIAL_LABEL, SRC_LABEL, STAGES } from '../../../data/config';
import { Badge } from '../primitives';
import { fmtArea, fmtM } from '../../../utils/format';
import { ITarget } from '../icons';

const KIND_LABEL: Record<string, string> = {
  parede: 'Parede de alvenaria', door: 'Porta', window: 'Janela', slider: 'Porta de correr (vidro)', telhado: 'Cobertura', calha: 'Calha e prumada', claraboia: 'Claraboia', duto: 'Duto / chaminé',
  fundacao: 'Fundação', pilar: 'Pilar', cinta: 'Cinta de amarração', caibro: 'Caibros', instalacao: 'Instalação', dispositivo: 'Equipamento', mobiliario: 'Mobiliário', luminaria: 'Luminária',
  revestimento: 'Revestimento em madeira', piso: 'Piso', terreno: 'Terreno', 'piso externo': 'Piso externo', 'vegetação': 'Paisagismo',
};

export function InspectTab() {
  const selected = useStore((s) => s.selected);
  const selectedRoom = useStore((s) => s.selectedRoom);
  const rig = useStore((s) => s.rig);
  const select = useStore((s) => s.select);
  const focus = useStore((s) => s.focus);
  const focusRoom = useStore((s) => s.focusRoom);

  if (selectedRoom && rig) {
    const r = rig.derived.roomById.get(selectedRoom);
    if (r) {
      return (
        <div className="stack">
          <div className="card">
            <h2 className="card__title">{r.name}</h2>
            <p className="card__sub">Ambiente · {rig.derived.levelName}</p>
            <dl className="dl">
              <dt>Área calculada</dt><dd>{fmtArea(r.area)}</dd>
              <dt>Medida nominal</dt><dd>{r.nominal[1] ? `${fmtM(r.nominal[0])} × ${fmtM(r.nominal[1])} m` : `${fmtM(r.nominal[0])} m (largura)`} <small>(ficha)</small></dd>
              <dt>Piso</dt><dd>{MATERIAL_LABEL[r.floor] ?? r.floor}</dd>
              <dt>Fonte</dt><dd><Badge kind={r.src} /> <small>{SRC_LABEL[r.src]}</small></dd>
              <dt>Origem da área</dt><dd>{r.areaSource}</dd>
            </dl>
            {r.note ? <p className="note">{r.note}</p> : null}
            <div className="btns"><button type="button" className="btn" onClick={() => focusRoom(r.id)}><ITarget />Enquadrar</button></div>
          </div>
        </div>
      );
    }
  }
  const e = selected && rig ? rig.byId.get(selected) : null;
  if (!e) {
    return (
      <div className="empty">
        <p><strong>Nada selecionado.</strong></p>
        <p>Clique em qualquer elemento da casa (parede, janela, móvel, tubulação…) ou escolha um item na aba Locais para ver nome, dimensões, material, etapa e grau de certeza.</p>
      </div>
    );
  }
  const m = e.meta;
  return (
    <div className="stack">
      <div className="card">
        <h2 className="card__title">{m.name}</h2>
        <p className="card__sub">{KIND_LABEL[m.kind] ?? m.kind}</p>
        <dl className="dl">
          <dt>Ambiente</dt><dd>{m.room ?? '—'}</dd>
          <dt>Nível</dt><dd>{m.level}</dd>
          <dt>Dimensões</dt><dd>{m.dims || '—'}</dd>
          <dt>Material</dt><dd>{m.material || '—'}</dd>
          <dt>Etapa</dt><dd>{STAGES[m.stageIdx].n}. {STAGES[m.stageIdx].name}</dd>
          <dt>Fonte</dt><dd><Badge kind={m.src} /> <small>{SRC_LABEL[m.src]}</small></dd>
        </dl>
        {m.note ? <p className="note">{m.note}</p> : null}
        <div className="btns">
          <button type="button" className="btn" onClick={() => focus(m.id)}><ITarget />Enquadrar</button>
          <button type="button" className="btn" onClick={() => select(null)}>Limpar seleção</button>
        </div>
        <p className="id">ID: {m.id}</p>
      </div>
    </div>
  );
}

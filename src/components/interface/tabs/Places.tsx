import { useMemo, useState } from 'react';
import { useStore } from '../../../state/store';
import { fmtArea } from '../../../utils/format';
import { ISearch } from '../icons';

const KIND_GROUPS: { id: string; label: string; kinds: string[] }[] = [
  { id: 'arq', label: 'Paredes', kinds: ['parede'] },
  { id: 'esq', label: 'Portas e janelas', kinds: ['door', 'window', 'slider'] },
  { id: 'cob', label: 'Cobertura', kinds: ['telhado', 'calha', 'claraboia', 'duto'] },
  { id: 'est', label: 'Fundação e estrutura', kinds: ['fundacao', 'pilar', 'cinta', 'caibro'] },
  { id: 'ins', label: 'Instalações', kinds: ['instalacao', 'dispositivo'] },
  { id: 'mob', label: 'Mobiliário e luminárias', kinds: ['mobiliario', 'luminaria'] },
  { id: 'aca', label: 'Revestimentos e pisos', kinds: ['revestimento', 'piso'] },
  { id: 'ent', label: 'Entorno', kinds: ['terreno', 'piso externo', 'vegetação'] },
];

export function PlacesTab() {
  const rig = useStore((s) => s.rig);
  const selected = useStore((s) => s.selected);
  const selectedRoom = useStore((s) => s.selectedRoom);
  const focus = useStore((s) => s.focus);
  const focusRoom = useStore((s) => s.focusRoom);
  const [q, setQ] = useState('');
  const norm = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const nq = norm(q.trim());

  const rooms = useMemo(() => (rig?.derived.rooms ?? []).filter((r) => !nq || norm(r.name).includes(nq)), [rig, nq]);
  const groups = useMemo(() => {
    const els = rig?.elems ?? [];
    return KIND_GROUPS.map((g) => ({
      ...g,
      items: els.filter((e) => g.kinds.includes(e.meta.kind) && (!nq || norm(e.meta.name).includes(nq) || norm(e.meta.room ?? '').includes(nq))),
    })).filter((g) => g.items.length);
  }, [rig, nq]);

  return (
    <div className="stack">
      <div className="search">
        <ISearch />
        <input type="search" placeholder="Buscar ambiente ou elemento…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar ambientes e elementos" />
      </div>
      <section>
        <h2 className="h">Ambientes ({rooms.length})</h2>
        <ul className="list list--btn">
          {rooms.map((r) => (
            <li key={r.id}>
              <button type="button" className="item" aria-current={selectedRoom === r.id} onClick={() => focusRoom(r.id)}>
                <span>{r.name}</span><small>{fmtArea(r.area)}</small>
              </button>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="h">Elementos</h2>
        {groups.map((g) => (
          <details key={g.id} className="acc" open={!!nq}>
            <summary>{g.label}<small>{g.items.length}</small></summary>
            <ul className="list list--btn">
              {g.items.slice(0, 200).map((e) => (
                <li key={e.meta.id}>
                  <button type="button" className="item" aria-current={selected === e.meta.id} disabled={!e.shown} title={e.shown ? undefined : 'Ainda não aparece nesta etapa/camada'} onClick={() => focus(e.meta.id)}>
                    <span>{e.meta.name}</span><small>{e.meta.room ?? ''}</small>
                  </button>
                </li>
              ))}
            </ul>
          </details>
        ))}
        {!groups.length && <p className="note">Nenhum elemento encontrado.</p>}
      </section>
    </div>
  );
}

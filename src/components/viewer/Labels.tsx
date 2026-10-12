import { memo, useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '../../state/store';
import { EXPLODE_OFFSETS, layersFor, stageWindow } from '../../data/config';
import { modeAllows, easeInOut } from '../../scene/animation/apply';
import { pickables } from './Picking';
import { fmtArea } from '../../utils/format';

const registry = new Map<string, HTMLElement>();
const ref = (id: string) => (el: HTMLElement | null) => { if (el) registry.set(id, el); else registry.delete(id); };

/** Camada DOM dos rótulos ancorados (posicionados por `LabelsDriver` a cada quadro, sem re-render do React). */
export const LabelsOverlay = memo(function LabelsOverlay() {
  const model = useStore((s) => s.model);
  const anns = model.annotations;
  const rooms = model.rooms;
  return (
    <div className="labels" aria-hidden="true">
      {anns.map((a) => (
        <div key={a.id} ref={ref(a.id)} className="label" data-kind="ann" data-hidden="1">
          <span className="label__dot" /><span className="label__text">{a.text}</span>
        </div>
      ))}
      {rooms.map((r) => (
        <div key={`room:${r.id}`} ref={ref(`room:${r.id}`)} className="label label--room" data-kind="room" data-hidden="1">
          <span className="label__text">{r.name}</span>
        </div>
      ))}
    </div>
  );
});

export function LabelsDriver() {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const ray = useMemo(() => new THREE.Raycaster(), []);
  const v = useMemo(() => new THREE.Vector3(), []);
  const dir = useMemo(() => new THREE.Vector3(), []);
  const occ = useMemo(() => new Map<string, boolean>(), []);
  let frame = 0;

  useEffect(() => () => { registry.forEach((el) => { el.dataset.hidden = '1'; }); }, []);

  useFrame(() => {
    const st = useStore.getState();
    const rig = st.rig;
    if (!rig) return;
    frame++;
    const lay = layersFor(st.model);
    const layMeta = new Map(lay.map((l) => [l.id, l]));
    const ex = easeInOut(st.explodeOn ? st.explodeAmount : 0);
    const doOcc = frame % 6 === 0;
    let list: THREE.Object3D[] | null = null;
    const xr = st.xray || st.view === 'instalacoes';

    const place = (id: string, pos: THREE.Vector3, visibleRule: boolean, checkOcc: boolean) => {
      const el = registry.get(id);
      if (!el) return;
      let show = visibleRule && st.labels && st.view !== 'interior';
      if (show) {
        v.copy(pos).project(camera);
        if (v.z > 1 || v.z < -1 || Math.abs(v.x) > 1.05 || Math.abs(v.y) > 1.05) show = false;
        else {
          const x = (v.x * 0.5 + 0.5) * size.width, y = (-v.y * 0.5 + 0.5) * size.height;
          el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
        }
      }
      if (show && checkOcc && !xr) {
        if (doOcc || !occ.has(id)) {
          if (!list) list = pickables();
          dir.copy(pos).sub(camera.position);
          const dist = dir.length();
          ray.set(camera.position, dir.normalize());
          ray.far = Math.max(0, dist - 0.2);
          const hit = ray.intersectObjects(list, false).length > 0;
          occ.set(id, hit);
        }
        if (occ.get(id)) show = false;
      }
      el.dataset.hidden = show ? '0' : '1';
    };

    const annOk = st.view === 'geral' || st.view === 'corte' || st.view === 'instalacoes';
    for (const a of st.model.annotations) {
      const meta = layMeta.get(a.layer);
      const [w0, w1] = stageWindow(a.stage);
      const reached = st.progress >= w0 + (w1 - w0) * 0.55;
      const layerOn = st.layers[a.layer] !== false;
      const modeOk = modeAllows(st.view, a.layer, !!meta?.embedded);
      let elemOk = true;
      if (a.element) { const e = rig.byId.get(a.element); elemOk = !!e && e.shown; }
      const off = EXPLODE_OFFSETS[meta?.explodeGroup ?? 'alvenaria'] ?? [0, 0, 0];
      pos3(v2, a.at[0] + off[0] * ex, a.at[1] + off[1] * ex, a.at[2] + off[2] * ex);
      place(a.id, v2, annOk && reached && layerOn && modeOk && elemOk, true);
    }
    const roomOk = st.view === 'planta';
    for (const r of st.model.rooms) {
      pos3(v2, r.spot[0], 0.12, r.spot[1]);
      const dr = rig.derived.roomById.get(r.id);
      if (dr) pos3(v2, dr.centroid[0], 0.12, dr.centroid[1]);
      const el = registry.get(`room:${r.id}`);
      if (el && dr) { const t = el.querySelector('.label__text'); const txt = `${r.name} · ${fmtArea(dr.area)}`; if (t && t.textContent !== txt) t.textContent = txt; }
      place(`room:${r.id}`, v2, roomOk && st.layers.pisos !== false, false);
    }
  });
  return null;
}

const v2 = new THREE.Vector3();
function pos3(t: THREE.Vector3, x: number, y: number, z: number) { t.set(x, y, z); }

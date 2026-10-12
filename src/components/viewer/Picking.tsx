import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '../../state/store';
import { SECTION } from '../../scene/sectionPlane';

export const pointer = { x: 0, y: 0 };

/** Meshes realmente visíveis (camada AND linha do tempo AND modo) — o raycast do three ignora `visible`. */
export function pickables(): THREE.Object3D[] {
  const rig = useStore.getState().rig;
  if (!rig) return [];
  const out: THREE.Object3D[] = [];
  for (const e of rig.elems) {
    if (!e.shown || !e.obj.visible) continue;
    for (const m of e.meshes) out.push(m);
  }
  return out;
}

export function Picking() {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  const ray = useMemo(() => new THREE.Raycaster(), []);
  const ndc = useMemo(() => new THREE.Vector2(), []);
  const ground = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), []);

  useEffect(() => {
    const el = gl.domElement;
    let down: { x: number; y: number; t: number } | null = null;
    let raf = 0;
    let pending: { x: number; y: number } | null = null;

    const hitAt = (cx: number, cy: number) => {
      const r = el.getBoundingClientRect();
      ndc.set(((cx - r.left) / r.width) * 2 - 1, -(((cy - r.top) / r.height) * 2 - 1));
      ray.setFromCamera(ndc, camera);
      const st = useStore.getState();
      const hits = ray.intersectObjects(pickables(), false);
      for (const h of hits) {
        if (st.sectionOn && SECTION.distanceToPoint(h.point) < -0.004) continue; // dentro da região cortada
        const id = h.object.userData.elemId as string | undefined;
        if (id) return id;
      }
      return null;
    };

    const tip = () => document.getElementById('hover-tip');
    const updateHover = () => {
      raf = 0;
      if (!pending) return;
      const st = useStore.getState();
      if (st.view === 'interior' && st.pointerLocked) { pending = null; return; }
      const id = hitAt(pending.x, pending.y);
      const t = tip();
      if (id !== st.hover) useStore.setState({ hover: id });
      if (t) {
        if (id) {
          const e = st.rig?.byId.get(id);
          t.textContent = e?.meta.name ?? id;
          t.style.transform = `translate(${pending.x + 14}px, ${pending.y + 16}px)`;
          t.dataset.show = '1';
        } else t.dataset.show = '0';
      }
      el.style.cursor = st.calib.active ? 'crosshair' : id ? 'pointer' : '';
      pending = null;
    };
    const onMove = (e: PointerEvent) => {
      pointer.x = e.clientX; pointer.y = e.clientY;
      if (e.pointerType === 'touch' || (e.buttons & 1)) return;
      pending = { x: e.clientX, y: e.clientY };
      if (!raf) raf = requestAnimationFrame(updateHover);
    };
    const onDown = (e: PointerEvent) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; };
    const onUp = (e: PointerEvent) => {
      if (!down) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      const dur = performance.now() - down.t;
      down = null;
      if (moved > 5 || dur > 700 || (e.pointerType === 'mouse' && e.button !== 0)) return;
      const st = useStore.getState();
      if (st.view === 'interior' && st.pointerLocked) return;
      // calibração por distância conhecida: dois pontos no piso
      if (st.calib.active && st.view === 'planta') {
        const r = el.getBoundingClientRect();
        ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1));
        ray.setFromCamera(ndc, camera);
        const p = new THREE.Vector3();
        if (ray.ray.intersectPlane(ground, p)) {
          const pts = st.calib.pts.length >= 2 ? [] : [...st.calib.pts];
          pts.push([p.x, p.z]);
          useStore.setState({ calib: { active: true, pts } });
        }
        return;
      }
      const id = hitAt(e.clientX, e.clientY);
      useStore.getState().select(id);
      if (!id) useStore.setState({ selected: null });
      invalidate();
    };
    const onLeave = () => {
      useStore.setState({ hover: null });
      const t = tip(); if (t) t.dataset.show = '0';
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointerleave', onLeave);
    return () => {
      el.removeEventListener('pointermove', onMove); el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointerup', onUp); el.removeEventListener('pointerleave', onLeave);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [gl, camera, invalidate, ray, ndc, ground]);
  return null;
}

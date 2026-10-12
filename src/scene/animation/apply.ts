import * as THREE from 'three';
import type { Rig, Elem } from '../build/rig';
import { edgeMat } from '../build/rig';
import { EXPLODE_OFFSETS, layersFor, localProgress } from '../../data/config';
import type { ViewMode } from '../../state/store';

export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

export interface ApplyState {
  progress: number;
  layers: Record<string, boolean>;
  view: ViewMode;
  xray: boolean;
  explode: number;       // 0..1 (já suavizado)
  guides: boolean;
  flow: boolean;
  reduceMotion: boolean;
}

/** Regras de visibilidade por modo (terceiro fator da precedência: camada AND linha do tempo AND modo). */
export function modeAllows(view: ViewMode, layerId: string, embedded: boolean): boolean {
  switch (view) {
    case 'planta': return layerId !== 'cobertura' && !embedded;
    case 'instalacoes': return layerId !== 'cobertura' && layerId !== 'mobiliario';
    case 'interior': return !embedded;
    default: return true;
  }
}

/** Revelação de um elemento no progresso p (0..1): retorna r de 0..1. */
export function revealOf(e: Elem, p: number): number {
  return localProgress(e.anim.stage, e.anim.a, e.anim.b, p);
}

const layCache = new WeakMap<object, Map<string, ReturnType<typeof layersFor>[number]>>();
function layMetaFor(rig: Rig) {
  let m = layCache.get(rig);
  if (!m) { m = new Map(layersFor(rig.derived.model).map((l) => [l.id, l])); layCache.set(rig, m); }
  return m;
}

export function isEffectivelyVisible(e: Elem) { return e.obj.visible && e.r > 0; }

const baseY = new WeakMap<Elem, number>();

/**
 * Aplica o estado ao grafo de cena de forma determinística: o resultado depende somente de `s`
 * (nenhum valor é acumulado entre chamadas), o que torna a linha do tempo reversível.
 */
export function applyState(rig: Rig, s: ApplyState) {
  const layMeta = layMetaFor(rig);
  const xrayEff = s.xray || s.view === 'instalacoes';

  for (const e of rig.elems) {
    const meta = layMeta.get(e.layer);
    const layerOn = s.layers[e.layer] !== false;
    const modeOk = modeAllows(s.view, e.layer, !!meta?.embedded) && !(s.view === 'planta' && e.meta.kind === 'vegetação');
    const r = revealOf(e, s.progress);
    e.r = r;
    const vis = layerOn && modeOk && r > 0;
    e.shown = vis;
    e.obj.visible = vis;
    if (!vis) {
      // estado canônico para elementos ocultos: nada fica "preso" de um quadro anterior
      e.obj.scale.y = 1; e.obj.position.y = 0;
      if (e.draw) for (const d of e.draw) d.mesh.geometry.setDrawRange(0, 0);
      if (e.finish) { e.finish.visible = false; e.finish.scale.y = 1; e.rFinish = 0; }
      for (const ls of e.edges) ls.visible = false;
      continue;
    }

    const k = s.reduceMotion ? (r >= 1 ? 1 : r > 0 ? 1 : 0) : easeInOut(r);
    let by = baseY.get(e);
    if (by === undefined) { by = e.center.y - e.size.y / 2; baseY.set(e, by); }
    e.obj.scale.y = 1;
    e.obj.position.y = 0;
    switch (e.anim.style) {
      case 'rise': {
        const sc = Math.max(0.001, k);
        e.obj.scale.y = sc;
        e.obj.position.y = by * (1 - sc);
        break;
      }
      case 'drop':
        e.obj.position.y = e.anim.drop * (1 - k);
        break;
      case 'draw':
        if (e.draw) for (const d of e.draw) {
          const step = 48;
          const cnt = Math.max(step, Math.floor((easeOut(r) * d.total) / step) * step);
          d.mesh.geometry.setDrawRange(0, Math.min(d.total, cnt));
        }
        break;
      default: break;
    }
    // reboco: sobe do piso até o topo (por parede)
    if (e.finish && e.finishAnim) {
      const rf = localProgress(e.finishAnim.stage, e.finishAnim.a, e.finishAnim.b, s.progress);
      e.rFinish = rf;
      e.finish.visible = rf > 0;
      e.finish.scale.y = Math.max(0.001, s.reduceMotion ? 1 : easeInOut(rf));
    }
    // arestas apenas no raio-X
    for (const ls of e.edges) ls.visible = xrayEff;
  }

  // explosão por grupos
  for (const [id, g] of rig.explode) {
    const off = EXPLODE_OFFSETS[id] ?? [0, 0, 0];
    g.position.set(off[0] * s.explode, off[1] * s.explode, off[2] * s.explode);
  }
  rig.guides.visible = s.guides && s.explode > 0.02;
  if (rig.guides.visible) updateGuides(rig, s.explode);

  // fluxo
  for (const f of rig.flow) {
    const e = rig.byId.get(f.elemId);
    f.mesh.visible = s.flow && !!e && e.obj.visible && e.r >= 0.999 && !s.reduceMotion;
  }
  void edgeMat;
}

function updateGuides(rig: Rig, k: number) {
  const pos = rig.guides.geometry.attributes.position as THREE.BufferAttribute;
  let i = 0;
  for (const [id] of rig.explode) {
    const off = EXPLODE_OFFSETS[id] ?? [0, 0, 0];
    const y0 = rig.explodeBase.get(id) ?? 0;
    for (const [x, z] of rig.corners) {
      pos.setXYZ(i++, x, y0, z);
      pos.setXYZ(i++, x, y0 + off[1] * k, z);
    }
  }
  pos.needsUpdate = true;
  rig.guides.computeLineDistances();
}

/** Atualiza posição das partículas de fluxo (tempo em segundos). */
export function updateFlow(rig: Rig, t: number) {
  const dummy = new THREE.Object3D();
  const v = new THREE.Vector3();
  for (const f of rig.flow) {
    if (!f.mesh.visible) continue;
    const rr = f.mesh.userData.rr ?? 1;
    for (let i = 0; i < f.n; i++) {
      const u = (((t * f.speed) / Math.max(1, f.curve.getLength() * 0.5) + f.seed + i / f.n) % 1 + 1) % 1;
      f.curve.getPointAt(u, v);
      dummy.position.copy(v);
      dummy.scale.setScalar(f.mesh.userData.rr ?? 0.02);
      dummy.updateMatrix();
      f.mesh.setMatrixAt(i, dummy.matrix);
    }
    f.mesh.instanceMatrix.needsUpdate = true;
    void rr;
  }
}

/** Atualiza o plano de corte a partir dos limites da casa. */
export function sectionPlane(plane: THREE.Plane, rig: Rig, axis: 'x' | 'y' | 'z', t: number, flip: boolean) {
  const b = rig.derived.bbox;
  const i = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
  const lo = b.min[i] - (axis === 'y' ? 0.0 : 0.5), hi = b.max[i] + (axis === 'y' ? 0.2 : 0.5);
  const pos = lo + (hi - lo) * t;
  const n = new THREE.Vector3(0, 0, 0);
  n.setComponent(i, flip ? 1 : -1);
  plane.normal.copy(n);
  plane.constant = flip ? -pos : pos;
  return pos;
}

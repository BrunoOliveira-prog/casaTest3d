import * as THREE from 'three';
import type { Derived } from '../../data/house/derive';
import type { Axis, ViewMode } from '../../state/store';
import type { Insets } from '../../utils/layout';

export const FOV = 38;
export const FP_FOV = 72;

export interface Pose {
  kind: 'persp' | 'ortho';
  pos: THREE.Vector3; target: THREE.Vector3; zoom: number;
}

export function availableSize(w: number, h: number, ins: Insets) {
  return { w: Math.max(200, w - ins.left - ins.right), h: Math.max(200, h - ins.top - ins.bottom) };
}

function dirFrom(azDeg: number, elDeg: number) {
  const az = (azDeg * Math.PI) / 180, el = (elDeg * Math.PI) / 180;
  return new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
}

/** distância para enquadrar uma esfera de raio R na área disponível */
export function fitDistance(R: number, w: number, h: number, fov = FOV) {
  const f = (fov * Math.PI) / 180;
  const aspect = w / h;
  const hf = 2 * Math.atan(Math.tan(f / 2) * aspect);
  return (R / Math.sin(Math.min(f, hf) / 2)) * 1.02;
}

export function houseCenter(d: Derived) {
  const b = d.bbox;
  return new THREE.Vector3(b.center[0], 1.5, b.center[2]);
}

export function sectionTarget(d: Derived, axis: Axis, t: number) {
  const b = d.bbox;
  const c = houseCenter(d);
  const i = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
  const lo = b.min[i], hi = b.max[i];
  const pos = lo + (hi - lo) * t;
  if (axis === 'x') c.x = pos; else if (axis === 'z') c.z = pos; else c.y = pos;
  return c;
}

export function viewPose(view: ViewMode, d: Derived, size: { w: number; h: number }, opt: { axis: Axis; flip: boolean; t: number; explode?: number }): Pose {
  const b = d.bbox;
  const c = houseCenter(d);
  const ex = opt.explode ?? 0;
  // com a vista explodida, o conjunto fica ~24 m mais alto: sobe o alvo e amplia o enquadramento
  c.y += ex * 6.2;
  const R = Math.hypot(b.size[0] * 0.5, b.size[2] * 0.5, 2.6 + ex * 12.5) * 1.0;
  switch (view) {
    case 'planta': {
      const zoom = Math.min(size.w / (b.size[0] + 3.2), size.h / (b.size[2] + 3.2));
      return { kind: 'ortho', pos: new THREE.Vector3(c.x, 60, c.z), target: new THREE.Vector3(c.x, 0, c.z), zoom };
    }
    case 'corte': {
      const dist = fitDistance(R * 0.95, size.w, size.h);
      const tgt = c.clone();
      let dir: THREE.Vector3;
      if (opt.axis === 'z') dir = dirFrom(opt.flip ? 200 : 22, 20);
      else if (opt.axis === 'x') dir = dirFrom(opt.flip ? -68 : 112, 20);
      else dir = dirFrom(28, 48);
      return { kind: 'persp', pos: tgt.clone().add(dir.multiplyScalar(dist)), target: tgt, zoom: 1 };
    }
    case 'instalacoes': {
      const dist = fitDistance(R * 0.95, size.w, size.h);
      return { kind: 'persp', pos: c.clone().add(dirFrom(24, 42).multiplyScalar(dist)), target: c.clone(), zoom: 1 };
    }
    default: {
      const dist = fitDistance(R * 0.98, size.w, size.h);
      const tgt = c.clone(); tgt.y = 1.3;
      return { kind: 'persp', pos: tgt.clone().add(dirFrom(30, 24).multiplyScalar(dist)), target: tgt, zoom: 1 };
    }
  }
}

export function easeCam(t: number) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

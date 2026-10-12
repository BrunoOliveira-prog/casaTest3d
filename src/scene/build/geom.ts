import * as THREE from 'three';
import type { DWall, ProfilePt } from '../../data/house/derive';
import { interp } from '../../data/house/derive';
import type { V2 } from '../../data/house/types';

/** Aplica o referencial local da parede: x = ao longo, y = altura, z = normal. */
export function applyWallFrame(obj: THREE.Object3D, w: DWall) {
  obj.position.set(w.a[0], 0, w.a[1]);
  obj.rotation.set(0, Math.atan2(-w.dz, w.dx), 0);
}

/** Forma (s, y) de um trecho de parede. Mantém vãos reais (portas = recortes até o piso; janelas = furos). */
export interface WallShapeOpts {
  from?: number; to?: number; y0?: number; topOffset?: number; openings?: boolean;
}
export function buildWallShape(w: DWall, o: WallShapeOpts = {}): THREE.Shape | null {
  const from = Math.max(o.from ?? w.s0, w.s0), to = Math.min(o.to ?? w.s1, w.s1);
  const y0 = o.y0 ?? 0, off = o.topOffset ?? 0;
  if (to - from < 0.05) return null;
  // contorno superior
  const up: [number, number][] = [];
  const prof = w.profile;
  for (let i = 0; i + 1 < prof.length; i += 2) {
    const a = prof[i], b = prof[i + 1];
    const sa = Math.max(a.s, from), sb = Math.min(b.s, to);
    if (sb - sa < 1e-4) continue;
    const ha = interp([a, b], sa) - off, hb = interp([a, b], sb) - off;
    up.push([sa, Math.max(ha, y0 + 0.05)], [sb, Math.max(hb, y0 + 0.05)]);
  }
  if (!up.length) return null;
  // contorno inferior com recortes de portas
  const pts: [number, number][] = [[from, y0]];
  if (o.openings !== false) {
    const notches = w.dopenings.filter((n) => n.notch && n.head > y0 + 0.02 && n.s1 > from && n.s0 < to).sort((p, q) => p.s0 - q.s0);
    for (const n of notches) {
      const a = Math.max(n.s0, from + 0.001), b = Math.min(n.s1, to - 0.001);
      pts.push([a, y0], [a, n.head], [b, n.head], [b, y0]);
    }
  }
  pts.push([to, y0]);
  for (let i = up.length - 1; i >= 0; i--) pts.push(up[i]);
  const clean: [number, number][] = [];
  for (const p of pts) {
    const q = clean[clean.length - 1];
    if (!q || Math.abs(q[0] - p[0]) > 1e-5 || Math.abs(q[1] - p[1]) > 1e-5) clean.push(p);
  }
  if (clean.length > 1) {
    const f = clean[0], l = clean[clean.length - 1];
    if (Math.abs(f[0] - l[0]) < 1e-5 && Math.abs(f[1] - l[1]) < 1e-5) clean.pop();
  }
  const shape = new THREE.Shape();
  shape.moveTo(clean[0][0], clean[0][1]);
  for (let i = 1; i < clean.length; i++) shape.lineTo(clean[i][0], clean[i][1]);
  shape.closePath();
  if (o.openings !== false) {
    for (const n of w.dopenings) {
      if (n.notch) continue;
      if (n.s0 < from + 0.01 || n.s1 > to - 0.01 || n.sill <= y0 + 0.02) continue;
      const hole = new THREE.Path();
      hole.moveTo(n.s0, n.sill); hole.lineTo(n.s1, n.sill); hole.lineTo(n.s1, n.head); hole.lineTo(n.s0, n.head); hole.closePath();
      shape.holes.push(hole);
    }
  }
  return shape;
}

export function extrudeShape(shape: THREE.Shape, depth: number, centerZ = 0): THREE.BufferGeometry {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, steps: 1 });
  g.translate(0, 0, -depth / 2 + centerZ);
  return g;
}

export function polyShape(poly: V2[], holes: V2[][] = []): THREE.Shape {
  const s = new THREE.Shape();
  poly.forEach(([x, z], i) => (i === 0 ? s.moveTo(x, -z) : s.lineTo(x, -z)));
  s.closePath();
  for (const h of holes) {
    const p = new THREE.Path();
    h.forEach(([x, z], i) => (i === 0 ? p.moveTo(x, -z) : p.lineTo(x, -z)));
    p.closePath();
    s.holes.push(p);
  }
  return s;
}

/** Laje horizontal: y de `y` a `y + thick`, coordenadas de mundo. */
export function flatSlab(poly: V2[], holes: V2[][], y: number, thick: number): THREE.BufferGeometry {
  const g = new THREE.ExtrudeGeometry(polyShape(poly, holes), { depth: thick, bevelEnabled: false });
  g.rotateX(-Math.PI / 2);
  g.translate(0, y, 0);
  return g;
}

/** Caixa entre dois pontos 3D (mundo). */
export function boxBetween(p1: THREE.Vector3, p2: THREE.Vector3, width: number, height: number): THREE.BufferGeometry {
  const len = p1.distanceTo(p2);
  const g = new THREE.BoxGeometry(len, height, width);
  const ex = new THREE.Vector3().subVectors(p2, p1).normalize();
  let up = new THREE.Vector3(0, 1, 0);
  if (Math.abs(ex.dot(up)) > 0.98) up = new THREE.Vector3(1, 0, 0);
  const ez = new THREE.Vector3().crossVectors(ex, up).normalize();
  const ey = new THREE.Vector3().crossVectors(ez, ex).normalize();
  const m = new THREE.Matrix4().makeBasis(ex, ey, ez).setPosition(p1.clone().add(p2).multiplyScalar(0.5));
  g.applyMatrix4(m);
  return g;
}

export function profileAt(profile: ProfilePt[], s: number) { return interp(profile, s); }

export function mesh(g: THREE.BufferGeometry, m: THREE.Material): THREE.Mesh { return new THREE.Mesh(g, m); }

export function box(w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material): THREE.Mesh {
  const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  me.position.set(x, y, z);
  return me;
}
export function cyl(rt: number, rb: number, h: number, x: number, y: number, z: number, m: THREE.Material, seg = 16): THREE.Mesh {
  const me = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
  me.position.set(x, y, z);
  return me;
}

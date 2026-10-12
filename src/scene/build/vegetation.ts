import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { rng } from './textures';

/** Folha/lâmina = octaedro esticado (8 triângulos), orientado ao longo de `dir`. Cores por vértice (sRGB). */
interface Leaf { pos: THREE.Vector3; dir: THREE.Vector3; w: number; l: number; color: THREE.Color }

const Y = new THREE.Vector3(0, 1, 0);
function leafGeometry(leaves: Leaf[]): THREE.BufferGeometry {
  const base = new THREE.OctahedronGeometry(1, 0);
  const parts: THREE.BufferGeometry[] = [];
  const q = new THREE.Quaternion(), m = new THREE.Matrix4(), sc = new THREE.Vector3();
  for (const lf of leaves) {
    const g = base.clone();
    q.setFromUnitVectors(Y, lf.dir.clone().normalize());
    sc.set(lf.w, lf.l, lf.w * 0.45);
    // o centro da folha fica a meio comprimento ao longo da direção
    m.compose(lf.pos, q, sc);
    g.applyMatrix4(m);
    const n = g.attributes.position.count;
    const col = new Float32Array(n * 3);
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < n; i++) {
      // pontas mais claras, base mais escura
      const t = Math.min(1, Math.max(0, (pos.getY(i) - lf.pos.y) / (lf.l + 0.0001) * 0.5 + 0.5));
      const c = lf.color.clone().multiplyScalar(0.82 + 0.3 * t);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.deleteAttribute('uv');
    parts.push(g);
  }
  const out = mergeGeometries(parts, false)!;
  parts.forEach((p) => p.dispose()); base.dispose();
  out.computeBoundingBox(); out.computeBoundingSphere();
  return out;
}

const hsl = (h: number, s: number, l: number) => new THREE.Color().setHSL(h, s, l, THREE.SRGBColorSpace);

/** Arbusto baixo de folhagem cinza-esverdeada (tipo sálvia/alecrim). Raio ≈ 0.5, altura ≈ 0.55. */
export function shrubGeometry(seed: number, detail: number): THREE.BufferGeometry {
  const r = rng(seed);
  const stems = Math.round(14 + detail * 9);
  const leaves: Leaf[] = [];
  for (let i = 0; i < stems; i++) {
    const az = r() * Math.PI * 2;
    const el = 0.35 + r() * 1.05;            // elevação (rad) — mais vertical no centro
    const spread = 1 - Math.min(1, (el - 0.35) / 1.2) * 0.0;
    const dir = new THREE.Vector3(Math.cos(az) * Math.cos(el) * spread, Math.sin(el), Math.sin(az) * Math.cos(el) * spread).normalize();
    const R = 0.38 + r() * 0.16;
    const hue = 0.2 + r() * 0.08, sat = 0.14 + r() * 0.2, lig = 0.38 + r() * 0.16;
    const per = 3 + (detail > 1 ? 1 : 0);
    for (let k = 0; k < per; k++) {
      const t = (0.35 + (k / per) * 0.65) * R;
      const p = dir.clone().multiplyScalar(t).add(new THREE.Vector3(0, 0.02, 0));
      // folhas menores perto da base e do topo: volume arredondado
      const lenK = 0.075 + r() * 0.05;
      const lightness = lig * (0.62 + 0.5 * (p.y / 0.55));
      leaves.push({ pos: p, dir: dir.clone().add(new THREE.Vector3((r() - 0.5) * 0.5, (r() - 0.5) * 0.4, (r() - 0.5) * 0.5)), w: 0.034 + r() * 0.02, l: lenK, color: hsl(hue, sat, Math.min(0.62, lightness)) });
    }
  }
  return leafGeometry(leaves);
}

/** Touceira de gramínea ornamental: lâminas finas e arqueadas. */
export function tuftGeometry(seed: number, detail: number): THREE.BufferGeometry {
  const r = rng(seed);
  const blades = Math.round(22 + detail * 12);
  const leaves: Leaf[] = [];
  for (let i = 0; i < blades; i++) {
    const az = r() * Math.PI * 2, tilt = 0.12 + r() * 0.75;
    const dir = new THREE.Vector3(Math.cos(az) * Math.sin(tilt), Math.cos(tilt), Math.sin(az) * Math.sin(tilt)).normalize();
    const len = 0.22 + r() * 0.24;
    const base = new THREE.Vector3((r() - 0.5) * 0.08, 0.0, (r() - 0.5) * 0.08);
    const hue = 0.17 + r() * 0.08, sat = 0.2 + r() * 0.2, lig = 0.4 + r() * 0.2;
    // 2 segmentos: curva a lâmina
    leaves.push({ pos: base.clone().add(dir.clone().multiplyScalar(len * 0.5)), dir, w: 0.011, l: len * 0.5, color: hsl(hue, sat, lig * 0.85) });
    const dir2 = dir.clone().add(new THREE.Vector3(Math.cos(az) * 0.5, -0.35, Math.sin(az) * 0.5)).normalize();
    leaves.push({ pos: base.clone().add(dir.clone().multiplyScalar(len)).add(dir2.clone().multiplyScalar(len * 0.32)), dir: dir2, w: 0.01, l: len * 0.34, color: hsl(hue + 0.01, sat, Math.min(0.66, lig * 1.2)) });
  }
  return leafGeometry(leaves);
}

/** Oliveira ornamental: tronco torcido + copa esparsa de folhagem prateada. Altura ≈ 2.6 m, copa Ø ≈ 2.2 m. */
export function oliveGeometry(seed: number, detail: number): { trunk: THREE.BufferGeometry; canopy: THREE.BufferGeometry } {
  const r = rng(seed);
  const trunkParts: THREE.BufferGeometry[] = [];
  const tips: THREE.Vector3[] = [];
  const branches = 4;
  for (let b = 0; b < branches; b++) {
    const az = (b / branches) * Math.PI * 2 + r() * 0.6;
    const lean = 0.16 + r() * 0.2;
    const top = 1.55 + r() * 0.55;
    const pts = [
      new THREE.Vector3((r() - 0.5) * 0.05, 0, (r() - 0.5) * 0.05),
      new THREE.Vector3(Math.cos(az) * lean * 0.3, top * 0.3, Math.sin(az) * lean * 0.3),
      new THREE.Vector3(Math.cos(az + 0.6) * lean * 0.9, top * 0.65, Math.sin(az + 0.6) * lean * 0.9),
      new THREE.Vector3(Math.cos(az) * lean * 2.2, top, Math.sin(az) * lean * 2.2),
    ];
    const curve = new THREE.CatmullRomCurve3(pts);
    const tube = new THREE.TubeGeometry(curve, 8, 0.055 - b * 0.006, 6, false);
    const n = tube.attributes.position.count, col = new Float32Array(n * 3);
    const c = hsl(0.08, 0.18, 0.28 + r() * 0.06);
    for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    tube.setAttribute('color', new THREE.BufferAttribute(col, 3)); tube.deleteAttribute('uv');
    trunkParts.push(tube);
    tips.push(pts[3]);
    // ramos secundários
    for (let k = 0; k < 2; k++) {
      const t0 = curve.getPoint(0.55 + k * 0.2);
      const a2 = az + (k ? 1.6 : -1.5) + r() * 0.6;
      const end = t0.clone().add(new THREE.Vector3(Math.cos(a2) * 0.55, 0.55 + r() * 0.3, Math.sin(a2) * 0.55));
      const c2 = new THREE.CatmullRomCurve3([t0, t0.clone().lerp(end, 0.5).add(new THREE.Vector3(0, 0.1, 0)), end]);
      const t2 = new THREE.TubeGeometry(c2, 5, 0.022, 5, false);
      const n2 = t2.attributes.position.count, col2 = new Float32Array(n2 * 3);
      for (let i = 0; i < n2; i++) { col2[i * 3] = c.r; col2[i * 3 + 1] = c.g; col2[i * 3 + 2] = c.b; }
      t2.setAttribute('color', new THREE.BufferAttribute(col2, 3)); t2.deleteAttribute('uv');
      trunkParts.push(t2); tips.push(end);
    }
  }
  const trunk = mergeGeometries(trunkParts, false)!;
  trunkParts.forEach((p) => p.dispose());

  const leaves: Leaf[] = [];
  const per = Math.round(70 + detail * 38);
  for (const tip of tips) {
    for (let i = 0; i < per; i++) {
      // ponto em elipsoide ao redor da ponta do ramo
      const u = r(), v = r() * 2 - 1, az = r() * Math.PI * 2;
      const rad = 0.28 + Math.cbrt(u) * 0.5;
      const sx = Math.sqrt(1 - v * v);
      const off = new THREE.Vector3(Math.cos(az) * sx * rad, v * rad * 0.7 + 0.12, Math.sin(az) * sx * rad);
      const p = tip.clone().add(off);
      const dir = off.clone().normalize().add(new THREE.Vector3((r() - 0.5) * 0.6, 0.25 + (r() - 0.5) * 0.4, (r() - 0.5) * 0.6)).normalize();
      const depthK = 0.55 + 0.45 * Math.min(1, (off.y + 0.5) / 1.0);
      const hue = 0.2 + r() * 0.07, sat = 0.1 + r() * 0.16, lig = (0.4 + r() * 0.2) * depthK + 0.06;
      leaves.push({ pos: p, dir, w: 0.035 + r() * 0.02, l: 0.075 + r() * 0.05, color: hsl(hue, sat, Math.min(0.64, lig)) });
    }
  }
  const canopy = leafGeometry(leaves);
  return { trunk, canopy };
}

/** Planta de vaso (folhas largas verdes radiando do centro). Altura ≈ 1 m. Cache por semente. */
const potCache = new Map<number, THREE.BufferGeometry>();
export function potPlantGeometry(seed: number): THREE.BufferGeometry {
  const hit = potCache.get(seed);
  if (hit) return hit;
  const r = rng(seed);
  const leaves: Leaf[] = [];
  const n = 34;
  for (let i = 0; i < n; i++) {
    const az = r() * Math.PI * 2;
    const el = 0.5 + r() * 0.95;
    const dir = new THREE.Vector3(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el)).normalize();
    const len = 0.2 + r() * 0.16;
    const stem = 0.12 + r() * 0.34;
    const base = new THREE.Vector3(0, 0.05 + stem * 0.6, 0).add(dir.clone().multiplyScalar(stem * 0.9));
    leaves.push({ pos: base.clone().add(dir.clone().multiplyScalar(len)), dir: dir.clone().add(new THREE.Vector3(0, -0.25, 0)), w: 0.09 + r() * 0.05, l: len, color: hsl(0.3 + r() * 0.04, 0.42 + r() * 0.1, 0.24 + r() * 0.12) });
  }
  const g = leafGeometry(leaves);
  potCache.set(seed, g);
  return g;
}

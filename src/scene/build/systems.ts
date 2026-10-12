import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Ctx, register, fmt, FlowItem } from './rig';
import { box, cyl } from './geom';
import type { Device, SystemDef } from '../../data/house/types';

const V = (p: [number, number, number]) => new THREE.Vector3(p[0], p[1], p[2]);

/** Polilinha com cantos arredondados (curva de raio fixo, limitada à metade dos trechos). */
export function filletPath(pts: THREE.Vector3[], radius: number): THREE.CurvePath<THREE.Vector3> {
  const path = new THREE.CurvePath<THREE.Vector3>();
  if (pts.length < 2) return path;
  let cur = pts[0].clone();
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i], a = pts[i - 1], b = pts[i + 1];
    const d1 = p.clone().sub(a), d2 = b.clone().sub(p);
    const l1 = d1.length(), l2 = d2.length();
    if (l1 < 1e-6 || l2 < 1e-6) continue;
    d1.normalize(); d2.normalize();
    if (d1.dot(d2) > 0.9999) { continue; }
    const r = Math.min(radius, l1 / 2, l2 / 2);
    const s = p.clone().sub(d1.clone().multiplyScalar(r));
    const e = p.clone().add(d2.clone().multiplyScalar(r));
    if (cur.distanceTo(s) > 1e-5) path.add(new THREE.LineCurve3(cur, s));
    path.add(new THREE.QuadraticBezierCurve3(s, p.clone(), e));
    cur = e;
  }
  const last = pts[pts.length - 1];
  if (cur.distanceTo(last) > 1e-5) path.add(new THREE.LineCurve3(cur, last));
  return path;
}

function tube(path: THREE.CurvePath<THREE.Vector3>, radius: number): THREE.TubeGeometry {
  const len = path.getLength();
  return new THREE.TubeGeometry(path, Math.max(4, Math.ceil(len * 14)), radius, 8, false);
}

const flowGeo = new THREE.SphereGeometry(1, 8, 6);

export function buildSystems(ctx: Ctx) {
  const { d, mats } = ctx;
  for (const sys of d.model.systems) {
    const layer = `sys:${sys.id}`;
    const color = new THREE.Color(sys.color);
    const pipeMat = new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.15 });
    ctx.sysMats.push(pipeMat);
    const [sa, sb] = sys.stage;
    const n = sys.routes.length;
    sys.routes.forEach((r, i) => {
      const pts = r.points.map(V);
      const path = filletPath(pts, 0.14);
      const geo = tube(path, r.radius);
      const m = new THREE.Mesh(geo, pipeMat);
      m.userData.noEdges = true;
      const g = new THREE.Group(); g.add(m);
      const len = path.getLength();
      const a = sa + (sb - sa) * (i / n), b = Math.min(1, a + ((sb - sa) / n) * 1.5 + 0.02);
      const id = r.id;
      register(ctx, {
        id, name: r.label, layer, kind: 'instalacao', obj: g, room: null,
        dims: `${fmt(len)} m de trajeto · Ø ${fmt(r.radius * 2000, 0)} mm (ilustrativo)`,
        material: '', stageIdx: 2, src: 'esquematico',
        note: `ESQUEMÁTICO: ${sys.name}. Trajeto ilustrativo, sem projeto de instalações; não use para execução.`,
        anim: { stage: 2, a, b, style: 'draw' }, meshes: [m], edges: false,
        draw: [{ mesh: m, total: geo.index!.count }],
      });
      // partículas de fluxo (água/esgoto)
      if (ctx.quality >= 1 && (sys.id === 'agua-fria' || sys.id === 'agua-quente' || sys.id === 'esgoto')) {
        const cnt = Math.min(36, Math.max(3, Math.ceil(len / 0.55)));
        const im = new THREE.InstancedMesh(flowGeo, new THREE.MeshBasicMaterial({ color: color.clone().lerp(new THREE.Color('#ffffff'), 0.45) }), cnt);
        im.frustumCulled = false; im.visible = false; im.userData.noEdges = true; im.userData.isFlow = true; im.userData.rr = r.radius * 0.7;
        const rr = r.radius * 0.7;
        const dummy = new THREE.Object3D();
        for (let k = 0; k < cnt; k++) { dummy.position.set(0, 0, 0); dummy.scale.setScalar(rr); dummy.updateMatrix(); im.setMatrixAt(k, dummy.matrix); }
        ctx.layerGroup(layer, 'instalacoes').add(im);
        ctx.flow.push({ curve: path, mesh: im, n: cnt, layer, elemId: id, speed: sys.id === 'esgoto' ? 0.16 : 0.32, seed: i * 0.37 } as FlowItem);
        ctx.sysMats.push(im.material as THREE.Material);
      }
    });

    // prumadas (subidas nos pontos de consumo)
    if (sys.branches.length) {
      const top = sys.branchY + (sys.id === 'agua-quente' ? 0.65 : 0.62);
      const geos: THREE.BufferGeometry[] = [];
      for (const [x, z] of sys.branches) {
        const t = new THREE.CylinderGeometry(0.02, 0.02, top - sys.branchY, 8); t.translate(x, (top + sys.branchY) / 2, z); geos.push(t);
        const s = new THREE.SphereGeometry(0.035, 10, 8); s.translate(x, top, z); geos.push(s);
      }
      const bm = new THREE.Mesh(mergeGeometries(geos, false), pipeMat);
      bm.userData.noEdges = true;
      const g = new THREE.Group(); g.add(bm);
      register(ctx, {
        id: `PRU-${sys.id}`, name: `Pontos de consumo — ${sys.name}`, layer, kind: 'instalacao', obj: g, room: null,
        dims: `${sys.branches.length} pontos`, material: '', stageIdx: 2, src: 'esquematico',
        note: 'ESQUEMÁTICO: subidas até as peças; alturas ilustrativas.',
        anim: { stage: 2, a: Math.min(0.85, sb), b: 1, style: 'rise' }, meshes: [bm], edges: false,
      });
    }
    sys.devices?.forEach((dev, i) => buildDevice(ctx, sys, dev, layer, i, sys.devices!.length));
  }

  // luminárias de teto (elétrica)
  const eletrica = d.model.systems.find((s) => s.id === 'eletrica');
  if (eletrica) {
    d.model.lights.forEach((l, i) => {
      const g = new THREE.Group();
      const disc = cyl(0.11, 0.11, 0.025, l.x, l.y - 0.02, l.z, mats.m.lightEmit, 20);
      const ring = cyl(0.135, 0.135, 0.015, l.x, l.y - 0.005, l.z, mats.m.white, 20);
      g.add(ring, disc);
      const room = d.roomById.get(l.room);
      register(ctx, {
        id: l.id, name: `Luminária de teto — ${room?.name ?? ''}`, layer: 'mobiliario', kind: 'luminaria', obj: g, room: room?.name ?? null,
        dims: 'Ø 27 cm (ilustrativa)', material: '', stageIdx: 4, src: 'esquematico', note: 'ESQUEMÁTICO: posição ilustrativa no centro do ambiente.',
        anim: { stage: 4, a: 0.7 + (i / d.model.lights.length) * 0.2, b: 1, style: 'drop', drop: 0.5 }, edges: false,
      });
    });
  }
}

function buildDevice(ctx: Ctx, sys: SystemDef, dev: Device, layer: string, i: number, n: number) {
  const { mats } = ctx;
  const g = new THREE.Group();
  const [x, y, z] = dev.pos;
  let dims = '';
  if (dev.kind === 'manhole') {
    g.add(box(0.6, 0.5, 0.6, x, y, z, mats.m.concreteDark));
    g.add(cyl(0.3, 0.3, 0.04, x, 0.0, z, mats.m.inox, 20));
    g.add(cyl(0.25, 0.25, Math.max(0.05, -(y + 0.25)), x, (y + 0.25) / 2 - 0.0, z, mats.m.concrete, 16));
    dims = '60 × 60 cm (ilustrativa)';
  } else if (dev.kind === 'panel') {
    g.add(box(0.42, 0.62, 0.14, x, y, z, mats.m.white));
    g.add(box(0.36, 0.56, 0.02, x, y, z + 0.075, mats.m.frame));
    for (let k = 0; k < 6; k++) g.add(box(0.05, 0.05, 0.02, x - 0.1 + (k % 3) * 0.1, y + 0.12 - Math.floor(k / 3) * 0.12, z + 0.095, mats.m.white));
    dims = '42 × 62 cm';
  } else if (dev.kind === 'split') {
    const s = new THREE.Group();
    s.add(box(0.92, 0.29, 0.21, 0, 0, 0, mats.m.white));
    s.add(box(0.8, 0.03, 0.02, 0, -0.08, 0.105, mats.m.black));
    s.position.set(x, y, z); s.rotation.y = ((dev.rot ?? 0) * Math.PI) / 180;
    g.add(s);
    dims = '92 × 29 × 21 cm';
  } else if (dev.kind === 'condenser') {
    const s = new THREE.Group();
    s.add(box(0.82, 0.58, 0.32, 0, 0, 0, mats.m.white));
    const fan = cyl(0.2, 0.2, 0.02, 0, 0, 0.165, mats.m.black, 20); fan.rotation.x = Math.PI / 2;
    s.add(fan);
    s.add(box(0.7, 0.04, 0.34, 0, -0.32, 0, mats.m.black));
    s.position.set(x, y, z); s.rotation.y = ((dev.rot ?? 0) * Math.PI) / 180;
    g.add(s);
    dims = '82 × 58 × 32 cm';
  }
  register(ctx, {
    id: dev.id, name: dev.label, layer, kind: 'dispositivo', obj: g, room: ctx.d.roomAt(x, z)?.name ?? 'Área externa',
    dims, material: '', stageIdx: 2, src: 'esquematico', note: `ESQUEMÁTICO: ${sys.name}. Posição ilustrativa.`,
    anim: { stage: 2, a: Math.min(0.9, sys.stage[1] * 0.8 + (i / n) * 0.1), b: 1, style: 'drop', drop: 0.5 }, edges: false,
  });
}

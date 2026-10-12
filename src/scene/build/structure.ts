import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Ctx, register, fmt } from './rig';
import { applyWallFrame, box, boxBetween } from './geom';
import { planeH } from '../../data/house/derive';

/** Fundação (sapata corrida + radier) — dimensões ilustrativas. */
export function buildFoundation(ctx: Ctx) {
  const { d, mats } = ctx;
  const p = d.model.params;
  const bearing = d.walls.filter((w) => w.kind === 'ext' || w.kind === 'muro' || w.tClass === 'mid');
  bearing.forEach((w, i) => {
    const isMuro = w.kind === 'muro';
    const fw = isMuro ? 0.4 : p.footingW;
    const fh = isMuro ? 0.4 : p.footingDepth;
    const g = new THREE.Group();
    applyWallFrame(g, w);
    const len = w.s1 - w.s0;
    const m = box(len + (isMuro ? 0 : 0.0), fh - 0.05, fw, (w.s0 + w.s1) / 2, -(fh - 0.05) / 2 - 0.05, 0, mats.m.concreteDark);
    g.add(m);
    register(ctx, {
      id: `SAP-${w.id}`, name: `Sapata corrida — ${w.name}`, layer: 'fundacao', kind: 'fundacao', obj: g,
      room: null, dims: `${fmt(len)} m × ${fmt(fw * 100, 0)} cm de largura × ${fmt(fh * 100, 0)} cm de profundidade`,
      material: 'concreto', stageIdx: 0, src: 'esquematico',
      note: 'ESQUEMÁTICO: sapata corrida sob as paredes externas e de meia-espessura. A planta não traz projeto de fundação.',
      anim: { stage: 0, a: 0.05 + (i / bearing.length) * 0.4, b: 0.35 + (i / bearing.length) * 0.4, style: 'rise' }, meshes: [m], edges: true,
    });
  });

  // radier
  const slab = d.model.slab;
  const shape = new THREE.Shape();
  slab.polygon.forEach(([x, z], i) => (i === 0 ? shape.moveTo(x, -z) : shape.lineTo(x, -z)));
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: p.slabThick, bevelEnabled: false });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, -p.slabThick, 0);
  const sm = new THREE.Mesh(geo, mats.m.concrete);
  const g = new THREE.Group(); g.add(sm);
  register(ctx, {
    id: 'RADIER', name: slab.name, layer: 'fundacao', kind: 'fundacao', obj: g, room: 'Toda a casa e pátio',
    dims: `${fmt(p.slabThick * 100, 0)} cm de espessura`, material: 'concreto', stageIdx: 0, src: slab.src, note: slab.note,
    anim: { stage: 0, a: 0.55, b: 1, style: 'rise' }, meshes: [sm], edges: true,
  });
}

/** Pilares, cintas de amarração e caibros — sistema esquemático. */
export function buildStructure(ctx: Ctx) {
  const { d, mats } = ctx;
  const st = d.model.structure;
  const p = d.model.params;

  st.pillars.forEach((pl, i) => {
    const s = (pl.ext ? p.wallExtT : p.wallIntT) - 0.02;
    const size = Math.max(0.1, Math.min(pl.size, s));
    const g = new THREE.Group();
    const top = d.topAt(pl.x, pl.z, 0.05).h - 0.02;
    const m = box(size, top, size, pl.x, top / 2, pl.z, mats.m.concreteDark);
    g.add(m);
    register(ctx, {
      id: pl.id, name: `Pilar ${pl.id}`, layer: 'estrutura', kind: 'pilar', obj: g, room: null,
      dims: `${fmt(size * 100, 0)} × ${fmt(size * 100, 0)} cm · altura ${fmt(top)} m`, material: 'concreto', stageIdx: 1, src: 'esquematico',
      note: 'ESQUEMÁTICO: posição e seção ilustrativas dentro das paredes. Não há projeto estrutural.',
      anim: { stage: 1, a: (i / st.pillars.length) * 0.4, b: 0.3 + (i / st.pillars.length) * 0.4, style: 'rise' }, meshes: [m], edges: true,
    });
  });

  // cintas seguindo o topo das paredes
  const walls = d.walls.filter((w) => w.kind !== 'muro' && !w.height);
  walls.forEach((w, i) => {
    const g = new THREE.Group();
    applyWallFrame(g, w);
    const geos: THREE.BufferGeometry[] = [];
    for (let k = 0; k + 1 < w.profile.length; k += 2) {
      const a = w.profile[k], b = w.profile[k + 1];
      if (b.s - a.s < 0.05) continue;
      geos.push(boxBetween(new THREE.Vector3(a.s, a.h - 0.12, 0), new THREE.Vector3(b.s, b.h - 0.12, 0), Math.max(0.08, w.t - 0.02), 0.2));
    }
    if (!geos.length) return;
    const m = new THREE.Mesh(mergeGeometries(geos, false), mats.m.concrete);
    g.add(m);
    register(ctx, {
      id: `CIN-${w.id}`, name: `Cinta de amarração — ${w.name}`, layer: 'estrutura', kind: 'cinta', obj: g, room: null,
      dims: `${fmt(w.s1 - w.s0)} m · seção ${fmt((w.t - 0.02) * 100, 0)} × 20 cm`, material: 'concreto', stageIdx: 1, src: 'esquematico',
      note: 'ESQUEMÁTICO: viga de respaldo acompanhando o topo da parede (altura definida pelo plano do telhado).',
      anim: { stage: 1, a: 0.35 + (i / walls.length) * 0.3, b: 0.65 + (i / walls.length) * 0.35, style: 'drop', drop: 0.8 }, meshes: [m], edges: false,
    });
  });

  // caibros por telhado
  const byRoof = new Map<string, typeof st.rafters>();
  for (const r of st.rafters) { (byRoof.get(r.roof) ?? byRoof.set(r.roof, []).get(r.roof)!).push(r); }
  let ri = 0;
  for (const [rid, list] of byRoof) {
    const roof = d.roofById.get(rid);
    if (!roof) continue;
    const geos: THREE.BufferGeometry[] = [];
    for (const r of list) {
      const ya = planeH(roof, r.a[0], r.a[1]) - 0.06, yb = planeH(roof, r.b[0], r.b[1]) - 0.06;
      geos.push(boxBetween(new THREE.Vector3(r.a[0], ya, r.a[1]), new THREE.Vector3(r.b[0], yb, r.b[1]), 0.06, 0.12));
    }
    if (!geos.length) continue;
    const m = new THREE.Mesh(mergeGeometries(geos, false), mats.m.timberRaw);
    const g = new THREE.Group(); g.add(m);
    register(ctx, {
      id: `CAI-${rid}`, name: `Caibros — ${roof.name}`, layer: 'estrutura', kind: 'caibro', obj: g, room: null,
      dims: `${list.length} caibros · seção 6 × 12 cm`, material: 'madeira-clara', stageIdx: 1, src: 'esquematico',
      note: 'ESQUEMÁTICO: caibros ilustrativos, apoiados sob o plano do telhado. Espaçamento e seção não vêm da planta.',
      anim: { stage: 1, a: 0.6 + ri * 0.08, b: 0.85 + ri * 0.08, style: 'drop', drop: 1.6 }, meshes: [m], edges: false,
    });
    ri++;
  }
}

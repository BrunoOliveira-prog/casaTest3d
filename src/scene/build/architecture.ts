import * as THREE from 'three';
import type { DWall } from '../../data/house/derive';
import { Ctx, register, fmt } from './rig';
import { applyWallFrame, box, buildWallShape, cyl, extrudeShape, flatSlab } from './geom';
import { interp } from '../../data/house/derive';

// ---------------------------------------------------------------- paredes
export function buildWalls(ctx: Ctx) {
  const { d, mats } = ctx;
  const ext = d.walls.filter((w) => w.kind === 'ext' || w.kind === 'muro');
  const inn = d.walls.filter((w) => !(w.kind === 'ext' || w.kind === 'muro'));
  const order = new Map<string, number>();
  ext.forEach((w, i) => order.set(w.id, i / Math.max(1, ext.length - 1)));
  inn.forEach((w, i) => order.set(w.id, i / Math.max(1, inn.length - 1)));

  for (const w of d.walls) {
    const shape = buildWallShape(w);
    if (!shape) continue;
    const geo = extrudeShape(shape, w.t);
    const obj = new THREE.Group();
    applyWallFrame(obj, w);
    const raw = new THREE.Mesh(geo, mats.m.wallRaw);
    const fin = new THREE.Mesh(geo, mats.m.wallFinish);
    obj.add(raw, fin);
    const cap: THREE.Mesh[] = [];
    if (w.kind === 'muro') {
      // coroamento (pingadeira) em concreto claro, levemente mais largo que o muro
      const c = box(w.s1 - w.s0 + 0.04, 0.04, w.t + 0.07, (w.s0 + w.s1) / 2, w.maxTop + 0.02, 0, mats.m.concrete);
      c.userData.noEdges = true; obj.add(c); cap.push(c);
    }
    const isExt = w.kind === 'ext' || w.kind === 'muro';
    const o = order.get(w.id) ?? 0;
    const rooms = w.rooms.map((r) => d.roomById.get(r)?.name).filter(Boolean).join(' | ');
    register(ctx, {
      id: w.id, name: w.name, layer: 'alvenaria', kind: 'parede', obj,
      room: rooms || (w.kind === 'muro' ? 'Pátio (lado externo)' : 'Área externa'),
      dims: `${fmt(w.L)} m de comprimento · ${fmt(w.t * 100, 0)} cm de espessura · altura ${fmt(w.minTop)}–${fmt(w.maxTop)} m`,
      material: w.material === 'reboco-int' ? 'reboco-int' : 'reboco',
      stageIdx: 3, src: w.src, note: w.note || (w.kind === 'muro' ? '' : 'Altura calculada pelo plano do telhado (estimado).'),
      anim: { stage: 3, a: isExt ? o * 0.42 : 0.22 + o * 0.38, b: isExt ? 0.42 + o * 0.42 : 0.62 + o * 0.2, style: 'rise' },
      meshes: [raw, fin, ...cap], edges: true, raw, finish: fin,
      finishAnim: { stage: 4, a: 0.04 + o * 0.12, b: 0.5 + o * 0.12 },
    });
    // as arestas do acabamento duplicam as da base; mantém só as da base
    const e = ctx.byId.get(w.id)!;
    e.edges.forEach((ls) => { if (ls.parent === fin) { fin.remove(ls); } });
    e.edges = e.edges.filter((ls) => ls.parent === raw);
  }
}

// ---------------------------------------------------------------- esquadrias
const FRAME_T = 0.05;
export function buildOpenings(ctx: Ctx) {
  const { d, mats } = ctx;
  const all: { w: DWall; o: DWall['dopenings'][number] }[] = [];
  d.walls.forEach((w) => w.dopenings.forEach((o) => all.push({ w, o })));
  all.forEach(({ w, o }, idx) => {
    const g = new THREE.Group();
    applyWallFrame(g, w);
    const depth = Math.min(0.12, w.t * 0.7);
    const cx = (o.s0 + o.s1) / 2;
    const W = o.s1 - o.s0, y0 = o.notch ? 0 : o.sill, H = o.head - y0;
    const frameM = mats.m.frame;
    const add = (m: THREE.Object3D) => { g.add(m); return m; };

    if (o.type === 'window' || o.type === 'slider') {
      const panels = o.type === 'slider' ? 4 : Math.max(1, Math.round(W / 1.1));
      const ft = o.type === 'slider' ? 0.045 : FRAME_T;
      // moldura externa
      add(box(W, ft, depth, cx, y0 + ft / 2, 0, frameM));
      add(box(W, ft, depth, cx, y0 + H - ft / 2, 0, frameM));
      add(box(ft, H - 2 * ft, depth, o.s0 + ft / 2, y0 + H / 2, 0, frameM));
      add(box(ft, H - 2 * ft, depth, o.s1 - ft / 2, y0 + H / 2, 0, frameM));
      const pw = (W - 2 * ft) / panels;
      for (let i = 0; i < panels; i++) {
        const sx = o.s0 + ft + pw * (i + 0.5);
        const zoff = o.type === 'slider' ? (i % 2 ? 0.035 : -0.035) : 0;
        if (i > 0) add(box(ft * 0.8, H - 2 * ft, depth * 0.8, o.s0 + ft + pw * i, y0 + H / 2, zoff, frameM));
        const gl = add(box(pw - 0.01, H - 2 * ft, 0.012, sx, y0 + H / 2, zoff, mats.m.glass)) as THREE.Mesh;
        gl.castShadow = false; gl.renderOrder = 2; gl.userData.noEdges = true;
        if (o.type === 'slider') {
          // quadro de cada folha de correr
          add(box(pw, 0.04, 0.05, sx, y0 + 0.04, zoff, frameM));
          add(box(pw, 0.04, 0.05, sx, y0 + H - ft - 0.02, zoff, frameM));
        }
      }
      if (o.type === 'window') {
        // peitoril em reboco
        const sill = box(W + 0.12, 0.03, w.t + 0.08, cx, o.sill - 0.015, 0, mats.m.reboco);
        add(sill);
      }
    } else {
      // porta: batente + folha aberta
      const entry = o.id === 'P-ENT';
      const leafM = o.material === 'madeira-escura' ? mats.m.doorDark : mats.m.doorLight;
      const jambM = entry ? mats.m.doorDark : mats.m.doorLight;
      add(box(0.05, H, depth, o.s0 + 0.025, H / 2, 0, jambM));
      add(box(0.05, H, depth, o.s1 - 0.025, H / 2, 0, jambM));
      add(box(W, 0.05, depth, cx, H - 0.025, 0, jambM));
      const hinge = new THREE.Group();
      hinge.position.set(o.s0 + 0.05, 0, 0);
      hinge.rotation.y = -o.swingSide * 1.32;
      const lw = W - 0.1, lh = H - 0.06;
      const leaf = box(lw, lh, 0.04, lw / 2, lh / 2 + 0.01, 0, leafM);
      hinge.add(leaf);
      const hb = entry ? cyl(0.014, 0.014, 0.6, lw - 0.1, 1.1, 0.045 * o.swingSide, mats.m.inox, 8)
        : cyl(0.012, 0.012, 0.12, lw - 0.08, 1.02, 0.04, mats.m.inox, 8);
      if (!entry) hb.rotation.z = Math.PI / 2;
      hinge.add(hb);
      add(hinge);
    }

    const label = o.type === 'window' ? 'Janela' : o.type === 'slider' ? 'Porta de correr (vidro)' : 'Porta';
    const room = w.rooms.map((r) => d.roomById.get(r)?.name).filter(Boolean).join(' | ');
    register(ctx, {
      id: o.id, name: o.name ?? `${label} (${w.name})`, layer: 'esquadrias', kind: o.type, obj: g,
      room: room || 'Área externa',
      dims: `${fmt(W)} m de largura × ${fmt(o.head - o.sill)} m de altura${o.notch ? '' : ` · peitoril ${fmt(o.sill)} m`}`,
      material: o.type === 'door' ? o.material : 'aluminio-preto',
      stageIdx: 3, src: o.src, note: o.note ?? '',
      anim: { stage: 3, a: 0.46 + (idx / Math.max(1, all.length)) * 0.34, b: 0.66 + (idx / Math.max(1, all.length)) * 0.3, style: 'drop', drop: 0.9 },
      edges: false,
    });
  });
}

// ---------------------------------------------------------------- revestimentos de madeira
export function buildCladding(ctx: Ctx) {
  const { d, mats } = ctx;
  d.model.cladding.forEach((c, i) => {
    const w = d.wallById.get(c.wall);
    if (!w) return;
    const from = c.from;
    const to = typeof c.to === 'number' ? c.to : c.to === 'L' ? w.s1 : w.L + parseFloat(c.to.replace('L', ''));
    const y0 = c.y0;
    const shape = buildWallShape(w, { from, to, y0, topOffset: 0.015, openings: true });
    if (!shape) return;
    const depth = 0.05;
    const geo = extrudeShape(shape, depth, c.side * (w.t / 2 + depth / 2));
    const g = new THREE.Group();
    applyWallFrame(g, w);
    const m = new THREE.Mesh(geo, c.orientation === 'vertical' ? mats.m.timberV : mats.m.timberH);
    g.add(m);
    register(ctx, {
      id: c.id, name: c.name, layer: 'acabamentos', kind: 'revestimento', obj: g, room: 'Fachada',
      dims: `${fmt(to - from)} m de comprimento · 5 cm de espessura`,
      material: 'madeira-escura', stageIdx: 4, src: 'estimado', note: 'Posição inferida das fachadas; espessura estimada.',
      anim: { stage: 4, a: 0.34 + i * 0.1, b: 0.55 + i * 0.1, style: 'drop', drop: 1.4 }, meshes: [m], edges: true,
    });
  });
}

// ---------------------------------------------------------------- pisos
export function buildFloors(ctx: Ctx) {
  const { d, mats } = ctx;
  const ft = d.model.params.floorThick;
  d.rooms.forEach((r, i) => {
    const geo = flatSlab(r.polygon, [], 0, ft);
    const mkey = r.floor === 'madeira' ? 'floorWood' : r.floor === 'porcelanato' ? 'floorTile' : 'floorCement';
    const m = new THREE.Mesh(geo, mats.m[mkey]);
    const g = new THREE.Group(); g.add(m);
    register(ctx, {
      id: `PISO-${r.id}`, name: `Piso — ${r.name}`, layer: 'pisos', kind: 'piso', obj: g, room: r.name,
      dims: `${fmt(r.area)} m² (polígono do modelo)`,
      material: r.floor, stageIdx: 4, src: 'estimado', note: 'Tipo de piso adotado como hipótese de visualização.',
      anim: { stage: 4, a: (i / d.rooms.length) * 0.4, b: 0.25 + (i / d.rooms.length) * 0.4, style: 'rise' }, meshes: [m], edges: false,
    });
  });
}

// ---------------------------------------------------------------- legendas auxiliares de altura
export function wallHeightAt(w: DWall, s: number) { return interp(w.profile, s); }

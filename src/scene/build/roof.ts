import * as THREE from 'three';
import { Ctx, register, fmt } from './rig';
import { boxBetween, polyShape, cyl } from './geom';
import { planeH, pip } from '../../data/house/derive';
import type { Roof, V2 } from '../../data/house/types';

function displaced(geo: THREE.BufferGeometry, roof: Roof, dy: number) {
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) pos.setY(i, pos.getY(i) + planeH(roof, pos.getX(i), pos.getZ(i)) + dy);
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  geo.computeBoundingBox(); geo.computeBoundingSphere();
}

function slabGeometry(roof: Roof, thick: number) {
  const shape = polyShape(roof.polygon, roof.holes);
  const g = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false });
  g.rotateX(-Math.PI / 2);
  displaced(g, roof, 0);
  return g;
}
function undersideGeometry(roof: Roof) {
  const g = new THREE.ShapeGeometry(polyShape(roof.polygon, roof.holes));
  g.rotateX(-Math.PI / 2);
  displaced(g, roof, -0.004);
  return g;
}

export function buildRoofs(ctx: Ctx) {
  const { d, mats } = ctx;
  const th = d.model.params.roofThick;
  const order = ['RW', 'RC', 'RH', 'RS', 'RN'];
  d.model.roofs.forEach((roof, i) => {
    const slope = Math.abs(roof.plane.gx) > Math.abs(roof.plane.gz);
    const top = new THREE.Mesh(slabGeometry(roof, th), [slope ? mats.m.roofX : mats.m.roofZ, mats.m.fascia]);
    const under = new THREE.Mesh(undersideGeometry(roof), mats.m.roofUnder);
    under.userData.noEdges = true;
    const g = new THREE.Group(); g.add(top, under);
    const gr = Math.hypot(roof.plane.gx, roof.plane.gz);
    const idx = Math.max(0, order.indexOf(roof.id));
    register(ctx, {
      id: `TEL-${roof.id}`, name: roof.name, layer: 'cobertura', kind: 'telhado', obj: g, room: 'Cobertura',
      dims: `Inclinação ${fmt(Math.atan(gr) * 180 / Math.PI, 1)}° (${fmt(gr * 100, 0)}%) · espessura ${fmt(th * 100, 0)} cm`,
      material: 'telha', stageIdx: 3, src: roof.src, note: roof.note,
      anim: { stage: 3, a: 0.5 + idx * 0.09, b: 0.78 + idx * 0.09, style: 'drop', drop: 5 }, meshes: [top, under], edges: true,
    });
  });

  buildGutters(ctx);
  buildSkylight(ctx);
  buildChimney(ctx);
}

function buildGutters(ctx: Ctx) {
  const { d, mats } = ctx;
  const th = d.model.params.roofThick;
  let n = 0;
  for (const roof of d.model.roofs) {
    const gx = roof.plane.gx, gz = roof.plane.gz;
    const dn: V2 = [-gx, -gz];
    const dl = Math.hypot(dn[0], dn[1]);
    if (dl < 1e-6) continue;
    dn[0] /= dl; dn[1] /= dl;
    // orientação do polígono → normal externa
    let area = 0;
    for (let i = 0; i < roof.polygon.length; i++) {
      const [x1, z1] = roof.polygon[i], [x2, z2] = roof.polygon[(i + 1) % roof.polygon.length];
      area += x1 * z2 - x2 * z1;
    }
    const sgn = area > 0 ? 1 : -1;
    for (let i = 0; i < roof.polygon.length; i++) {
      const a = roof.polygon[i], b = roof.polygon[(i + 1) % roof.polygon.length];
      const ex = b[0] - a[0], ez = b[1] - a[1], L = Math.hypot(ex, ez);
      if (L < 0.8) continue;
      // normal externa (para polígono horário em x-z com z para baixo: ajusta pelo sinal da área)
      const nx = (sgn * ez) / L, nz = (-sgn * ex) / L;
      if (nx * dn[0] + nz * dn[1] < 0.95) continue;
      const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
      // ignora bordas internas (há outro telhado logo além)
      const outside: V2 = [mx + nx * 0.25, mz + nz * 0.25];
      if (d.model.roofs.some((o) => o !== roof && pip(o.polygon, outside[0], outside[1]) && !o.holes.some((h) => pip(h, outside[0], outside[1])))) continue;
      const off = 0.04;
      const pa = new THREE.Vector3(a[0] + nx * off, planeH(roof, a[0], a[1]) + th * 0.35, a[1] + nz * off);
      const pb = new THREE.Vector3(b[0] + nx * off, planeH(roof, b[0], b[1]) + th * 0.35, b[1] + nz * off);
      const gm = new THREE.Mesh(boxBetween(pa, pb, 0.11, 0.09), mats.m.gutter);
      const g = new THREE.Group(); g.add(gm);
      // prumada
      const t0 = 0.08 / L;
      const dx = a[0] + ex * t0 + nx * off, dz = a[1] + ez * t0 + nz * off;
      const hTop = planeH(roof, dx, dz) + th * 0.35;
      const dp = cyl(0.035, 0.035, hTop, dx, hTop / 2, dz, mats.m.gutter, 10);
      g.add(dp);
      n++;
      register(ctx, {
        id: `CALHA-${roof.id}-${n}`, name: `Calha e prumada — ${roof.name}`, layer: 'cobertura', kind: 'calha', obj: g, room: 'Cobertura',
        dims: `${fmt(L)} m de calha`, material: 'inox', stageIdx: 3, src: 'estimado',
        note: 'Calha simplificada na borda baixa do telhado; não aparece na planta.',
        anim: { stage: 3, a: 0.82, b: 1, style: 'drop', drop: 0.6 }, meshes: [gm, dp], edges: false,
      });
    }
  }
}

function buildSkylight(ctx: Ctx) {
  const { d, mats } = ctx;
  const sk = d.model.roofExtras.skylight;
  const roof = d.model.roofs.find((r) => pip(r.polygon, sk.center[0], sk.center[1]) && r.holes.some((h) => pip(h, sk.center[0], sk.center[1])));
  if (!roof) return;
  const th = d.model.params.roofThick;
  const [cx, cz] = sk.center, [sx, sz] = sk.size;
  const hy = (x: number, z: number) => planeH(roof, x, z) + th * 0.5;
  const c = [[cx - sx / 2, cz - sz / 2], [cx + sx / 2, cz - sz / 2], [cx + sx / 2, cz + sz / 2], [cx - sx / 2, cz + sz / 2]];
  const g = new THREE.Group();
  const gg = new THREE.BufferGeometry();
  gg.setAttribute('position', new THREE.Float32BufferAttribute(c.flatMap(([x, z]) => [x, hy(x, z), z]), 3));
  gg.setIndex([0, 2, 1, 0, 3, 2]); gg.computeVertexNormals();
  const glass = new THREE.Mesh(gg, mats.m.skylightGlass); glass.renderOrder = 2; glass.userData.noEdges = true;
  g.add(glass);
  for (let i = 0; i < 4; i++) {
    const a = c[i], b = c[(i + 1) % 4];
    const fr = new THREE.Mesh(boxBetween(new THREE.Vector3(a[0], hy(a[0], a[1]) + 0.01, a[1]), new THREE.Vector3(b[0], hy(b[0], b[1]) + 0.01, b[1]), 0.06, 0.05), mats.m.frame);
    g.add(fr);
  }
  register(ctx, {
    id: sk.id, name: sk.name, layer: 'cobertura', kind: 'claraboia', obj: g, room: d.roomAt(cx, cz)?.name ?? 'Cobertura',
    dims: `${fmt(sx)} × ${fmt(sz)} m`, material: 'vidro', stageIdx: 3, src: sk.src, note: sk.note,
    anim: { stage: 3, a: 0.88, b: 1, style: 'drop', drop: 1.2 }, edges: false,
  });
}

function buildChimney(ctx: Ctx) {
  const { d, mats } = ctx;
  const ch = d.model.roofExtras.chimney;
  const t = d.topAt(ch.pos[0], ch.pos[1], 0);
  const roof = t.roof ? d.roofById.get(t.roof) : undefined;
  if (!roof) return;
  const base = planeH(roof, ch.pos[0], ch.pos[1]);
  const h = ch.height + d.model.params.roofThick;
  const g = new THREE.Group();
  g.add(cyl(ch.radius, ch.radius, h, ch.pos[0], base + h / 2 - 0.05, ch.pos[1], mats.m.black, 16));
  g.add(cyl(ch.radius * 1.35, ch.radius * 1.35, 0.04, ch.pos[0], base + h - 0.03, ch.pos[1], mats.m.inox, 16));
  register(ctx, {
    id: ch.id, name: ch.name, layer: 'cobertura', kind: 'duto', obj: g, room: 'Cobertura',
    dims: `Ø ${fmt(ch.radius * 200, 0)} cm · ${fmt(ch.height)} m acima da telha`, material: 'inox', stageIdx: 3, src: ch.src, note: ch.note,
    anim: { stage: 3, a: 0.9, b: 1, style: 'drop', drop: 1 }, edges: false,
  });
}

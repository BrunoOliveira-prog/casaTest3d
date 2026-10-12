import type { HouseModel, Overrides, Roof, Room, Wall, Opening, V2, V3, Furniture } from './types';

// ------------------------------------------------------------------ utilidades geométricas
export const planeH = (r: Roof, x: number, z: number) => {
  const p = r.plane;
  return p.h0 + p.gx * (x - p.x0) + p.gz * (z - p.z0);
};

export function pip(poly: V2[], x: number, z: number): boolean {
  let inside = false;
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const [x1, z1] = poly[i];
    const [x2, z2] = poly[(i + 1) % n];
    if (z1 > z !== z2 > z) {
      const xi = x1 + ((z - z1) * (x2 - x1)) / (z2 - z1);
      if (xi > x) inside = !inside;
    }
  }
  return inside;
}

export function polygonArea(poly: V2[]): number {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, z1] = poly[i];
    const [x2, z2] = poly[(i + 1) % poly.length];
    a += x1 * z2 - x2 * z1;
  }
  return Math.abs(a) / 2;
}

export function polygonCentroid(poly: V2[]): V2 {
  let a = 0, cx = 0, cz = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, z1] = poly[i];
    const [x2, z2] = poly[(i + 1) % poly.length];
    const f = x1 * z2 - x2 * z1;
    a += f; cx += (x1 + x2) * f; cz += (z1 + z2) * f;
  }
  if (Math.abs(a) < 1e-9) return poly[0];
  return [cx / (3 * a), cz / (3 * a)];
}

function inRoof(r: Roof, x: number, z: number, infl: number): boolean {
  const pts: V2[] = infl === 0 ? [[x, z]] : [[x, z], [x + infl, z], [x - infl, z], [x, z + infl], [x, z - infl]];
  for (const [px, pz] of pts) {
    if (pip(r.polygon, px, pz) && !r.holes.some((h) => pip(h, px, pz))) return true;
  }
  return false;
}

export function topAt(roofs: Roof[], x: number, z: number, infl = 0.14): { h: number; roof: string | null } {
  let best: number | null = null;
  let bid: string | null = null;
  for (const r of roofs) {
    if (inRoof(r, x, z, infl)) {
      const h = planeH(r, x, z);
      if (best === null || h > best) { best = h; bid = r.id; }
    }
  }
  return { h: best ?? 2.8, roof: bid };
}

// ------------------------------------------------------------------ overrides (parâmetros, escala)
export const DEFAULT_OVERRIDES: Overrides = {};

export function applyOverrides(base: HouseModel, ov: Overrides): HouseModel {
  const m: HouseModel = structuredClone(base);
  const bp = base.params;
  if (ov.params) m.params = { ...m.params, ...ov.params };
  const p = m.params;

  // espessuras
  for (const w of m.walls) {
    if (w.tClass === 'ext') w.t = p.wallExtT;
    else if (w.tClass === 'int') w.t = p.wallIntT;
    else if (w.tClass === 'mid') w.t = p.wallMidT;
  }
  // alturas dos telhados (planos = face inferior)
  const dRidge = p.ridgeMax - bp.ridgeMax - (p.roofThick - bp.roofThick);
  const dBase = p.ceilingBase - bp.ceilingBase;
  for (const r of m.roofs) {
    if (r.id === 'RC' || r.id === 'RH') r.plane.h0 += dRidge;
    else r.plane.h0 += dBase;
    if (r.id === 'RC' && ov.slopeCentral !== undefined) r.plane.gz = -Math.abs(ov.slopeCentral);
  }
  // escala planimétrica (calibração)
  const k = ov.planScale ?? 1;
  if (Math.abs(k - 1) > 1e-6) scalePlan(m, k);
  m.calibration = { planScale: k };
  return m;
}

function sv(v: V2, k: number): V2 { return [v[0] * k, v[1] * k]; }
function scalePlan(m: HouseModel, k: number) {
  for (const w of m.walls) {
    w.a = sv(w.a, k); w.b = sv(w.b, k);
    for (const o of w.openings) o.center *= k;
  }
  for (const r of m.rooms) { r.polygon = r.polygon.map((p) => sv(p, k)); r.spot = [r.spot[0] * k, r.spot[1] * k, r.spot[2]]; }
  for (const r of m.roofs) {
    r.polygon = r.polygon.map((p) => sv(p, k));
    r.holes = r.holes.map((h) => h.map((p) => sv(p, k)));
    r.plane.x0 *= k; r.plane.z0 *= k; r.plane.gx /= k; r.plane.gz /= k;
  }
  m.structure.pillars.forEach((p) => { p.x *= k; p.z *= k; });
  m.structure.rafters.forEach((r) => { r.a = sv(r.a, k); r.b = sv(r.b, k); });
  m.slab.polygon = m.slab.polygon.map((p) => sv(p, k));
  m.furniture.forEach((f) => { f.x *= k; f.z *= k; });
  m.lights.forEach((l) => { l.x *= k; l.z *= k; });
  for (const s of m.systems) {
    s.routes.forEach((r) => { r.points = r.points.map((p): V3 => [p[0] * k, p[1], p[2] * k]); });
    s.branches = s.branches.map((b): [number, number] => [b[0] * k, b[1] * k]);
    s.devices?.forEach((d) => { d.pos = [d.pos[0] * k, d.pos[1], d.pos[2] * k]; });
  }
  m.cladding.forEach((c) => { c.from *= k; if (typeof c.to === 'number') c.to *= k; });
  m.annotations.forEach((a) => { a.at = [a.at[0] * k, a.at[1], a.at[2] * k]; });
  m.landscape.plants.forEach((p) => { p.x *= k; p.z *= k; });
  m.landscape.paths.forEach((p) => { p.polygon = p.polygon.map((q) => sv(q, k)); });
  (m.landscape.beds ?? []).forEach((b) => { b.polygon = b.polygon.map((q) => sv(q, k)); });
  const sk = m.roofExtras.skylight; sk.center = sv(sk.center, k);
  const ch = m.roofExtras.chimney; ch.pos = sv(ch.pos, k);
  m.reference.mPerPx = [m.reference.mPerPx[0] * k, m.reference.mPerPx[1] * k];
}

// ------------------------------------------------------------------ paredes derivadas
export interface ProfilePt { s: number; h: number; roof: string }
export interface DOpening extends Opening {
  s0: number; s1: number;      // intervalo ao longo da parede
  head: number;                // altura da verga
  notch: boolean;              // abertura que desce até o piso
  swingSide: 1 | -1;           // lado da normal para onde a folha abre (portas)
}
export interface DWall extends Wall {
  L: number; dx: number; dz: number; nx: number; nz: number;
  ea: number; eb: number;       // extensão nas extremidades (+ estende / − recua)
  s0: number; s1: number;
  profile: ProfilePt[];
  dopenings: DOpening[];
  horizontal: boolean;
  minTop: number; maxTop: number;
}
export interface DRoom extends Room {
  area: number; centroid: V2; bbox: [V2, V2];
}
export interface Rect { x0: number; x1: number; z0: number; z1: number; id: string; kind: 'parede' | 'movel' | 'muro' | 'esquadria' }
export interface Derived {
  model: HouseModel;
  walls: DWall[];
  wallById: Map<string, DWall>;
  rooms: DRoom[];
  roomById: Map<string, DRoom>;
  roofById: Map<string, Roof>;
  bbox: { min: V3; max: V3; center: V3; size: V3; radius: number };
  collision: Rect[];
  roomAt: (x: number, z: number) => DRoom | null;
  topAt: (x: number, z: number, infl?: number) => { h: number; roof: string | null };
  levelName: string;
}

const isHoriz = (w: Wall) => Math.abs(w.a[1] - w.b[1]) < 1e-6;
const atEnd = (w: Wall, p: V2, eps = 0.02) =>
  Math.hypot(w.a[0] - p[0], w.a[1] - p[1]) < eps || Math.hypot(w.b[0] - p[0], w.b[1] - p[1]) < eps;
function onAxisInterior(w: Wall, p: V2, eps = 0.02): boolean {
  const [ax, az] = w.a, [bx, bz] = w.b;
  if (isHoriz(w)) return Math.abs(p[1] - az) < eps && Math.min(ax, bx) + eps < p[0] && p[0] < Math.max(ax, bx) - eps;
  return Math.abs(p[0] - ax) < eps && Math.min(az, bz) + eps < p[1] && p[1] < Math.max(az, bz) - eps;
}

function segIntersections(a: V2, dx: number, dz: number, L: number, poly: V2[]): number[] {
  const res: number[] = [];
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const [x1, z1] = poly[i];
    const [x2, z2] = poly[(i + 1) % n];
    const ex = x2 - x1, ez = z2 - z1;
    const den = dx * ez - dz * ex;
    if (Math.abs(den) < 1e-9) continue;
    const s = ((x1 - a[0]) * ez - (z1 - a[1]) * ex) / den;
    const u = ((x1 - a[0]) * dz - (z1 - a[1]) * dx) / den;
    if (s > 0 && s < L && u >= 0 && u <= 1) res.push(s);
  }
  return res;
}

export function computeProfile(roofs: Roof[], a: V2, dx: number, dz: number, L: number, s0: number, s1: number): ProfilePt[] {
  const roofById = new Map(roofs.map((r) => [r.id, r]));
  const set = new Set<number>([s0, s1]);
  for (const r of roofs) for (const poly of [r.polygon, ...r.holes]) for (const s of segIntersections(a, dx, dz, L, poly)) set.add(Math.round(s * 1e4) / 1e4);
  const bps = [...set].filter((b) => b >= s0 - 1e-6 && b <= s1 + 1e-6).sort((p, q) => p - q);
  const out: ProfilePt[] = [];
  for (let i = 0; i < bps.length - 1; i++) {
    const sa = bps[i], sb = bps[i + 1];
    if (sb - sa < 1e-4) continue;
    const sm = (sa + sb) / 2;
    const { roof } = topAt(roofs, a[0] + dx * sm, a[1] + dz * sm);
    const rid = roof ?? roofs[0].id;
    const r = roofById.get(rid)!;
    out.push({ s: sa, h: planeH(r, a[0] + dx * sa, a[1] + dz * sa), roof: rid });
    out.push({ s: sb, h: planeH(r, a[0] + dx * sb, a[1] + dz * sb), roof: rid });
  }
  return out;
}

export function derive(model: HouseModel): Derived {
  const walls: DWall[] = model.walls.map((w) => {
    const L = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]);
    const dx = (w.b[0] - w.a[0]) / L, dz = (w.b[1] - w.a[1]) / L;
    return { ...w, L, dx, dz, nx: -dz, nz: dx, ea: 0, eb: 0, s0: 0, s1: L, profile: [], dopenings: [], horizontal: isHoriz(w), minTop: 0, maxTop: 0 };
  });

  // junções
  for (const w of walls) {
    (['a', 'b'] as const).forEach((end) => {
      const p = w[end];
      let val = 0;
      if (w.kind === 'muro') {
        const hit = walls.filter((o) => o !== w && o.kind !== 'muro' && o.horizontal !== w.horizontal && (onAxisInterior(o, p) || atEnd(o, p)));
        if (hit.length) val = -Math.max(...hit.map((o) => o.t)) / 2;
      } else {
        const others = walls.filter((o) => o !== w && o.kind !== 'muro');
        const through = others.filter((o) => onAxisInterior(o, p) && o.horizontal !== w.horizontal);
        const coll = others.filter((o) => atEnd(o, p) && o.horizontal === w.horizontal);
        const perp = others.filter((o) => atEnd(o, p) && o.horizontal !== w.horizontal);
        if (through.length) val = -Math.max(...through.map((o) => o.t)) / 2;
        else if (coll.length) val = 0;
        else if (perp.length && w.horizontal) val = Math.max(...perp.map((o) => o.t)) / 2;
      }
      if (end === 'a') w.ea = val; else w.eb = val;
    });
    w.s0 = -w.ea; w.s1 = w.L + w.eb;
  }

  // perfil de topo
  for (const w of walls) {
    if (w.kind === 'muro' || w.height) {
      const h = w.height ?? 1.1;
      w.profile = [{ s: w.s0, h, roof: '-' }, { s: w.s1, h, roof: '-' }];
    } else {
      w.profile = computeProfile(model.roofs, w.a, w.dx, w.dz, w.L, w.s0, w.s1);
    }
    w.minTop = Math.min(...w.profile.map((p) => p.h));
    w.maxTop = Math.max(...w.profile.map((p) => p.h));
  }

  // cômodos
  const rooms: DRoom[] = model.rooms.map((r) => {
    const xs = r.polygon.map((p) => p[0]), zs = r.polygon.map((p) => p[1]);
    return { ...r, area: polygonArea(r.polygon), centroid: polygonCentroid(r.polygon), bbox: [[Math.min(...xs), Math.min(...zs)], [Math.max(...xs), Math.max(...zs)]] };
  });
  const roomById = new Map(rooms.map((r) => [r.id, r]));
  const roomAt = (x: number, z: number): DRoom | null => rooms.find((r) => pip(r.polygon, x, z)) ?? null;

  // aberturas
  for (const w of walls) {
    w.dopenings = w.openings.map((o) => {
      const s0 = o.center - o.w / 2, s1 = o.center + o.w / 2;
      const sMidX = w.a[0] + w.dx * o.center, sMidZ = w.a[1] + w.dz * o.center;
      const notch = o.sill <= 0.001;
      let swingSide: 1 | -1 = 1;
      if (o.type === 'door') {
        const off = w.t / 2 + 0.5;
        const r1 = roomAt(sMidX + w.nx * off, sMidZ + w.nz * off);
        const r2 = roomAt(sMidX - w.nx * off, sMidZ - w.nz * off);
        if (r1 && r2) swingSide = r1.area <= r2.area ? 1 : -1;
        else if (r1) swingSide = 1; else if (r2) swingSide = -1;
      }
      // verga limitada ao topo da parede no vão
      const topAtSpan = Math.min(...w.profile.filter((p) => p.s >= s0 - 1e-3 && p.s <= s1 + 1e-3).map((p) => p.h), interp(w.profile, s0), interp(w.profile, s1));
      const head = Math.min(o.sill + o.h, topAtSpan - 0.06);
      return { ...o, s0, s1, head, notch, swingSide };
    });
  }

  // limites
  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity, maxY = 0;
  for (const r of model.roofs) {
    for (const [x, z] of r.polygon) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z); maxY = Math.max(maxY, planeH(r, x, z) + model.params.roofThick); }
  }
  for (const [x, z] of model.slab.polygon) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z); }
  const min: V3 = [minX, -model.params.footingDepth, minZ];
  const max: V3 = [maxX, maxY, maxZ];
  const size: V3 = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
  const center: V3 = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
  const radius = Math.hypot(size[0], size[1], size[2]) / 2;

  const collision = buildCollision(walls, model.furniture);
  return {
    model, walls, wallById: new Map(walls.map((w) => [w.id, w])), rooms, roomById,
    roofById: new Map(model.roofs.map((r) => [r.id, r])),
    bbox: { min, max, center, size, radius }, collision, roomAt,
    topAt: (x, z, infl) => topAt(model.roofs, x, z, infl), levelName: model.levels[0]?.name ?? 'Térreo',
  };
}

export function interp(profile: ProfilePt[], s: number): number {
  if (!profile.length) return 2.8;
  let best = profile[0].h, bd = Infinity;
  for (let i = 0; i < profile.length - 1; i += 2) {
    const a = profile[i], b = profile[i + 1];
    if (s >= a.s - 1e-6 && s <= b.s + 1e-6) {
      const t = b.s === a.s ? 0 : (s - a.s) / (b.s - a.s);
      return a.h + (b.h - a.h) * t;
    }
    const d = Math.min(Math.abs(s - a.s), Math.abs(s - b.s));
    if (d < bd) { bd = d; best = Math.abs(s - a.s) < Math.abs(s - b.s) ? a.h : b.h; }
  }
  return best;
}

// ------------------------------------------------------------------ colisão (modo interior)
export function buildCollision(walls: DWall[], furniture: Furniture[]): Rect[] {
  const rects: Rect[] = [];
  for (const w of walls) {
    const pass = w.dopenings.filter((o) => o.passable ?? o.type !== 'window').map((o) => [o.s0 + 0.03, o.s1 - 0.03] as [number, number]).sort((p, q) => p[0] - q[0]);
    const solid: [number, number][] = [];
    let cur = w.s0;
    for (const [a, b] of pass) {
      if (a > cur) solid.push([cur, a]);
      cur = Math.max(cur, b);
    }
    if (cur < w.s1) solid.push([cur, w.s1]);
    for (const [sa, sb] of solid) {
      const xa = w.a[0] + w.dx * sa, za = w.a[1] + w.dz * sa, xb = w.a[0] + w.dx * sb, zb = w.a[1] + w.dz * sb;
      const ht = w.t / 2;
      const x0 = Math.min(xa, xb) - (w.horizontal ? 0 : ht), x1 = Math.max(xa, xb) + (w.horizontal ? 0 : ht);
      const z0 = Math.min(za, zb) - (w.horizontal ? ht : 0), z1 = Math.max(za, zb) + (w.horizontal ? ht : 0);
      rects.push({ x0, x1, z0, z1, id: w.id, kind: w.kind === 'muro' ? 'muro' : 'parede' });
    }
  }
  for (const f of furniture) {
    if (f.kind === 'rug' || f.kind === 'plant' || f.kind === 'pendant') continue;
    // w e d são as extensões em planta (eixos X e Z); a rotação só orienta a frente do móvel
    const hw = f.w / 2, hd = f.d / 2;
    rects.push({ x0: f.x - hw, x1: f.x + hw, z0: f.z - hd, z1: f.z + hd, id: f.id, kind: 'movel' });
  }
  return rects;
}

/** Move um círculo (raio r) por (dx,dz) deslizando contra retângulos. */
export function moveWithCollision(pos: V2, dx: number, dz: number, r: number, rects: Rect[]): V2 {
  let x = pos[0] + dx, z = pos[1] + dz;
  for (let it = 0; it < 3; it++) {
    for (const q of rects) {
      const cx = Math.max(q.x0, Math.min(x, q.x1)), cz = Math.max(q.z0, Math.min(z, q.z1));
      const ddx = x - cx, ddz = z - cz;
      const d2 = ddx * ddx + ddz * ddz;
      if (d2 < r * r) {
        if (d2 > 1e-10) {
          const d = Math.sqrt(d2);
          x = cx + (ddx / d) * r; z = cz + (ddz / d) * r;
        } else {
          // centro dentro do retângulo: empurra pela menor penetração
          const pl = x - q.x0, pr = q.x1 - x, pt = z - q.z0, pb = q.z1 - z;
          const m = Math.min(pl, pr, pt, pb);
          if (m === pl) x = q.x0 - r; else if (m === pr) x = q.x1 + r; else if (m === pt) z = q.z0 - r; else z = q.z1 + r;
        }
      }
    }
  }
  return [x, z];
}

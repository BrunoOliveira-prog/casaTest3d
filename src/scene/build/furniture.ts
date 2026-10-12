import * as THREE from 'three';
import { Ctx, register, fmt } from './rig';
import { box, cyl } from './geom';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { Furniture } from '../../data/house/types';
import { potPlantGeometry } from './vegetation';

const MAT_KEY: Record<string, string> = {
  'madeira-clara': 'woodLight', 'madeira-escura': 'woodDark', 'tecido-claro': 'fabric', louca: 'louca', inox: 'inox',
  bancada: 'bancada', branco: 'white', vidro: 'glass', preto: 'black',
};
const FLOOR_Y = 0.02;

type B = (w: number, h: number, d: number, x: number, y: number, z?: number, m?: THREE.Material) => THREE.Mesh;

/** Constrói o móvel no referencial local: origem no centro da pegada, no piso; frente = +z (salvo indicação). */
function make(f: Furniture, ctx: Ctx, lw: number, ld: number): THREE.Group {
  const M = ctx.mats.m;
  const main = M[MAT_KEY[f.material] ?? 'woodLight'];
  const g = new THREE.Group();
  const b: B = (w, h, d, x, y, z = 0, m = main) => { const me = box(w, h, d, x, y + h / 2, z, m); g.add(me); return me; };
  const rb = (w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material = main, r = 0.04) => {
    const me = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3)), m);
    me.position.set(x, y + h / 2, z); g.add(me); return me;
  };
  const c = (r: number, h: number, x: number, y: number, z: number, m: THREE.Material = main, seg = 18) => { const me = cyl(r, r, h, x, y + h / 2, z, m, seg); g.add(me); return me; };
  const h = f.h;

  switch (f.kind) {
    case 'bed': {
      rb(lw, 0.2, ld, 0, 0.1, 0, M.woodLight, 0.02);                                   // estrado
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) b(0.06, 0.1, 0.06, sx * (lw / 2 - 0.05), 0, sz * (ld / 2 - 0.05), M.woodDark);
      rb(lw - 0.04, h - 0.3, ld - 0.06, 0, 0.3, 0.01, M.fabric, 0.06);                  // colchão
      rb(lw - 0.0, 0.03, ld * 0.58, 0, h - 0.02, ld * 0.2, M.fabricDark, 0.015);        // manta
      const np = lw > 1.4 ? 2 : 1;
      for (let i = 0; i < np; i++) { const pw = (lw - 0.14) / np - 0.05; rb(pw, 0.13, 0.4, -lw / 2 + 0.07 + ((lw - 0.14) / np) * (i + 0.5), h - 0.02, -ld / 2 + 0.34, M.white, 0.06).rotation.x = -0.18; }
      rb(lw + 0.1, h + 0.45, 0.08, 0, 0, -ld / 2 - 0.0, M.woodDark, 0.02);              // cabeceira
      break;
    }
    case 'nightstand': {
      b(lw, h, ld, 0, 0, 0);
      b(lw - 0.06, 0.012, 0.012, 0, h * 0.62, ld / 2 + 0.002, M.woodDark);
      b(0.1, 0.02, 0.02, 0, h * 0.72, ld / 2 + 0.012, M.inox);
      break;
    }
    case 'wardrobe': {
      b(lw, h, ld, 0, 0);
      const n = lw > 1.4 ? 4 : lw > 0.8 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const x = -lw / 2 + (lw / n) * (i + 0.5);
        b(lw / n - 0.02, h - 0.1, 0.012, x, 0.05, ld / 2 + 0.004, M.woodLight);
        b(0.012, 0.3, 0.02, x + (i % 2 ? -1 : 1) * (lw / n / 2 - 0.05), h * 0.45, ld / 2 + 0.02, M.inox);
      }
      break;
    }
    case 'cabinet': {
      b(lw, h, ld, 0, 0);
      for (let i = 0; i < 3; i++) {
        b(lw - 0.06, h / 3 - 0.05, 0.012, 0, 0.03 + (h / 3) * i, ld / 2 + 0.004, M.woodLight);
        b(0.12, 0.015, 0.02, 0, 0.03 + (h / 3) * i + (h / 3 - 0.05) / 2, ld / 2 + 0.018, M.inox);
      }
      break;
    }
    case 'toilet': {
      b(lw * 0.95, 0.38, 0.2, 0, 0, -ld / 2 + 0.11, M.louca);
      const bowl = c(lw * 0.45, 0.4, 0, 0, 0.1, M.louca, 20); bowl.scale.z = (ld - 0.25) / (lw * 0.9);
      b(lw * 0.95, 0.02, ld - 0.25, 0, 0.4, 0.1, M.louca);
      break;
    }
    case 'basin': {
      b(lw, h - 0.2, ld, 0, 0, 0, M.woodLight);
      b(lw + 0.02, 0.04, ld + 0.02, 0, h - 0.2, 0, M.bancada);
      const cu = c(0.17, 0.03, 0, h - 0.17, 0.02, M.louca, 24); cu.scale.z = 0.8;
      c(0.015, 0.16, 0, h - 0.17, -ld / 2 + 0.06, M.inox, 8);
      b(0.012, 0.012, 0.1, 0, h - 0.01, -ld / 2 + 0.12, M.inox);
      break;
    }
    case 'shower': {
      b(lw, 0.05, ld, 0, 0, 0, M.louca);
      const t = 0.012;
      const gl = (w: number, hh: number, d: number, x: number, z: number) => { const me = b(w, hh, d, x, 0.05, z, M.glass); me.userData.noEdges = true; me.castShadow = false; };
      gl(lw, h - 0.05, t, 0, ld / 2);
      gl(t, h - 0.05, ld, lw / 2, 0);
      b(lw, 0.02, 0.02, 0, h - 0.02, ld / 2, M.frame);
      b(0.02, 0.02, ld, lw / 2, h - 0.02, 0, M.frame);
      c(0.012, 1.0, -lw / 2 + 0.06, 1.05, -ld / 2 + 0.05, M.inox, 8);
      c(0.09, 0.02, -lw / 2 + 0.12, 2.0, -ld / 2 + 0.12, M.inox, 16);
      break;
    }
    case 'desk': {
      b(lw, 0.035, ld, 0, h - 0.035);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) b(0.04, h - 0.035, 0.04, sx * (lw / 2 - 0.04), 0, sz * (ld / 2 - 0.04), M.woodDark);
      b(0.38, h - 0.07, ld - 0.08, lw / 2 - 0.23, 0.0, 0, M.woodLight);
      break;
    }
    case 'chair': {
      rb(lw, 0.045, ld, 0, 0.43, 0, main, 0.02);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const l = b(0.032, 0.43, 0.032, sx * (lw / 2 - 0.035), 0, sz * (ld / 2 - 0.035), M.woodDark); l.rotation.set(sz * 0.05, 0, -sx * 0.05); }
      rb(lw - 0.02, 0.2, 0.025, 0, h - 0.22, -ld / 2 + 0.02, main, 0.012).rotation.x = -0.1;
      rb(lw - 0.02, 0.025, 0.025, 0, h - 0.02, -ld / 2 + 0.03, M.woodDark, 0.01);
      for (const sx of [-1, 1]) b(0.025, h - 0.45, 0.025, sx * (lw / 2 - 0.035), 0.45, -ld / 2 + 0.03, M.woodDark);
      break;
    }
    case 'shelf': {
      const t = 0.025;
      b(t, h, ld, -lw / 2 + t / 2, 0, 0); b(t, h, ld, lw / 2 - t / 2, 0, 0); b(lw, h, 0.01, 0, 0, -ld / 2 + 0.005, M.woodDark);
      const ns = 5;
      for (let i = 0; i <= ns; i++) b(lw, t, ld, 0, (i * (h - t)) / ns, 0);
      const cols = ['#b24c3d', '#3f6b8a', '#d8c8a8', '#5c7a55', '#c99a3c'];
      for (let i = 0; i < ns; i++) for (let k = 0; k < 4; k++) {
        const bm = new THREE.MeshStandardMaterial({ color: cols[(i + k) % cols.length], roughness: 0.8 }); ctx.sysMats.push(bm);
        b(0.03, 0.2 + ((i * 7 + k * 3) % 5) * 0.015, ld * 0.55, -lw / 2 + 0.1 + k * 0.14, (i * (h - t)) / ns + t, 0, bm);
      }
      break;
    }
    case 'bench': {
      b(lw, 0.05, ld, 0, h - 0.05);
      b(0.05, h - 0.05, ld - 0.04, -lw / 2 + 0.1, 0, 0, M.woodDark); b(0.05, h - 0.05, ld - 0.04, lw / 2 - 0.1, 0, 0, M.woodDark);
      break;
    }
    case 'planter': {
      b(lw, h, ld, 0, 0);
      b(lw - 0.06, 0.02, ld - 0.06, 0, h - 0.005, 0, M.soil);
      for (let i = 0; i < 3; i++) { const lf = new THREE.Mesh(potPlantGeometry(21 + i), M.plantVertex); lf.position.set(0, h, -ld / 2 + 0.35 + i * (ld - 0.7) / 2); lf.scale.setScalar(0.8); g.add(lf); }
      break;
    }
    case 'sofaL': {
      // costas ao leste (+x), voltado para o oeste; chaise ao sul (+z)
      const seatH = 0.44, bk = 0.26, depth = 0.95;
      rb(lw - 0.04, 0.08, ld - 0.04, 0, 0.1, 0, M.fabricDark, 0.02);   // base
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) b(0.05, 0.1, 0.05, sx * (lw / 2 - 0.12), 0, sz * (ld / 2 - 0.12), M.woodDark);
      // assentos (módulos almofadados)
      const n = 3, mod = (ld - depth * 0.0) / n;
      for (let i = 0; i < n; i++) rb(depth - bk * 0.2, 0.2, mod - 0.02, lw / 2 - depth / 2 - bk * 0.4, 0.18, -ld / 2 + mod * (i + 0.5), main, 0.07);
      rb(lw - depth * 0.95, 0.2, 0.98, -depth * 0.45, 0.18, ld / 2 - 0.5, main, 0.07);
      // encosto e braços
      rb(bk, h - 0.3, ld - 0.02, lw / 2 - bk / 2, 0.28, 0, main, 0.08);
      rb(lw - 0.02, h - 0.3, bk, 0, 0.28, ld / 2 - bk / 2, main, 0.08);
      rb(lw - 0.02, 0.2, 0.18, 0, 0.3, -ld / 2 + 0.09, main, 0.07);
      // almofadas de encosto e decorativas
      for (let i = 0; i < n; i++) { const m = rb(0.2, 0.46, mod - 0.1, lw / 2 - bk - 0.1, seatH + 0.0, -ld / 2 + mod * (i + 0.5), main, 0.09); m.rotation.z = 0.16; }
      const dec = rb(0.14, 0.34, 0.34, lw / 2 - bk - 0.22, seatH + 0.12, -ld / 2 + 0.38, M.woodLight, 0.06); dec.rotation.set(0, 0.4, 0.2);
      break;
    }
    case 'rug': {
      b(lw, h, ld, 0, 0, 0, M.fabric);
      break;
    }
    case 'roundtable': {
      const r = lw / 2;
      c(r, 0.04, 0, h - 0.04, 0, main, 32);
      c(0.05, h - 0.04, 0, 0, 0, M.woodDark, 12);
      c(r * 0.5, 0.03, 0, 0, 0, M.woodDark, 24);
      break;
    }
    case 'tvunit': {
      // frente voltada para leste (+x); costas na parede oeste
      b(lw, 0.45, ld, 0, 0.0, 0);
      b(0.05, h - 0.45 + 0.55, ld - 0.4, -lw / 2 + 0.03, 0.45, 0, M.woodDark);
      const tv = b(0.035, 0.8, 1.45, -lw / 2 + 0.09, 1.0, 0, M.tvScreen); tv.userData.noEdges = true;
      b(0.012, 0.82, 1.47, -lw / 2 + 0.075, 0.99, 0, M.black);
      break;
    }
    case 'table': {
      b(lw, 0.045, ld, 0, h - 0.045);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) b(0.07, h - 0.045, 0.07, sx * (lw / 2 - 0.1), 0, sz * (ld / 2 - 0.1), M.woodDark);
      break;
    }
    case 'plant': {
      const pr = Math.min(lw, ld) * 0.34;
      c(pr, 0.42, 0, 0, 0, M.pot, 20).scale.set(1, 1, 1);
      c(pr * 0.94, 0.02, 0, 0.41, 0, M.soil, 20);
      const lf = new THREE.Mesh(potPlantGeometry(7 + f.id.length), M.plantVertex);
      lf.position.y = 0.42; lf.scale.setScalar(Math.max(0.7, (h - 0.4) / 0.9)); g.add(lf);
      break;
    }
    case 'counter': {
      const isIsland = f.id.includes('ILHA');
      b(lw, h - 0.04, ld - 0.04, 0, 0, -0.02, M.woodLight);
      b(lw + 0.02, 0.04, ld + (isIsland ? 0.12 : 0.02), 0, h - 0.04, isIsland ? 0 : 0, M.bancada);
      if (f.id.includes('BANC')) {
        b(0.55, 0.02, 0.4, -lw * 0.2, h - 0.0, 0, M.black).userData.noEdges = true; // cuba
        b(0.6, 0.012, 0.5, lw * 0.22, h, 0, M.black); // cooktop
        for (let i = 0; i < 4; i++) c(0.07, 0.008, lw * 0.22 + (i % 2 ? 0.14 : -0.14), h + 0.012, (i < 2 ? -0.1 : 0.1), M.inox, 14);
        c(0.012, 0.22, -lw * 0.2, h, -ld / 2 + 0.07, M.inox, 8);
      }
      break;
    }
    case 'fridge': {
      b(lw, h, ld, 0, 0, 0, M.inox);
      b(lw - 0.02, 0.012, 0.01, 0, h * 0.62, ld / 2 + 0.003, M.black);
      b(0.025, 0.5, 0.03, lw / 2 - 0.08, h * 0.66, ld / 2 + 0.02, M.black);
      b(0.025, 0.4, 0.03, lw / 2 - 0.08, h * 0.2, ld / 2 + 0.02, M.black);
      break;
    }
    case 'stool': {
      c(lw / 2, 0.045, 0, h - 0.045, 0, main, 20);
      for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + Math.PI / 4; c(0.015, h - 0.045, Math.cos(a) * lw * 0.3, 0, Math.sin(a) * lw * 0.3, M.woodDark, 6); }
      break;
    }
    case 'tank': {
      b(lw, h - 0.3, ld, 0, 0, 0, M.woodLight);
      b(lw, 0.3, ld, 0, h - 0.3, 0, main);
      b(lw - 0.12, 0.03, ld - 0.12, 0, h - 0.015, 0, M.louca);
      c(0.015, 0.2, 0, h, -ld / 2 + 0.06, M.inox, 8);
      break;
    }
    case 'washer': {
      b(lw, h, ld, 0, 0, 0, M.white);
      const dr = cyl(0.21, 0.21, 0.02, 0, h * 0.5, ld / 2 + 0.005, M.black, 24); dr.rotation.x = Math.PI / 2; g.add(dr);
      b(lw - 0.1, 0.05, 0.01, 0, h - 0.1, ld / 2 + 0.004, M.black);
      break;
    }
    case 'armchair': {
      rb(lw, 0.22, ld, 0, 0.14, 0, main, 0.07);
      rb(lw, h - 0.3, 0.2, 0, 0.3, -ld / 2 + 0.1, main, 0.08);
      rb(0.16, 0.24, ld - 0.14, -lw / 2 + 0.08, 0.3, 0.07, main, 0.07); rb(0.16, 0.24, ld - 0.14, lw / 2 - 0.08, 0.3, 0.07, main, 0.07);
      rb(lw - 0.34, 0.12, ld - 0.24, 0, 0.36, 0.08, M.fabric, 0.05);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const l = c(0.02, 0.15, sx * (lw / 2 - 0.08), 0, sz * (ld / 2 - 0.08), M.woodDark, 8); l.rotation.set(sz * 0.12, 0, -sx * 0.12); }
      break;
    }
    case 'pendant': {
      // pendente: canopla no forro, cabo e cúpula metálica com lâmpada (o forro acompanha o telhado inclinado)
      const ceil = ctx.d.topAt(f.x, f.z).h - FLOOR_Y - 0.01;
      const k = lw / 0.36;
      const prof = [[0.012, 0.24], [0.03, 0.235], [0.06, 0.215], [0.11, 0.16], [0.15, 0.09], [0.175, 0.03], [0.18, 0]].map(([r, y]) => new THREE.Vector2(r * k, y * k));
      const shade = new THREE.Mesh(new THREE.LatheGeometry(prof, 36), M.lampShade);
      shade.position.y = h; g.add(shade);
      const inner = new THREE.Mesh(new THREE.LatheGeometry(prof.map((p) => new THREE.Vector2(p.x * 0.97, p.y * 0.97)), 36), M.lampInner);
      inner.position.y = h + 0.004; g.add(inner);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.045 * k, 16, 12), M.lampBulb);
      bulb.position.y = h + 0.07 * k; g.add(bulb);
      const top = h + 0.24 * k;
      if (ceil > top + 0.02) c(0.004, ceil - top, 0, top, 0, M.black, 6);
      c(0.05, 0.02, 0, ceil - 0.02, 0, M.lampShade, 20);
      break;
    }
    default:
      b(lw, h, ld, 0, 0, 0);
  }
  return g;
}

export function buildFurniture(ctx: Ctx) {
  const { d } = ctx;
  const roomOrder = new Map<string, number>(d.rooms.map((r, i) => [r.id, i]));
  d.model.furniture.forEach((f, i) => {
    const rad = (f.rot * Math.PI) / 180;
    const swap = Math.abs(Math.sin(rad)) > 0.7;
    const lw = swap ? f.d : f.w, ld = swap ? f.w : f.d;
    const inner = make(f, ctx, lw, ld);
    const g = new THREE.Group();
    inner.position.y = FLOOR_Y;
    g.add(inner);
    g.position.set(f.x, 0, f.z);
    g.rotation.y = rad;
    const room = d.roomById.get(f.room);
    const oi = (roomOrder.get(f.room) ?? 0) / Math.max(1, d.rooms.length);
    register(ctx, {
      id: f.id, name: f.name, layer: 'mobiliario', kind: 'mobiliario', obj: g, room: room?.name ?? null,
      dims: `${fmt(f.w)} × ${fmt(f.d)} × ${fmt(f.h)} m (L × P × A)`, material: f.material, stageIdx: 4, src: f.src, note: f.note,
      anim: { stage: 4, a: 0.35 + oi * 0.4 + (i % 4) * 0.02, b: 0.58 + oi * 0.4 + (i % 4) * 0.02, style: 'drop', drop: 1.0 }, edges: false,
    });
  });
}

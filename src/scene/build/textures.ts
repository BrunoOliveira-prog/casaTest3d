import * as THREE from 'three';

/** Gerador pseudo-aleatório determinístico. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Ruído de valor periódico (tileável) com interpolação suave. `px`/`py` = período em células. */
function makeNoise(seed: number, px: number, py: number) {
  const r = rng(seed);
  const g = new Float32Array(px * py);
  for (let i = 0; i < g.length; i++) g[i] = r();
  const sm = (t: number) => t * t * (3 - 2 * t);
  return (x: number, y: number) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const fx = sm(x - xi), fy = sm(y - yi);
    const x0 = ((xi % px) + px) % px, x1 = (x0 + 1) % px;
    const y0 = ((yi % py) + py) % py, y1 = (y0 + 1) % py;
    const a = g[y0 * px + x0], b = g[y0 * px + x1], c = g[y1 * px + x0], d = g[y1 * px + x1];
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
}

/** fBm tileável: `u`,`v` em [0,1). */
export function fbmTile(seed: number, baseX: number, baseY: number, octaves: number) {
  const ns: ((x: number, y: number) => number)[] = [];
  for (let o = 0; o < octaves; o++) ns.push(makeNoise(seed + o * 31, baseX << o, baseY << o));
  return (u: number, v: number) => {
    let s = 0, amp = 1, norm = 0;
    for (let o = 0; o < octaves; o++) {
      s += ns[o](u * (baseX << o), v * (baseY << o)) * amp; norm += amp; amp *= 0.5;
    }
    return s / norm;
  };
}

export interface TexPair {
  map: THREE.CanvasTexture;
  /** altura em tons de cinza (mantido para quem preferir bumpMap) */
  bump: THREE.CanvasTexture;
  /** normal map em espaço tangente (convenção OpenGL, +Y = +v), derivado da altura por Sobel */
  normal: THREE.CanvasTexture;
  /** rugosidade no canal G (0 = espelho, 1 = fosco); ausente quando a função não define `r` */
  rough?: THREE.CanvasTexture;
}

function mk(c: HTMLCanvasElement, srgb: boolean, repeat: [number, number], aniso = 8) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = aniso;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

type PixelFn = (x: number, y: number, u: number, v: number) => [number, number, number] | number;

/** Preenche um canvas por pixel. Retorna cor [r,g,b] 0-255 ou um número (cinza). */
function paint(w: number, h: number, fn: PixelFn): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d')!;
  const im = g.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = fn(x, y, x / w, y / h);
      const i = (y * w + x) * 4;
      if (typeof o === 'number') { im.data[i] = im.data[i + 1] = im.data[i + 2] = o; } else { im.data[i] = o[0]; im.data[i + 1] = o[1]; im.data[i + 2] = o[2]; }
      im.data[i + 3] = 255;
    }
  }
  g.putImageData(im, 0, 0);
  return c;
}

const clamp = (v: number, a = 0, b = 255) => Math.min(b, Math.max(a, v));

/** Cada textura gera cor + relevo a partir da MESMA função de altura/cor, em um único passe. */
function pair(w: number, h: number, repeat: [number, number], fn: (x: number, y: number, u: number, v: number) => { c: [number, number, number]; h: number; r?: number }, strength = 1.5): TexPair {
  const cols = new Uint8ClampedArray(w * h * 3);
  const hs = new Float32Array(w * h);
  let rs: Uint8ClampedArray | null = null;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = fn(x, y, x / w, y / h);
      const i = y * w + x;
      cols[i * 3] = o.c[0]; cols[i * 3 + 1] = o.c[1]; cols[i * 3 + 2] = o.c[2];
      hs[i] = Math.min(1, Math.max(0, o.h));
      if (o.r !== undefined) { if (!rs) rs = new Uint8ClampedArray(w * h); rs[i] = clamp(o.r * 255); }
    }
  }
  const H = (x: number, y: number) => hs[(((y % h) + h) % h) * w + (((x % w) + w) % w)];
  const cc = paint(w, h, (x, y) => { const i = (y * w + x) * 3; return [cols[i], cols[i + 1], cols[i + 2]]; });
  const cb = paint(w, h, (x, y) => clamp(hs[y * w + x] * 255));
  // Sobel tileável → normal em espaço tangente. O canvas tem y para baixo e a textura é invertida (flipY): +y_pixel = −v.
  const cn = paint(w, h, (x, y) => {
    const dx = (H(x + 1, y - 1) + 2 * H(x + 1, y) + H(x + 1, y + 1)) - (H(x - 1, y - 1) + 2 * H(x - 1, y) + H(x - 1, y + 1));
    const dy = (H(x - 1, y + 1) + 2 * H(x, y + 1) + H(x + 1, y + 1)) - (H(x - 1, y - 1) + 2 * H(x, y - 1) + H(x + 1, y - 1));
    let nx = -dx * strength, ny = dy * strength, nz = 1;
    const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    return [clamp((nx * 0.5 + 0.5) * 255), clamp((ny * 0.5 + 0.5) * 255), clamp((nz * 0.5 + 0.5) * 255)];
  });
  const out: TexPair = { map: mk(cc, true, repeat), bump: mk(cb, false, repeat), normal: mk(cn, false, repeat) };
  if (rs) { const r = rs; out.rough = mk(paint(w, h, (x, y) => { const v = r[y * w + x]; return [v, v, v]; }), false, repeat); }
  return out;
}

// ------------------------------------------------------------------ reboco / massa fina
export function stuccoTex(): TexPair {
  const lo = fbmTile(11, 3, 3, 3), hi = fbmTile(71, 64, 64, 2), mid = fbmTile(5, 12, 12, 3);
  return pair(512, 512, [0.4, 0.4], (_x, _y, u, v) => {
    const a = lo(u, v), b = hi(u, v), m = mid(u, v);
    const k = 0.94 + (a - 0.5) * 0.06 + (m - 0.5) * 0.04 + (b - 0.5) * 0.025;
    return { c: [clamp(238 * k), clamp(232 * k), clamp(220 * k)], h: 0.5 + (b - 0.5) * 0.9 + (m - 0.5) * 0.3, r: 0.86 + (b - 0.5) * 0.12 };
  });
}

// ------------------------------------------------------------------ alvenaria bruta (bloco cerâmico)
export function blockTex(): TexPair {
  const n = fbmTile(3, 16, 16, 3);
  const r = rng(5);
  const rows = 4, cols = 3;
  const shade: number[][] = Array.from({ length: rows }, () => Array.from({ length: cols + 1 }, () => 0.86 + r() * 0.22));
  return pair(512, 256, [0.7, 1.4], (x, y, u, v) => {
    const rh = 256 / rows, bw = 512 / cols;
    const row = Math.floor(y / rh), off = row % 2 ? bw / 2 : 0;
    const xx = ((x + off) % 512 + 512) % 512;
    const col = Math.floor(xx / bw);
    const fx = xx - col * bw, fy = y - row * rh;
    const mortar = fy < 3 || fy > rh - 2 || fx < 3 || fx > bw - 2;
    const k = shade[row][col] * (0.92 + n(u, v) * 0.16);
    if (mortar) return { c: [150, 140, 128], h: 0.15 };
    return { c: [clamp(196 * k), clamp(150 * k), clamp(118 * k)], h: 0.62 + (n(u * 2, v * 2) - 0.5) * 0.3 };
  });
}

// ------------------------------------------------------------------ madeira (ripado vertical / frisos horizontais)
function timber(seed: number, vertical: boolean, boards: number, repeat: [number, number], tone: [number, number, number], gap: number): TexPair {
  const r = rng(seed);
  const S = 512;
  const per = Array.from({ length: boards }, () => ({ k: 0.86 + r() * 0.26, hue: (r() - 0.5) * 8 }));
  // fibras correm ao longo da tábua: variação rápida na largura, lenta no comprimento
  const G1 = vertical ? fbmTile(seed + 3, 40, 3, 3) : fbmTile(seed + 3, 3, 40, 3);
  const G2 = vertical ? fbmTile(seed + 9, 128, 6, 2) : fbmTile(seed + 9, 6, 128, 2);
  const knotX = Array.from({ length: boards }, () => (r() < 0.2 ? 0.1 + r() * 0.8 : -1));
  return pair(S, S, repeat, (_x, _y, u, v) => {
    const along = vertical ? v : u, across = vertical ? u : v;
    const bi = Math.min(boards - 1, Math.floor(across * boards));
    const f = across * boards - bi;
    const p = per[bi];
    const g1 = G1(u, v), g2 = G2(u, v);
    let k = p.k * (0.92 + g1 * 0.14 + (g2 - 0.5) * 0.1);
    let hh = 0.55 + (g2 - 0.5) * 0.4;
    const kx = knotX[bi];
    if (kx >= 0) {
      const dx = (along - kx) * 7, dy = (f - 0.5) * 2.6;
      const d = Math.hypot(dx * 1.2, dy);
      if (d < 0.5) { k *= 0.78 + d * 0.4; hh -= (0.5 - d) * 0.35; }
    }
    const edge = Math.min(f, 1 - f);
    if (edge < gap) return { c: [38, 20, 10], h: 0.02, r: 1 };
    const bevel = Math.min(1, edge / (gap * 3));
    k *= 0.88 + 0.12 * bevel;
    return { c: [clamp(tone[0] * k + p.hue), clamp(tone[1] * k), clamp(tone[2] * k - p.hue * 0.4)], h: clamp(hh * (0.8 + 0.2 * bevel), 0, 1), r: 0.5 + (g2 - 0.5) * 0.3 + (1 - bevel) * 0.15 };
  });
}
export const timberVTex = () => timber(21, true, 8, [1, 1], [168, 98, 48], 0.02);
export const timberHTex = () => timber(33, false, 8, [0.5, 0.9], [176, 108, 56], 0.022);

// ------------------------------------------------------------------ telha metálica standing seam
export function roofSeamTex(): TexPair {
  const n = fbmTile(8, 4, 4, 3), f = fbmTile(15, 2, 96, 2);
  const S = 512, panels = 2;
  return pair(S, S, [1, 1], (x, y, u, v) => {
    const pw = S / panels;
    const px = ((x % pw) + pw) % pw;
    const idx = Math.floor(x / pw);
    // nervura: pico estreito na borda de cada painel + sombra de um lado
    const rib = Math.exp(-Math.pow((px - 6) / 4.2, 2));
    const lip = Math.exp(-Math.pow((px - 14) / 5, 2));
    const panelTone = 0.94 + ((idx * 37) % 7) * 0.012 + (n(u, v) - 0.5) * 0.06 + (f(u, v) - 0.5) * 0.05;
    // leve ondulação transversal (oil-canning) para refletir luz
    const pan = Math.sin((px / pw) * Math.PI) * 0.03;
    let k = panelTone + pan;
    k += rib * 0.34 - lip * 0.14;
    return { c: [clamp(122 * k), clamp(127 * k), clamp(134 * k)], h: 0.3 + rib * 0.65 + (f(u, v) - 0.5) * 0.04, r: 0.36 + (f(u, v) - 0.5) * 0.22 + (n(u, v) - 0.5) * 0.12 - rib * 0.08 };
  });
}

// ------------------------------------------------------------------ concreto liso com juntas (calçada, garagem)
export function concreteTex(joint: boolean, base: [number, number, number], rep: [number, number], seed = 61): TexPair {
  const lo = fbmTile(seed, 4, 4, 4), hi = fbmTile(seed + 7, 80, 80, 2);
  return pair(512, 512, rep, (x, y, u, v) => {
    const a = lo(u, v), b = hi(u, v);
    let k = 0.93 + (a - 0.5) * 0.12 + (b - 0.5) * 0.07;
    let h = 0.55 + (b - 0.5) * 0.5;
    if (joint) {
      const e = Math.min(x, 512 - x, y, 512 - y);
      const jx = x < 2 || y < 2;
      if (jx) { k *= 0.6; h = 0.05; } else if (e < 5) { h = 0.35; k *= 0.96; }
    }
    return { c: [clamp(base[0] * k), clamp(base[1] * k), clamp(base[2] * k)], h, r: 0.82 + (a - 0.5) * 0.25 + (b - 0.5) * 0.1 };
  });
}

// ------------------------------------------------------------------ pisos internos
export function floorWoodTex(): TexPair {
  const r = rng(77);
  const grain = fbmTile(78, 3, 80, 3);
  const rows = 6;
  const planks: { off: number; k: number }[][] = Array.from({ length: rows }, () => {
    const arr: { off: number; k: number }[] = [];
    let x = -r() * 0.4;
    while (x < 1.2) { const len = 0.35 + r() * 0.35; arr.push({ off: x, k: 0.88 + r() * 0.24 }); x += len; }
    return arr;
  });
  return pair(512, 512, [1 / 1.2, 1 / 1.2], (_x, y, u, v) => {
    const row = Math.min(rows - 1, Math.floor(v * rows));
    const fy = v * rows - row;
    const list = planks[row];
    let pl = list[0];
    for (const p of list) if (u >= p.off) pl = p;
    const nxt = list[list.indexOf(pl) + 1];
    const endDist = Math.min(u - pl.off, nxt ? nxt.off - u : 1);
    const g = grain(v * 1.0 + row * 0.13, u);
    const k = pl.k * (0.9 + g * 0.2);
    const gap = Math.min(fy, 1 - fy) < 0.03 || (endDist >= 0 && endDist < 0.0025);
    if (gap) return { c: [90, 62, 38], h: 0.05, r: 0.9 };
    return { c: [clamp(206 * k), clamp(166 * k), clamp(118 * k)], h: 0.6 + (g - 0.5) * 0.3, r: 0.36 + (g - 0.5) * 0.18 };
  });
}
export function floorTileTex(): TexPair {
  const lo = fbmTile(3, 5, 5, 4);
  return pair(512, 512, [1 / 1.2, 1 / 1.2], (x, y, u, v) => {
    const a = lo(u, v);
    const k = 0.95 + (a - 0.5) * 0.1;
    const half = 256;
    const gx = Math.min(x % half, half - (x % half)), gy = Math.min(y % half, half - (y % half));
    if (Math.min(gx, gy) < 1.5) return { c: [150, 148, 140], h: 0.1, r: 0.95 };
    return { c: [clamp(224 * k), clamp(222 * k), clamp(214 * k)], h: 0.6, r: 0.16 + (a - 0.5) * 0.1 };
  });
}

// ------------------------------------------------------------------ terreno e canteiros
export function groundTex(): TexPair {
  const lo = fbmTile(45, 3, 3, 4), hi = fbmTile(46, 96, 96, 2);
  return pair(512, 512, [11, 11], (_x, _y, u, v) => {
    const a = lo(u, v), b = hi(u, v);
    const k = 0.95 + (a - 0.5) * 0.1 + (b - 0.5) * 0.12;
    return { c: [clamp(176 * k), clamp(173 * k), clamp(165 * k)], h: 0.5 + (b - 0.5) * 0.7 };
  });
}
export function mulchTex(): TexPair {
  const r = rng(9);
  const S = 512;
  const stones = Array.from({ length: 900 }, () => ({ x: r() * S, y: r() * S, s: 2.2 + r() * 4.2, k: 0.55 + r() * 0.7, t: r() }));
  const buf = new Float32Array(S * S * 4); // r,g,b,h
  for (let i = 0; i < S * S; i++) { buf[i * 4] = 78; buf[i * 4 + 1] = 58; buf[i * 4 + 2] = 44; buf[i * 4 + 3] = 0.2; }
  for (const s of stones) {
    const rad = Math.ceil(s.s);
    for (let dy = -rad; dy <= rad; dy++) {
      for (let dx = -rad; dx <= rad; dx++) {
        const d = Math.hypot(dx, dy) / s.s;
        if (d > 1) continue;
        const px = (((s.x + dx) | 0) % S + S) % S, py = (((s.y + dy) | 0) % S + S) % S;
        const i = (py * S + px) * 4;
        const lum = s.k * (1 - d * 0.35);
        const warm = s.t < 0.6;
        buf[i] = (warm ? 150 : 128) * lum; buf[i + 1] = (warm ? 122 : 124) * lum; buf[i + 2] = (warm ? 96 : 118) * lum;
        buf[i + 3] = 0.45 + (1 - d) * 0.5;
      }
    }
  }
  return pair(S, S, [5, 5], (x, y) => { const i = (y * S + x) * 4; return { c: [clamp(buf[i]), clamp(buf[i + 1]), clamp(buf[i + 2])], h: buf[i + 3], r: 0.8 + (1 - buf[i + 3]) * 0.2 }; }, 2.5);
}

// ------------------------------------------------------------------ tecido / madeira de móveis (leves)
export function linenTex(): TexPair {
  const hi = fbmTile(90, 128, 128, 1);
  return pair(256, 256, [3, 3], (x, y, u, v) => {
    const weave = ((x >> 1) + (y >> 1)) % 2 ? 0.03 : -0.03;
    const k = 0.96 + (hi(u, v) - 0.5) * 0.06 + weave;
    return { c: [clamp(222 * k), clamp(217 * k), clamp(206 * k)], h: 0.5 + weave * 3 };
  });
}

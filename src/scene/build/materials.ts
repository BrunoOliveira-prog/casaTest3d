import * as THREE from 'three';
import type { Overrides } from '../../data/house/types';

import * as TX from './textures';

export interface MatLib {
  m: Record<string, THREE.Material>;
  /** materiais que ficam translúcidos no raio-X */
  xray: THREE.Material[];
  /** materiais que mudam de lado (double side) em cortes */
  solids: THREE.Material[];
  setColors(c: NonNullable<Overrides['colors']>): void;
  setXray(on: boolean, opacity: number): void;
  /** ajustes que dependem da qualidade gráfica (vidro com transmissão real na Alta) */
  setQuality(level: 'baixa' | 'media' | 'alta'): void;
  /** liga/desliga o plano de corte em todos os materiais (inclui sombras); `extra` = materiais fora da biblioteca */
  setSection(plane: THREE.Plane | null, extra?: THREE.Material[]): void;
  dispose(): void;
  tmp: THREE.Texture[];
}

export function createMaterials(): MatLib {
  const tex: THREE.Texture[] = [];
  const T = <A extends THREE.Texture>(t: A) => { tex.push(t); return t; };

  // texturas procedurais PBR (cor + relevo) — sem arquivos remotos
  const P = (t: TX.TexPair) => { tex.push(t.map, t.bump, t.normal); if (t.rough) tex.push(t.rough); return t; };
  /** parâmetros PBR: cor + normal map (+ mapa de rugosidade, que então manda na rugosidade) */
  const pbr = (t: TX.TexPair, ns: number): THREE.MeshStandardMaterialParameters => ({
    map: t.map, normalMap: t.normal, normalScale: new THREE.Vector2(ns, ns),
    ...(t.rough ? { roughnessMap: t.rough, roughness: 1 } : {}),
  });
  const plaster = P(TX.stuccoTex());
  const block = P(TX.blockTex());
  const timberV = P(TX.timberVTex());
  const timberH = P(TX.timberHTex());
  const floorWood = P(TX.floorWoodTex());
  const floorTile = P(TX.floorTileTex());
  const floorCement = P(TX.concreteTex(true, [186, 186, 180], [1 / 1.6, 1 / 1.6], 14));
  const roofSeam = P(TX.roofSeamTex());
  const roofSeamX: TX.TexPair = { map: roofSeam.map.clone(), bump: roofSeam.bump.clone(), normal: roofSeam.normal.clone(), rough: roofSeam.rough?.clone() };
  for (const t of [roofSeamX.map, roofSeamX.bump, roofSeamX.normal, roofSeamX.rough]) { if (!t) continue; t.rotation = Math.PI / 2; t.center.set(0.5, 0.5); t.needsUpdate = true; tex.push(t); }
  const ground = P(TX.groundTex());
  const mulch = P(TX.mulchTex());
  const pathTex = P(TX.concreteTex(true, [214, 208, 198], [1 / 1.2, 1 / 1.2], 91));
  const driveTex = P(TX.concreteTex(true, [196, 190, 181], [1 / 3.2, 1 / 3.2], 33));
  const concrete = P(TX.concreteTex(false, [168, 168, 162], [0.5, 0.5], 61));
  const linen = P(TX.linenTex());

  const std = (p: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(p);

  const m: Record<string, THREE.Material> = {
    wallRaw: std({ color: '#ffffff', roughness: 0.95, ...pbr(block, 0.6) }),
    wallFinish: std({ color: '#ffffff', roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -1.5, polygonOffsetUnits: -1.5, ...pbr(plaster, 0.09) }),
    reboco: std({ color: '#ffffff', roughness: 0.9, ...pbr(plaster, 0.09) }),
    concrete: std({ color: '#ffffff', roughness: 0.95, ...pbr(concrete, 0.35) }),
    concreteDark: std({ color: '#8a8984', roughness: 0.98 }),
    timberV: std({ color: '#ffffff', roughness: 0.55, ...pbr(timberV, 0.8) }),
    timberH: std({ color: '#ffffff', roughness: 0.55, ...pbr(timberH, 0.8) }),
    timberRaw: std({ color: '#c8a36e', roughness: 0.8 }),
    floorWood: std({ color: '#ffffff', roughness: 0.42, ...pbr(floorWood, 0.4) }),
    floorTile: std({ color: '#ffffff', roughness: 0.28, ...pbr(floorTile, 0.3) }),
    floorCement: std({ color: '#ffffff', roughness: 0.8, ...pbr(floorCement, 0.3) }),
    roofZ: std({ color: '#ffffff', roughness: 0.5, metalness: 0.18, ...pbr(roofSeam, 1.0) }),
    roofX: std({ color: '#ffffff', roughness: 0.5, metalness: 0.18, ...pbr(roofSeamX, 1.0) }),
    fascia: std({ color: '#555a60', roughness: 0.5, metalness: 0.35 }),
    roofUnder: std({ color: '#e9e3d6', roughness: 0.9, side: THREE.BackSide }),
    gutter: std({ color: '#5e6469', roughness: 0.4, metalness: 0.7 }),
    grass: std({ color: '#ffffff', roughness: 1, ...pbr(ground, 0.14) }),
    // chão "infinito" ao redor do terreno: cor média da textura do terreno, sem repetição visível ao longe
    groundFar: std({ color: '#a8a59d', roughness: 1 }),
    soil: std({ color: '#9b958a', roughness: 1 }),
    mulch: std({ color: '#ffffff', roughness: 1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1, ...pbr(mulch, 1.0) }),
    curb: std({ color: '#52565a', roughness: 0.45, metalness: 0.7 }),
    path: std({ color: '#ffffff', roughness: 0.92, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, ...pbr(pathTex, 0.3) }),
    drive: std({ color: '#ffffff', roughness: 0.94, polygonOffset: true, polygonOffsetFactor: -1.5, polygonOffsetUnits: -1.5, ...pbr(driveTex, 0.3) }),
    frame: std({ color: '#1c1d1f', roughness: 0.45, metalness: 0.6 }),
    glass: new THREE.MeshPhysicalMaterial({ color: '#cfe3ea', roughness: 0.04, metalness: 0, transparent: true, opacity: 0.26, side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 1.2 }),
    doorDark: std({ color: '#8a5a36', roughness: 0.55 }),
    doorLight: std({ color: '#d9cdb9', roughness: 0.6 }),
    // mobiliário
    woodLight: std({ color: '#cfae82', roughness: 0.6 }),
    woodDark: std({ color: '#7a4a2a', roughness: 0.6 }),
    fabric: std({ color: '#ffffff', roughness: 1, ...pbr(linen, 0.3) }),
    fabricDark: std({ color: '#8d8a82', roughness: 1 }),
    white: std({ color: '#f4f3ef', roughness: 0.5 }),
    louca: std({ color: '#fbfbf9', roughness: 0.18 }),
    inox: std({ color: '#c9cdd0', roughness: 0.3, metalness: 0.85 }),
    bancada: std({ color: '#e6e2da', roughness: 0.3 }),
    lampShade: std({ color: '#1d1e20', roughness: 0.45, metalness: 0.55, side: THREE.DoubleSide }),
    lampInner: std({ color: '#f3ead8', emissive: '#ffd9a6', emissiveIntensity: 0.6, roughness: 0.6, side: THREE.BackSide }),
    lampBulb: std({ color: '#fff3dc', emissive: '#ffd59a', emissiveIntensity: 3.2, roughness: 0.3 }),
    tvScreen: std({ color: '#0b0c0e', roughness: 0.08, metalness: 0.4 }),
    black: std({ color: '#222426', roughness: 0.35, metalness: 0.2 }),
    plantGreen: std({ color: '#5f8a4a', roughness: 0.9 }),
    plantVertex: std({ vertexColors: true, roughness: 0.9, color: '#ffffff', side: THREE.DoubleSide }),
    pot: std({ color: '#8a8478', roughness: 0.9 }),
    skylightGlass: new THREE.MeshPhysicalMaterial({ color: '#bfdcec', roughness: 0.05, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false }),
    lightEmit: std({ color: '#fff6dc', emissive: '#ffe9b0', emissiveIntensity: 0.9, roughness: 0.5 }),
    highlight: new THREE.MeshBasicMaterial({ color: '#9DC7BE', transparent: true, opacity: 0.42, depthTest: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }),
    hover: new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.18, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }),
  };

  const xray = [m.groundFar, m.fascia, m.mulch, m.curb, m.drive, m.wallRaw, m.wallFinish, m.reboco, m.timberV, m.timberH, m.floorWood, m.floorTile, m.floorCement, m.roofZ, m.roofX, m.roofUnder, m.grass, m.soil, m.concrete, m.path, m.gutter];
  const solids = [m.groundFar, m.fascia, m.mulch, m.drive, m.wallRaw, m.wallFinish, m.reboco, m.timberV, m.timberH, m.roofZ, m.roofX, m.grass, m.soil, m.concrete, m.concreteDark];

  const base: Record<string, string> = {};
  const lib: MatLib = {
    m, xray, solids, tmp: tex,
    setColors(c) {
      const set = (mat: THREE.Material, col: string | undefined, def: string) => { (mat as THREE.MeshStandardMaterial).color.set(col ?? def); };
      set(m.wallFinish, c.reboco, '#ffffff'); set(m.reboco, c.reboco, '#ffffff');
      set(m.timberV, c.madeira, '#ffffff'); set(m.timberH, c.madeira, '#ffffff');
      set(m.roofZ, c.telha, '#ffffff'); set(m.roofX, c.telha, '#ffffff');
      set(m.frame, c.esquadria, '#1c1d1f');
    },
    setQuality(level) {
      const g = m.glass as THREE.MeshPhysicalMaterial;
      const hi = level === 'alta';
      g.transmission = hi ? 1 : 0;
      g.transparent = !hi;
      g.opacity = hi ? 1 : 0.26;
      g.roughness = hi ? 0.015 : 0.04;
      g.thickness = 0.012; g.ior = 1.52;
      g.color.set(hi ? '#f1f7f5' : '#cfe3ea');
      g.envMapIntensity = hi ? 1.0 : 1.2;
      g.needsUpdate = true;
    },
    setXray(on, opacity) {
      for (const mat of xray) {
        mat.transparent = on; mat.opacity = on ? opacity : 1; mat.depthWrite = !on; mat.needsUpdate = true;
      }
    },
    setSection(plane, extra = []) {
      const on = !!plane;
      for (const mat of [...Object.values(m), ...extra]) {
        mat.clippingPlanes = on ? [plane!] : null;
        mat.clipShadows = on;
        mat.needsUpdate = true;
      }
      for (const mat of solids) mat.side = on ? THREE.DoubleSide : THREE.FrontSide;
      m.roofUnder.side = on ? THREE.DoubleSide : THREE.BackSide;
    },
    dispose() {
      Object.values(m).forEach((x) => x.dispose());
      tex.forEach((t) => t.dispose());
      void base;
    },
  };
  return lib;
}

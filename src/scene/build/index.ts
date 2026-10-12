import * as THREE from 'three';
import type { HouseModel } from '../../data/house/types';
import { derive } from '../../data/house/derive';
import { EXPLODE_ORDER, layersFor } from '../../data/config';
import { createMaterials, MatLib } from './materials';
import { Ctx, Elem, Rig } from './rig';
import { buildCladding, buildFloors, buildOpenings, buildWalls } from './architecture';
import { buildFoundation, buildStructure } from './structure';
import { buildRoofs } from './roof';
import { buildSystems } from './systems';
import { buildFurniture } from './furniture';
import { buildSite } from './site';

export function buildRig(model: HouseModel, mats: MatLib, quality: number): Rig {
  const d = derive(model);
  const root = new THREE.Group(); root.name = 'casa';
  const explode = new Map<string, THREE.Group>();
  for (const id of EXPLODE_ORDER) { const g = new THREE.Group(); g.name = `explode:${id}`; root.add(g); explode.set(id, g); }
  const layers = new Map<string, THREE.Group>();
  const layerExplode = new Map<string, string>(layersFor(model).map((l) => [l.id, l.explodeGroup]));
  const elems: Elem[] = [];
  const byId = new Map<string, Elem>();
  const flow: Ctx['flow'] = [];
  const sysMats: THREE.Material[] = [];

  const ctx: Ctx = {
    d, mats, elems, byId, layerExplode, quality, flow, sysMats,
    layerGroup(layer, ex) {
      let g = layers.get(layer);
      if (!g) {
        g = new THREE.Group(); g.name = `layer:${layer}`;
        (explode.get(ex) ?? root).add(g);
        layers.set(layer, g);
      }
      return g;
    },
  };

  buildSite(ctx);
  buildFoundation(ctx);
  buildFloors(ctx);
  buildStructure(ctx);
  buildSystems(ctx);
  buildWalls(ctx);
  buildOpenings(ctx);
  buildCladding(ctx);
  buildRoofs(ctx);
  buildFurniture(ctx);

  // linhas-guia da explosão: base de cada grupo (altura média) em 4 cantos da pegada
  const explodeBase = new Map<string, number>();
  for (const [id] of explode) {
    let lo = Infinity, hi = -Infinity;
    for (const e of elems) {
      if ((layerExplode.get(e.layer) ?? 'alvenaria') !== id) continue;
      lo = Math.min(lo, e.center.y - e.size.y / 2); hi = Math.max(hi, e.center.y + e.size.y / 2);
    }
    explodeBase.set(id, isFinite(lo) ? (lo + hi) / 2 : 0);
  }
  const [mn, mx] = [d.bbox.min, d.bbox.max];
  const m = 0.6;
  const corners: [number, number][] = [[mn[0] - m, mn[2] - m], [mx[0] + m, mn[2] - m], [mx[0] + m, mx[2] + m], [mn[0] - m, mx[2] + m]];
  const gGeo = new THREE.BufferGeometry();
  gGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(EXPLODE_ORDER.length * corners.length * 6), 3));
  const guides = new THREE.LineSegments(gGeo, new THREE.LineDashedMaterial({ color: '#202826', dashSize: 0.25, gapSize: 0.18, transparent: true, opacity: 0.4, depthWrite: false }));
  guides.visible = false; guides.frustumCulled = false; guides.name = 'guias';
  root.add(guides);

  const helpers: THREE.Object3D[] = [guides];
  return {
    root, explode, layers, elems, byId, mats, derived: d, guides, explodeBase, corners, flow, sysMats, helpers,
    dispose() {
      const geos = new Set<THREE.BufferGeometry>();
      root.traverse((o) => {
        const mm = o as THREE.Mesh;
        if (mm.geometry) geos.add(mm.geometry);
        if ((o as THREE.InstancedMesh).isInstancedMesh) (o as THREE.InstancedMesh).dispose();
      });
      geos.forEach((g) => g.dispose());
      sysMats.forEach((x) => x.dispose());
    },
  };
}

export type { Rig, Elem } from './rig';
export { createMaterials };

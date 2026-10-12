import * as THREE from 'three';
import type { Derived } from '../../data/house/derive';
import type { Src } from '../../data/house/types';
import type { MatLib } from './materials';
import { MATERIAL_LABEL, STAGES } from '../../data/config';

export type AnimStyle = 'rise' | 'drop' | 'draw' | 'static';

export interface ElementMeta {
  id: string; name: string; layer: string; kind: string;
  room: string | null; level: string; dims: string; material: string;
  stageIdx: number; src: Src; note: string;
}

export interface Elem {
  meta: ElementMeta;
  obj: THREE.Group;
  layer: string;
  anim: { stage: number; a: number; b: number; style: AnimStyle; drop: number };
  meshes: THREE.Mesh[];
  edges: THREE.LineSegments[];
  raw?: THREE.Mesh; finish?: THREE.Mesh;
  finishAnim?: { stage: number; a: number; b: number };
  draw?: { mesh: THREE.Mesh; total: number }[];
  extra: THREE.Object3D[];            // objetos que só aparecem com o elemento 100% pronto
  center: THREE.Vector3; size: THREE.Vector3;
  anchorsOnly?: boolean;
  /** estado calculado */
  r: number; rFinish: number; shown: boolean;
}

export interface FlowItem { curve: THREE.Curve<THREE.Vector3>; mesh: THREE.InstancedMesh; n: number; layer: string; elemId: string; speed: number; seed: number }

export interface Rig {
  root: THREE.Group;
  explode: Map<string, THREE.Group>;
  layers: Map<string, THREE.Group>;
  elems: Elem[];
  byId: Map<string, Elem>;
  mats: MatLib;
  derived: Derived;
  guides: THREE.LineSegments;
  /** altura média (y) de cada grupo de explosão em repouso, usada pelas linhas-guia */
  explodeBase: Map<string, number>;
  corners: [number, number][];
  flow: FlowItem[];
  sysMats: THREE.Material[];
  helpers: THREE.Object3D[];
  dispose(): void;
}

export interface Ctx {
  d: Derived;
  mats: MatLib;
  layerGroup(layer: string, explodeGroup: string): THREE.Group;
  elems: Elem[];
  byId: Map<string, Elem>;
  layerExplode: Map<string, string>;
  quality: number;
  flow: FlowItem[];
  /** materiais criados dinamicamente (descartados junto com o rig) */
  sysMats: THREE.Material[];
}

export interface RegisterOpts {
  id: string; name: string; layer: string; kind: string;
  obj: THREE.Group;
  room?: string | null; dims?: string; material?: string; stageIdx: number; src: Src; note?: string;
  anim: { stage: number; a: number; b: number; style: AnimStyle; drop?: number };
  meshes?: THREE.Mesh[];
  edges?: boolean;
  raw?: THREE.Mesh; finish?: THREE.Mesh; finishAnim?: Elem['finishAnim'];
  draw?: Elem['draw']; extra?: THREE.Object3D[];
}

export const edgeMat = new THREE.LineBasicMaterial({ color: '#27312e', transparent: true, opacity: 0.55, depthWrite: false });

export function register(ctx: Ctx, o: RegisterOpts): Elem {
  const meshes: THREE.Mesh[] = o.meshes ?? [];
  if (!o.meshes) o.obj.traverse((c) => { if ((c as THREE.Mesh).isMesh) meshes.push(c as THREE.Mesh); });
  meshes.forEach((m) => { m.userData.elemId = o.id; m.castShadow = true; m.receiveShadow = true; });
  const edges: THREE.LineSegments[] = [];
  if (o.edges) {
    for (const m of meshes) {
      if (m.userData.noEdges) continue;
      const eg = new THREE.EdgesGeometry(m.geometry, 28);
      const ls = new THREE.LineSegments(eg, edgeMat);
      ls.visible = false; ls.userData.isEdges = true;
      m.add(ls); edges.push(ls);
    }
  }
  const ex = ctx.layerExplode.get(o.layer) ?? 'alvenaria';
  ctx.layerGroup(o.layer, ex).add(o.obj);
  o.obj.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(o.obj);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const matKey = o.material ?? '';
  const el: Elem = {
    meta: {
      id: o.id, name: o.name, layer: o.layer, kind: o.kind, room: o.room ?? null, level: ctx.d.levelName,
      dims: o.dims ?? '', material: MATERIAL_LABEL[matKey] ?? matKey, stageIdx: o.stageIdx, src: o.src, note: o.note ?? '',
    },
    obj: o.obj, layer: o.layer, anim: { drop: 0, ...o.anim }, meshes, edges,
    raw: o.raw, finish: o.finish, finishAnim: o.finishAnim, draw: o.draw, extra: o.extra ?? [],
    center, size, r: 1, rFinish: 1, shown: true,
  };
  if (ctx.byId.has(o.id)) console.warn('Elemento duplicado', o.id);
  ctx.byId.set(o.id, el);
  ctx.elems.push(el);
  return el;
}

export function stageName(i: number) { return `${STAGES[i].n} — ${STAGES[i].name}`; }
export const fmt = (n: number, d = 2) => n.toFixed(d).replace('.', ',');

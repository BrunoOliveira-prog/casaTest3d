import * as THREE from 'three';
import { Ctx, register, fmt } from './rig';
import { boxBetween, flatSlab } from './geom';
import { oliveGeometry, shrubGeometry, tuftGeometry } from './vegetation';

export function buildSite(ctx: Ctx) {
  const { d, mats } = ctx;
  const bb = d.bbox;
  // terreno: caixa com topo em piso cimentício/cascalho claro e laterais neutras (corte do terreno)
  const w = 44, dp = 40, depth = 5.2;
  const cx = bb.center[0], cz = bb.center[2] + 4;
  const geo = new THREE.BoxGeometry(w, depth, dp);
  const m = new THREE.Mesh(geo, [mats.m.soil, mats.m.soil, mats.m.grass, mats.m.soil, mats.m.soil, mats.m.soil]);
  m.position.set(cx, -0.02 - depth / 2, cz);
  m.receiveShadow = true;
  // entorno contínuo até o horizonte (some na névoa): evita a "borda" do recorte de terreno nas vistas externas
  const far = new THREE.Mesh(new THREE.CircleGeometry(320, 64), mats.m.groundFar);
  far.rotation.x = -Math.PI / 2; far.position.set(cx, -0.034, cz);
  far.receiveShadow = true; far.castShadow = false; far.userData.noEdges = true; far.userData.noPick = true;
  const g = new THREE.Group(); g.add(m, far);
  register(ctx, {
    id: 'TERRENO', name: 'Terreno', layer: 'terreno', kind: 'terreno', obj: g, room: 'Entorno',
    dims: `${fmt(w, 0)} × ${fmt(dp, 0)} m (recorte ilustrativo)`, material: '', stageIdx: 0, src: 'estimado',
    note: 'Terreno plano ilustrativo. Limites reais do lote não constam na planta.',
    anim: { stage: 0, a: 0, b: 0, style: 'static' }, meshes: [m, far], edges: false,
  });
  m.castShadow = false; far.castShadow = false;

  // caminhos / pisos externos
  d.model.landscape.paths.forEach((p, i) => {
    const garage = p.material === 'concreto-garagem';
    const pg = new THREE.Mesh(flatSlab(p.polygon, [], -0.02, garage ? 0.025 : 0.035), garage ? mats.m.drive : mats.m.path);
    const grp = new THREE.Group(); grp.add(pg);
    register(ctx, {
      id: p.id, name: p.name, layer: 'paisagismo', kind: 'piso externo', obj: grp, room: 'Entorno', dims: garage ? 'Concreto desempenado com juntas (ilustrativo)' : 'Placas de concreto claro (ilustrativo)',
      material: 'concreto-claro', stageIdx: 4, src: 'estimado', note: 'Traçado inferido das imagens de referência.',
      anim: { stage: 4, a: 0.6 + i * 0.1, b: 0.85 + i * 0.1, style: 'rise' }, meshes: [pg], edges: false,
    });
    pg.castShadow = false;
  });

  // canteiros: base de cascalho/casca + borda metálica fina
  const beds = d.model.landscape.beds ?? [];
  if (beds.length) {
    const grp = new THREE.Group();
    const ms: THREE.Mesh[] = [];
    let area = 0;
    for (const b of beds) {
      const slab = new THREE.Mesh(flatSlab(b.polygon, [], -0.02, 0.06), mats.m.mulch);
      slab.castShadow = false; slab.userData.noEdges = true;
      grp.add(slab); ms.push(slab);
      for (let i = 0; i < b.polygon.length; i++) {
        const a = b.polygon[i], c = b.polygon[(i + 1) % b.polygon.length];
        const e = new THREE.Mesh(boxBetween(new THREE.Vector3(a[0], 0.045, a[1]), new THREE.Vector3(c[0], 0.045, c[1]), 0.012, 0.11), mats.m.curb);
        grp.add(e); ms.push(e);
      }
      let ar = 0;
      for (let i = 0; i < b.polygon.length; i++) { const p = b.polygon[i], q = b.polygon[(i + 1) % b.polygon.length]; ar += p[0] * q[1] - q[0] * p[1]; }
      area += Math.abs(ar) / 2;
    }
    register(ctx, {
      id: 'CANTEIROS', name: 'Canteiros com cascalho e borda metálica', layer: 'paisagismo', kind: 'canteiro', obj: grp, room: 'Entorno',
      dims: `${beds.length} canteiros · ${fmt(area, 1)} m²`, material: '', stageIdx: 4, src: 'estimado',
      note: 'Posições inferidas das imagens de referência; borda em aço de 1 cm (estimada).',
      anim: { stage: 4, a: 0.62, b: 0.88, style: 'rise' }, meshes: ms, edges: false,
    });
  }

  // vegetação (instanciada, folhagem em folhas/lâminas com cor por vértice)
  const plants = d.model.landscape.plants;
  const trees = plants.filter((p) => p.kind === 'arvore');
  const shrubs = plants.filter((p) => p.kind === 'arbusto');
  const tufts = plants.filter((p) => p.kind === 'graminea');
  const det = ctx.quality;
  const grp = new THREE.Group();
  const dummy = new THREE.Object3D();
  const col = new THREE.Color();
  const rnd = (i: number) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const mk = (geoI: THREE.BufferGeometry, count: number, mat: THREE.Material) => {
    const im = new THREE.InstancedMesh(geoI, mat, Math.max(1, count));
    im.castShadow = true; im.receiveShadow = true; im.count = count; grp.add(im); return im;
  };
  const place = (im: THREE.InstancedMesh, list: typeof plants, ySquash: number, seed: number) => {
    list.forEach((p, i) => {
      dummy.position.set(p.x, 0.03, p.z);
      dummy.rotation.set(0, rnd(i + seed) * Math.PI * 2, 0);
      const sv = ySquash * (0.88 + rnd(i * 3 + seed) * 0.28);
      dummy.scale.set(p.s, p.s * sv, p.s); dummy.updateMatrix();
      im.setMatrixAt(i, dummy.matrix);
      const t = 0.88 + rnd(i * 7 + seed) * 0.22;
      col.setRGB(t, t * (0.98 + rnd(i + 3) * 0.04), t * 0.96); im.setColorAt(i, col);
    });
    im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.computeBoundingSphere();
  };
  const meshes: THREE.Mesh[] = [];
  // duas variações de cada arbusto para quebrar a repetição
  const shrubA = shrubs.filter((_, i) => i % 2 === 0), shrubB = shrubs.filter((_, i) => i % 2 === 1);
  const sA = mk(shrubGeometry(101, det), shrubA.length, mats.m.plantVertex); place(sA, shrubA, 1, 1);
  const sB = mk(shrubGeometry(202, det), shrubB.length, mats.m.plantVertex); place(sB, shrubB, 1, 5);
  const tf = mk(tuftGeometry(303, det), tufts.length, mats.m.plantVertex); place(tf, tufts, 1, 9);
  meshes.push(sA, sB, tf);
  trees.forEach((t, i) => {
    const og = oliveGeometry(400 + i * 17, det);
    const trunk = new THREE.Mesh(og.trunk, mats.m.plantVertex);
    const canopy = new THREE.Mesh(og.canopy, mats.m.plantVertex);
    for (const mm of [trunk, canopy]) {
      mm.position.set(t.x, 0.03, t.z); mm.scale.setScalar(t.s); mm.rotation.y = rnd(i * 11) * Math.PI * 2;
      mm.castShadow = true; mm.receiveShadow = true; grp.add(mm); meshes.push(mm);
    }
  });
  register(ctx, {
    id: 'VEG', name: 'Vegetação (arbustos, gramíneas e oliveiras)', layer: 'paisagismo', kind: 'vegetação', obj: grp, room: 'Entorno',
    dims: `${trees.length} árvores, ${shrubs.length} arbustos e ${tufts.length} touceiras`, material: '', stageIdx: 4, src: 'estimado',
    note: 'Espécies e portes ilustrativos, inspirados nas imagens de referência (arbustos baixos cinza-esverdeados e oliveiras pequenas).',
    anim: { stage: 4, a: 0.75, b: 1, style: 'rise' }, meshes, edges: false,
  });
}

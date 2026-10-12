import './env';
import * as THREE from 'three';
import houseJson from '../src/data/house/casa-de-campo.json';
import type { HouseModel, Overrides } from '../src/data/house/types';
import { validateHouse } from '../src/data/house/validate';
import { applyOverrides, derive, interp, moveWithCollision } from '../src/data/house/derive';
import { localProgress, stageOfProgress, stageWindow, STAGES, layersFor } from '../src/data/config';
import { buildWallShape } from '../src/scene/build/geom';
import { buildRig } from '../src/scene/build';
import { createMaterials } from '../src/scene/build/materials';
import { applyState, ApplyState, modeAllows, sectionPlane } from '../src/scene/animation/apply';
import { useStore } from '../src/state/store';

const BASE = houseJson as unknown as HouseModel;
let pass = 0, fail = 0;
const failures: string[] = [];
function test(name: string, fn: () => void) {
  try { fn(); pass++; console.log(`  ok   ${name}`); } catch (e) { fail++; failures.push(name); console.log(`  FAIL ${name}\n       ${(e as Error).message}`); }
}
function eq(a: unknown, b: unknown, msg = '') { if (a !== b) throw new Error(`${msg} esperado ${String(b)}, obtido ${String(a)}`); }
function ok(c: unknown, msg: string) { if (!c) throw new Error(msg); }
const clone = <T,>(x: T): T => structuredClone(x);

// ------------------------------------------------------------------------------------------------
console.log('Dados e validação');
test('modelo padrão é válido', () => { const e = validateHouse(BASE); ok(e.length === 0, e.join(' | ')); });
test('rejeita versão errada, campo ausente e JSON vazio', () => {
  ok(validateHouse({ ...clone(BASE), version: 2 }).length > 0, 'versão 2 deveria falhar');
  const m = clone(BASE) as Partial<HouseModel>; delete m.walls;
  ok(validateHouse(m).some((s) => s.includes('walls')), 'campo ausente deveria ser citado');
  ok(validateHouse(null).length > 0, 'null deveria falhar');
});
test('rejeita ID duplicado', () => { const m = clone(BASE); m.walls[1].id = m.walls[0].id; ok(validateHouse(m).some((s) => s.includes('duplicado')), 'duplicado'); });
test('rejeita abertura fora da parede e sobreposta', () => {
  const m = clone(BASE); const w = m.walls.find((x) => x.openings.length > 0)!;
  w.openings[0].center = 999; ok(validateHouse(m).some((s) => s.includes('fora da parede')), 'fora');
  const m2 = clone(BASE); const w2 = m2.walls.find((x) => x.openings.length > 1)!;
  w2.openings[1].center = w2.openings[0].center; ok(validateHouse(m2).some((s) => s.includes('sobrep')), 'sobreposição');
});
test('rejeita espessura impossível, parede diagonal e trajeto repetido', () => {
  const m = clone(BASE); m.walls[0].t = 3; ok(validateHouse(m).some((s) => s.includes('espessura')), 'espessura');
  const m2 = clone(BASE); m2.walls[0].b = [m2.walls[0].a[0] + 3, m2.walls[0].a[1] + 3]; ok(validateHouse(m2).some((s) => s.includes('ortogonais')), 'diagonal');
  const m3 = clone(BASE); const r = m3.systems[0].routes[0]; r.points[1] = [...r.points[0]] as [number, number, number]; ok(validateHouse(m3).some((s) => s.includes('repetidos')), 'repetidos');
});
test('importModel do estado rejeita texto inválido e aceita o modelo padrão', () => {
  const st = useStore.getState();
  eq(st.importModel('isto não é json'), false); ok((useStore.getState().importErrors ?? []).length > 0, 'erros');
  eq(useStore.getState().importModel(JSON.stringify({ ...BASE, version: 9 })), false);
  eq(useStore.getState().importModel(JSON.stringify(BASE)), true); eq(useStore.getState().importErrors, null);
  useStore.getState().resetAll();
});

// ------------------------------------------------------------------------------------------------
console.log('Geometria derivada');
const D = derive(BASE);
test('cache do script Python concorda com a derivação em TypeScript (junções e topo)', () => {
  for (const w of D.walls) {
    const src = BASE.walls.find((x) => x.id === w.id)!;
    if (src.extA !== undefined) ok(Math.abs(w.ea - src.extA) < 1e-3, `${w.id}: extA ${w.ea} vs ${src.extA}`);
    if (src.extB !== undefined) ok(Math.abs(w.eb - src.extB) < 1e-3, `${w.id}: extB ${w.eb} vs ${src.extB}`);
    const top = src.top as { profile?: [number, number][] } | undefined;
    if (top?.profile) for (const [s, h] of top.profile) {
      ok(w.profile.some((p) => Math.abs(p.s - s) < 0.004 && Math.abs(p.h - h) < 0.012), `${w.id}: ponto de topo (${s}, ${h}) ausente`);
    }
  }
});
test('toda abertura cabe na parede, verga abaixo do topo, portas vão até o piso', () => {
  for (const w of D.walls) for (const o of w.dopenings) {
    ok(o.s0 >= w.s0 - 1e-6 && o.s1 <= w.s1 + 1e-6, `${o.id} fora do trecho da parede ${w.id}`);
    ok(o.head > o.sill + 0.3, `${o.id}: verga muito baixa`);
    ok(o.head <= Math.min(...w.profile.filter((p) => p.s >= o.s0 - 1e-3 && p.s <= o.s1 + 1e-3).map((p) => p.h)) + 1e-6, `${o.id}: verga acima do topo`);
    if (o.type === 'door') eq(o.notch, true, `${o.id} deveria descer até o piso`);
    if (o.type === 'window') eq(o.notch, false, `${o.id} deveria ter peitoril`);
  }
});
test('vãos são reais: a área da face da parede diminui exatamente pela área das aberturas', () => {
  const area = (s: THREE.Shape) => {
    const poly = (pts: THREE.Vector2[]) => { let a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p.x * q.y - q.x * p.y; } return Math.abs(a) / 2; };
    const { shape, holes } = s.extractPoints(8);
    return poly(shape) - holes.reduce((t, h) => t + poly(h), 0);
  };
  for (const w of D.walls) {
    const shape = buildWallShape(w);
    ok(!!shape, `${w.id}: sem forma`);
    let base = 0;
    for (let i = 0; i + 1 < w.profile.length; i += 2) { const a = w.profile[i], b = w.profile[i + 1]; base += ((a.h + b.h) / 2) * (b.s - a.s); }
    const cut = w.dopenings.reduce((t, o) => t + (o.s1 - o.s0) * (o.head - (o.notch ? 0 : o.sill)), 0);
    ok(Math.abs(area(shape!) - (base - cut)) < 0.01, `${w.id}: área ${area(shape!).toFixed(3)} ≠ ${(base - cut).toFixed(3)}`);
  }
});
test('topo das paredes acompanha os planos de telhado (parede norte tem degraus)', () => {
  const n = D.wallById.get('P-N')!;
  ok(n.maxTop - n.minTop > 1.0, 'esperava degraus entre telhados');
  ok(Math.abs(interp(n.profile, 8) - 4.7188) < 0.02, 'altura sob o telhado central');
});
test('sobrescritas: escala planimétrica, espessuras e inclinação', () => {
  const k = applyOverrides(BASE, { planScale: 1.25 });
  const w0 = BASE.walls[0], w1 = k.walls[0];
  ok(Math.abs(Math.hypot(w1.b[0] - w1.a[0], w1.b[1] - w1.a[1]) - 1.25 * Math.hypot(w0.b[0] - w0.a[0], w0.b[1] - w0.a[1])) < 1e-9, 'comprimento ×1,25');
  ok(Math.abs(derive(k).bbox.size[0] - 1.25 * D.bbox.size[0]) < 0.9, 'bbox escalada');
  const t = applyOverrides(BASE, { params: { wallExtT: 0.3 } });
  eq(t.walls.find((w) => w.tClass === 'ext')!.t, 0.3);
  const s = applyOverrides(BASE, { slopeCentral: 0.12 });
  ok(Math.abs(s.roofs.find((r) => r.id === 'RC')!.plane.gz + 0.12) < 1e-9, 'inclinação central 12%');
  ok(validateHouse(k).length === 0, 'modelo escalado continua válido');
});
test('colisão: desliza nas paredes, não atravessa, passa pela porta', () => {
  let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const r = 0.24;
  const inside = (x: number, z: number) => D.collision.some((q) => { const cx = Math.max(q.x0, Math.min(x, q.x1)), cz = Math.max(q.z0, Math.min(z, q.z1)); return Math.hypot(x - cx, z - cz) < r - 1e-6; });
  let pos: [number, number] = [6.0, 3.0];
  for (let i = 0; i < 4000; i++) {
    const a = rnd() * Math.PI * 2;
    pos = moveWithCollision(pos, Math.cos(a) * 0.05, Math.sin(a) * 0.05, r, D.collision);
    ok(!inside(pos[0], pos[1]), `penetrou obstáculo em ${pos.map((v) => v.toFixed(2)).join(',')}`);
  }
  const door = D.walls.find((w) => w.dopenings.some((o) => o.id === 'P-HALL'))!;
  const o = door.dopenings.find((x) => x.id === 'P-HALL')!;
  const cx = door.a[0] + door.dx * ((o.s0 + o.s1) / 2), cz = door.a[1] + door.dz * ((o.s0 + o.s1) / 2);
  let p: [number, number] = [cx, cz + 0.8];
  for (let i = 0; i < 60; i++) p = moveWithCollision(p, 0, -0.05, r, D.collision);
  ok(p[1] < cz - 0.3, `não atravessou a porta do hall (z final ${p[1].toFixed(2)}, parede em ${cz.toFixed(2)})`);
});

// ------------------------------------------------------------------------------------------------
console.log('Linha do tempo, camadas e restauração de estado');
test('janelas das etapas: ordenadas, sobrepostas pouco e cobrindo 0–1', () => {
  let prevEnd = 0;
  for (let i = 0; i < STAGES.length; i++) {
    const [a, b] = stageWindow(i);
    ok(a <= prevEnd + 1e-9 && b > a, `etapa ${i}`); prevEnd = b;
  }
  ok(Math.abs(stageWindow(0)[0]) < 1e-9 && Math.abs(stageWindow(4)[1] - 1) < 1e-9, 'extremos');
  eq(stageOfProgress(0), 0); eq(stageOfProgress(0.21), 1); eq(stageOfProgress(1), 4);
});
test('progresso local é monótono e limitado em [0,1]', () => {
  for (let st = 0; st < 5; st++) for (const [a, b] of [[0, 0.5], [0.2, 1], [0.7, 0.7]]) {
    let prev = 0;
    for (let p = 0; p <= 1.0001; p += 0.01) { const r = localProgress(st, a, b, p); ok(r >= 0 && r <= 1, 'faixa'); ok(r >= prev - 1e-12, 'monotonia'); prev = r; }
  }
});

const mats = createMaterials();
const rig = buildRig(BASE, mats, 1);
const baseState = (): ApplyState => ({ progress: 1, layers: Object.fromEntries(layersFor(BASE).map((l) => [l.id, true])), view: 'geral', xray: false, explode: 0, guides: true, flow: true, reduceMotion: false });
function snapshot(): string {
  const parts: string[] = [];
  for (const e of rig.elems) {
    const o = e.obj;
    parts.push([e.meta.id, o.visible ? 1 : 0, o.position.y.toFixed(5), o.scale.y.toFixed(5), e.finish ? `${e.finish.visible ? 1 : 0}/${e.finish.scale.y.toFixed(5)}` : '', e.draw ? e.draw.map((d) => d.mesh.geometry.drawRange.count).join(',') : ''].join('|'));
  }
  for (const [id, g] of rig.explode) parts.push(`${id}:${g.position.toArray().map((v) => v.toFixed(5)).join(',')}`);
  return parts.join('\n');
}
test('construção tem elementos em todas as camadas e todas as etapas', () => {
  const layers = new Set(rig.elems.map((e) => e.layer));
  for (const l of layersFor(BASE)) ok(layers.has(l.id), `camada sem elementos: ${l.id}`);
  const stages = new Set(rig.elems.map((e) => e.anim.stage));
  eq(stages.size, 5, 'etapas representadas');
  ok(rig.elems.length > 200, 'quantidade de elementos');
});
test('estado 0%: só o terreno existe; 100%: tudo existe', () => {
  applyState(rig, { ...baseState(), progress: 0 });
  const vis0 = rig.elems.filter((e) => e.obj.visible).map((e) => e.meta.id);
  eq(vis0.length, 1, `visíveis em 0%: ${vis0.slice(0, 5).join(',')}`); eq(vis0[0], 'TERRENO');
  applyState(rig, baseState());
  eq(rig.elems.filter((e) => !e.obj.visible).length, 0, 'ocultos em 100%');
});
test('reversibilidade: ida e volta (aleatória) restaura exatamente o mesmo estado', () => {
  applyState(rig, baseState()); const full = snapshot();
  applyState(rig, { ...baseState(), progress: 0 }); const zero = snapshot();
  let seed = 11; const rnd = () => { seed = (seed * 48271) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 80; i++) applyState(rig, { ...baseState(), progress: rnd(), explode: rnd() > 0.5 ? rnd() : 0, xray: rnd() > 0.5 });
  applyState(rig, baseState()); eq(snapshot() === full, true, 'estado 100% divergiu após percurso aleatório');
  applyState(rig, { ...baseState(), progress: 0 }); eq(snapshot() === zero, true, 'estado 0% divergiu');
  const a = (p: number) => { applyState(rig, { ...baseState(), progress: p }); return snapshot(); };
  eq(a(0.37) === (a(0.9), a(0.37)), true, 'determinismo em 37%');
  applyState(rig, baseState());
});
test('animação monótona: elementos só aparecem, nunca somem, com o avanço do progresso', () => {
  let prev = new Map<string, number>();
  for (let p = 0; p <= 1.0001; p += 0.02) {
    applyState(rig, { ...baseState(), progress: Math.min(1, p) });
    const cur = new Map(rig.elems.map((e) => [e.meta.id, e.r]));
    for (const [id, r] of cur) ok(r >= (prev.get(id) ?? 0) - 1e-12, `${id} regrediu em ${p.toFixed(2)}`);
    prev = cur;
  }
  applyState(rig, baseState());
});
test('precedência de visibilidade: camada E linha do tempo E modo', () => {
  const st = baseState();
  // camada desligada vence linha do tempo completa
  applyState(rig, { ...st, layers: { ...st.layers, cobertura: false } });
  ok(rig.elems.filter((e) => e.layer === 'cobertura').every((e) => !e.obj.visible), 'cobertura deveria sumir');
  ok(rig.elems.filter((e) => e.layer === 'alvenaria').every((e) => e.obj.visible), 'alvenaria continua');
  // linha do tempo vence camada ligada
  applyState(rig, { ...st, progress: 0.25 });
  ok(rig.elems.filter((e) => e.layer === 'alvenaria').every((e) => !e.obj.visible), 'alvenaria ainda não construída');
  ok(rig.elems.filter((e) => e.layer === 'estrutura').some((e) => e.obj.visible), 'estrutura já começou');
  // modo sobrepõe
  applyState(rig, { ...st, view: 'planta' });
  ok(rig.elems.filter((e) => e.layer === 'cobertura').every((e) => !e.obj.visible), 'planta oculta cobertura');
  ok(rig.elems.filter((e) => e.layer === 'estrutura' || e.layer.startsWith('sys:')).every((e) => !e.obj.visible), 'planta oculta camadas embutidas');
  applyState(rig, { ...st, view: 'instalacoes' });
  ok(rig.elems.filter((e) => e.layer.startsWith('sys:')).every((e) => e.obj.visible), 'instalações visíveis');
  ok(rig.elems.filter((e) => e.layer === 'cobertura' || e.layer === 'mobiliario').every((e) => !e.obj.visible), 'instalações oculta cobertura e mobiliário');
  applyState(rig, { ...st, view: 'interior' });
  ok(rig.elems.filter((e) => e.layer === 'mobiliario').every((e) => e.obj.visible), 'interior mostra mobiliário');
  ok(rig.elems.filter((e) => e.layer === 'estrutura').every((e) => !e.obj.visible), 'interior oculta estrutura embutida');
  // todas as três condições juntas
  applyState(rig, { ...st, progress: 0.1, view: 'geral', layers: { ...st.layers, fundacao: false } });
  ok(rig.elems.filter((e) => e.layer === 'fundacao').every((e) => !e.obj.visible), 'fundação desligada');
  eq(modeAllows('geral', 'cobertura', false), true);
  applyState(rig, st);
});
test('explosão: grupos voltam exatamente à origem; linhas-guia só quando explodido', () => {
  applyState(rig, { ...baseState(), explode: 1 });
  ok(rig.explode.get('cobertura')!.position.y > 10, 'cobertura sobe');
  ok(rig.guides.visible, 'guias visíveis');
  applyState(rig, { ...baseState(), explode: 0 });
  for (const [, g] of rig.explode) eq(g.position.lengthSq(), 0, 'grupo na origem');
  eq(rig.guides.visible, false);
});
test('raio-X e corte: materiais compartilhados voltam ao estado original', () => {
  const before = mats.xray.map((m) => [m.transparent, m.opacity, m.depthWrite]);
  mats.setXray(true, 0.3);
  ok(mats.xray.every((m) => m.transparent && Math.abs(m.opacity - 0.3) < 1e-9), 'raio-X ligado');
  mats.setXray(false, 0.3);
  eq(JSON.stringify(mats.xray.map((m) => [m.transparent, m.opacity, m.depthWrite])), JSON.stringify(before), 'raio-X restaurado');
  const plane = new THREE.Plane();
  mats.setSection(plane, rig.sysMats);
  ok(Object.values(mats.m).every((m) => m.clippingPlanes?.[0] === plane && m.clipShadows), 'plano aplicado a todos os materiais');
  mats.setSection(null, rig.sysMats);
  ok(Object.values(mats.m).every((m) => m.clippingPlanes === null), 'plano removido');
  eq((mats.m.wallRaw as THREE.MeshStandardMaterial).side, THREE.FrontSide);
});
test('plano de corte: eixos, posição e inversão', () => {
  const p = new THREE.Plane();
  const pos = sectionPlane(p, rig, 'z', 0.5, false);
  ok(Math.abs(p.distanceToPoint(new THREE.Vector3(0, 0, pos))) < 1e-9, 'plano passa pela posição');
  ok(p.distanceToPoint(new THREE.Vector3(0, 0, pos - 1)) > 0, 'mantém o lado norte (z menor)');
  sectionPlane(p, rig, 'z', 0.5, true);
  ok(p.distanceToPoint(new THREE.Vector3(0, 0, pos - 1)) < 0, 'inversão mantém o lado oposto');
  sectionPlane(p, rig, 'y', 0.5, false);
  ok(p.normal.y === -1, 'eixo Y');
});
test('seleção não altera materiais compartilhados (realce é uma malha sobreposta)', () => {
  const m0 = JSON.stringify([mats.m.wallRaw.userData, (mats.m.wallRaw as THREE.MeshStandardMaterial).color.getHex(), (mats.m.highlight as THREE.MeshBasicMaterial).opacity]);
  const e = rig.byId.get('P-L')!;
  const ov = new THREE.Mesh(e.raw!.geometry, mats.m.highlight); e.raw!.add(ov); e.raw!.remove(ov);
  eq(JSON.stringify([mats.m.wallRaw.userData, (mats.m.wallRaw as THREE.MeshStandardMaterial).color.getHex(), (mats.m.highlight as THREE.MeshBasicMaterial).opacity]), m0);
});
test('metadados completos em todos os elementos (inspeção)', () => {
  for (const e of rig.elems) {
    const m = e.meta;
    ok(m.id && m.name && m.layer && m.kind && m.level, `${m.id}: metadados básicos`);
    ok(['confirmado', 'estimado', 'esquematico'].includes(m.src), `${m.id}: fonte`);
    ok(m.stageIdx >= 0 && m.stageIdx < 5, `${m.id}: etapa`);
    ok(e.meshes.length > 0, `${m.id}: sem malha`);
  }
});
test('reconstrução com sobrescritas gera modelo válido e cena consistente', () => {
  const ov: Overrides = { planScale: 1.1, params: { wallExtT: 0.3, ceilingBase: 3.0, ridgeMax: 5.2 }, slopeCentral: 0.12 };
  const m = applyOverrides(BASE, ov);
  ok(validateHouse(m).length === 0, validateHouse(m).join('|'));
  const r2 = buildRig(m, mats, 1);
  eq(r2.elems.length, rig.elems.length, 'mesma quantidade de elementos');
  r2.dispose();
});

console.log('Alta fidelidade (paisagismo, texturas, vegetação)');
test('canteiros: polígonos válidos e arbustos/gramíneas dentro de um canteiro', () => {
  const L = BASE.landscape; const beds = L.beds ?? [];
  ok(beds.length >= 4, 'canteiros esperados');
  const inside = (x: number, z: number) => beds.some((b) => { const xs = b.polygon.map((q) => q[0]), zs = b.polygon.map((q) => q[1]); return x >= Math.min(...xs) && x <= Math.max(...xs) && z >= Math.min(...zs) && z <= Math.max(...zs); });
  const low = L.plants.filter((p) => p.kind !== 'arvore');
  ok(low.length > 20, 'vegetação baixa suficiente');
  ok(low.every((p) => inside(p.x, p.z)), 'planta baixa fora de canteiro');
});
test('cena inclui canteiros, vegetação e fáscia do telhado com material múltiplo', () => {
  ok(rig.byId.has('CANTEIROS') && rig.byId.has('VEG'), 'CANTEIROS/VEG');
  const roof = rig.byId.get('TEL-RC')!;
  const top = roof.meshes[0];
  ok(Array.isArray(top.material) && top.material.length === 2, 'laje com material de topo + fáscia');
  const veg = rig.byId.get('VEG')!;
  ok(veg.meshes.every((m) => m.geometry.attributes.position.count > 0 && !!m.geometry.attributes.color), 'folhagem com cor por vértice');
});
test('texturas procedurais: cor, normal map e rugosidade', () => {
  const a = createMaterials(), b = createMaterials();
  const ma = a.m.timberV as THREE.MeshStandardMaterial, mb = b.m.timberV as THREE.MeshStandardMaterial;
  ok(!!ma.map && !!ma.normalMap && !!ma.roughnessMap && !!mb.map, 'mapa + normal + rugosidade');
  a.dispose(); b.dispose();
});

rig.dispose();
console.log(`\n${pass} testes passaram, ${fail} falharam.`);
if (fail) { console.log('Falhas:\n - ' + failures.join('\n - ')); process.exit(1); }

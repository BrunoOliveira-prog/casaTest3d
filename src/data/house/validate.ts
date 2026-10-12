import type { HouseModel, V2 } from './types';
import { polygonArea } from './derive';

const fin = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const finV = (v: unknown, len: number): boolean => Array.isArray(v) && v.length === len && v.every(fin);

/** Valida a estrutura mínima do modelo. Retorna lista de mensagens em português (vazia = válido). */
export function validateHouse(input: unknown): string[] {
  const errs: string[] = [];
  if (!input || typeof input !== 'object') return ['O arquivo não contém um objeto JSON válido.'];
  const m = input as Partial<HouseModel>;
  if (m.version !== 1) errs.push(`Versão do formato não suportada (${String(m.version)}). Esperado: 1.`);
  for (const key of ['meta', 'reference', 'params', 'walls', 'rooms', 'roofs', 'structure', 'slab', 'furniture', 'systems', 'landscape', 'annotations'] as const) {
    if (m[key] === undefined || m[key] === null) errs.push(`Campo obrigatório ausente: "${key}".`);
  }
  if (errs.length) return errs;
  const model = m as HouseModel;

  // IDs duplicados
  const seen = new Map<string, string>();
  const reg = (id: string, where: string) => {
    if (typeof id !== 'string' || !id) { errs.push(`${where}: identificador vazio.`); return; }
    if (seen.has(id)) errs.push(`ID duplicado "${id}" (${where} e ${seen.get(id)}).`);
    else seen.set(id, where);
  };

  for (const [k, v] of Object.entries(model.params)) if (!fin(v)) errs.push(`Parâmetro inválido: ${k}.`);

  const wallIds = new Set<string>();
  for (const w of model.walls) {
    reg(w.id, `parede ${w.id}`); wallIds.add(w.id);
    if (!finV(w.a, 2) || !finV(w.b, 2)) { errs.push(`Parede ${w.id}: coordenadas inválidas.`); continue; }
    const L = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]);
    if (L < 0.1) errs.push(`Parede ${w.id}: comprimento menor que 10 cm.`);
    if (Math.abs(w.a[0] - w.b[0]) > 1e-6 && Math.abs(w.a[1] - w.b[1]) > 1e-6) errs.push(`Parede ${w.id}: somente paredes ortogonais (paralelas aos eixos X/Z) são suportadas.`);
    if (!fin(w.t) || w.t < 0.05 || w.t > 0.6) errs.push(`Parede ${w.id}: espessura impossível (${String(w.t)} m). Use entre 0,05 e 0,60 m.`);
    const ops = [...w.openings].sort((p, q) => p.center - q.center);
    ops.forEach((o, i) => {
      reg(o.id, `abertura ${o.id}`);
      if (![o.center, o.w, o.h, o.sill].every(fin)) { errs.push(`Abertura ${o.id}: valores numéricos inválidos.`); return; }
      if (o.w <= 0.2 || o.h <= 0.2) errs.push(`Abertura ${o.id}: dimensões muito pequenas.`);
      if (o.sill < 0) errs.push(`Abertura ${o.id}: peitoril negativo.`);
      if (o.center - o.w / 2 < -1e-6 || o.center + o.w / 2 > L + 1e-6) errs.push(`Abertura ${o.id} fica fora da parede ${w.id} (parede com ${L.toFixed(2)} m, vão de ${(o.center - o.w / 2).toFixed(2)} a ${(o.center + o.w / 2).toFixed(2)} m).`);
      if (i > 0) {
        const p = ops[i - 1];
        if (o.center - o.w / 2 < p.center + p.w / 2 - 1e-6) errs.push(`Aberturas ${p.id} e ${o.id} se sobrepõem na parede ${w.id}.`);
      }
    });
  }

  const roomIds = new Set<string>();
  for (const r of model.rooms) {
    reg(r.id, `cômodo ${r.id}`); roomIds.add(r.id);
    if (!Array.isArray(r.polygon) || r.polygon.length < 3 || !r.polygon.every((p) => finV(p, 2))) { errs.push(`Cômodo ${r.id}: polígono inválido.`); continue; }
    if (polygonArea(r.polygon as V2[]) < 0.5) errs.push(`Cômodo ${r.id}: área menor que 0,5 m².`);
  }
  for (const w of model.walls) for (const rid of w.rooms ?? []) if (!roomIds.has(rid)) errs.push(`Parede ${w.id} referencia um cômodo inexistente (${rid}).`);

  const roofIds = new Set<string>();
  for (const r of model.roofs) {
    reg(r.id, `telhado ${r.id}`); roofIds.add(r.id);
    if (!Array.isArray(r.polygon) || r.polygon.length < 3) errs.push(`Telhado ${r.id}: polígono inválido.`);
    if (![r.plane.x0, r.plane.z0, r.plane.h0, r.plane.gx, r.plane.gz].every(fin)) errs.push(`Telhado ${r.id}: plano de inclinação inválido.`);
  }

  for (const f of model.furniture) {
    reg(f.id, `móvel ${f.id}`);
    if (!roomIds.has(f.room)) errs.push(`Móvel ${f.id} referencia um cômodo inexistente (${f.room}).`);
    if (![f.x, f.z, f.w, f.d, f.h].every(fin) || f.w <= 0 || f.d <= 0 || f.h <= 0) errs.push(`Móvel ${f.id}: dimensões inválidas.`);
  }
  for (const p of model.structure.pillars) reg(p.id, `pilar ${p.id}`);
  for (const r of model.structure.rafters) if (!roofIds.has(r.roof)) errs.push('Caibro referencia telhado inexistente.');

  for (const s of model.systems) {
    reg(`sys:${s.id}`, `sistema ${s.id}`);
    for (const rt of s.routes) {
      reg(rt.id, `trajeto ${rt.id}`);
      if (!Array.isArray(rt.points) || rt.points.length < 2) { errs.push(`Trajeto ${rt.id}: precisa de pelo menos 2 pontos.`); continue; }
      if (!rt.points.every((p) => finV(p, 3))) errs.push(`Trajeto ${rt.id}: ponto com coordenadas inválidas.`);
      if (!fin(rt.radius) || rt.radius <= 0 || rt.radius > 0.3) errs.push(`Trajeto ${rt.id}: raio inválido.`);
      for (let i = 1; i < rt.points.length; i++) {
        const a = rt.points[i - 1], b = rt.points[i];
        if (Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 1e-6) errs.push(`Trajeto ${rt.id}: pontos consecutivos repetidos.`);
      }
    }
  }
  for (const c of model.cladding) if (!wallIds.has(c.wall)) errs.push(`Revestimento ${c.id} referencia parede inexistente (${c.wall}).`);
  for (const a of model.annotations) if (!finV(a.at, 3)) errs.push(`Legenda ${a.id}: posição inválida.`);
  return errs;
}

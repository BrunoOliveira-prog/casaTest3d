import type { HouseModel, V3 } from './house/types';

// ------------------------------------------------------------------ etapas da construção (configuração única)
export interface StageDef { id: string; n: number; name: string; short: string; description: string }
export const STAGES: StageDef[] = [
  { id: 'fundacao', n: 1, name: 'Fundação', short: 'Fundação', description: 'Terreno, sapata corrida e radier. Dimensões ilustrativas (estimadas).' },
  { id: 'estrutura', n: 2, name: 'Estrutura', short: 'Estrutura', description: 'Pilares, cintas e caibros da cobertura. Estrutura esquemática, não documentada na planta.' },
  { id: 'instalacoes', n: 3, name: 'Instalações', short: 'Instalações', description: 'Esgoto, água fria e quente, elétrica e climatização — trajetos esquemáticos.' },
  { id: 'fechamento', n: 4, name: 'Fechamento', short: 'Fechamento', description: 'Alvenaria com vãos reais, esquadrias e telhados de uma água.' },
  { id: 'finalizacao', n: 5, name: 'Finalização', short: 'Finalização', description: 'Reboco, madeira, pisos, mobiliário sugerido e entorno.' },
];
/** Cada etapa ocupa 20% da linha do tempo; as janelas se sobrepõem levemente. */
export const STAGE_SPAN = 1 / STAGES.length;
export const STAGE_OVERLAP = 0.02;
export const SEQUENCE_SECONDS = 40;

export function stageWindow(i: number): [number, number] {
  const a = i * STAGE_SPAN - (i > 0 ? STAGE_OVERLAP : 0);
  const b = (i + 1) * STAGE_SPAN + (i < STAGES.length - 1 ? STAGE_OVERLAP : 0);
  return [a, b];
}
export function stageOfProgress(p: number): number {
  return Math.min(STAGES.length - 1, Math.max(0, Math.floor(p / STAGE_SPAN - 1e-9)));
}
/** Progresso local (0..1) de um elemento cuja animação ocupa [a,b] da janela da etapa. */
export function localProgress(stage: number, a: number, b: number, p: number): number {
  const [w0, w1] = stageWindow(stage);
  const s = w0 + a * (w1 - w0), e = w0 + b * (w1 - w0);
  if (e - s < 1e-9) return p >= e ? 1 : 0;
  return Math.max(0, Math.min(1, (p - s) / (e - s)));
}

// ------------------------------------------------------------------ camadas
export interface LayerDef {
  id: string; name: string; group: string; color: string;
  explodeGroup: string;
  /** Camadas embutidas só ficam legíveis em raio-X ou antes do fechamento. */
  embedded?: boolean;
  /** Ativa transparência no modo raio-X. */
  xray?: boolean;
  icon?: string;
}
export const EXPLODE_OFFSETS: Record<string, V3> = {
  terreno: [0, -5.2, 0],
  fundacao: [0, -3.1, 0],
  pisos: [0, -1.2, 0],
  alvenaria: [0, 0, 0],
  mobiliario: [0, 4.6, 0],
  instalacoes: [0, 7.0, 0],
  estrutura: [0, 9.6, 0],
  cobertura: [0, 14.2, 0],
};
export const EXPLODE_ORDER = ['terreno', 'fundacao', 'pisos', 'alvenaria', 'mobiliario', 'instalacoes', 'estrutura', 'cobertura'];

export function layersFor(model: HouseModel): LayerDef[] {
  const sys: LayerDef[] = model.systems.map((s) => ({
    id: `sys:${s.id}`, name: s.name, group: 'Instalações (esquemáticas)', color: s.color, explodeGroup: 'instalacoes', embedded: true, icon: s.icon,
  }));
  return [
    { id: 'terreno', name: 'Terreno', group: 'Terreno e fundação', color: '#8a9a6a', explodeGroup: 'terreno', xray: true },
    { id: 'fundacao', name: 'Sapata e radier', group: 'Terreno e fundação', color: '#8c8a84', explodeGroup: 'fundacao', embedded: true, xray: true },
    { id: 'estrutura', name: 'Pilares, cintas e caibros', group: 'Estrutura (esquemática)', color: '#b3ada0', explodeGroup: 'estrutura', embedded: true },
    ...sys,
    { id: 'alvenaria', name: 'Paredes de alvenaria', group: 'Arquitetura', color: '#efede6', explodeGroup: 'alvenaria', xray: true },
    { id: 'esquadrias', name: 'Portas e janelas', group: 'Arquitetura', color: '#1c1d1f', explodeGroup: 'alvenaria' },
    { id: 'cobertura', name: 'Cobertura', group: 'Arquitetura', color: '#9aa0a4', explodeGroup: 'cobertura', xray: true },
    { id: 'pisos', name: 'Pisos', group: 'Arquitetura', color: '#c9a679', explodeGroup: 'pisos', xray: true },
    { id: 'acabamentos', name: 'Revestimentos em madeira', group: 'Arquitetura', color: '#8a4f2b', explodeGroup: 'alvenaria', xray: true },
    { id: 'mobiliario', name: 'Mobiliário, louças e luminárias', group: 'Interior', color: '#d9d4c9', explodeGroup: 'mobiliario' },
    { id: 'paisagismo', name: 'Paisagismo e piso externo', group: 'Entorno', color: '#6f8f55', explodeGroup: 'terreno' },
  ];
}

export type PresetId = 'tudo' | 'arquitetura' | 'estrutura' | 'instalacoes';
export const PRESETS: { id: PresetId; name: string }[] = [
  { id: 'tudo', name: 'Tudo' },
  { id: 'arquitetura', name: 'Arquitetura' },
  { id: 'estrutura', name: 'Estrutura' },
  { id: 'instalacoes', name: 'Instalações' },
];
export function presetVisibility(id: PresetId, layers: LayerDef[]): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const l of layers) {
    let on = true;
    if (id === 'arquitetura') on = !l.embedded;
    else if (id === 'estrutura') on = ['terreno', 'fundacao', 'estrutura', 'alvenaria', 'cobertura'].includes(l.id);
    else if (id === 'instalacoes') on = ['terreno', 'fundacao', 'alvenaria', 'esquadrias', 'pisos'].includes(l.id) || l.id.startsWith('sys:');
    out[l.id] = on;
  }
  return out;
}

// ------------------------------------------------------------------ iluminação
export interface LightingPreset {
  id: 'dia' | 'tarde'; name: string;
  sunColor: string; sunIntensity: number; sunDir: V3;
  hemiSky: string; hemiGround: string; hemiIntensity: number;
  bgTop: string; bgBottom: string; env: number; exposure: number; interior: number;
  /** céu do modo "Céu": cores de zênite/meio/horizonte (= névoa) e do chão refletido */
  sky: { fog: string; ground: string; zenith: string; mid: string };
}
export const LIGHTING: Record<'dia' | 'tarde', LightingPreset> = {
  dia: { id: 'dia', name: 'Dia', sunColor: '#fff3e0', sunIntensity: 2.7, sunDir: [-0.45, 0.78, 0.55], hemiSky: '#e3ecf2', hemiGround: '#b4ae9f', hemiIntensity: 1.0, bgTop: '#d8dad8', bgBottom: '#e9e7e1', env: 0.4, exposure: 1.0, interior: 0,
    sky: { fog: '#dde3e6', ground: '#b9b5ac', zenith: '#6f9cc6', mid: '#a9c4da' } },
  tarde: { id: 'tarde', name: 'Fim de tarde', sunColor: '#ffae72', sunIntensity: 2.3, sunDir: [0.85, 0.28, 0.45], hemiSky: '#e9c8aa', hemiGround: '#6f6256', hemiIntensity: 0.62, bgTop: '#c9bbb2', bgBottom: '#e2d5c8', env: 0.28, exposure: 0.95, interior: 1,
    sky: { fog: '#ecd2b8', ground: '#8f8173', zenith: '#7d8fb0', mid: '#d9b9a6' } },
};

export const QUALITY = {
  baixa: { label: 'Baixa', dpr: 1, shadows: false, shadowMap: 512, shadowRadius: 1, detail: 0, post: 'off' as const },
  media: { label: 'Média', dpr: 1.5, shadows: true, shadowMap: 2048, shadowRadius: 2.5, detail: 1, post: 'ao' as const },
  alta: { label: 'Alta', dpr: 2, shadows: true, shadowMap: 4096, shadowRadius: 3.5, detail: 2, post: 'full' as const },
} as const;
export type QualityId = keyof typeof QUALITY;

export const SRC_LABEL: Record<string, string> = { confirmado: 'Confirmado pela planta', estimado: 'Estimado para visualização', esquematico: 'Esquemático' };
export const SRC_SHORT: Record<string, string> = { confirmado: 'Confirmado', estimado: 'Estimado', esquematico: 'Esquemático' };

export const MATERIAL_LABEL: Record<string, string> = {
  reboco: 'Reboco liso off-white', 'reboco-int': 'Reboco interno claro', alvenaria: 'Alvenaria (bloco cerâmico)', concreto: 'Concreto armado',
  'madeira-escura': 'Madeira natural escura', 'madeira-clara': 'Madeira natural clara', 'aluminio-preto': 'Alumínio preto (perfil fino)',
  vidro: 'Vidro transparente', louca: 'Louça branca', inox: 'Aço inox', bancada: 'Bancada em quartzo', 'tecido-claro': 'Tecido claro', branco: 'Branco',
  telha: 'Telha metálica standing seam cinza-claro', 'concreto-claro': 'Concreto claro (placas)', madeira: 'Piso de madeira clara', porcelanato: 'Porcelanato claro', cimenticio: 'Piso cimentício cinza-claro',
};

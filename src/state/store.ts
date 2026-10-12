import { create } from 'zustand';
import baseJson from '../data/house/casa-de-campo.json';
import type { HouseModel, Overrides, Params } from '../data/house/types';
import { applyOverrides } from '../data/house/derive';
import { validateHouse } from '../data/house/validate';
import { layersFor, presetVisibility, PresetId, QualityId } from '../data/config';
import type { Rig } from '../scene/build/rig';
import { clearPersisted, loadPersisted, savePersisted } from './persist';

export type ViewMode = 'geral' | 'planta' | 'corte' | 'instalacoes' | 'interior';
export type Axis = 'x' | 'y' | 'z';
export type Tab = 'camadas' | 'corte' | 'locais' | 'inspecao' | 'planta';

export const DEFAULT_BASE = baseJson as unknown as HouseModel;

export interface CameraRequest { nonce: number; kind: 'view' | 'focus' | 'room' | 'home'; view?: ViewMode; target?: string }

export interface State {
  base: HouseModel;
  customBase: boolean;
  overrides: Overrides;
  model: HouseModel;

  // linha do tempo
  progress: number; playing: boolean; speed: number;
  // vistas
  view: ViewMode;
  // raio-X
  xray: boolean; xrayOpacity: number;
  // camadas
  layers: Record<string, boolean>; preset: PresetId | 'custom';
  // explosão
  explodeOn: boolean; explodeAmount: number; guides: boolean;
  // corte
  sectionOn: boolean; sectionAxis: Axis; sectionPos: number; sectionFlip: boolean;
  // seleção
  selected: string | null; hover: string | null; selectedRoom: string | null;
  // luz / qualidade / extras
  lighting: 'dia' | 'tarde'; quality: QualityId; labels: boolean; flow: boolean;
  /** fundo da cena: céu físico (padrão) ou estúdio neutro como nas imagens de referência */
  backdrop: 'ceu' | 'estudio';
  // planta
  planOverlay: boolean; planOpacity: number; planImage: 'planta' | 'planta-mobiliada' | 'cobertura';
  calib: { active: boolean; pts: [number, number][] };
  // UI
  panelOpen: boolean; tab: Tab; helpOpen: boolean; noticeSeen: boolean; fpActive: boolean; pointerLocked: boolean;
  webglFailed: boolean; canvasKey: number; toast: string | null; importErrors: string[] | null;
  // referências
  rig: Rig | null; rigVersion: number; capture: (() => void) | null;
  cameraReq: CameraRequest;

  // ações
  set: (p: Partial<State>) => void;
  setProgress: (p: number) => void;
  togglePlay: () => void;
  restart: () => void;
  setView: (v: ViewMode) => void;
  setLayer: (id: string, on: boolean) => void;
  setPreset: (p: PresetId) => void;
  setExplode: (on: boolean) => void;
  select: (id: string | null) => void;
  focus: (id: string) => void;
  focusRoom: (id: string) => void;
  setOverrides: (o: Overrides) => void;
  patchParams: (p: Partial<Params>) => void;
  importModel: (text: string) => boolean;
  resetAll: () => void;
  showToast: (t: string | null) => void;
  requestCamera: (r: Omit<CameraRequest, 'nonce'>) => void;
}

function mk(base: HouseModel, ov: Overrides) { return applyOverrides(base, ov); }

const persisted = typeof window !== 'undefined' ? loadPersisted() : null;
let initialBase = DEFAULT_BASE;
let customBase = false;
if (persisted?.customBase && validateHouse(persisted.customBase).length === 0) { initialBase = persisted.customBase; customBase = true; }
const initialOv: Overrides = persisted?.overrides ?? {};
const initialModel = mk(initialBase, initialOv);
const allOn = (m: HouseModel) => presetVisibility('tudo', layersFor(m));

export const useStore = create<State>((set, get) => ({
  base: initialBase, customBase, overrides: initialOv, model: initialModel,
  progress: 1, playing: false, speed: 1,
  view: 'geral',
  xray: false, xrayOpacity: persisted?.ui?.xrayOpacity ?? 0.28,
  layers: allOn(initialModel), preset: 'tudo',
  explodeOn: false, explodeAmount: 1, guides: true,
  sectionOn: false, sectionAxis: 'z', sectionPos: 0.5, sectionFlip: false,
  selected: null, hover: null, selectedRoom: null,
  backdrop: persisted?.ui?.backdrop ?? 'ceu',
  lighting: persisted?.ui?.lighting ?? 'dia', quality: persisted?.ui?.quality ?? 'media', labels: persisted?.ui?.labels ?? true, flow: persisted?.ui?.flow ?? true,
  planOverlay: true, planOpacity: persisted?.ui?.planOpacity ?? 0.5, planImage: 'planta',
  calib: { active: false, pts: [] },
  panelOpen: typeof window !== 'undefined' ? window.innerWidth > 900 : true, tab: 'camadas', helpOpen: false,
  noticeSeen: persisted?.ui?.noticeSeen ?? false, fpActive: false, pointerLocked: false,
  webglFailed: false, canvasKey: 0, toast: null, importErrors: null,
  rig: null, rigVersion: 0, capture: null,
  cameraReq: { nonce: 0, kind: 'home' },

  set: (p) => set(p),
  setProgress: (p) => set({ progress: Math.min(1, Math.max(0, p)) }),
  togglePlay: () => {
    const s = get();
    if (s.playing) set({ playing: false });
    else set({ playing: true, progress: s.progress >= 0.999 ? 0 : s.progress });
  },
  restart: () => set({ progress: 0, playing: true }),
  setView: (v) => {
    const s = get();
    const patch: Partial<State> = { view: v, fpActive: v === 'interior', pointerLocked: false };
    if (v === 'corte') patch.sectionOn = true;
    if (v !== 'corte' && s.view === 'corte') patch.sectionOn = false;
    if (v === 'interior') { patch.xray = false; patch.explodeOn = false; }
    if (v !== 'planta') patch.calib = { active: false, pts: [] };
    set(patch);
    get().requestCamera({ kind: 'view', view: v });
  },
  setLayer: (id, on) => set((s) => ({ layers: { ...s.layers, [id]: on }, preset: 'custom' })),
  setPreset: (p) => set((s) => ({ preset: p, layers: presetVisibility(p, layersFor(s.model)) })),
  setExplode: (on) => {
    set({ explodeOn: on });
    const v = get().view;
    if (v !== 'planta' && v !== 'interior') get().requestCamera({ kind: 'view', view: v });
  },
  select: (id) => set({ selected: id, selectedRoom: null, ...(id ? { tab: 'inspecao' as Tab, panelOpen: true } : {}) }),
  focus: (id) => {
    const s = get();
    const e = s.rig?.byId.get(id);
    const patch: Partial<State> = { selected: id, selectedRoom: null, tab: 'inspecao', panelOpen: true };
    // elementos internos ficam atrás do telhado/paredes: liga o raio-X para que o foco seja visível
    const inner = !!e && (e.layer === 'mobiliario' || e.layer === 'pisos' || e.layer === 'estrutura' || e.layer === 'fundacao' || e.layer.startsWith('sys:') || e.meta.kind === 'door' || e.meta.kind === 'window');
    if (e && inner && !s.xray && (s.view === 'geral' || s.view === 'corte')) { patch.xray = true; patch.toast = 'Raio-X ativado para mostrar o elemento por dentro.'; }
    set(patch);
    get().requestCamera({ kind: 'focus', target: id });
  },
  focusRoom: (id) => { set({ selectedRoom: id, selected: null, tab: 'inspecao', panelOpen: true }); get().requestCamera({ kind: 'room', target: id }); },
  setOverrides: (o) => {
    const s = get();
    const model = mk(s.base, o);
    set({ overrides: o, model });
  },
  patchParams: (p) => {
    const s = get();
    get().setOverrides({ ...s.overrides, params: { ...(s.overrides.params ?? {}), ...p } });
  },
  importModel: (text) => {
    let data: unknown;
    try { data = JSON.parse(text); } catch { set({ importErrors: ['O arquivo não é um JSON válido.'] }); return false; }
    const errs = validateHouse(data);
    if (errs.length) { set({ importErrors: errs }); return false; }
    const base = data as HouseModel;
    const model = mk(base, {});
    set({ base, customBase: true, overrides: {}, model, importErrors: null, layers: allOn(model), preset: 'tudo', selected: null, selectedRoom: null, toast: 'Modelo importado com sucesso.' });
    return true;
  },
  resetAll: () => {
    clearPersisted();
    const model = mk(DEFAULT_BASE, {});
    set({
      base: DEFAULT_BASE, customBase: false, overrides: {}, model, layers: allOn(model), preset: 'tudo', selected: null, selectedRoom: null, importErrors: null,
      xray: false, explodeOn: false, sectionOn: false, progress: 1, playing: false, planOverlay: true, planOpacity: 0.5, toast: 'Modelo restaurado para o padrão.',
    });
  },
  showToast: (t) => set({ toast: t }),
  requestCamera: (r) => set((s) => ({ cameraReq: { ...r, nonce: s.cameraReq.nonce + 1 } })),
}));

// persistência (overrides, modelo importado e preferências)
if (typeof window !== 'undefined') {
  useStore.subscribe((s, p) => {
    if (s.overrides === p.overrides && s.base === p.base && s.lighting === p.lighting && s.quality === p.quality && s.labels === p.labels
      && s.flow === p.flow && s.noticeSeen === p.noticeSeen && s.xrayOpacity === p.xrayOpacity && s.planOpacity === p.planOpacity && s.backdrop === p.backdrop) return;
    savePersisted({
      v: 1, overrides: s.overrides, customBase: s.customBase ? s.base : null,
      ui: { lighting: s.lighting, quality: s.quality, labels: s.labels, flow: s.flow, noticeSeen: s.noticeSeen, xrayOpacity: s.xrayOpacity, planOpacity: s.planOpacity, backdrop: s.backdrop },
    });
  });
}

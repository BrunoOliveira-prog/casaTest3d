import type { HouseModel, Overrides } from '../data/house/types';

export const STORAGE_KEY = 'raiox-casa:v1';

export interface Persisted {
  v: 1;
  overrides: Overrides;
  customBase: HouseModel | null;
  ui: {
    lighting: 'dia' | 'tarde'; quality: 'baixa' | 'media' | 'alta'; labels: boolean; flow: boolean;
    noticeSeen: boolean; xrayOpacity: number; planOpacity: number;
    backdrop?: 'ceu' | 'estudio';
  };
}

export function loadPersisted(): Partial<Persisted> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (!p || p.v !== 1) return null;
    return p;
  } catch { return null; }
}

let timer: number | undefined;
export function savePersisted(p: Persisted) {
  window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch { /* quota / modo privado: segue sem persistir */ }
  }, 250);
}
export function clearPersisted() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

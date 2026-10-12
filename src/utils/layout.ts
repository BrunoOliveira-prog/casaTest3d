/** Constantes de layout compartilhadas entre CSS (variáveis) e o enquadramento da câmera. */
export const PANEL_W = 360;
export const TIMELINE_H = 118;
export const MOBILE_BP = 900;

export interface Insets { left: number; right: number; top: number; bottom: number }

export function getInsets(panelOpen: boolean): Insets {
  const w = window.innerWidth, h = window.innerHeight;
  const mobile = w <= MOBILE_BP;
  if (mobile) return { left: 0, right: 0, top: 168, bottom: 156 + (panelOpen ? Math.round(h * 0.4) : 0) };
  return { left: 0, right: panelOpen ? PANEL_W : 0, top: 64, bottom: TIMELINE_H };
}

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const isTouchDevice = () =>
  typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0) && window.matchMedia('(pointer: coarse)').matches;

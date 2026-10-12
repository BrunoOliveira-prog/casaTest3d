import type { ReactNode } from 'react';

const base = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const;
const I = (p: { children: ReactNode }) => <svg {...base}>{p.children}</svg>;

export const IPlay = () => <I><path d="M7 5v14l12-7z" fill="currentColor" stroke="none" /></I>;
export const IPause = () => <I><path d="M8 5v14M16 5v14" strokeWidth="3" /></I>;
export const IRestart = () => <I><path d="M4 12a8 8 0 1 0 3-6.2" /><path d="M4 4v5h5" /></I>;
export const IXray = () => <I><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M4 12h16M12 4v16" strokeDasharray="2 3" /></I>;
export const IExplode = () => <I><path d="M12 3 4 7l8 4 8-4z" /><path d="m4 12 8 4 8-4" /><path d="m4 17 8 4 8-4" /></I>;
export const ILabel = () => <I><path d="M4 6h16v9H13l-3 4v-4H4z" /></I>;
export const ISun = () => <I><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5" /></I>;
export const IMoon = () => <I><path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" /></I>;
export const ICamera = () => <I><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></I>;
export const IHelp = () => <I><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01" /></I>;
export const IPanel = () => <I><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M15 4v16" /></I>;
export const IClose = () => <I><path d="M6 6l12 12M18 6 6 18" /></I>;
export const IFlip = () => <I><path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7" /></I>;
export const ISearch = () => <I><circle cx="11" cy="11" r="6" /><path d="m20 20-4-4" /></I>;
export const ITarget = () => <I><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="2" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></I>;
export const IWalk = () => <I><circle cx="13" cy="4.5" r="1.8" /><path d="m9 21 2-6-2-3 3-4 3 3 3 1M11 15l3 2 1 4" /></I>;
export const IPlan = () => <I><rect x="4" y="4" width="16" height="16" rx="1.5" /><path d="M4 11h8V4M12 11v9M16 11h4" /></I>;
export const ICube = () => <I><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9z" /><path d="m4 7.5 8 4.5 8-4.5M12 12v9" /></I>;
export const ISection = () => <I><path d="M4 18h16M6 18V9l6-4 6 4v9" /><path d="M12 3v18" strokeDasharray="2 2.5" /></I>;
export const IPipe = () => <I><path d="M3 8h8a3 3 0 0 1 3 3v2a3 3 0 0 0 3 3h4" /><circle cx="3" cy="8" r="1" /><circle cx="21" cy="16" r="1" /></I>;
export const IDownload = () => <I><path d="M12 4v11M7 11l5 5 5-5M5 20h14" /></I>;
export const IUpload = () => <I><path d="M12 16V5M7 9l5-5 5 5M5 20h14" /></I>;

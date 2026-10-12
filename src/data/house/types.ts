// Modelo de dados serializável da casa (fonte de verdade). Unidades: metros.
export type Src = 'confirmado' | 'estimado' | 'esquematico';
export type V2 = [number, number];
export type V3 = [number, number, number];

export interface Params {
  wallExtT: number; wallIntT: number; wallMidT: number;
  roofThick: number; eave: number; floorThick: number; slabThick: number;
  footingW: number; footingDepth: number;
  doorH: number; doorW: number; entryDoorH: number;
  ridgeMax: number; ceilingBase: number; eyeHeight: number;
}

export type OpeningType = 'door' | 'window' | 'slider';
export interface Opening {
  id: string; type: OpeningType;
  center: number;        // posição do centro ao longo da parede, a partir de 'a' (m)
  w: number; h: number; sill: number;
  material: string; src: Src; name?: string; note?: string;
  passable?: boolean; swing?: string;
}

export type WallKind = 'ext' | 'int' | 'stub' | 'glazing' | 'muro';
export interface Wall {
  id: string; a: V2; b: V2; t: number; tClass: 'ext' | 'int' | 'mid' | 'custom';
  kind: WallKind; name: string; material: string;
  openings: Opening[]; src: Src; note: string; height?: number;
  rooms: string[];
  // cache gerado pelo script Python (recalculado em tempo de execução pelo app)
  extA?: number; extB?: number; top?: unknown;
}

export interface Room {
  id: string; name: string; level: string; polygon: V2[];
  nominal: [number, number | null]; floor: 'madeira' | 'porcelanato' | 'cimenticio';
  src: Src; areaSource: string; spot: [number, number, number]; open?: boolean; note?: string;
}

export interface RoofPlane { x0: number; z0: number; h0: number; gx: number; gz: number }
export interface Roof {
  id: string; name: string; src: Src; polygon: V2[]; holes: V2[][]; plane: RoofPlane; note: string;
}

export interface Pillar { id: string; x: number; z: number; size: number; top: number; ext: boolean }
export interface Rafter { roof: string; a: V2; b: V2 }

export interface Furniture {
  id: string; kind: string; room: string; x: number; z: number; w: number; d: number; h: number;
  rot: number; material: string; name: string; src: Src; note: string;
}

export interface Route { id: string; label: string; points: V3[]; radius: number }
export interface Device { id: string; kind: string; pos: V3; label: string; rot?: number }
export interface SystemDef {
  id: string; name: string; color: string; icon: string; stage: [number, number];
  routes: Route[]; branches: [number, number][]; branchY: number; devices?: Device[];
}

export interface Cladding {
  id: string; name: string; wall: string; side: 1 | -1; from: number; to: string | number;
  y0: number; y1: string | number; orientation: 'vertical' | 'horizontal';
}

export interface Plant { x: number; z: number; kind: 'arvore' | 'arbusto' | 'graminea'; s: number }
export interface BedDef { id: string; name: string; polygon: V2[] }
export interface PathDef { id: string; name: string; polygon: V2[]; material: string }

export interface Annotation {
  id: string; text: string; layer: string; at: V3; stage: number; element: string | null;
}

export interface HouseModel {
  version: number;
  meta: { name: string; units: string; unitsScale: number; origin: string; source: string; disclaimer: string; orientation: string };
  reference: { image: string; furnished: string; roof: string; sizePx: [number, number]; originPx: [number, number]; mPerPx: [number, number]; note: string };
  params: Params;
  levels: { id: string; name: string; elevation: number }[];
  walls: Wall[];
  rooms: Room[];
  roofs: Roof[];
  roofExtras: {
    skylight: { id: string; name: string; center: V2; size: V2; src: Src; note: string };
    chimney: { id: string; name: string; pos: V2; radius: number; height: number; src: Src; note: string };
  };
  structure: { system: string; note: string; pillars: Pillar[]; rafters: Rafter[] };
  slab: { name: string; polygon: V2[]; src: Src; note: string };
  furniture: Furniture[];
  lights: { id: string; room: string; x: number; z: number; y: number }[];
  systems: SystemDef[];
  cladding: Cladding[];
  landscape: { beds?: BedDef[]; plants: Plant[]; paths: PathDef[] };
  annotations: Annotation[];
  assumptions: { id: string; text: string }[];
  calibration?: { planScale: number };
}

export interface Overrides {
  params?: Partial<Params>;
  planScale?: number;
  slopeCentral?: number;           // fração (ex.: 0.17)
  colors?: Partial<Record<'reboco' | 'madeira' | 'telha' | 'esquadria', string>>;
}

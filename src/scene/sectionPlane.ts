import * as THREE from 'three';
/** Plano de corte único compartilhado por materiais (render + sombras) e pela seleção (raycast). */
export const SECTION = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);

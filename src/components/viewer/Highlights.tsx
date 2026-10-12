import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '../../state/store';

function overlayFor(m: THREE.Mesh, mat: THREE.Material): THREE.Mesh {
  let o: THREE.Mesh;
  if ((m as THREE.InstancedMesh).isInstancedMesh) {
    const im = m as THREE.InstancedMesh;
    const c = new THREE.InstancedMesh(im.geometry, mat, im.count);
    c.instanceMatrix = im.instanceMatrix;
    o = c;
  } else o = new THREE.Mesh(m.geometry, mat);
  o.userData.overlay = true; o.renderOrder = 4;
  o.raycast = () => { /* não participa da seleção */ };
  return o;
}

/** Realce da seleção/hover por malhas sobrepostas — os materiais compartilhados nunca são alterados. */
export function Highlights() {
  const rig = useStore((s) => s.rig);
  const selected = useStore((s) => s.selected);
  const hover = useStore((s) => s.hover);
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    if (!rig) return;
    const added: THREE.Object3D[] = [];
    const add = (id: string | null, mat: THREE.Material) => {
      if (!id) return;
      const e = rig.byId.get(id);
      if (!e) return;
      for (const m of e.meshes) {
        if (m === e.finish) continue;
        if (m.userData.noOverlay) continue;
        const o = overlayFor(m, mat);
        m.add(o); added.push(o);
      }
    };
    add(selected, rig.mats.m.highlight);
    if (hover && hover !== selected) add(hover, rig.mats.m.hover);
    invalidate();
    return () => { added.forEach((o) => o.parent?.remove(o)); invalidate(); };
  }, [rig, selected, hover, invalidate]);
  return null;
}

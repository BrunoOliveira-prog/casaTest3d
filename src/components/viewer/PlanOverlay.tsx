import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '../../state/store';

const asset = (p: string) => `${import.meta.env.BASE_URL}${p.replace(/^\//, '')}`;

/** Imagem de referência (planta) sobreposta ao modelo na vista Planta + marcadores da calibração. */
export function PlanOverlay() {
  const model = useStore((s) => s.model);
  const view = useStore((s) => s.view);
  const on = useStore((s) => s.planOverlay);
  const opacity = useStore((s) => s.planOpacity);
  const image = useStore((s) => s.planImage);
  const calib = useStore((s) => s.calib);
  const invalidate = useThree((s) => s.invalidate);

  const ref = model.reference;
  const url = asset(image === 'planta' ? ref.image : image === 'planta-mobiliada' ? ref.furnished : ref.roof);

  const tex = useMemo(() => {
    const t = new THREE.TextureLoader().load(url, () => invalidate());
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    return t;
  }, [url, invalidate]);
  useEffect(() => () => tex.dispose(), [tex]);

  const [W, H] = ref.sizePx, [ox, oz] = ref.originPx, [mx, mz] = ref.mPerPx;
  const w = W * mx, h = H * mz;
  const cx = -ox * mx + w / 2, cz = -oz * mz + h / 2;
  const show = view === 'planta' && on;

  const markers = view === 'planta' ? calib.pts : [];
  const line = useMemo(() => {
    if (markers.length < 2) return null;
    const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(markers[0][0], 0.2, markers[0][1]), new THREE.Vector3(markers[1][0], 0.2, markers[1][1])]);
    return new THREE.Line(g, new THREE.LineBasicMaterial({ color: '#d4402f', depthTest: false }));
  }, [markers]);

  useEffect(() => { invalidate(); }, [show, opacity, calib, invalidate]);

  return (
    <>
      <mesh visible={show} position={[cx, 0.07, cz]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={6} raycast={() => null}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial map={tex} transparent opacity={opacity} depthWrite={false} toneMapped={false} polygonOffset polygonOffsetFactor={-4} />
      </mesh>
      {markers.map(([x, z], i) => (
        <mesh key={i} position={[x, 0.2, z]} renderOrder={9} raycast={() => null}>
          <sphereGeometry args={[0.14, 16, 12]} />
          <meshBasicMaterial color="#d4402f" depthTest={false} />
        </mesh>
      ))}
      {line && <primitive object={line} renderOrder={9} />}
    </>
  );
}

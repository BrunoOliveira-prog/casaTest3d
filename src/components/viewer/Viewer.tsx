import { Component, ReactNode, Suspense, lazy, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { AdaptiveDpr } from '@react-three/drei';
import * as THREE from 'three';
import { QUALITY } from '../../data/config';
import { useStore } from '../../state/store';
import { CameraRig } from '../../scene/cameras/CameraRig';
import { SceneRoot } from './SceneRoot';
import { Lights } from './Lights';
import { Picking } from './Picking';
import { Highlights } from './Highlights';
import { FirstPerson } from './FirstPerson';
import { LabelsDriver } from './Labels';
import { PlanOverlay } from './PlanOverlay';
const Post = lazy(() => import('./Post').then((m) => ({ default: m.Post })));

export function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}

class Boundary extends Component<{ children: ReactNode; onError: (e: Error) => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(e: Error) { console.error('Falha na cena 3D:', e); this.props.onError(e); }
  render() { return this.state.failed ? null : this.props.children; }
}

export function Viewer() {
  const quality = useStore((s) => s.quality);
  const key = useStore((s) => s.canvasKey);
  const q = QUALITY[quality];
  const [ok] = useState(() => webglAvailable());

  useEffect(() => { if (!ok) useStore.setState({ webglFailed: true }); }, [ok]);
  if (!ok) return null;

  return (
    <div className="viewer" role="img" aria-label="Modelo 3D interativo da casa de campo térrea em U. Use as vistas, a linha do tempo e o painel lateral para explorar.">
      <Boundary key={key} onError={() => useStore.setState({ webglFailed: true })}>
        <Canvas
          key={key}
          frameloop="demand"
          dpr={[1, q.dpr]}
          performance={{ min: 0.55 }}
          shadows="percentage"
          gl={{ antialias: true, powerPreference: 'high-performance', alpha: false }}
          onCreated={({ gl }) => {
            gl.localClippingEnabled = true;
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.outputColorSpace = THREE.SRGBColorSpace;
            const el = gl.domElement;
            el.addEventListener('webglcontextlost', (e) => { e.preventDefault(); useStore.setState({ webglFailed: true }); });
            el.style.touchAction = 'none';
          }}
        >
          <Suspense fallback={null}>
            <AdaptiveDpr />
            <Lights />
            <SceneRoot />
            <CameraRig />
            <Highlights />
            <Picking />
            <FirstPerson />
            <LabelsDriver />
            <PlanOverlay />
            <Post />
          </Suspense>
        </Canvas>
      </Boundary>
    </div>
  );
}

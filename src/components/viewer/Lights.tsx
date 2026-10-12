import { useEffect, useMemo, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { LIGHTING, QUALITY } from '../../data/config';
import { useStore } from '../../state/store';

function gradientTexture(top: string, bottom: string) {
  const c = document.createElement('canvas'); c.width = 4; c.height = 256;
  const g = c.getContext('2d')!;
  const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, top); gr.addColorStop(1, bottom);
  g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * Céu em degradê equiretangular (dependente da direção da câmera): zênite → meio → horizonte na cor exata da névoa,
 * e abaixo do horizonte a própria névoa — o chão que some na neblina emenda sem costura com o céu.
 * A mesma imagem gera o mapa de ambiente (PMREM), então reflexos e luz indireta ficam coerentes com o fundo.
 */
function skyBackground(p: (typeof LIGHTING)['dia']['sky'], sunDir: THREE.Vector3) {
  const W = 512, H = 256;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  const gr = g.createLinearGradient(0, 0, 0, H / 2);
  gr.addColorStop(0, p.zenith); gr.addColorStop(0.62, p.mid); gr.addColorStop(0.93, p.fog); gr.addColorStop(1, p.fog);
  g.fillStyle = gr; g.fillRect(0, 0, W, H / 2);
  // abaixo do horizonte: chão difuso perto, névoa na linha do horizonte (luz rebatida nas fachadas)
  const gg = g.createLinearGradient(0, H / 2, 0, H);
  gg.addColorStop(0, p.fog); gg.addColorStop(0.25, p.ground); gg.addColorStop(1, p.ground);
  g.fillStyle = gg; g.fillRect(0, H / 2, W, H / 2);
  // brilho difuso em torno do sol
  const az = Math.atan2(sunDir.x, -sunDir.z), el = Math.asin(Math.max(-1, Math.min(1, sunDir.y)));
  const sx = (az / (Math.PI * 2) + 0.5) * W, sy = (0.5 - el / Math.PI) * H;
  for (const dx of [-W, 0, W]) {
    const rg = g.createRadialGradient(sx + dx, sy, 0, sx + dx, sy, H * 0.45);
    rg.addColorStop(0, 'rgba(255,248,232,0.55)'); rg.addColorStop(1, 'rgba(255,248,232,0)');
    g.fillStyle = rg; g.fillRect(0, 0, W, H / 2 + 4);
  }
  const t = new THREE.CanvasTexture(c);
  t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function Lights() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const invalidate = useThree((s) => s.invalidate);
  const lighting = useStore((s) => s.lighting);
  const quality = useStore((s) => s.quality);
  const backdrop = useStore((s) => s.backdrop);
  const rig = useStore((s) => s.rig);
  const view = useStore((s) => s.view);
  const preset = LIGHTING[lighting];
  const q = QUALITY[quality];
  const sun = useRef<THREE.DirectionalLight>(null);

  const R = rig?.derived.bbox.radius ?? 16;
  const center = useMemo(() => new THREE.Vector3(...(rig?.derived.bbox.center ?? [8, 2, 6])), [rig]);
  const sunDir = useMemo(() => new THREE.Vector3(...preset.sunDir).normalize(), [preset]);
  const sky = backdrop === 'ceu' && view !== 'planta';

  // ambiente (reflexos + luz indireta): céu físico no modo "Céu"; estúdio neutro no modo "Estúdio" e na planta
  useEffect(() => {
    const pm = new THREE.PMREMGenerator(gl);
    let env: THREE.Texture;
    let bg: THREE.Texture | null = null;
    if (sky) {
      // reflexos e luz indireta saem do MESMO céu do fundo (degradê + névoa) → cores coerentes, sem azul exagerado
      bg = skyBackground(preset.sky, sunDir);
      env = pm.fromEquirectangular(bg).texture;
    } else {
      env = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    }
    scene.environment = env;
    if (sky && bg) {
      scene.background = bg;
      scene.backgroundIntensity = 1;
      scene.fog = new THREE.Fog(preset.sky.fog, R * 3.2, R * 13);
    }
    invalidate();
    return () => {
      if (scene.environment === env) scene.environment = null;
      if (bg && scene.background === bg) scene.background = null;
      env.dispose(); bg?.dispose(); pm.dispose();
    };
  }, [gl, scene, invalidate, sky, sunDir, preset, R]);

  // fundo em degradê (estúdio / planta)
  useEffect(() => {
    gl.toneMappingExposure = preset.exposure;
    if (sky) return;
    const bg = gradientTexture(preset.bgTop, preset.bgBottom);
    scene.background = bg;
    scene.fog = view === 'planta' ? null : new THREE.Fog(preset.bgBottom, R * 3.4, R * 14);
    invalidate();
    return () => { if (scene.background === bg) scene.background = null; bg.dispose(); };
  }, [preset, scene, gl, invalidate, sky, view, R]);

  useEffect(() => () => { scene.fog = null; }, [scene]);

  // a luz de ambiente (IBL) não sabe que está dentro de casa: no modo interior ela é reduzida para não "lavar" os cômodos
  useEffect(() => {
    const base = sky ? preset.env * 1.6 : preset.env;
    scene.environmentIntensity = view === 'interior' ? base * 0.45 : base;
    invalidate();
  }, [scene, sky, preset, view, invalidate]);

  useEffect(() => {
    const l = sun.current; if (!l) return;
    l.shadow.mapSize.set(q.shadowMap, q.shadowMap);
    if (l.shadow.map) { l.shadow.map.dispose(); l.shadow.map = null as never; }
    const cam = l.shadow.camera;
    const e = R * 1.05;
    cam.left = -e; cam.right = e; cam.top = e; cam.bottom = -e; cam.near = 0.5; cam.far = R * 6;
    cam.updateProjectionMatrix();
    l.shadow.bias = -0.00025; l.shadow.normalBias = q.shadowMap >= 4096 ? 0.02 : 0.035;
    l.shadow.radius = q.shadowRadius;
    invalidate();
  }, [q.shadowMap, q.shadowRadius, R, invalidate]);

  useEffect(() => {
    const l = sun.current; if (!l) return;
    l.target.position.copy(center); l.target.updateMatrixWorld(); invalidate();
  }, [center, invalidate]);

  const pos = center.clone().add(sunDir.clone().multiplyScalar(R * 2.4));
  const interiorOn = view === 'interior' || preset.interior > 0;
  const lamps = rig?.derived.model.lights ?? [];

  return (
    <>
      <hemisphereLight args={[preset.hemiSky, preset.hemiGround, sky ? preset.hemiIntensity * 0.55 : preset.hemiIntensity]} />
      <directionalLight
        ref={sun} color={preset.sunColor} intensity={preset.sunIntensity} position={pos.toArray()} castShadow={q.shadows}
      />
      {interiorOn && lamps.map((l) => (
        <pointLight key={l.id} position={[l.x, l.y - 0.15, l.z]} intensity={view === 'interior' ? (lighting === 'tarde' ? 7 : 3.4) : lighting === 'tarde' ? 3 : 0}
          distance={6.5} decay={1.6} color={lighting === 'tarde' ? '#ffd7a0' : '#fff4e2'} />
      ))}
    </>
  );
}

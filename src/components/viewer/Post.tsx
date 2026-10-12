import { useEffect, useRef, type JSX } from 'react';
import { useThree } from '@react-three/fiber';
import { Bloom, EffectComposer, N8AO, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import * as THREE from 'three';
import { QUALITY } from '../../data/config';
import { useStore } from '../../state/store';
import { post } from '../../scene/post';

/**
 * Pós-processamento (WebGL2, via `postprocessing`):
 * - Média: oclusão de ambiente N8AO em meia resolução + SMAA.
 * - Alta: N8AO em qualidade alta + bloom sutil (lâmpadas, sol no vidro) + vinheta leve + SMAA.
 * Fica desligado na vista Planta e com o corte ativo (os passes de AO ignoram o plano de recorte).
 * Com o compositor ativo, o mapeamento de tons sai do renderizador e vira um efeito (o render vai para buffer HDR linear).
 */
export function Post() {
  const quality = useStore((s) => s.quality);
  const sectionOn = useStore((s) => s.sectionOn);
  const view = useStore((s) => s.view);
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  const level = QUALITY[quality].post;
  const on = level !== 'off' && !sectionOn && view !== 'planta';
  const full = on && level === 'full';

  useEffect(() => {
    gl.toneMapping = on ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
    invalidate();
  }, [on, gl, invalidate]);

  const ref = useRef<{ render: () => void } | null>(null);
  useEffect(() => {
    if (!on) { post.render = null; return; }
    post.render = () => ref.current?.render();
    return () => { post.render = null; };
  }, [on]);

  if (!on) return null;
  const interior = view === 'interior';
  const fx: JSX.Element[] = [
    <N8AO key="ao"
      aoRadius={interior ? 0.6 : 1.0} distanceFalloff={interior ? 0.6 : 1.0} intensity={full ? 2.6 : 2.2}
      quality={full ? 'high' : 'performance'} halfRes={!full} color="#1a1611"
    />,
  ];
  if (full) fx.push(<Bloom key="bloom" intensity={0.32} luminanceThreshold={2.6} luminanceSmoothing={0.4} mipmapBlur radius={0.7} />);
  fx.push(<ToneMapping key="tm" mode={ToneMappingMode.ACES_FILMIC} />);
  if (full) fx.push(<Vignette key="vig" offset={0.32} darkness={0.38} />);
  fx.push(<SMAA key="smaa" />);
  return (
    <EffectComposer ref={ref as never} multisampling={0} enableNormalPass={false} frameBufferType={THREE.HalfFloatType}>
      {fx}
    </EffectComposer>
  );
}

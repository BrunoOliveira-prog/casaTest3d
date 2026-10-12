import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '../../state/store';
import { buildRig } from '../../scene/build';
import { createMaterials } from '../../scene/build/materials';
import { edgeMat } from '../../scene/build/rig';
import { applyState, sectionPlane, updateFlow } from '../../scene/animation/apply';
import { SEQUENCE_SECONDS } from '../../data/config';
import { SECTION } from '../../scene/sectionPlane';
import { post } from '../../scene/post';
import { prefersReducedMotion } from '../../utils/layout';

/** Constrói o grafo da casa a partir do modelo e aplica o estado (linha do tempo, camadas, raio-X, explosão, corte). */
export function SceneRoot() {
  const model = useStore((s) => s.model);
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const invalidate = useThree((s) => s.invalidate);
  const get = useThree((s) => s.get);
  const mats = useMemo(() => { const t0 = performance.now(); const m = createMaterials(); if (location.search.includes('debug')) console.info(`[raiox] texturas: ${(performance.now() - t0).toFixed(0)} ms`); return m; }, []);
  const explodeCur = useRef(0);
  const clock = useRef(0);
  const slow = useRef({ n: 0, sum: 0, last: 0 });
  const reduce = useMemo(() => prefersReducedMotion(), []);

  useEffect(() => () => mats.dispose(), [mats]);

  const rig = useMemo(() => buildRig(model, mats, 1), [model, mats]);

  useEffect(() => {
    scene.add(rig.root);
    useStore.setState((s) => ({
      rig, rigVersion: s.rigVersion + 1,
      selected: s.selected && rig.byId.has(s.selected) ? s.selected : null,
      hover: null,
    }));
    return () => {
      scene.remove(rig.root);
      rig.dispose();
      useStore.setState({ rig: null });
    };
  }, [rig, scene]);

  // captura PNG (somente o canvas 3D)
  useEffect(() => {
    const capture = () => {
      const st = useStore.getState();
      const camera = get().camera;
      if (post.render) post.render(); else gl.render(scene, camera);
      gl.domElement.toBlob((blob) => {
        if (!blob) { useStore.getState().showToast('Não foi possível gerar a imagem.'); return; }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `raio-x-casa-${st.view}-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.png`;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1500);
        useStore.getState().showToast('Imagem PNG salva (apenas a cena 3D, sem a interface).');
      }, 'image/png');
    };
    useStore.setState({ capture });
    return () => useStore.setState({ capture: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, scene, get]);

  const quality = useStore((s) => s.quality);
  useEffect(() => { mats.setQuality(quality); invalidate(); }, [mats, quality, invalidate]);

  // qualquer mudança de estado pede um novo quadro (renderização sob demanda)
  useEffect(() => useStore.subscribe(() => invalidate()), [invalidate]);

  // raio-X (material compartilhado)
  const xray = useStore((s) => s.xray);
  const view = useStore((s) => s.view);
  const xrayOpacity = useStore((s) => s.xrayOpacity);
  useEffect(() => { mats.setXray(xray || view === 'instalacoes', xrayOpacity); invalidate(); }, [mats, xray, view, xrayOpacity, invalidate]);

  // cores editáveis
  const colors = useStore((s) => s.overrides.colors);
  useEffect(() => { mats.setColors(colors ?? {}); invalidate(); }, [mats, colors, invalidate]);

  // corte (ligado/desligado; a posição é atualizada por quadro)
  const sectionOn = useStore((s) => s.sectionOn);
  useEffect(() => {
    mats.setSection(sectionOn ? SECTION : null, [...rig.sysMats, edgeMat, rig.guides.material as THREE.Material]);
    invalidate();
  }, [mats, rig, sectionOn, invalidate]);

  useFrame((state, dt) => {
    const st = useStore.getState();
    let animating = false;
    // reprodução
    if (st.playing) {
      const np = st.progress + (Math.min(dt, 0.1) * st.speed) / SEQUENCE_SECONDS;
      if (np >= 1) useStore.setState({ progress: 1, playing: false }); else useStore.setState({ progress: np });
      animating = true;
    }
    // explosão suave
    const target = st.explodeOn ? st.explodeAmount : 0;
    if (reduce) explodeCur.current = target;
    else {
      const d = target - explodeCur.current;
      if (Math.abs(d) > 0.0008) { explodeCur.current += d * (1 - Math.exp(-Math.min(dt, 0.1) * 5.5)); animating = true; }
      else explodeCur.current = target;
    }
    const quality = st.quality;
    applyState(rig, {
      progress: useStore.getState().progress, layers: st.layers, view: st.view, xray: st.xray, explode: explodeCur.current,
      guides: st.guides, flow: st.flow && quality !== 'baixa', reduceMotion: reduce,
    });
    if (st.sectionOn) sectionPlane(SECTION, rig, st.sectionAxis, st.sectionPos, st.sectionFlip);
    // fluxo
    if (st.flow && quality !== 'baixa' && !reduce) {
      clock.current += dt;
      updateFlow(rig, clock.current);
      if (rig.flow.some((f) => f.mesh.visible)) animating = true;
    }
    if (animating) invalidate();

    // qualidade adaptativa: se o quadro contínuo ficar lento, reduz um nível
    if (animating) {
      const w = slow.current;
      if (dt < 0.25 && state.clock.elapsedTime - w.last < 0.2) { w.n++; w.sum += dt; }
      w.last = state.clock.elapsedTime;
      if (w.n >= 120) {
        const avg = w.sum / w.n; w.n = 0; w.sum = 0;
        if (avg > 0.045 && st.quality !== 'baixa') {
          const next = st.quality === 'alta' ? 'media' : 'baixa';
          useStore.setState({ quality: next, toast: `Qualidade reduzida automaticamente para “${next === 'media' ? 'Média' : 'Baixa'}” para manter a fluidez.` });
        }
      }
    }
  });

  return null;
}


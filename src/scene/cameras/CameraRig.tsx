import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { useStore } from '../../state/store';
import { FOV, FP_FOV, Pose, availableSize, easeCam, houseCenter, viewPose } from './poses';
import { getInsets, prefersReducedMotion } from '../../utils/layout';
import { fpState } from './fpState';

interface Tween {
  t0: number; dur: number;
  fromPos: THREE.Vector3; toPos: THREE.Vector3; fromTarget: THREE.Vector3; toTarget: THREE.Vector3;
  fromZoom: number; toZoom: number; fromFov: number; toFov: number; cam: 'persp' | 'ortho'; onDone?: () => void;
}

export const camState = { tweening: false, mode: 'persp' as 'persp' | 'ortho' };

export function CameraRig() {
  const gl = useThree((s) => s.gl);
  const setThree = useThree((s) => s.set);
  const invalidate = useThree((s) => s.invalidate);
  const size = useThree((s) => s.size);
  const regress = useThree((s) => s.performance.regress);
  const useThree_regress = regress;

  const persp = useMemo(() => { const c = new THREE.PerspectiveCamera(FOV, 1, 0.1, 600); c.position.set(22, 16, 30); return c; }, []);
  const ortho = useMemo(() => { const c = new THREE.OrthographicCamera(-100, 100, 100, -100, -300, 400); c.up.set(0, 0, -1); c.position.set(8, 60, 6); c.lookAt(8, 0, 6); return c; }, []);
  const controls = useMemo(() => {
    const c = new OrbitControls(persp, gl.domElement);
    c.enableDamping = true; c.dampingFactor = 0.09; c.maxPolarAngle = Math.PI * 0.495; c.minDistance = 2.5; c.maxDistance = 90;
    c.zoomToCursor = false; c.rotateSpeed = 0.7;
    return c;
  }, [gl, persp]);
  if (typeof location !== 'undefined' && location.search.includes('debug')) (window as unknown as { __cam: unknown }).__cam = { persp, controls, invalidate };
  const tween = useRef<Tween | null>(null);
  const lastPersp = useRef<{ pos: THREE.Vector3; target: THREE.Vector3 } | null>(null);
  const sizeKey = useRef('');
  const curView = useRef(useStore.getState().view);

  // cria câmera padrão
  useEffect(() => {
    setThree({ camera: persp });
    const stop = () => { tween.current = null; camState.tweening = false; };
    controls.addEventListener('start', stop);
    const onChange = () => { useThree_regress(); invalidate(); };
    controls.addEventListener('change', onChange);
    return () => { controls.removeEventListener('start', stop); controls.removeEventListener('change', onChange); controls.dispose(); };
  }, [controls, persp, setThree, invalidate]);

  // controles de planta (pan/zoom ortográficos)
  useEffect(() => {
    const el = gl.domElement;
    const pts = new Map<number, { x: number; y: number }>();
    let lastDist = 0;
    const v = new THREE.Vector3();
    const toWorld = (cx: number, cy: number) => {
      const r = el.getBoundingClientRect();
      v.set(((cx - r.left) / r.width) * 2 - 1, -(((cy - r.top) / r.height) * 2 - 1), 0);
      ortho.updateMatrixWorld(); ortho.updateProjectionMatrix();
      return v.unproject(ortho).clone();
    };
    const zoomAt = (cx: number, cy: number, k: number) => {
      const before = toWorld(cx, cy);
      ortho.zoom = Math.min(400, Math.max(6, ortho.zoom * k));
      ortho.updateProjectionMatrix(); ortho.updateMatrixWorld();
      const after = toWorld(cx, cy);
      ortho.position.x += before.x - after.x; ortho.position.z += before.z - after.z;
      invalidate();
    };
    const active = () => useStore.getState().view === 'planta' && camState.mode === 'ortho';
    const down = (e: PointerEvent) => { if (!active()) return; pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); el.setPointerCapture?.(e.pointerId); tween.current = null; camState.tweening = false; };
    const move = (e: PointerEvent) => {
      const p = pts.get(e.pointerId);
      if (!p || !active()) return;
      if (pts.size === 1) {
        ortho.position.x -= (e.clientX - p.x) / ortho.zoom;
        ortho.position.z -= (e.clientY - p.y) / ortho.zoom;
        p.x = e.clientX; p.y = e.clientY; invalidate();
      } else if (pts.size === 2) {
        p.x = e.clientX; p.y = e.clientY;
        const [a, b] = [...pts.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (lastDist > 0) zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, dist / lastDist);
        lastDist = dist;
      }
    };
    const up = (e: PointerEvent) => { pts.delete(e.pointerId); lastDist = 0; };
    const wheel = (e: WheelEvent) => { if (!active()) return; e.preventDefault(); zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0015)); };
    el.addEventListener('pointerdown', down); el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', wheel, { passive: false });
    return () => {
      el.removeEventListener('pointerdown', down); el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); el.removeEventListener('wheel', wheel);
    };
  }, [gl, ortho, invalidate]);

  const req = useStore((s) => s.cameraReq);
  const rigVersion = useStore((s) => s.rigVersion);

  // pedidos de câmera
  useEffect(() => {
    const st = useStore.getState();
    const rig = st.rig;
    if (!rig || req.nonce === 0 && rigVersion === 0) return;
    const d = rig.derived;
    const ins = getInsets(st.panelOpen);
    const avail = availableSize(size.width, size.height, ins);
    const dur = prefersReducedMotion() ? 0 : 1000;

    const start = (cam: 'persp' | 'ortho', toPos: THREE.Vector3, toTarget: THREE.Vector3, toZoom: number, toFov: number, onDone?: () => void, d2 = dur) => {
      const c = cam === 'persp' ? persp : ortho;
      const fromTarget = cam === 'persp' ? controls.target.clone() : new THREE.Vector3(ortho.position.x, 0, ortho.position.z);
      tween.current = {
        t0: performance.now(), dur: d2, fromPos: c.position.clone(), toPos, fromTarget, toTarget,
        fromZoom: c.zoom, toZoom, fromFov: persp.fov, toFov, cam, onDone,
      };
      camState.tweening = d2 > 0;
      invalidate();
    };
    const activate = (cam: 'persp' | 'ortho') => {
      camState.mode = cam;
      setThree({ camera: cam === 'persp' ? persp : ortho });
      controls.enabled = cam === 'persp' && useStore.getState().view !== 'interior';
    };

    const goView = (view: typeof st.view) => {
      const prev = curView.current;
      curView.current = view;
      if (view === 'interior') {
        if (prev !== 'interior') lastPersp.current = { pos: persp.position.clone(), target: controls.target.clone() };
        // início do passeio: canto sudoeste da sala, olhando para a sala de jantar (o vidro para o pátio fica à direita)
        const sala = d.roomById.get('R-SALA');
        const x = sala ? Math.min(Math.max(4.4, sala.bbox[0][0] + 0.9), sala.bbox[1][0] - 1) : 4.4;
        const z = sala ? Math.min(Math.max(4.5, sala.bbox[0][1] + 1.2), sala.bbox[1][1] - 0.9) : 4.5;
        const yaw = (-45 * Math.PI) / 180;
        const eye0 = d.model.params.eyeHeight;
        activate('persp'); controls.enabled = false;
        const eye = eye0;
        fpState.x = x; fpState.z = z; fpState.yaw = yaw; fpState.pitch = 0;
        const to = new THREE.Vector3(x, eye, z);
        const tg = new THREE.Vector3(x - Math.sin(yaw) * 2, eye, z - Math.cos(yaw) * 2);
        start('persp', to, tg, 1, FP_FOV, () => { camState.tweening = false; });
        return;
      }
      const pose: Pose = viewPose(view, d, avail, { axis: st.sectionAxis, flip: st.sectionFlip, t: st.sectionPos, explode: st.explodeOn ? st.explodeAmount : 0 });
      if (pose.kind === 'ortho') {
        if (prev !== 'planta' && camState.mode === 'persp') lastPersp.current = { pos: persp.position.clone(), target: controls.target.clone() };
        activate('ortho');
        ortho.up.set(0, 0, -1);
        const from = pose.zoom * 0.55;
        ortho.zoom = from; ortho.position.copy(pose.pos); ortho.lookAt(pose.target);
        start('ortho', pose.pos.clone(), pose.target.clone(), pose.zoom, FOV);
        return;
      }
      // perspectiva: se vier da planta, começa de cima
      if (camState.mode === 'ortho') {
        const c = new THREE.Vector3(ortho.position.x, 0, ortho.position.z);
        persp.position.set(c.x, Math.max(30, d.bbox.radius * 2.6), c.z + 0.01);
        controls.target.copy(c);
        persp.fov = FOV; persp.updateProjectionMatrix();
      } else if (prev === 'interior') {
        const cp = Math.cos(fpState.pitch);
        controls.target.copy(persp.position).add(new THREE.Vector3(-Math.sin(fpState.yaw) * cp, Math.sin(fpState.pitch), -Math.cos(fpState.yaw) * cp).multiplyScalar(2));
      }
      activate('persp');
      controls.enabled = true;
      start('persp', pose.pos, pose.target, 1, FOV);
    };

    if (req.kind === 'view' && req.view) goView(req.view);
    else if (req.kind === 'home') goView(st.view);
    else if (req.kind === 'focus' && req.target) {
      const e = rig.byId.get(req.target);
      if (!e) return;
      const box = new THREE.Box3().setFromObject(e.obj);
      if (box.isEmpty()) return;
      const c = box.getCenter(new THREE.Vector3()); const sz = box.getSize(new THREE.Vector3());
      if (st.view === 'interior') return;
      if (camState.mode === 'ortho') {
        const zoom = Math.min(avail.w / (Math.max(sz.x, 2) * 2.4), avail.h / (Math.max(sz.z, 2) * 2.4));
        start('ortho', new THREE.Vector3(c.x, 60, c.z), new THREE.Vector3(c.x, 0, c.z), Math.min(120, Math.max(ortho.zoom * 0.8, zoom)), FOV);
      } else {
        const dir = persp.position.clone().sub(controls.target).normalize();
        if (dir.y < 0.25) dir.y = 0.25; dir.normalize();
        const dist = Math.min(60, Math.max(3.5, Math.max(sz.x, sz.y, sz.z) * 2.1 + 1.5));
        const tg = new THREE.Vector3(c.x, Math.max(0.4, c.y), c.z);
        start('persp', tg.clone().add(dir.multiplyScalar(dist)), tg, 1, FOV);
      }
    } else if (req.kind === 'room' && req.target) {
      const r = d.roomById.get(req.target);
      if (!r) return;
      if (st.view === 'interior') {
        fpState.x = r.spot[0]; fpState.z = r.spot[1]; fpState.yaw = (-r.spot[2] * Math.PI) / 180; fpState.pitch = 0;
        invalidate();
        return;
      }
      const w = r.bbox[1][0] - r.bbox[0][0], h = r.bbox[1][1] - r.bbox[0][1];
      if (camState.mode === 'ortho') {
        const zoom = Math.min(avail.w / (w + 2.5), avail.h / (h + 2.5));
        start('ortho', new THREE.Vector3(r.centroid[0], 60, r.centroid[1]), new THREE.Vector3(r.centroid[0], 0, r.centroid[1]), zoom, FOV);
      } else {
        const tg = new THREE.Vector3(r.centroid[0], 0.9, r.centroid[1]);
        const dist = Math.max(w, h) * 1.25 + 3.5;
        const dir = new THREE.Vector3(Math.sin(0.35) * Math.cos(1.0), Math.sin(1.0), Math.cos(0.35) * Math.cos(1.0));
        start('persp', tg.clone().add(dir.multiplyScalar(dist)), tg, 1, FOV);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [req.nonce, rigVersion]);

  useFrame(() => {
    // dimensões / insets
    const st = useStore.getState();
    const ins = st.view === 'interior' ? { left: 0, right: 0, top: 0, bottom: 0 } : getInsets(st.panelOpen);
    const key = `${size.width}x${size.height}|${ins.right}|${ins.bottom}|${camState.mode}`;
    if (key !== sizeKey.current) {
      sizeKey.current = key;
      persp.aspect = size.width / size.height;
      ortho.left = -size.width / 2; ortho.right = size.width / 2; ortho.top = size.height / 2; ortho.bottom = -size.height / 2;
      const ox = (ins.right - ins.left) / 2, oy = (ins.bottom - ins.top) / 2;
      for (const c of [persp, ortho]) { c.setViewOffset(size.width, size.height, ox, oy, size.width, size.height); }
      persp.updateProjectionMatrix(); ortho.updateProjectionMatrix();
    }
    const tw = tween.current;
    if (tw) {
      const t = tw.dur <= 0 ? 1 : Math.min(1, (performance.now() - tw.t0) / tw.dur);
      const k = easeCam(t);
      if (tw.cam === 'persp') {
        persp.position.lerpVectors(tw.fromPos, tw.toPos, k);
        controls.target.lerpVectors(tw.fromTarget, tw.toTarget, k);
        persp.fov = tw.fromFov + (tw.toFov - tw.fromFov) * k;
        persp.updateProjectionMatrix();
        if (!controls.enabled) persp.lookAt(controls.target);
        else controls.update();
      } else {
        ortho.zoom = tw.fromZoom + (tw.toZoom - tw.fromZoom) * k;
        ortho.position.lerpVectors(tw.fromPos, tw.toPos, k);
        ortho.updateProjectionMatrix();
      }
      if (t >= 1) { tween.current = null; camState.tweening = false; tw.onDone?.(); }
      invalidate();
    } else if (controls.enabled) {
      controls.update();
    }
    void houseCenter;
  });
  return null;
}

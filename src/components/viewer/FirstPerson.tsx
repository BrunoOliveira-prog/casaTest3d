import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useStore } from '../../state/store';
import { moveWithCollision } from '../../data/house/derive';
import { fpInput, fpState } from '../../scene/cameras/fpState';
import { camState } from '../../scene/cameras/CameraRig';

const RADIUS = 0.24;
const WALK = 1.5, RUN = 2.9;

export function FirstPerson() {
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  const view = useStore((s) => s.view);
  const keys = useRef(new Set<string>());
  const moving = useRef(false);

  useEffect(() => {
    if (view !== 'interior') return;
    const el = gl.domElement;
    let dragging = false;
    const onKey = (e: KeyboardEvent, down: boolean) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
      const c = e.code;
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight'].includes(c)) {
        if (down) keys.current.add(c); else keys.current.delete(c);
        if (c.startsWith('Arrow')) e.preventDefault();
        invalidate();
      }
    };
    const kd = (e: KeyboardEvent) => onKey(e, true);
    const ku = (e: KeyboardEvent) => onKey(e, false);
    const blur = () => keys.current.clear();
    const pd = (e: PointerEvent) => { if (e.pointerType === 'mouse' && e.button !== 0) return; dragging = true; };
    const pu = () => { dragging = false; };
    const pm = (e: PointerEvent) => {
      const locked = document.pointerLockElement === el;
      if (!dragging && !locked) return;
      if (e.pointerType === 'touch') return; // toque usa o controle virtual
      fpState.yaw -= e.movementX * 0.0032;
      fpState.pitch = Math.max(-1.25, Math.min(1.25, fpState.pitch - e.movementY * 0.0032));
      invalidate();
    };
    const lockChange = () => useStore.setState({ pointerLocked: document.pointerLockElement === el });
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku); window.addEventListener('blur', blur);
    el.addEventListener('pointerdown', pd); window.addEventListener('pointerup', pu); el.addEventListener('pointermove', pm);
    document.addEventListener('pointerlockchange', lockChange);
    return () => {
      window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); window.removeEventListener('blur', blur);
      el.removeEventListener('pointerdown', pd); window.removeEventListener('pointerup', pu); el.removeEventListener('pointermove', pm);
      document.removeEventListener('pointerlockchange', lockChange);
      if (document.pointerLockElement === el) document.exitPointerLock();
      keys.current.clear();
    };
  }, [view, gl, invalidate]);

  useFrame(({ camera }, dt) => {
    if (view !== 'interior' || camState.tweening) return;
    const rig = useStore.getState().rig;
    if (!rig) return;
    const k = keys.current;
    let f = 0, r = 0;
    if (k.has('KeyW') || k.has('ArrowUp')) f += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) f -= 1;
    if (k.has('KeyD')) r += 1;
    if (k.has('KeyA')) r -= 1;
    let turn = 0;
    if (k.has('ArrowLeft')) turn += 1;
    if (k.has('ArrowRight')) turn -= 1;
    f += -fpInput.moveY; r += fpInput.moveX;
    const run = k.has('ShiftLeft') || k.has('ShiftRight') || fpInput.run;
    const len = Math.hypot(f, r);
    if (len > 1) { f /= len; r /= len; }
    const dts = Math.min(dt, 0.05);
    if (turn) fpState.yaw += turn * 1.8 * dts;
    if (fpInput.lookDX || fpInput.lookDY) {
      fpState.yaw -= fpInput.lookDX * 0.005;
      fpState.pitch = Math.max(-1.25, Math.min(1.25, fpState.pitch - fpInput.lookDY * 0.005));
      fpInput.lookDX = 0; fpInput.lookDY = 0;
    }
    const sp = (run ? RUN : WALK) * dts;
    const sy = Math.sin(fpState.yaw), cy = Math.cos(fpState.yaw);
    const dx = (-sy * f + cy * r) * sp, dz = (-cy * f - sy * r) * sp;
    if (dx || dz) {
      const [nx, nz] = moveWithCollision([fpState.x, fpState.z], dx, dz, RADIUS, rig.derived.collision);
      fpState.x = Math.max(-14, Math.min(30, nx)); fpState.z = Math.max(-11, Math.min(26, nz));
    }
    const eye = rig.derived.model.params.eyeHeight;
    camera.position.set(fpState.x, eye, fpState.z);
    camera.rotation.order = 'YXZ';
    camera.rotation.set(fpState.pitch, fpState.yaw, 0);
    const active = !!(dx || dz || turn || len);
    moving.current = active;
    if (active) invalidate();
  });
  return null;
}

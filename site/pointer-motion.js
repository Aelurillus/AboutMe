import { createFrameQueue, approach } from './animation-frame.js';

export function createPointerMotion({ cursor, poses, fine, reduced }) {
  const lights = new Map();
  document.querySelectorAll('.spotlight').forEach(card => {
    const clip = document.createElement('div'); clip.className = 'spotlight-light'; clip.setAttribute('aria-hidden', 'true');
    const glow = document.createElement('div'); glow.className = 'spotlight-glow'; clip.append(glow); card.append(clip);
    lights.set(card, { clip, glow });
  });
  const sprites = new Map();
  Object.entries(poses || {}).forEach(([pose, src]) => {
    if (!/^\/(?!\/)/.test(src)) return;
    const image = new Image(); image.src = src; sprites.set(pose, image);
    image.decode?.().catch(() => {});
  });
  let x = 0, y = 0, target, pointerSeen = false, dirty = false, hitTest = false;
  let visible = false, down = false, lastPose, activeLight, lastTime;
  const magnets = new Map();
  const enabled = () => fine.matches && !reduced.matches && !document.hidden;
  const inside = rect => x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  const frames = createFrameQueue(time => {
    if (!enabled() || !pointerSeen) return false;
    const elapsed = lastTime === undefined ? 16 : Math.min(64, time - lastTime); lastTime = time;
    // Read geometry before changing any styles. Events only record new input.
    if (hitTest) { target = document.elementFromPoint(x, y); hitTest = false; }
    let card = target?.closest('.spotlight'), social = target?.closest('.social');
    const cardRect = dirty && card ? card.getBoundingClientRect() : null;
    const socialRect = dirty && social ? social.getBoundingClientRect() : null;
    if (cardRect && !inside(cardRect)) card = null;
    if (socialRect && !inside(socialRect)) social = null;
    if (dirty) {
      if (!visible && cursor.complete && cursor.naturalWidth) {
        visible = true; cursor.style.visibility = 'visible'; document.documentElement.classList.add('cat-ready');
      }
      if (visible) cursor.style.transform = `translate3d(${x + 3}px,${y + (down ? 4 : 3)}px,0) scale(${down ? 0.94 : 1})`;
      const pose = down ? 'pressed' : target?.closest('button,a,input,select,textarea,[role="button"]') ? 'hover' : 'idle';
      if (pose !== lastPose) {
        const image = sprites.get(pose);
        if (image?.complete && image.naturalWidth) { cursor.src = image.src; lastPose = pose; }
        cursor.dataset.pose = pose;
      }
      const light = lights.get(card);
      if (light !== activeLight) { activeLight?.clip.classList.remove('is-active'); light?.clip.classList.add('is-active'); activeLight = light; }
      if (light && cardRect) light.glow.style.transform = `translate3d(${x - cardRect.left - 320}px,${y - cardRect.top - 320}px,0)`;
      magnets.forEach((state, link) => { if (link !== social) { state.tx = 0; state.ty = 0; } });
      if (social && socialRect) {
        if (!magnets.has(social)) { social.classList.add('is-magnetic'); magnets.set(social, { x: 0, y: 0, tx: 0, ty: 0 }); }
        const state = magnets.get(social);
        state.tx = (x - socialRect.left - socialRect.width / 2) / 5;
        state.ty = (y - socialRect.top - socialRect.height / 2) / 5;
      }
      dirty = false;
    }
    let moving = false;
    magnets.forEach((state, link) => {
      state.x = approach(state.x, state.tx, elapsed); state.y = approach(state.y, state.ty, elapsed);
      link.firstChild.style.transform = `translate3d(${state.x}px,${state.y}px,0)`;
      if (state.x !== state.tx || state.y !== state.ty) moving = true;
      else if (state.tx === 0 && state.ty === 0) { link.classList.remove('is-magnetic'); link.firstChild.style.transform = ''; magnets.delete(link); }
    });
    if (!moving) lastTime = undefined;
    return moving;
  });
  function record(event) {
    if (event.pointerType !== 'mouse' || !enabled()) return;
    x = event.clientX; y = event.clientY; target = event.target instanceof Element ? event.target : null;
    pointerSeen = true; dirty = true; frames.request();
  }
  function hide() {
    frames.cancel(); lastTime = undefined; pointerSeen = false; down = false; dirty = false; hitTest = false;
    if (visible) { cursor.style.visibility = 'hidden'; document.documentElement.classList.remove('cat-ready'); visible = false; }
    activeLight?.clip.classList.remove('is-active'); activeLight = undefined;
    magnets.forEach((_, link) => { link.classList.remove('is-magnetic'); link.firstChild.style.transform = ''; }); magnets.clear();
  }
  function refreshGeometry() { if (pointerSeen && enabled()) { dirty = true; hitTest = true; frames.request(); } }
  addEventListener('pointermove', record, { passive: true });
  addEventListener('pointerdown', event => { if (event.pointerType === 'mouse') { down = true; record(event); } }, { passive: true });
  addEventListener('pointerup', event => { down = false; record(event); }, { passive: true });
  addEventListener('pointercancel', hide); addEventListener('blur', hide);
  document.documentElement.addEventListener('pointerleave', hide);
  fine.addEventListener('change', hide); reduced.addEventListener('change', hide);
  addEventListener('scroll', refreshGeometry, { passive: true }); addEventListener('resize', refreshGeometry);
  document.fonts?.ready.then(refreshGeometry);
  return { hide };
}

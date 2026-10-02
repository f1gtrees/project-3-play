/* =============================================================================
   DRAG INPUT — Project 3 (floating thumb-stick)
   -----------------------------------------------------------------------------
   Touch anywhere and drag: where your thumb first lands becomes the center,
   and the direction/distance you drag is the movement. Arrow keys / WASD
   and mouse-drag work too, for testing on the Mac. Generic — a candidate
   for engine.js later (see PARKING_LOT.md).

   getVector() -> {x, y}, each -1..1 (0,0 = not moving). Analog: a small
   drag walks slowly, a full drag walks at full speed.
   ============================================================================= */
function createDragInput(canvas, opts = {}) {
  const deadZone = opts.deadZone || 16;   // CSS px you can wobble without moving
  const maxRadius = opts.maxRadius || 50; // CSS px for full speed
  let drag = null; // { id, originX, originY, x, y }

  function begin(id, x, y) { drag = { id, originX: x, originY: y, x, y }; }

  canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    if (drag) return; // one thumb steers; extra fingers are ignored
    const t = e.changedTouches[0];
    begin(t.identifier, t.clientX, t.clientY);
  }, { passive: false });
  canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    if (!drag) return;
    for (const t of e.changedTouches) if (t.identifier === drag.id) { drag.x = t.clientX; drag.y = t.clientY; }
  }, { passive: false });
  function touchEnd(e) {
    if (!drag) return;
    for (const t of e.changedTouches) if (t.identifier === drag.id) drag = null;
  }
  canvas.addEventListener('touchend', touchEnd);
  canvas.addEventListener('touchcancel', touchEnd);

  // Mouse drag (desktop testing)
  canvas.addEventListener('mousedown', e => begin('mouse', e.clientX, e.clientY));
  window.addEventListener('mousemove', e => { if (drag && drag.id === 'mouse') { drag.x = e.clientX; drag.y = e.clientY; } });
  window.addEventListener('mouseup', () => { if (drag && drag.id === 'mouse') drag = null; });

  // Keyboard (desktop testing)
  const keys = {};
  const KEY_CODES = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD'];
  window.addEventListener('keydown', e => { if (KEY_CODES.includes(e.code)) { keys[e.code] = true; e.preventDefault(); } });
  window.addEventListener('keyup', e => { keys[e.code] = false; });
  window.addEventListener('blur', () => { Object.keys(keys).forEach(k => { keys[k] = false; }); });

  function getVector() {
    if (drag) {
      const dx = drag.x - drag.originX, dy = drag.y - drag.originY;
      const dist = Math.hypot(dx, dy);
      if (dist < deadZone) return { x: 0, y: 0 };
      const strength = Math.min(1, (dist - deadZone) / (maxRadius - deadZone));
      return { x: dx / dist * strength, y: dy / dist * strength };
    }
    let x = 0, y = 0;
    if (keys.ArrowLeft || keys.KeyA) x -= 1;
    if (keys.ArrowRight || keys.KeyD) x += 1;
    if (keys.ArrowUp || keys.KeyW) y -= 1;
    if (keys.ArrowDown || keys.KeyS) y += 1;
    const len = Math.hypot(x, y);
    return len ? { x: x / len, y: y / len } : { x: 0, y: 0 };
  }

  return {
    getVector,
    getDrag: () => (drag ? { ...drag, maxRadius } : null),
    cancel: () => { drag = null; }
  };
}

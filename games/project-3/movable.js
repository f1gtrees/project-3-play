/* =============================================================================
   MOVABLE — Project 3 (testing aid)
   -----------------------------------------------------------------------------
   Makes an on-screen element movable: DOUBLE-TAP it (double-click on the
   Mac), then drag it where you like and let go. It glows gold while it's
   being moved. The spot is remembered on this device, as a fraction of the
   screen so it still makes sense after rotating.

   makeMovable(el, { storageKey, defaultPos(W, H, w, h) -> { x, y }, stamp, scale })
   scale: a number, or a function giving it (the element is scaled around its centre).
   stamp: the HUD layout's stamp (hud-layout.js) — a spot saved before a
   newer layout was exported from World Builder is dropped, so the Builder wins.
   Returns { place } — call place() after the element's size changes.
   ============================================================================= */
function makeMovable(el, opts) {
  let pos = null;
  try { pos = JSON.parse(localStorage.getItem(opts.storageKey)); } catch (e) { pos = null; }
  if (pos && (pos.stamp || 0) !== (opts.stamp || 0)) pos = null;
  let moving = false, lastTap = 0, touchId = null, lastTouch = 0;

  function place() {
    const W = window.innerWidth, H = window.innerHeight, w = el.offsetWidth, h = el.offsetHeight;
    const k = (typeof opts.scale === 'function' ? opts.scale() : opts.scale) || 1, sw = w * k, sh = h * k; // on-screen size (the element is scaled around its centre)
    let x, y;
    if (pos) { x = pos.fx * W - w / 2; y = pos.fy * H - h / 2; }
    else { const d = opts.defaultPos(W, H, w, h); x = d.x; y = d.y; }
    // keep the whole (scaled) element on screen
    const cx = Math.max(2 + sw / 2, Math.min(W - 2 - sw / 2, x + w / 2));
    const cy = Math.max(2 + sh / 2, Math.min(H - 2 - sh / 2, y + h / 2));
    el.style.left = (cx - w / 2) + 'px'; el.style.top = (cy - h / 2) + 'px';
  }
  function moveTo(cx, cy) { pos = { fx: cx / window.innerWidth, fy: cy / window.innerHeight, stamp: opts.stamp || 0 }; place(); }
  function start() { moving = true; el.classList.add('moving'); if (navigator.vibrate) navigator.vibrate(15); }
  function stop() {
    if (!moving) return;
    moving = false; el.classList.remove('moving');
    try { localStorage.setItem(opts.storageKey, JSON.stringify(pos)); } catch (e) { /* not saved — fine */ }
  }

  el.addEventListener('touchstart', e => {
    e.preventDefault(); e.stopPropagation();
    const t = e.changedTouches[0], now = Date.now();
    touchId = t.identifier; lastTouch = now;
    if (now - lastTap < 350) start();   // second tap: pick it up
    lastTap = now;
  }, { passive: false });
  el.addEventListener('touchmove', e => {
    e.preventDefault();
    for (const t of e.changedTouches) if (t.identifier === touchId && moving) moveTo(t.clientX, t.clientY);
  }, { passive: false });
  const end = e => { for (const t of e.changedTouches) if (t.identifier === touchId) { stop(); touchId = null; } };
  el.addEventListener('touchend', end);
  el.addEventListener('touchcancel', end);

  // Mac: double-click, drag, release
  el.addEventListener('dblclick', e => { if (Date.now() - lastTouch > 600) { e.preventDefault(); start(); } });
  el.addEventListener('mousedown', e => e.stopPropagation());
  window.addEventListener('mousemove', e => { if (moving && touchId === null) moveTo(e.clientX, e.clientY); });
  window.addEventListener('mouseup', () => { if (touchId === null) stop(); });

  window.addEventListener('resize', place);
  requestAnimationFrame(place);
  return { place };
}

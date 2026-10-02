/* =============================================================================
   ACTION BUTTON — Project 3
   -----------------------------------------------------------------------------
   A round on-screen button you can MOVE:
     - TAP it: does its action (right away, on touch-down).
     - PRESS AND HOLD it (about half a second): it lights up — now drag it
       wherever your thumb likes it, and let go. The spot is remembered on
       this phone (it falls back to bottom-right if it can't be).
   Space bar presses it on the Mac.
   setCooldown(0..1) dims the button and shows a ring refilling while it
   can't be used yet.

   opts.layout = { x, y, scale, visible } from hud-layout.js (World
   Builder's HUD screen): x/y = the button's CENTRE as a fraction of the
   screen. opts.stamp = that layout's stamp — a spot saved on the phone
   before a newer layout was exported is dropped, so the Builder wins.
   opts.fit() (optional) = extra size factor for this screen, so the button
   is the same share of any phone (Project 3 passes hudFit from hud.js).

   opts.key = the keyboard key that presses it on the Mac (default 'Space';
   null = none). opts.fireOnRelease = act when a TAP ends instead of on
   touch-down (for menu buttons: a press-and-hold to move it then doesn't
   also open the menu). opts.className = extra look (e.g. a square button).

   Generic on purpose (label, action, where to remember) — every ability
   button later can be one of these.
   ============================================================================= */
function createActionButton(opts) {
  const L = opts.layout || {};
  let size = 0;
  const workOutSize = () => {
    size = Math.round((opts.size || 76) * (L.scale || 1) * (opts.fit ? opts.fit() : 1));
    btn.style.width = btn.style.height = size + 'px';
    btn.style.fontSize = Math.round((opts.fontSize || 13) * size / (opts.size || 76)) + 'px'; // label grows with the button
  };
  const storageKey = opts.storageKey || 'actionButtonPos';
  const hiddenByLayout = L.visible === false;
  const btn = document.createElement('button');
  btn.className = 'action-btn' + (opts.className ? ' ' + opts.className : '');
  btn.textContent = opts.label || 'ACT';
  workOutSize();
  document.body.appendChild(btn);

  // Position is remembered as a fraction of the screen, so it still makes
  // sense after rotating the phone.
  let pos = null;
  try { pos = JSON.parse(localStorage.getItem(storageKey)); } catch (e) { pos = null; }
  if (pos && (pos.stamp || 0) !== (opts.stamp || 0)) pos = null; // a newer layout from World Builder wins
  function place() {
    workOutSize();
    const W = window.innerWidth, H = window.innerHeight;
    let x = pos ? pos.fx * W - size / 2 : (typeof L.x === 'number' ? L.x * W - size / 2 : W - size - 24);
    let y = pos ? pos.fy * H - size / 2 : (typeof L.y === 'number' ? L.y * H - size / 2 : H - size - 48);
    x = Math.max(4, Math.min(W - size - 4, x));
    y = Math.max(4, Math.min(H - size - 4, y));
    btn.style.left = x + 'px'; btn.style.top = y + 'px';
  }
  function save(cx, cy) {
    pos = { fx: cx / window.innerWidth, fy: cy / window.innerHeight, stamp: opts.stamp || 0 };
    try { localStorage.setItem(storageKey, JSON.stringify(pos)); } catch (e) { /* not saved — fine */ }
  }
  place();
  window.addEventListener('resize', place);

  const HOLD_MS = 500;
  let holdTimer = null, moving = false, touchId = null, lastTouch = 0;

  function press() {
    btn.classList.add('held');
    setTimeout(() => btn.classList.remove('held'), 120);
    if (!opts.fireOnRelease && opts.onPress) opts.onPress();
  }
  function startHold() {
    clearTimeout(holdTimer);
    holdTimer = setTimeout(() => {
      moving = true;
      btn.classList.add('moving');
      if (navigator.vibrate) navigator.vibrate(20);
    }, HOLD_MS);
  }
  function moveTo(cx, cy) {
    pos = { fx: cx / window.innerWidth, fy: cy / window.innerHeight, stamp: opts.stamp || 0 };
    place();
  }
  function end(cx, cy) {
    clearTimeout(holdTimer);
    if (moving) { save(cx, cy); moving = false; btn.classList.remove('moving'); }
    else if (opts.fireOnRelease && opts.onPress) opts.onPress(); // a tap, not a move
  }

  btn.addEventListener('touchstart', e => {
    e.preventDefault(); e.stopPropagation();
    if (touchId !== null) return;
    const t = e.changedTouches[0];
    touchId = t.identifier; lastTouch = Date.now();
    press(); startHold();
  }, { passive: false });
  btn.addEventListener('touchmove', e => {
    e.preventDefault();
    for (const t of e.changedTouches) if (t.identifier === touchId && moving) moveTo(t.clientX, t.clientY);
  }, { passive: false });
  function touchEnd(e) {
    for (const t of e.changedTouches) if (t.identifier === touchId) { end(t.clientX, t.clientY); touchId = null; }
  }
  btn.addEventListener('touchend', touchEnd);
  btn.addEventListener('touchcancel', touchEnd);

  // Mouse (Mac testing) — ignores the fake mouse events phones send after a touch.
  let mouseDown = false;
  btn.addEventListener('mousedown', e => {
    if (Date.now() - lastTouch < 600) return;
    e.stopPropagation(); mouseDown = true; press(); startHold();
  });
  window.addEventListener('mousemove', e => { if (mouseDown && moving) moveTo(e.clientX, e.clientY); });
  window.addEventListener('mouseup', e => { if (mouseDown) { mouseDown = false; end(e.clientX, e.clientY); } });

  const key = opts.key === undefined ? 'Space' : opts.key;
  if (key) window.addEventListener('keydown', e => {
    if (e.code === key && !e.repeat && btn.style.display !== 'none') {
      e.preventDefault(); press();
      if (opts.fireOnRelease && opts.onPress) opts.onPress();
    }
  });

  let lastCooldown = -1;
  return {
    el: btn,
    setVisible(v) { btn.style.display = v && !hiddenByLayout ? 'block' : 'none'; },
    // f = how much of the cooldown is left: 1 = just used, 0 = ready.
    setCooldown(f) {
      f = Math.max(0, Math.min(1, f));
      const q = Math.round(f * 50) / 50; // only touch the page when it visibly changes
      if (q === lastCooldown) return;
      lastCooldown = q;
      btn.classList.toggle('cooling', q > 0);
      btn.style.setProperty('--cd', (q * 360) + 'deg');
    }
  };
}

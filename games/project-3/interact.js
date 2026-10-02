/* =============================================================================
   INTERACT — Project 3: press-and-hold on something in the world
   -----------------------------------------------------------------------------
   The vendor and loot boxes work the same way: walk close, then PRESS AND
   HOLD ON THEM (on the phone; click-and-hold on the Mac, or hold E next to
   one). A bar over them fills up; when it's full, their menu opens.

   A target: { key, x, y, box: { x, y, w, h } (where you can press, art px),
               range (how close the hero must be), holdSeconds,
               bubbleX, bubbleY (where the bar sits, art px), open() }

   createInteract() -> it
   interactPress(it, targets, pt, hero) -> true if pt (art px) landed on a
     target the hero is close enough to (the page then keeps the finger
     from steering the hero)
   interactRelease(it)
   updateInteract(it, targets, hero, dt, keyHold) — fills the bar; opens
     the target's menu when full
   drawHoldBar(...) — the bar (the bubble art stretched wider)

   Generic on purpose — a candidate for the engine later.
   ============================================================================= */
function createInteract() { return { target: null, progress: 0, pressing: false, byKey: false }; }

function nearTarget(targets, hero) {
  let best = null, bd = Infinity;
  targets.forEach(t => { const d = Math.hypot(t.x - hero.x, t.y - hero.y); if (d <= t.range && d < bd) { bd = d; best = t; } });
  return best;
}
function interactPress(it, targets, pt, hero) {
  const pad = 6; // a little extra around the art — easy to hit with a thumb
  const t = targets.find(t => pt.x >= t.box.x - pad && pt.x <= t.box.x + t.box.w + pad && pt.y >= t.box.y - pad && pt.y <= t.box.y + t.box.h + pad &&
    Math.hypot(t.x - hero.x, t.y - hero.y) <= t.range);
  if (!t) return false;
  it.target = t.key; it.pressing = true; it.byKey = false; it.progress = 0;
  return true;
}
function interactRelease(it) { it.pressing = false; }

function updateInteract(it, targets, hero, dt, keyHold) {
  if (keyHold && !it.pressing) { const t = nearTarget(targets, hero); if (t) { it.target = t.key; it.pressing = true; it.byKey = true; } }
  if (it.byKey && !keyHold) it.pressing = false;
  const t = it.target && targets.find(x => x.key === it.target);
  if (!t || !it.pressing || Math.hypot(t.x - hero.x, t.y - hero.y) > t.range) {
    it.progress = Math.max(0, it.progress - dt * 3); // let go / walked off: drains back quickly
    if (it.progress === 0) it.target = it.pressing ? it.target : null;
    return;
  }
  it.progress += dt / Math.max(0.1, t.holdSeconds || 1);
  if (it.progress >= 1) { it.progress = 0; it.pressing = false; it.target = null; t.open(); }
}

// The bar: the bubble sheet (frames left to right, empty → full), drawn
// `widthMul` times wider. centre x / bottom y in screen px.
function drawHoldBar(ctx, imgEntry, B, cx, bottomY, progress, near, s, widthMul, now) {
  const w = Math.round(B.frameW * s * (widthMul || 1)), h = B.frameH * s;
  const frame = progress > 0 ? Math.min(B.frames - 1, Math.floor(progress * B.frames))
    : near ? (Math.floor(now / 400) % 2) : 0; // close enough: a little flicker that says "press me"
  const x = Math.round(cx - w / 2), y = Math.round(bottomY - h);
  if (imgEntry && imgEntry.ok) ctx.drawImage(imgEntry.img, frame * B.frameW, 0, B.frameW, B.frameH, x, y, w, h);
  else {
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(x + s, y + s, Math.round((w - 2 * s) * progress), h - 2 * s);
  }
}

/* =============================================================================
   CHEST SHOW — Project 3: the short on-screen opening of a loot box
   -----------------------------------------------------------------------------
   The screen dims, the chest appears big in the middle and plays its opening
   frames (its art from shop-data.js → chests), a burst of light, a moment to
   look at it — then the loot menu. Tap to skip.
   Used for box types with show: true (World Builder → Shop → Box types).
   Settings: shop-data.js → loot.show { size, hold, dim, rays }.

   const show = createChestShow({ onOpen, onClose });   // pause / un-pause here
   show.play(art, image, () => { ...open the menu... });
   ============================================================================= */
function createChestShow(opts) {
  opts = opts || {};
  const cv = document.createElement('canvas');
  cv.className = 'chest-show hidden';
  document.body.appendChild(cv);
  const g = cv.getContext('2d');
  let run = null;

  function settings() { return Object.assign({ size: 6, hold: 0.6, dim: 70, rays: true }, (SHOP.loot && SHOP.loot.show) || {}); }
  function play(art, img, done) {
    if (!art || !img) { if (done) done(); return; }
    run = { art, img, t: 0, last: performance.now(), done, S: settings() };
    cv.classList.remove('hidden');
    if (opts.onOpen) opts.onOpen();
    requestAnimationFrame(step);
  }
  const openTime = () => run.art.frames * (run.art.ms || 45) / 1000;
  function finish() {
    if (!run) return;
    const d = run.done; run = null;
    cv.classList.add('hidden');
    if (opts.onClose) opts.onClose();
    if (d) d();
  }
  function step(now) {
    if (!run) return;
    run.t += Math.min(0.05, (now - run.last) / 1000); run.last = now;
    const R = run, S = R.S, A = R.art, dpr = window.devicePixelRatio || 1;
    const W = Math.round(window.innerWidth * dpr), H = Math.round(window.innerHeight * dpr);
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    const end = openTime() + Math.max(0, S.hold);
    if (R.t >= end + 0.25) { finish(); return; }
    const fadeIn = Math.min(1, R.t / 0.2), fadeOut = R.t > end ? 1 - (R.t - end) / 0.25 : 1, a = fadeIn * fadeOut;
    g.clearRect(0, 0, W, H);
    g.fillStyle = 'rgba(0,0,0,' + (Math.max(0, Math.min(100, S.dim)) / 100 * a) + ')'; g.fillRect(0, 0, W, H);
    // as big as `size` allows and still fits; whole pixels so the art stays sharp
    const k = Math.max(1, Math.floor(Math.min(S.size * dpr, W * 0.7 / A.frameW, H * 0.4 / A.frameH)));
    const pop = R.t < 0.2 ? 0.7 + 0.3 * (R.t / 0.2) : 1; // grows in quickly
    const w = A.frameW * k * pop, h = A.frameH * k * pop, cx = W / 2, cy = H * 0.45;
    const frame = Math.min(A.frames - 1, Math.floor(R.t * 1000 / (A.ms || 45)));
    const opened = R.t / openTime();
    if (S.rays && opened > 0.55) {
      const p = Math.min(1, (opened - 0.55) / 0.3);
      g.save(); g.translate(cx, cy); g.rotate(R.t * 0.6); g.globalAlpha = 0.45 * p * a;
      g.fillStyle = '#ffe28a';
      const len = Math.max(w, h) * 1.6;
      for (let i = 0; i < 12; i++) { g.rotate(Math.PI / 6); g.beginPath(); g.moveTo(0, 0); g.lineTo(len, -len * 0.09); g.lineTo(len, len * 0.09); g.closePath(); g.fill(); }
      g.restore();
    }
    g.save(); g.globalAlpha = a; g.imageSmoothingEnabled = false;
    g.drawImage(R.img, frame * A.frameW, 0, A.frameW, A.frameH, Math.round(cx - w / 2), Math.round(cy - h / 2), Math.round(w), Math.round(h));
    g.restore();
    requestAnimationFrame(step);
  }
  // tap: skip to the open chest, tap again to go on
  const skip = e => {
    if (!run) return;
    if (e) { e.preventDefault(); e.stopPropagation(); }
    if (run.t < openTime()) run.t = openTime(); else finish();
  };
  cv.addEventListener('touchstart', skip, { passive: false });
  cv.addEventListener('mousedown', skip);
  window.addEventListener('keydown', e => { if (run && (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyE')) skip(e); });
  return { play, isOpen: () => !!run };
}

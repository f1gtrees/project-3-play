/* =============================================================================
   HUD — Project 3
   -----------------------------------------------------------------------------
   The health blocks, the wallet (money counter) and the wave
   counter, as page elements on top of the game. Shown in combat rooms only.

   WHERE THEY GO comes from hud-layout.js (World Builder → HUD): each
   element's centre (x, y as a fraction of the screen), its size (scale) and
   whether it's shown. For quick testing on the phone, double-tap one, drag,
   let go (movable.js) — that sticks on the phone until a newer layout is
   exported from World Builder.

   FITS ANY SCREEN: positions are a share of the screen, and every control
   is scaled by hudFit() — the screen's size compared with the one the
   layout was made on (hud-layout.js screen) — so it looks the same on a
   small or a big phone.

   createHud() -> { update(hero, visible, swarmText) }
     hero = the shared hero state: hp, maxHp, money (combat.js).
   ============================================================================= */

// The layout from hud-layout.js, or {} if there isn't one (defaults below).
function hudLayout() { return (typeof HUD_LAYOUT !== 'undefined' && HUD_LAYOUT) || {}; }

// How much bigger or smaller this screen is than the layout's reference
// screen. Goes by the width (phones are held upright; Safari's toolbars
// eat some height), but a wide, short window (a Mac browser) goes by its
// height instead. Kept between 0.85 and 1.6 so it never gets silly.
function hudFit() {
  const s = hudLayout().screen || { w: 390, h: 844 };
  const k = Math.min(window.innerWidth / s.w, window.innerHeight / (s.w * 1.5));
  return Math.max(0.85, Math.min(1.6, k));
}

function createHud() {
  const LAY = hudLayout(), E = LAY.elements || {}, stamp = LAY.stamp || 0;

  // One HUD element: a movable box placed from the layout (or a default spot).
  function part(id, className, html, fallback) {
    const el = document.createElement('div');
    el.className = 'hud-box ' + className;
    el.innerHTML = html;
    const L = E[id] || (id === 'wallet' && E.xp) || {}; // the wallet took over the old XP bar's spot
    document.body.appendChild(el);
    // its size on this screen: the layout's size × the screen fit (re-worked out on every resize)
    const scale = () => { const k = (L.scale || 1) * hudFit(); el.style.transform = 'scale(' + k + ')'; return k; };
    const mover = makeMovable(el, {
      storageKey: 'project3.hud.' + id, stamp, scale,
      defaultPos: (W, H, w, h) => (typeof L.x === 'number' ? { x: L.x * W - w / 2, y: L.y * H - h / 2 } : fallback(W, H, w, h))
    });
    return { el, mover, hidden: L.visible === false, L };
  }
  const health = part('health', 'hud-health', '', (W, H, w) => ({ x: W - w - 12, y: 12 }));
  const wallet = part('wallet', 'hud-wallet', '<span class="hud-coin"></span><span class="hud-money">0</span>', (W, H, w) => ({ x: W - w - 12, y: 38 }));
  const swarm = part('swarm', 'hud-swarm', '<span class="hud-swarm-text"></span>', (W, H, w) => ({ x: W / 2 - w / 2, y: 56 }));
  const moneyEl = wallet.el.querySelector('.hud-money'), swarmText = swarm.el.querySelector('.hud-swarm-text');

  // MINI MAP: a small canvas — the room's floor picture shrunk down, the hero,
  // and points of interest (vendor, loot boxes, portals; enemies if switched on).
  // Its settings come from hud-layout.js (World Builder → HUD → Mini map):
  //   w, h (size in px), range (art px across it; 0 = the whole room),
  //   opacity (%), enemies (1 = show them), round (1 = a circle)
  const mmL = E.minimap || {};
  const MM = { w: mmL.w || 90, h: mmL.h || 120, range: mmL.range || 0, opacity: mmL.opacity === undefined ? 85 : mmL.opacity, enemies: !!mmL.enemies, round: !!mmL.round };
  const minimap = part('minimap', 'hud-minimap', '<canvas></canvas>', (W, H, w) => ({ x: 12, y: 60 }));
  if (!E.minimap) minimap.hidden = true; // not in the layout yet: switched off until it's added in World Builder → HUD
  const mmCanvas = minimap.el.querySelector('canvas'), dpr = window.devicePixelRatio || 1;
  mmCanvas.width = Math.round(MM.w * dpr); mmCanvas.height = Math.round(MM.h * dpr);
  mmCanvas.style.width = MM.w + 'px'; mmCanvas.style.height = MM.h + 'px';
  minimap.el.style.opacity = MM.opacity / 100;
  if (MM.round) { minimap.el.style.borderRadius = '50%'; mmCanvas.style.borderRadius = '50%'; }
  const mmCtx = mmCanvas.getContext('2d');
  let mmShown = null;

  let last = '';
  return {
    // info = { floor: image entry, world: {w,h}, hero: {x,y}, markers: [{ x, y, kind }] }
    drawMinimap(info) {
      const show = !!info && !minimap.hidden;
      if (show !== mmShown) { minimap.el.style.display = show ? '' : 'none'; mmShown = show; if (show) minimap.mover.place(); }
      if (!show) return;
      const g = mmCtx, cw = mmCanvas.width, ch = mmCanvas.height, W = info.world.w, H = info.world.h;
      // what part of the room shows: all of it, or a window `range` art px across around the hero
      let vx, vy, vw, vh;
      if (MM.range > 0) { vw = MM.range; vh = MM.range * ch / cw; vx = Math.max(0, Math.min(W - vw, info.hero.x - vw / 2)); vy = Math.max(0, Math.min(H - vh, info.hero.y - vh / 2)); if (vw > W) vx = (W - vw) / 2; if (vh > H) vy = (H - vh) / 2; }
      else { const k = Math.min(cw / W, ch / H); vw = cw / k; vh = ch / k; vx = (W - vw) / 2; vy = (H - vh) / 2; }
      const k = cw / vw, X = x => (x - vx) * k, Y = y => (y - vy) * k;
      g.clearRect(0, 0, cw, ch);
      g.fillStyle = 'rgba(10,10,14,0.85)'; g.fillRect(0, 0, cw, ch);
      g.imageSmoothingEnabled = true;
      if (info.floor && info.floor.ok) { const r = info.floorRect || { x: 0, y: 0, w: W, h: H }; g.drawImage(info.floor.img, X(r.x), Y(r.y), r.w * k, r.h * k); }
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 0, cw, ch);
      const dot = (x, y, r, color, ring) => {
        g.beginPath(); g.arc(X(x), Y(y), r * dpr, 0, Math.PI * 2);
        if (ring) { g.strokeStyle = color; g.lineWidth = 1.5 * dpr; g.stroke(); } else { g.fillStyle = color; g.fill(); }
      };
      (info.markers || []).forEach(m => {
        if (m.kind === 'enemy') { if (MM.enemies) dot(m.x, m.y, 1.5, '#ff5c5c'); }
        else if (m.kind === 'portal') dot(m.x, m.y, 3, m.locked ? '#ff6b6b' : '#6ee6ff', true);
        else if (m.kind === 'vendor') { dot(m.x, m.y, 3.5, '#000'); dot(m.x, m.y, 2.5, '#ffd23f'); }
        else if (m.kind === 'loot') { g.fillStyle = '#ff9d3a'; g.fillRect(X(m.x) - 2.5 * dpr, Y(m.y) - 2.5 * dpr, 5 * dpr, 5 * dpr); }
      });
      dot(info.hero.x, info.hero.y, 3, '#fff'); dot(info.hero.x, info.hero.y, 2, '#2fd0ff');
      g.strokeStyle = 'rgba(255,226,138,0.7)'; g.lineWidth = dpr;
      if (MM.round) { g.beginPath(); g.arc(cw / 2, ch / 2, Math.min(cw, ch) / 2 - dpr / 2, 0, Math.PI * 2); g.stroke(); }
      else g.strokeRect(dpr / 2, dpr / 2, cw - dpr, ch - dpr);
    },
    update(hero, visible, swarmLine) {
      const key = visible ? [hero.hp, hero.maxHp, hero.money || 0, swarmLine || ''].join('|') : 'hidden';
      if (key === last) return;           // only touch the page when something changed
      const wasHidden = last === 'hidden' || last === '';
      last = key;
      health.el.style.display = visible && !health.hidden ? '' : 'none';
      wallet.el.style.display = visible && !wallet.hidden ? '' : 'none';
      swarm.el.style.display = visible && !swarm.hidden && swarmLine ? '' : 'none';
      if (!visible) return;
      if (health.el.children.length !== hero.maxHp) {
        health.el.innerHTML = '';
        for (let i = 0; i < hero.maxHp; i++) health.el.appendChild(document.createElement('i'));
        health.mover.place();
      }
      [...health.el.children].forEach((b, i) => b.classList.toggle('full', i < Math.ceil(hero.hp)));
      const moneyText = String(hero.money || 0), moneyChanged = moneyEl.textContent !== moneyText;
      moneyEl.textContent = moneyText;
      if (moneyChanged && !wasHidden) wallet.mover.place(); // a wider number: keep it on screen
      const swarmChanged = swarmText.textContent !== (swarmLine || '');
      swarmText.textContent = swarmLine || '';
      if (wasHidden) { health.mover.place(); wallet.mover.place(); }
      if (wasHidden || swarmChanged) swarm.mover.place(); // its width changes with the text
    }
  };
}

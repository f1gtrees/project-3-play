/* =============================================================================
   SPECIALS — Project 3
   -----------------------------------------------------------------------------
   The hero's special attacks. They all fire ON THEIR OWN when ready and an
   enemy is close enough (Vampire-Survivors style) — no buttons.

   One entry per special: its art, its numbers, and `tune` = which numbers
   World Builder's Tuning screen shows ([key, label, step]). tuning.js can
   override any of them (TUNING.specials.<id>), and `test: true` there
   switches a special ON when the game starts, for play-testing. The pause
   menu's "Testing" page switches them on/off live.

   Later, specials will come from the chests after a mini boss (ROADMAP.md);
   for now the testing switches are how you get them.

   ICE SPIKE (coverage) — assets/specials/ice-spike.png (496×44), 31×22 frames:
     row 0  rise  16 frames (the big spike is up from frame 5)
     row 1  sink  16 frames
   A ring of spikes bursts out of the ground around the hero; every enemy
   inside the ring is hit and FROZEN (slowed, losing health for a few seconds).

   FIREBALL (scale damage) — assets/specials/fireball.png (901×84), 53×42 frames,
   drawn flying to the RIGHT:
     row 0  fly    4 frames
     row 1  burst 17 frames
   Shoots at the NEAREST enemy (if none is in range, the way the hero last
   moved) and burns through every enemy in its path (each one once) until
   it has flown its range or hits a prop. More fireballs fan out around that line.

   BOOMERANG AXE (coverage) — assets/specials/boomerang-axe.png (288×128), 36×32 frames:
     row 0  icon   1 frame
     row 1  spin   8 frames (flying)
     row 2  spin   4 frames (a faster spin — not used yet)
     row 3  land   8 frames (stuck in the ground)
   Thrown in a random direction; where it lands, everything nearby is hit.

   POISON BOTTLE (survivability) — assets/specials/poison-bottle.png (1323×212), 63×53 frames:
     row 0  icon    1 frame
     row 1  spin   14 frames (flying)
     row 2  tip     7 frames (not used yet)
     row 3  splash 14 frames
   Lobbed up and lands at the hero's feet: a smaller hit than the ice spike,
   but everyone in the splash is POISONED — losing health for a few seconds,
   and part of what they lose heals the hero.

   RUNE SPELL (survivability) — assets/specials/rune.png (790×138), 79×46 frames:
     row 0  appear  8 frames
     row 1  loop   10 frames
     row 2  vanish  8 frames
   The art is drawn stretched to fit the aura's radius. Always on — an aura around the hero that hurts anything inside it, a
   little every half second. Starts small / weak as the trade-off.

   CHAIN LIGHTNING (scale damage) — assets/specials/lightning.png (588×210),
   42×70 frames, three versions of a strike (one per row), 14 frames each.
   Strikes RANDOM enemies within its range of the hero, then jumps on to
   one more, with a % chance to keep jumping — every jump also stays within
   that range, so you have to be close to the fight for it to work.
   ============================================================================= */
const SPECIALS = {
  iceSpike: {
    label: 'Ice spike', build: 'coverage',
    sheet: {
      path: 'assets/specials/ice-spike.png',
      frameW: 31, frameH: 22, anchorX: 16, anchorY: 18,
      anims: {
        rise: { row: 0, frames: 16, ms: 35, loop: false },
        sink: { row: 1, frames: 16, ms: 35, loop: false }
      }
    },
    cooldown: 3.5,        // seconds between casts
    damage: 1,            // the burst
    radius: 34,           // art px: the ring of spikes, and the area hit
    spikes: 8,            // spikes in the ring
    hitFrame: 6,          // rise frame when it hits
    freezeSeconds: 2,     // frozen for this long
    freezeSlow: 50,       // frozen enemies move at this % of their speed
    freezeDps: 0.5,       // health lost per second while frozen
    tune: [
      ['cooldown', 'Seconds between', 0.1], ['damage', 'Damage', 0.25], ['radius', 'Radius (px)', 2],
      ['spikes', 'Spikes in the ring', 1], ['freezeSeconds', 'Freeze time (s)', 0.25],
      ['freezeSlow', 'Frozen speed (%)', 5], ['freezeDps', 'Freeze damage / s', 0.25]
    ]
  },
  fireball: {
    label: 'Fireball', build: 'damage',
    sheet: {
      path: 'assets/specials/fireball.png',
      frameW: 53, frameH: 42, anchorX: 27, anchorY: 25,
      anims: {
        fly:   { row: 0, frames: 4,  ms: 70 },
        burst: { row: 1, frames: 17, ms: 40, loop: false }
      }
    },
    cooldown: 2.2,
    damage: 1.5,          // to every enemy it passes through
    speed: 150,           // art px per second
    range: 170,           // how far it flies
    count: 1,             // fireballs per cast (fanned out)
    spread: 14,           // degrees between fireballs when there's more than one
    knockback: 40,
    tune: [
      ['cooldown', 'Seconds between', 0.1], ['damage', 'Damage', 0.25], ['speed', 'Speed (px/s)', 10],
      ['range', 'Distance (px)', 10], ['count', 'Fireballs', 1], ['spread', 'Fan angle (°)', 2]
    ]
  },
  boomerangAxe: {
    label: 'Boomerang axe', build: 'coverage',
    sheet: {
      path: 'assets/specials/boomerang-axe.png',
      frameW: 36, frameH: 32, anchorX: 13, anchorY: 24,
      anims: {
        spin: { row: 1, frames: 8, ms: 45 },
        land: { row: 3, frames: 8, ms: 60, loop: false }
      }
    },
    cooldown: 2.5,
    damage: 1.25,         // to everyone near where it lands
    radius: 22,           // art px around the landing spot
    axes: 1,              // thrown per cast
    distance: 80,         // how far it flies (each one 60–100% of this)
    flightTime: 0.45,     // seconds in the air
    stay: 0.6,            // seconds it stays stuck in the ground
    tune: [
      ['cooldown', 'Seconds between', 0.1], ['damage', 'Damage', 0.25], ['radius', 'Hit area (px)', 2],
      ['axes', 'Axes', 1], ['distance', 'Throw distance (px)', 5], ['flightTime', 'Time in the air (s)', 0.05]
    ]
  },
  poisonBottle: {
    label: 'Poison bottle', build: 'survive',
    sheet: {
      path: 'assets/specials/poison-bottle.png',
      frameW: 63, frameH: 53, anchorX: 32, anchorY: 40,
      anims: {
        spin:   { row: 1, frames: 14, ms: 30 },
        splash: { row: 3, frames: 14, ms: 50, loop: false }
      }
    },
    cooldown: 4,
    damage: 0.5,          // the splash (smaller than the ice spike)
    radius: 30,           // art px — the splash art is drawn to fit
    poisonSeconds: 3,
    poisonDps: 0.5,       // health lost per second while poisoned
    healPct: 30,          // % of the poison damage that heals the hero
    tune: [
      ['cooldown', 'Seconds between', 0.1], ['damage', 'Splash damage', 0.25], ['radius', 'Radius (px)', 2],
      ['poisonSeconds', 'Poison time (s)', 0.25], ['poisonDps', 'Poison damage / s', 0.25], ['healPct', 'Heals hero (% of poison)', 5]
    ]
  },
  runeSpell: {
    label: 'Rune spell', build: 'survive',
    sheet: {
      path: 'assets/specials/rune.png',
      frameW: 79, frameH: 46, anchorX: 39, anchorY: 23,   // the circle's centre
      anims: {
        appear: { row: 0, frames: 8,  ms: 50, loop: false },
        loop:   { row: 1, frames: 10, ms: 90 },
        vanish: { row: 2, frames: 8,  ms: 50, loop: false }
      }
    },
    artRadius: 38,        // the circle in the art is about this wide (half of 79) — used to fit it to `radius`
    radius: 20,           // art px — the aura around the hero
    dps: 0.5,             // health a second for anything inside (dealt every half second)
    color: '#c58cff',
    tune: [['radius', 'Aura radius (px)', 2], ['dps', 'Damage / s', 0.25]]
  },
  chainLightning: {
    label: 'Chain lightning', build: 'damage',
    sheet: {
      path: 'assets/specials/lightning.png',
      frameW: 42, frameH: 70, anchorX: 21, anchorY: 64,
      anims: {
        strike0: { row: 0, frames: 14, ms: 45, loop: false },
        strike1: { row: 1, frames: 14, ms: 45, loop: false },
        strike2: { row: 2, frames: 14, ms: 45, loop: false }
      }
    },
    cooldown: 3,
    damage: 1,            // each strike
    range: 70,            // only enemies this close to the hero can be struck (art px)
    strikes: 3,           // random enemies in range struck first
    chain: 1,             // then it jumps on to this many more beyond them
    chainChance: 30,      // % chance of each further jump after that
    chainMax: 4,          // never more than this many extra jumps by chance
    chainRange: 60,       // how far one jump can reach (art px)
    hitFrame: 3,
    tune: [
      ['cooldown', 'Seconds between', 0.1], ['damage', 'Damage per strike', 0.25], ['range', 'Range (px)', 10],
      ['strikes', 'First strikes', 1], ['chain', 'Sure jumps', 1], ['chainChance', 'Extra jump chance (%)', 5],
      ['chainMax', 'Most extra jumps', 1], ['chainRange', 'Jump reach (px)', 5]
    ]
  }
};

// tuning.js numbers on top of the ones above; returns the ids switched on for testing.
function applySpecialTuning(T) {
  const on = [];
  const S = (T && T.specials) || {};
  Object.keys(SPECIALS).forEach(id => {
    const t = S[id]; if (!t) return;
    (SPECIALS[id].tune || []).forEach(([k]) => { if (typeof t[k] === 'number') SPECIALS[id][k] = t[k]; });
    if (t.test) on.push(id);
  });
  return on;
}

// A special's numbers right now: its base numbers (+ tuning) changed by the
// run's upgrades from the vendor (shop.js → hero.mods):
//   mods.special[id][key] — added straight on (e.g. +1 fireball)
//   mods.cooldown — % sooner; mods.area — % bigger radius
function specialStats(id, mods) {
  const base = SPECIALS[id], D = Object.assign({}, base);
  if (!mods) return D;
  const add = (mods.special && mods.special[id]) || {};
  Object.keys(add).forEach(k => { if (typeof D[k] === 'number') D[k] = D[k] + add[k]; });
  if (mods.cooldown && typeof D.cooldown === 'number') D.cooldown = D.cooldown * Math.max(0.2, 1 - mods.cooldown / 100);
  if (mods.area && typeof D.radius === 'number') D.radius = D.radius * (1 + mods.area / 100);
  ['count', 'axes', 'spikes', 'strikes', 'chain', 'chainMax'].forEach(k => { if (typeof D[k] === 'number') D[k] = Math.max(0, D[k]); });
  return D;
}

// The hero's specials, kept for the whole run (not per room).
// owned: ids switched on. timers: seconds until each can fire again.
function createSpecials(ownedIds) {
  return { owned: new Set(ownedIds || []), timers: {}, runeTick: 0, runeTurn: 0,
    spikes: [], fireballs: [], bursts: [], axes: [], bottles: [], splashes: [], strikes: [], arcs: [] };
}
function toggleSpecial(sp, id, on) {
  if (on === undefined) on = !sp.owned.has(id);
  if (on) { sp.owned.add(id); sp.timers[id] = 0.5; } else sp.owned.delete(id);
}
// New room: clear anything still flying or sticking out of the ground.
function resetSpecialEffects(sp) {
  sp.spikes = []; sp.fireballs = []; sp.bursts = []; sp.axes = []; sp.bottles = []; sp.splashes = []; sp.strikes = []; sp.arcs = [];
}

const liveEnemies = c => c.enemies.filter(e => e.state !== 'dying');
function nearestEnemy(c, hero, r) {
  let best = null, bd = r;
  c.enemies.forEach(e => { if (e.state === 'dying') return; const d = Math.hypot(e.x - hero.x, e.y - hero.y); if (d <= bd) { bd = d; best = e; } });
  return best;
}
function anyEnemyWithin(c, hero, r) { return c.enemies.some(e => e.state !== 'dying' && Math.hypot(e.x - hero.x, e.y - hero.y) <= r); }

// aim = { x, y }: the way the hero last moved (unit length).
function updateSpecials(sp, c, hero, blockers, world, dt, aim) {
  const H = c.hero, mult = heroDamageMult(H);
  sp.cur = {}; Object.keys(SPECIALS).forEach(id => { sp.cur[id] = specialStats(id, H.mods); });
  const ST = id => sp.cur[id];
  // ---- fire whatever's ready ----
  if (c.active && !H.ko) sp.owned.forEach(id => {
    sp.timers[id] = Math.max(0, (sp.timers[id] || 0) - dt);
    if (sp.timers[id] > 0) return;
    const D = ST(id);
    if (id === 'iceSpike' && anyEnemyWithin(c, hero, D.radius + 8)) { castIceSpike(sp, c, hero, D); sp.timers[id] = D.cooldown; }
    if (id === 'fireball') {
      const target = nearestEnemy(c, hero, D.range);
      if (target) { castFireball(sp, hero, D, { x: target.x - hero.x, y: target.y - hero.y }); sp.timers[id] = D.cooldown; }
    }
    if (id === 'boomerangAxe' && anyEnemyWithin(c, hero, D.distance + D.radius)) { castAxes(sp, hero, D, world); sp.timers[id] = D.cooldown; }
    if (id === 'poisonBottle' && anyEnemyWithin(c, hero, D.radius + 6)) { castBottle(sp, hero, D); sp.timers[id] = D.cooldown; }
    if (id === 'chainLightning' && anyEnemyWithin(c, hero, D.range)) { castLightning(sp, c, hero, D); sp.timers[id] = D.cooldown; }
  });

  // ---- rune spell: always-on aura, a bite every half second ----
  sp.runeTurn += dt;
  // the rune's picture: appears when switched on, loops, vanishes when switched off
  const RD = SPECIALS.runeSpell;
  if (sp.owned.has('runeSpell')) {
    if (!sp.rune || sp.rune.anim.anim === 'vanish') sp.rune = { anim: createSpriteAnimator(RD.sheet, 'appear') };
    if (sp.rune.anim.anim === 'appear' && sp.rune.anim.frame >= 7) restartAnim(sp.rune.anim, 'loop');
  } else if (sp.rune && sp.rune.anim.anim !== 'vanish') restartAnim(sp.rune.anim, 'vanish');
  if (sp.rune) { updateSpriteAnim(sp.rune.anim, dt * 1000); if (sp.rune.anim.anim === 'vanish' && sp.rune.anim.frame >= 7) sp.rune = null; }
  if (sp.owned.has('runeSpell') && c.active && !H.ko) {
    const D = ST('runeSpell');
    sp.runeTick += dt;
    if (sp.runeTick >= 0.5) {
      sp.runeTick -= 0.5;
      liveEnemies(c).forEach(e => { if (Math.hypot(e.x - hero.x, e.y - hero.y) <= D.radius + 4) hurtEnemyQuietly(c, e, D.dps * 0.5 * mult); });
    }
  }

  // ---- boomerang axes: arc out, land, hit everyone near the spot ----
  sp.axes.forEach(a => {
    a.t += dt;
    updateSpriteAnim(a.anim, dt * 1000);
    if (!a.landed && a.t >= a.flight) {
      a.landed = true; a.x = a.tx; a.y = a.ty;
      restartAnim(a.anim, 'land');
      const D = ST('boomerangAxe');
      liveEnemies(c).forEach(e => { if (Math.hypot(e.x - a.x, e.y - a.y) <= D.radius) hitEnemy(c, e, D.damage * mult, a, 50); });
      c.effects.push({ kind: 'aoe', x: a.x, y: a.y, r: D.radius, t: 0, life: 0.25 });
    }
    if (!a.landed) { const k = a.t / a.flight; a.x = a.sx + (a.tx - a.sx) * k; a.y = a.sy + (a.ty - a.sy) * k; }
    if (a.landed && a.t >= a.flight + a.stay) a.done = true;
  });
  sp.axes = sp.axes.filter(a => !a.done);

  // ---- poison bottles: a short lob, then the splash poisons everyone in it ----
  sp.bottles.forEach(b => {
    b.t += dt;
    updateSpriteAnim(b.anim, dt * 1000);
    if (b.t >= b.flight) {
      b.done = true;
      const D = ST('poisonBottle');
      sp.splashes.push({ x: b.x, y: b.y, r: D.radius, anim: createSpriteAnimator(D.sheet, 'splash') });
      liveEnemies(c).forEach(e => {
        if (Math.hypot(e.x - b.x, e.y - b.y) > D.radius + 4) return;
        hitEnemy(c, e, D.damage * mult, b, 30);
        poisonEnemy(e, D.poisonSeconds, D.poisonDps * mult, D.healPct);
      });
    }
  });
  sp.bottles = sp.bottles.filter(b => !b.done);
  sp.splashes.forEach(k => { updateSpriteAnim(k.anim, dt * 1000); if (k.anim.frame >= 13) k.done = true; });
  sp.splashes = sp.splashes.filter(k => !k.done);

  // ---- lightning: each strike lands after its delay (the chain ripples outward) ----
  sp.strikes.forEach(k => {
    k.t += dt;
    if (k.t < 0) return;
    updateSpriteAnim(k.anim, dt * 1000);
    if (!k.hit && k.anim.frame >= ST('chainLightning').hitFrame) {
      k.hit = true;
      if (k.target && k.target.state !== 'dying') hitEnemy(c, k.target, ST('chainLightning').damage * mult, { x: k.x, y: k.y - 1 }, 10);
    }
    if (k.anim.frame >= 13) k.done = true;
  });
  sp.strikes = sp.strikes.filter(k => !k.done);
  sp.arcs.forEach(a => { a.t += dt; });
  sp.arcs = sp.arcs.filter(a => a.t < a.life);

  // ---- ice spikes: rise, hit once (the ring's owner spike does it), sink ----
  sp.spikes.forEach(k => {
    k.t += dt;
    if (k.t < 0) return;
    updateSpriteAnim(k.anim, dt * 1000);
    if (k.anim.anim === 'rise' && !k.hit && k.lead && k.anim.frame >= SPECIALS.iceSpike.hitFrame) {
      k.hit = true;
      const D = ST('iceSpike');
      liveEnemies(c).forEach(e => {
        if (Math.hypot(e.x - k.cx, e.y - k.cy) > D.radius + 6) return;
        hitEnemy(c, e, D.damage * mult, { x: k.cx, y: k.cy }, 20);
        freezeEnemy(e, D.freezeSeconds, D.freezeSlow, D.freezeDps * mult);
      });
    }
    const a = k.anim.def.anims[k.anim.anim];
    if (k.anim.frame >= a.frames - 1) {
      if (k.anim.anim === 'rise') { k.hold -= dt; if (k.hold <= 0) restartAnim(k.anim, 'sink'); }
      else k.done = true;
    }
  });
  sp.spikes = sp.spikes.filter(k => !k.done);

  // ---- fireballs: fly, burn through enemies, burst at the end ----
  sp.fireballs.forEach(f => {
    updateSpriteAnim(f.anim, dt * 1000);
    for (let step = 0; step < 2 && !f.done; step++) {
      const move = f.speed * dt / 2;
      f.x += f.dx * move; f.y += f.dy * move; f.travelled += move;
      const hitWall = blockers.some(r => f.x >= r.x && f.x < r.x + r.w && f.y >= r.y && f.y < r.y + r.h);
      if (f.travelled >= f.range || hitWall || f.x < 0 || f.y < 0 || f.x > world.w || f.y > world.h) { f.done = true; break; }
      liveEnemies(c).forEach(e => {
        if (f.hits.has(e) || Math.hypot(e.x - f.x, e.y - f.y) > 10 * (e.size || 1)) return;
        f.hits.add(e);
        hitEnemy(c, e, f.damage * mult, { x: f.x - f.dx, y: f.y - f.dy }, f.knockback);
      });
    }
    if (f.done) sp.bursts.push({ x: f.x, y: f.y, anim: createSpriteAnimator(SPECIALS.fireball.sheet, 'burst') });
  });
  sp.fireballs = sp.fireballs.filter(f => !f.done);
  sp.bursts.forEach(b => { updateSpriteAnim(b.anim, dt * 1000); if (b.anim.frame >= 16) b.done = true; });
  sp.bursts = sp.bursts.filter(b => !b.done);
}

function castIceSpike(sp, c, hero, D) {
  const n = Math.max(1, Math.round(D.spikes)), turn = Math.random() * Math.PI * 2;
  for (let i = 0; i < n; i++) {
    const a = turn + i / n * Math.PI * 2;
    sp.spikes.push({
      x: hero.x + Math.cos(a) * D.radius, y: hero.y + Math.sin(a) * D.radius * 0.8, // a little squashed: it's on the ground
      cx: hero.x, cy: hero.y, lead: i === 0, hit: false,
      t: -Math.random() * 0.08, hold: 0.15, flip: Math.random() < 0.5,
      anim: createSpriteAnimator(D.sheet, 'rise')
    });
  }
}

function castFireball(sp, hero, D, aim) {
  if (!aim.x && !aim.y) aim = { x: 0, y: 1 };
  const n = Math.max(1, Math.round(D.count)), base = Math.atan2(aim.y, aim.x), step = D.spread * Math.PI / 180;
  for (let i = 0; i < n; i++) {
    const a = base + (i - (n - 1) / 2) * step;
    sp.fireballs.push({
      x: hero.x + Math.cos(a) * 6, y: hero.y + Math.sin(a) * 6, dx: Math.cos(a), dy: Math.sin(a),
      speed: D.speed, range: D.range, damage: D.damage, knockback: D.knockback, travelled: 0, hits: new Set(),
      anim: createSpriteAnimator(D.sheet, 'fly')
    });
  }
}

function castAxes(sp, hero, D, world) {
  const n = Math.max(1, Math.round(D.axes));
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, dist = D.distance * (0.6 + Math.random() * 0.4);
    const tx = Math.max(4, Math.min(world.w - 4, hero.x + Math.cos(a) * dist));
    const ty = Math.max(8, Math.min(world.h - 2, hero.y + Math.sin(a) * dist * 0.8));
    sp.axes.push({ sx: hero.x, sy: hero.y, tx, ty, x: hero.x, y: hero.y, t: 0, flight: Math.max(0.1, D.flightTime),
      stay: D.stay, landed: false, flip: tx < hero.x, anim: createSpriteAnimator(D.sheet, 'spin') });
  }
}
function castBottle(sp, hero, D) {
  sp.bottles.push({ x: hero.x, y: hero.y, t: 0, flight: 0.35, anim: createSpriteAnimator(D.sheet, 'spin') });
}
// Picks the targets: `strikes` random enemies in range, then sure jumps, then lucky jumps.
function castLightning(sp, c, hero, D) {
  const inRange = e => Math.hypot(e.x - hero.x, e.y - hero.y) <= D.range;
  const live = liveEnemies(c).filter(inRange);
  for (let i = live.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [live[i], live[j]] = [live[j], live[i]]; } // shuffle
  const hit = live.slice(0, Math.max(1, Math.round(D.strikes)));
  const order = hit.slice();
  let from = hit[hit.length - 1], extra = 0;
  const jump = () => {
    let best = null, bd = D.chainRange;
    liveEnemies(c).forEach(e => { if (order.includes(e) || !inRange(e)) return; const d = Math.hypot(e.x - from.x, e.y - from.y); if (d <= bd) { bd = d; best = e; } });
    if (!best) return false;
    sp.arcs.push({ x1: from.x, y1: from.y, x2: best.x, y2: best.y, t: -0.12 * order.length + 0.1, life: 0.25 });
    order.push(best); from = best; return true;
  };
  for (let i = 0; i < Math.round(D.chain) && from; i++) if (!jump()) break;
  while (from && extra < Math.round(D.chainMax) && Math.random() * 100 < D.chainChance) { if (!jump()) break; extra++; }
  order.forEach((e, i) => sp.strikes.push({
    x: e.x, y: e.y, target: e, hit: false, t: -0.12 * i,
    anim: createSpriteAnimator(D.sheet, 'strike' + Math.floor(Math.random() * 3))
  }));
}

// ---- drawing ----
// Ice spikes stand on the ground, so they join the depth-sorted list.
// (So do landed axes and lightning strikes.)
function specialDrawItems(ctx, sp, images, toX, toY, s) {
  const items = sp.spikes.filter(k => k.t >= 0).map(k => ({
    y: k.y,
    draw: () => drawSpriteAnim(ctx, images[SPECIALS.iceSpike.sheet.path], k.anim, toX(k.x), toY(k.y), s, k.flip)
  }));
  sp.axes.filter(a => a.landed).forEach(a => items.push({ y: a.y, draw: () =>
    drawSpriteAnim(ctx, images[SPECIALS.boomerangAxe.sheet.path], a.anim, toX(a.x), toY(a.y), s, a.flip, { w: 6, h: 6, color: '#3fa58f' }) }));
  sp.strikes.filter(k => k.t >= 0).forEach(k => items.push({ y: k.y + 0.5, draw: () =>
    drawSpriteAnim(ctx, images[SPECIALS.chainLightning.sheet.path], k.anim, toX(k.x), toY(k.y), s, false, { w: 3, h: 40, color: '#bff4ff' }) }));
  return items;
}
// Things lying flat on the ground (under everyone): the rune ring, poison splashes.
function drawSpecialsUnder(ctx, sp, images, hero, toX, toY, s) {
  if (sp.rune && hero) {
    const R = (sp.cur && sp.cur.runeSpell) || SPECIALS.runeSpell, rimg = images[R.sheet.path];
    if (rimg && rimg.ok) drawSpriteAnim(ctx, rimg, sp.rune.anim, toX(hero.x), toY(hero.y), s * R.radius / R.artRadius, false);
    else if (sp.owned.has('runeSpell')) drawRune(ctx, R, hero, sp.runeTurn, toX, toY, s); // no art: the drawn ring
  }
  const D = SPECIALS.poisonBottle, img = images[D.sheet.path];
  sp.splashes.forEach(k => {
    const fit = k.r / 26; // the splash art is about 52 px across
    drawSpriteAnim(ctx, img, k.anim, toX(k.x), toY(k.y), s * fit, false, { w: k.r * 2, h: 4, color: 'rgba(130,230,90,0.5)' });
  });
}
// The rune aura without its art (greybox fallback): a soft disc, a ring and six turning marks.
function drawRune(ctx, D, hero, turn, toX, toY, s) {
  const cx = toX(hero.x), cy = toY(hero.y), rx = D.radius * s, ry = D.radius * 0.8 * s;
  ctx.save();
  ctx.globalAlpha = 0.18 + 0.06 * Math.sin(turn * 4);
  ctx.fillStyle = D.color;
  ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 0.75;
  ctx.strokeStyle = D.color; ctx.lineWidth = Math.max(1, s * 0.7);
  ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#efe0ff';
  for (let i = 0; i < 6; i++) {
    const a = turn * 1.2 + i * Math.PI / 3;
    ctx.fillRect(Math.round(cx + Math.cos(a) * rx - s), Math.round(cy + Math.sin(a) * ry - s), 2 * s, 2 * s);
  }
  ctx.restore();
}
// Fireballs and their bursts fly above everything (chest height).
function drawSpecialsOnTop(ctx, sp, images, toX, toY, s) {
  const D = SPECIALS.fireball, img = images[D.sheet.path], lift = 10;
  sp.fireballs.forEach(f => {
    if (!img || !img.ok) { ctx.fillStyle = '#ff8a3d'; ctx.fillRect(toX(f.x) - 2 * s, toY(f.y - lift) - 2 * s, 4 * s, 4 * s); return; }
    const a = D.sheet.anims.fly, d = D.sheet;
    ctx.save();
    ctx.translate(Math.round(toX(f.x)), Math.round(toY(f.y - lift)));
    ctx.rotate(Math.atan2(f.dy, f.dx));
    ctx.drawImage(img.img, f.anim.frame * d.frameW, a.row * d.frameH, d.frameW, d.frameH, -d.anchorX * s, -d.anchorY * s, d.frameW * s, d.frameH * s);
    ctx.restore();
  });
  sp.bursts.forEach(b => drawSpriteAnim(ctx, img, b.anim, toX(b.x), toY(b.y - lift), s, false, { w: 8, h: 8, color: '#ff8a3d' }));
  // axes in the air: a low arc
  const AX = SPECIALS.boomerangAxe, aimg = images[AX.sheet.path];
  sp.axes.filter(a => !a.landed).forEach(a => {
    const k = a.t / a.flight, up = Math.sin(k * Math.PI) * 18 + 6;
    drawSpriteAnim(ctx, aimg, a.anim, toX(a.x), toY(a.y - up), s, a.flip, { w: 6, h: 6, color: '#3fa58f' });
  });
  // bottles in the air: up and back down onto the hero's feet
  const PB = SPECIALS.poisonBottle, pimg = images[PB.sheet.path];
  sp.bottles.forEach(b => {
    const k = b.t / b.flight, up = Math.sin(k * Math.PI) * 26 + 8;
    drawSpriteAnim(ctx, pimg, b.anim, toX(b.x), toY(b.y - up + 12), s, false, { w: 4, h: 6, color: '#7fd14a' });
  });
  // lightning jumping between enemies: a jagged cyan line
  sp.arcs.filter(a => a.t >= 0).forEach(a => {
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - a.t / 0.25);
    ctx.strokeStyle = '#bff4ff'; ctx.lineWidth = Math.max(1, s * 0.8);
    ctx.beginPath();
    const n = 6;
    for (let i = 0; i <= n; i++) {
      const k = i / n, j = i === 0 || i === n ? 0 : (Math.random() - 0.5) * 8;
      const x = a.x1 + (a.x2 - a.x1) * k + j, y = a.y1 - 10 + (a.y2 - a.y1) * k + j;
      if (i === 0) ctx.moveTo(toX(x), toY(y)); else ctx.lineTo(toX(x), toY(y));
    }
    ctx.stroke(); ctx.restore();
  });
}

/* =============================================================================
   COMBAT — Project 3 (first slice, built to grow)
   -----------------------------------------------------------------------------
   What's here now:
     - Enemies from the room's  enemySpawns: [ { type, x, y, group?, hp?,
       speed?, attacks? } ]  (types + normal numbers in enemy-data.js; a
       spawn's own hp / speed / attack numbers override them).
     - ZONES: the room's  enemyZones: [ { id, x, y, w, h } ]. An enemy with
       group: <zone id> never leaves that rectangle, only chases while the
       hero is inside it, and walks back home when the hero leaves. They notice the hero, walk toward him (blocked by
       props, sliding along them), swing when close, get knocked back when
       hit, and play their death animation.
     - HERO AUTO-ATTACK (area): whenever any enemy is inside the hero's
       attack circle (HERO_COMBAT.meleeRadius), he swings, once per
       meleeCooldown. He turns toward the nearest enemy (the page plays the
       swing animation); meleeHitDelay seconds in, EVERY enemy inside the
       circle takes meleeDamage and is shoved outward. A faint ring shows
       the circle's size.
     - Hero health, a short invincible blink after being hit, knockback,
       and a knock-out.
     - PLACED enemies (the room's enemySpawns) stay dead for the rest of the
       RUN once killed: the page keeps a note per room (runRoom.killed).
     - MONEY COINS: a killed enemy may drop a coin (the boss always drops a
       few). Walk over it to add it to the WALLET (the HUD counter). Money
       lasts for the run (reset at the hub, like health) — it's for the
       wandering vendor (coming). No more in-run levels: XP will be earned
       from kills and spent at the hub (ROADMAP.md).
     - The SWARM (swarm.js): if the room has swarm settings, waves of
       enemies keep appearing around the hero, ending with a mini boss;
       beating it opens the room's locked portals.
     - ACTION BUTTON (heroAction): fires an energy BOLT at the nearest
       enemy in range (or straight ahead if there isn't one). Bolts break
       on props, hit the first enemy they touch, then the button cools down.

   All positions in ART PIXELS; x = centre, y = feet, like the hero.
   Uses big-room.js (moveActorWithBlockers, clampBoxToWorld) and
   sprite-anim.js. Project 3's own rules — not engine code.

   Room is a combat room if it has at least one enemy spawn.
   ============================================================================= */

// The hero's fighting numbers — tweak freely.
const HERO_COMBAT = {
  maxHp: 5,
  // AUTO-ATTACK — the three numbers to scale:
  meleeRadius: 26,     // SIZE: art px from the hero's feet — every enemy inside is hit (the hero is ~14 px wide)
  meleeDamage: 0.5,    // DAMAGE per swing, to each enemy hit
  meleeCooldown: 0.6,  // SPEED: seconds between swings (smaller = faster)
  meleeHitDelay: 0.12, // seconds into the swing when the blade connects
  meleeSwingTime: 0.4, // how long the swing animation holds the hero's facing
  meleeKnockback: 50,  // how hard a swing shoves each enemy outward (px/s)
  invulnTime: 1.0,     // seconds of blinking after being hit
  hitKnockback: 150,   // how hard an enemy swing shoves the hero

  // MONEY — skulls left behind by defeated enemies (numbers: World Builder → Tuning)
  money: {
    dropChance: 50,    // % chance a killed enemy drops a skull
    coinValue: 1,      // money per skull
    bossCoins: 5,      // skulls the mini boss always drops
    pickupRadius: 10,  // how close the hero's feet must get to one (art px)
    icon: 'assets/ui/skull.png', // the picture, on the ground and in the wallet / shop
    name: 'skulls',    // what it's called in menus ("12 skulls")
    iconScale: 1       // how big it's drawn on the ground (× the picture)
  },

  // ACT button — energy bolt
  bolt: {
    damage: 0.5,       // same as a melee strike (warriors have 3 health: 6 hits of either)
    speed: 170,        // art px per second
    range: 150,        // how far it flies before fading
    aimRange: 140,     // auto-aims at the nearest enemy within this distance
    cooldown: 0.8,     // seconds before ACT works again
    knockback: 90
  }
};

// TUNING (tuning.js, edited in World Builder) — put its numbers over the
// defaults above and the enemy types' own numbers. Called once at startup.
function applyTuning(T) {
  if (!T) return;
  const g = T.game || {};
  if (typeof g.zoom === 'number' && g.zoom > 0) GAME_CONFIG.ART_SCALE = g.zoom / 100; // Game zoom (%): 300 = each art pixel 3× bigger
  const h = T.hero || {}, has = (k) => typeof h[k] === 'number';
  ['maxHp', 'meleeRadius', 'meleeDamage', 'meleeCooldown', 'meleeKnockback'].forEach(k => { if (has(k)) HERO_COMBAT[k] = h[k]; });
  if (has('boltDamage')) HERO_COMBAT.bolt.damage = h.boltDamage;
  if (has('boltCooldown')) HERO_COMBAT.bolt.cooldown = h.boltCooldown;
  if (has('boltSpeed')) HERO_COMBAT.bolt.speed = h.boltSpeed;
  if (has('boltRange')) { HERO_COMBAT.bolt.range = h.boltRange; HERO_COMBAT.bolt.aimRange = Math.min(HERO_COMBAT.bolt.aimRange, h.boltRange); }
  if (has('walkSpeed')) GAME_CONFIG.PLAYER_SPEED = h.walkSpeed;
  // money coins (older tuning files called these xp…; those still count)
  [['moneyDropChance', 'xpDropChance', 'dropChance'], ['moneyCoinValue', 'xpCoinValue', 'coinValue'], ['moneyBossCoins', 'xpBossCoins', 'bossCoins']]
    .forEach(([k, old, x]) => { if (has(k)) HERO_COMBAT.money[x] = h[k]; else if (has(old)) HERO_COMBAT.money[x] = h[old]; });
  if (has('moneyPickupRadius')) HERO_COMBAT.money.pickupRadius = h.moneyPickupRadius;
  if (has('moneyIconScale')) HERO_COMBAT.money.iconScale = h.moneyIconScale;
  Object.keys(T.enemies || {}).forEach(name => {
    const type = ENEMY_TYPES[name], t = T.enemies[name];
    if (!type || !t) return;
    ['hp', 'speed', 'noticeRange'].forEach(k => { if (typeof t[k] === 'number') type[k] = t[k]; });
    (type.attacks || []).forEach(a => {
      const ta = t.attacks && t.attacks[a.name];
      if (ta) ['damage', 'cooldown', 'range'].forEach(k => { if (typeof ta[k] === 'number') a[k] = ta[k]; });
    });
  });
}

function xpNeeded(level) { return 1; } // (in-run levels are gone — kept so nothing older breaks)
// The hero's damage multiplier: 1 + the run's damage upgrades from the vendor (shop.js → H.mods.damage, in %).
function heroDamageMult(H) { return Math.max(0.1, 1 + ((H && H.mods && H.mods.damage) || 0) / 100); }

// blockers + world: used to move any enemy that starts inside a prop's box.
// hero: the hero's health, shared between rooms (so it carries through portals).
// runRoom: this run's notes about this room — { killed: Set of placed-enemy
//   numbers, swarmCleared } — so killed enemies stay dead for the whole run.
function createCombat(room, blockers, world, hero, runRoom) {
  const H = hero || { hp: HERO_COMBAT.maxHp, maxHp: HERO_COMBAT.maxHp };
  H.invuln = 0; H.knock = { x: 0, y: 0 }; H.ko = false; H.koTime = 0;
  if (H.money === undefined) H.money = 0;
  const c = {
    blockers: blockers || [], world: world || { w: 9999, h: 9999 },
    nav: typeof buildNav === 'function' && blockers && blockers.length && world ? buildNav(blockers, world, 8, 6) : null, // nav.js: ways around props
    runRoom: runRoom || { killed: new Set(), swarmCleared: false },
    active: !!((room.enemySpawns && room.enemySpawns.length) || room.swarm),
    enemies: [], effects: [], bolts: [], coins: [], shots: [], // shots = enemies' arrows in flight
    hero: H,
    meleeTimer: 0, actionTimer: 0, kills: 0,
    heroSwing: null, swingCount: 0, // current auto-attack swing, and how many so far (the page restarts the animation on a new one)
    banner: null                    // { title, sub, t, life } — a message across the screen
  };
  spawnPlaced(c, room);
  c.swarm = createSwarm(room, c.runRoom); // swarm.js (null if the room has no swarm)
  return c;
}

// Placed enemies — the ones set in World Builder. Ones killed earlier in
// this run stay dead.
function spawnPlaced(c, room) {
  (room.enemySpawns || []).forEach((s, i) => {
    if (c.runRoom.killed.has(i)) return;
    const e = makeEnemy(c, room, s);
    if (e) { e.placedIndex = i; c.enemies.push(e); }
  });
}

// Builds one enemy from spawn settings { type, x, y, group?, hp?, speed?, attacks? }.
// extra: { size, alwaysChase, scaleHp, scaleSpeed, scaleDamage, boss } for swarm / boss enemies.
function makeEnemy(c, room, s, extra) {
  const type = ENEMY_TYPES[s.type];
  if (!type) return null;
  extra = extra || {};
  const zone = s.group ? (room.enemyZones || []).find(z => z.id === s.group) || null : null;
  const stats = enemyStats(type, s);
  stats.hp *= extra.scaleHp || 1;
  stats.speed *= extra.scaleSpeed || 1;
  if (extra.scaleDamage) stats.attacks.forEach(a => { a.damage *= extra.scaleDamage; });
  const size = extra.size || 1;
  const e = {
    type, stats, zone, x: s.x, y: s.y, hp: stats.hp, size,
    w: type.fallback.w, h: type.fallback.h, // body size (keeps it on the picture)
    state: 'idle', stateTime: 0, facing: 1,
    anim: null,      // set just below (a sheet with facings picks idle-down etc.)
    dir: 'down', animBase: 'idle', look: null,
    knock: { x: 0, y: 0 }, flash: 0, swingLanded: false,
    cool: {},        // attack name -> seconds until it can be used again
    attack: null,    // the attack being swung right now
    engaged: !!extra.alwaysChase, // true once it has spotted the hero — then it keeps chasing further
    alwaysChase: !!extra.alwaysChase, // swarm enemies know where you are from the start
    boss: !!extra.boss, swarm: !!extra.swarm
  };
  e.anim = createSpriteAnimator(type.sheet, enemyAnim(e, 'idle'));
  stats.attacks.forEach(a => { e.cool[a.name] = 0.5; }); // a short pause before the first swing
  if (size > 1) stats.attacks.forEach(a => { a.range *= 1 + (size - 1) * 0.5; }); // bigger = longer reach
  nudgeOutOfBlockers(e, type.feet, c.blockers, c.world.w, c.world.h); // spawn inside a prop? step out of it
  keepInZone(e);
  e.home = { x: e.x, y: e.y };
  return e;
}

// A placed enemy's real numbers: its own overrides, else the type's normal ones.
function enemyStats(type, s) {
  const num = (v, d) => (typeof v === 'number' && !isNaN(v) ? v : d);
  const own = s.attacks || {};
  return {
    hp: num(s.hp, type.hp),
    speed: num(s.speed, type.speed),
    attacks: (type.attacks || []).map(a => Object.assign({}, a, {
      damage: num(own[a.name] && own[a.name].damage, a.damage),
      cooldown: num(own[a.name] && own[a.name].cooldown, a.cooldown)
    }))
  };
}

// Zones: keep an enemy's feet inside its group's rectangle.
function keepInZone(e) {
  const z = e.zone; if (!z) return;
  const hw = e.type.feet.w / 2;
  e.x = Math.min(z.x + z.w - hw, Math.max(z.x + hw, e.x));
  e.y = Math.min(z.y + z.h, Math.max(z.y + e.type.feet.h, e.y));
}
const inZone = (pt, z) => !z || (pt.x >= z.x && pt.x < z.x + z.w && pt.y >= z.y && pt.y < z.y + z.h);

// Start an animation from frame 0 even if it's the one already playing.
function restartAnim(animator, name) { animator.anim = null; playSpriteAnim(animator, name); }
function animDone(animator, stateTime) {
  const a = animator.def.anims[animator.anim];
  return stateTime >= (a.frames * a.ms) / 1000;
}
const feetDist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// Shove velocity that fades out over about a fifth of a second.
function applyKnock(actor, knock, feet, blockers, world, dt) {
  if (!knock.x && !knock.y) return;
  moveActorWithBlockers(actor, knock.x * dt, knock.y * dt, feet, blockers);
  clampBoxToWorld(actor, world.w, world.h);
  const fade = Math.max(0, 1 - dt * 6);
  knock.x *= fade; knock.y *= fade;
  if (Math.hypot(knock.x, knock.y) < 5) { knock.x = 0; knock.y = 0; }
}
function pushAway(knock, from, to, strength) {
  const dx = to.x - from.x, dy = to.y - from.y, d = Math.hypot(dx, dy) || 1;
  knock.x = dx / d * strength; knock.y = dy / d * strength;
}

// ---- UPDATE -----------------------------------------------------------------
// hero = the room's player object (x, y, w, h). world = { w, h }.
// view = the part of the room on screen right now { x, y, w, h } (art px) —
// the swarm appears just outside it.
function updateCombat(c, room, hero, blockers, world, dt, view) {
  const H = c.hero;
  H.invuln = Math.max(0, H.invuln - dt); // runs down in every room — even ones with no fight (the hub)
  if (!c.active) return;
  applyKnock(hero, H.knock, GAME_CONFIG.PLAYER_FEET, blockers, world, dt);
  if (H.ko) H.koTime += dt;

  c.enemies.forEach(e => updateEnemy(c, e, hero, blockers, world, dt));
  separateEnemies(c, blockers);
  c.enemies.forEach(keepInZone);
  c.enemies = c.enemies.filter(e => !(e.state === 'dying' && e.stateTime > deathTime(e)));
  updateShots(c, hero, blockers, world, dt);

  // Hero auto-melee: strike the nearest enemy in reach.
  c.meleeTimer = Math.max(0, c.meleeTimer - dt);
  if (!H.ko && c.meleeTimer === 0) {
    let target = null, best = HERO_COMBAT.meleeRadius;
    c.enemies.forEach(e => {
      if (e.state === 'dying') return;
      const d = feetDist(e, hero);
      if (d <= best) { best = d; target = e; }
    });
    if (target) {
      c.meleeTimer = HERO_COMBAT.meleeCooldown;
      const dx = target.x - hero.x, dy = target.y - hero.y;
      const dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
      c.heroSwing = { target, dir, t: 0, landed: false };
      c.swingCount++;
    }
  }
  // The swing connects partway through — if the enemy is still in reach.
  if (c.heroSwing) {
    const sw = c.heroSwing;
    sw.t += dt;
    if (!sw.landed && sw.t >= HERO_COMBAT.meleeHitDelay) {
      sw.landed = true;
      if (!H.ko) {
        // Area hit: everyone inside the circle right now, not just the one he turned toward.
        c.enemies.forEach(en => {
          if (en.state !== 'dying' && feetDist(en, hero) <= HERO_COMBAT.meleeRadius) hitEnemy(c, en, HERO_COMBAT.meleeDamage * heroDamageMult(H), hero);
        });
        c.effects.push({ kind: 'aoe', x: hero.x, y: hero.y, r: HERO_COMBAT.meleeRadius, t: 0, life: 0.22 });
      }
    }
    if (sw.t >= HERO_COMBAT.meleeSwingTime) c.heroSwing = null;
  }

  // Bolts: fly, break on props, hit the first enemy they touch.
  c.actionTimer = Math.max(0, c.actionTimer - dt);
  const B = HERO_COMBAT.bolt;
  c.bolts.forEach(b => {
    for (let step = 0; step < 2 && !b.done; step++) {  // two small steps per frame, so fast bolts can't skip past anything
      const move = B.speed * dt / 2;
      b.x += b.dx * move; b.y += b.dy * move; b.travelled += move;
      if (b.travelled >= B.range || b.x < 0 || b.y < 0 || b.x > world.w || b.y > world.h) { b.done = true; break; }
      if (blockers.some(r => b.x >= r.x && b.x < r.x + r.w && b.y >= r.y && b.y < r.y + r.h)) {
        b.done = true; c.effects.push({ kind: 'burst', x: b.x, y: b.y - 8, t: 0, life: 0.2 }); break;
      }
      const target = c.enemies.find(e => e.state !== 'dying' && Math.hypot(e.x - b.x, e.y - b.y) < 9);
      if (target) {
        b.done = true;
        c.effects.push({ kind: 'burst', x: b.x, y: b.y - 8, t: 0, life: 0.2 });
        hitEnemy(c, target, B.damage * heroDamageMult(H), { x: b.x - b.dx, y: b.y - b.dy }, B.knockback);
      }
    }
  });
  c.bolts = c.bolts.filter(b => !b.done);

  // XP coins: pop out, settle, then get picked up when the hero walks over them.
  c.coins.forEach(k => {
    k.t += dt;
    if (k.t < 0.25) { k.x += k.vx * dt; k.y += k.vy * dt; } // the little pop when it drops
    if (!H.ko && k.t > 0.2 && feetDist(k, hero) <= HERO_COMBAT.money.pickupRadius) { k.taken = true; gainMoney(c, HERO_COMBAT.money.coinValue); c.effects.push({ kind: 'sparkle', x: k.x, y: k.y - 4, t: 0, life: 0.25 }); }
  });
  c.coins = c.coins.filter(k => !k.taken);

  c.effects.forEach(f => { f.t += dt; });
  c.effects = c.effects.filter(f => f.t < f.life);

  if (c.swarm && !H.ko) updateSwarm(c, room, hero, view, dt); // swarm.js
  if (c.banner) { c.banner.t += dt; if (c.banner.t >= c.banner.life) c.banner = null; }
}

function updateEnemy(c, e, hero, blockers, world, dt) {
  const T = e.type, S = e.stats, H = c.hero;
  e.stateTime += dt;
  e.flash = Math.max(0, e.flash - dt);
  Object.keys(e.cool).forEach(k => { e.cool[k] = Math.max(0, e.cool[k] - dt); });
  applyKnock(e, e.knock, T.feet, blockers, world, dt);
  let slowK = 1; // frozen: slower, and ticking damage every half second
  if (e.frozen) {
    const F = e.frozen;
    F.t -= dt; F.tick += dt; slowK = F.slow;
    if (F.tick >= 0.5) { F.tick -= 0.5; if (F.dps) hurtEnemyQuietly(c, e, F.dps * 0.5); }
    if (F.t <= 0 && e.frozen === F) e.frozen = null;
  }
  if (e.poison) {
    const P = e.poison;
    P.t -= dt; P.tick += dt;
    if (P.tick >= 0.5) {
      P.tick -= 0.5;
      const d = Math.min(P.dps * 0.5, Math.max(0, e.hp));
      hurtEnemyQuietly(c, e, P.dps * 0.5);
      if (!H.ko) H.hp = Math.min(H.maxHp, H.hp + d * P.heal); // the drained health comes back to the hero
    }
    if (P.t <= 0 && e.poison === P) e.poison = null;
  }

  const d = feetDist(e, hero);
  const reach = S.attacks.length ? Math.min(...S.attacks.map(a => a.range)) : 12; // closest it needs to get
  // Walk toward a point — straight if nothing's in the way, else along a
  // path around the props (nav.js), re-planned every half second.
  const walkToward = (tx, ty) => {
    let gx = tx, gy = ty;
    if (c.nav && !clearLine(c.nav, e, { x: tx, y: ty })) {
      e.pathT = (e.pathT || 0) - dt;
      const goalMoved = !e.pathGoal || Math.hypot(e.pathGoal.x - tx, e.pathGoal.y - ty) > 16;
      if (!e.path || e.pathT <= 0 || goalMoved) { e.path = findPath(c.nav, e, { x: tx, y: ty }); e.pathT = 0.5; e.pathGoal = { x: tx, y: ty }; }
      while (e.path && e.path.length > 1 && Math.hypot(e.path[0].x - e.x, e.path[0].y - e.y) < 3) e.path.shift();
      if (e.path && e.path.length) { gx = e.path[0].x; gy = e.path[0].y; }
    } else e.path = null;
    const dx = gx - e.x, dy = gy - e.y, len = Math.hypot(dx, dy) || 1;
    moveActorWithBlockers(e, dx / len * S.speed * slowK * dt, dy / len * S.speed * slowK * dt, T.feet, blockers);
    clampBoxToWorld(e, world.w, world.h);
    keepInZone(e);
    e.facing = gx < e.x ? -1 : 1;
    e.look = { x: dx, y: dy };
    if (e.state !== 'chase') setEnemyState(e, 'chase', 'walk');
  };
  // In a zone, it only goes after the hero while the hero is inside the zone.
  const heroReachable = !H.ko && inZone(hero, e.zone);

  if (e.state === 'dying') {
    // just let the death animation play out
  } else if (e.state === 'hit') {
    const hasHitAnim = !!T.sheet.anims.hit; // no hit row (the guard): just a short stagger
    if (hasHitAnim ? animDone(e.anim, e.stateTime) : e.stateTime >= 0.2) setEnemyState(e, 'chase', 'walk');
  } else if (e.state === 'attack') {
    const a = e.attack;
    if (!e.swingLanded && e.anim.frame >= a.hitFrame) {
      e.swingLanded = true;
      if (a.projectile) fireShot(c, e, hero, a);            // ranged: let go of an arrow
      else if (d <= a.range + 6 && !H.ko && H.invuln === 0) damageHero(c, hero, e, a.damage);
    }
    if (animDone(e.anim, e.stateTime)) { e.cool[a.name] = a.cooldown; setEnemyState(e, 'chase', 'walk'); }
  } else if (heroReachable && (e.alwaysChase || d <= (e.engaged ? T.noticeRange * 1.6 : T.noticeRange))) {
    e.engaged = true; // once it's seen you, it follows you further before giving up
    e.facing = hero.x < e.x ? -1 : 1;
    e.look = { x: hero.x - e.x, y: hero.y - e.y };
    const ready = S.attacks.find(a => d <= a.range && e.cool[a.name] === 0);
    const keepAway = T.keepAway ? T.keepAway * e.size : 0;
    if (ready && !(keepAway && d < keepAway * 0.6 && !e.cornered)) { // a crowded ranged enemy backs off first (unless it's stuck)
      e.attack = ready;
      setEnemyState(e, 'attack', ready.anim || 'attack');
      e.swingLanded = false;
    } else if (keepAway && d < keepAway) {
      // Ranged: step away from the hero (walkToward a point on the far side), still facing him.
      const bx = e.x, by = e.y;
      walkToward(e.x + (e.x - hero.x), e.y + (e.y - hero.y));
      e.cornered = Math.hypot(e.x - bx, e.y - by) < S.speed * dt * 0.3; // backed into a wall: it'll shoot anyway
      e.facing = hero.x < e.x ? -1 : 1;
      e.look = { x: hero.x - e.x, y: hero.y - e.y };
    } else if (keepAway && d <= reach * 0.9) {
      if (e.state !== 'idle') setEnemyState(e, 'idle', 'idle'); // in range: stand and wait to shoot
    } else if (d > reach * 0.7) {
      walkToward(hero.x, hero.y);
    } else if (e.state !== 'idle') {
      setEnemyState(e, 'idle', 'idle'); // close, waiting for the next swing
    }
  } else {
    e.engaged = false;
    // Zoned enemies walk back to where they started; others just wait.
    if (e.zone && feetDist(e, e.home) > 3) walkToward(e.home.x, e.home.y);
    else if (e.state !== 'idle') setEnemyState(e, 'idle', 'idle');
  }
  // Sheets with facings (anims like walk-down / walk-side / walk-up): turn to
  // where it's looking — but never mid-swing or while falling.
  if (T.sheet.dirs && e.look && e.state !== 'attack' && e.state !== 'dying') {
    const nd = Math.abs(e.look.x) > Math.abs(e.look.y) ? 'side' : (e.look.y > 0 ? 'down' : 'up');
    if (nd !== e.dir) {
      e.dir = nd;
      const name = enemyAnim(e, e.animBase || 'idle');
      if (name !== e.anim.anim) { const f = e.anim.frame; e.anim.anim = name; e.anim.frame = Math.min(f, T.sheet.anims[name].frames - 1); }
    }
  }
  updateSpriteAnim(e.anim, dt * 1000 * (e.frozen && e.state !== 'dying' ? 0.6 : 1)); // frozen: moves stiffly
}
// The animation to play for a move: walk-down / walk-side / walk-up if the
// sheet has facings, else plain walk; a missing one falls back to idle.
function enemyAnim(e, base) {
  const A = e.type.sheet.anims, d = e.dir || 'side';
  if (A[base + '-' + d]) return base + '-' + d;
  if (A[base]) return base;
  if (A['idle-' + d]) return 'idle-' + d;
  return A.idle ? 'idle' : Object.keys(A)[0];
}
function setEnemyState(e, state, anim) {
  e.state = state; e.stateTime = 0; e.animBase = anim;
  restartAnim(e.anim, enemyAnim(e, anim));
}
// How long a defeated enemy stays on screen: its whole death animation, plus a beat.
function deathTime(e) {
  const a = e.type.sheet.anims.death;
  return a ? Math.max(0.6, (a.frames * a.ms) / 1000 + 0.15) : 1.2;
}

// ENEMY SHOTS (ranged attacks): fly at where the hero was, stop on props,
// hurt the hero on contact.
function fireShot(c, e, hero, a) {
  const P = a.projectile, ox = e.x + e.facing * 5 * e.size, oy = e.y;
  const dx = hero.x - ox, dy = hero.y - oy, len = Math.hypot(dx, dy) || 1;
  c.shots.push({ x: ox, y: oy, dx: dx / len, dy: dy / len, speed: P.speed || 120,
    range: a.range * 1.6, travelled: 0, damage: a.damage, color: P.color || '#ffe6a8', from: e });
}
function updateShots(c, hero, blockers, world, dt) {
  const H = c.hero;
  c.shots.forEach(sh => {
    for (let step = 0; step < 2 && !sh.done; step++) {
      const move = sh.speed * dt / 2;
      sh.x += sh.dx * move; sh.y += sh.dy * move; sh.travelled += move;
      if (sh.travelled >= sh.range || sh.x < 0 || sh.y < 0 || sh.x > world.w || sh.y > world.h) { sh.done = true; break; }
      if (blockers.some(r => sh.x >= r.x && sh.x < r.x + r.w && sh.y >= r.y && sh.y < r.y + r.h)) {
        sh.done = true; c.effects.push({ kind: 'burst', x: sh.x, y: sh.y - 10, t: 0, life: 0.15 }); break;
      }
      if (!H.ko && Math.hypot(hero.x - sh.x, hero.y - sh.y) < 7) {
        sh.done = true;
        if (H.invuln === 0) damageHero(c, hero, { x: sh.x - sh.dx, y: sh.y - sh.dy }, sh.damage);
      }
    }
  });
  c.shots = c.shots.filter(sh => !sh.done);
}

// Keep enemies from standing inside each other.
function separateEnemies(c, blockers) {
  const list = c.enemies.filter(e => e.state !== 'dying');
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const a = list[i], b = list[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), min = 10;
    if (d >= min) continue;
    const ux = d ? dx / d : 1, uy = d ? dy / d : 0, push = (min - d) / 2;
    moveActorWithBlockers(a, -ux * push, -uy * push, a.type.feet, blockers);
    moveActorWithBlockers(b, ux * push, uy * push, b.type.feet, blockers);
  }
}

function hitEnemy(c, e, damage, from, knockback) {
  if (e.state === 'dying') return;
  e.hp -= damage;
  e.flash = 0.12;
  e.engaged = true; // getting hit from afar wakes it up
  pushAway(e.knock, from, e, knockback !== undefined ? knockback : HERO_COMBAT.meleeKnockback);
  if (e.hp <= 0) killEnemy(c, e);
  else setEnemyState(e, 'hit', 'hit');
}
// Damage with no shove and no stagger (freeze / poison ticking away).
function hurtEnemyQuietly(c, e, damage) {
  if (e.state === 'dying') return;
  e.hp -= damage;
  e.flash = Math.max(e.flash, 0.06);
  e.engaged = true;
  if (e.hp <= 0) killEnemy(c, e);
}
function killEnemy(c, e) {
  e.hp = 0; e.frozen = null; e.poison = null;
  setEnemyState(e, 'dying', 'death'); c.kills++;
  dropCoins(c, e);
  if (e.placedIndex !== undefined) c.runRoom.killed.add(e.placedIndex); // stays dead for this run
}
// POISON (poison bottle): loses dps health a second for `seconds`, and the
// hero gets healPct % of that back.
function poisonEnemy(e, seconds, dps, healPct) {
  if (e.state === 'dying' || !(seconds > 0)) return;
  e.poison = { t: seconds, dps: dps || 0, heal: (healPct || 0) / 100, tick: 0 };
}
// FREEZE (ice spike): slowed to slow% speed, and losing dps health a second, for `seconds`.
function freezeEnemy(e, seconds, slow, dps) {
  if (e.state === 'dying' || !(seconds > 0)) return;
  e.frozen = { t: seconds, slow: Math.max(0, Math.min(100, slow)) / 100, dps: dps || 0, tick: 0 };
}

// Money coins from a defeated enemy: maybe one (dropChance), a handful from a boss.
function dropCoins(c, e) {
  const X = HERO_COMBAT.money;
  const n = e.boss ? Math.max(0, Math.round(X.bossCoins)) : (Math.random() * 100 < X.dropChance ? 1 : 0);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, sp = n > 1 ? 30 + Math.random() * 40 : 15;
    c.coins.push({ x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0 });
  }
}
// Money into the wallet.
function gainMoney(c, amount) { c.hero.money = (c.hero.money || 0) + amount; }

function damageHero(c, hero, from, damage) {
  const H = c.hero;
  H.hp = Math.max(0, H.hp - damage);
  H.invuln = HERO_COMBAT.invulnTime;
  pushAway(H.knock, from, hero, HERO_COMBAT.hitKnockback);
  if (H.hp === 0) { H.ko = true; H.koTime = 0; }
}

// ACTION BUTTON: fire a bolt. Aims at the nearest enemy within aimRange;
// if there isn't one, fires the way the hero is facing ('up'/'down'/'left'/'right').
// Returns true if it fired (false while cooling down).
function heroAction(c, hero, facing) {
  if (!c || !c.active || c.hero.ko || c.actionTimer > 0) return false;
  const B = HERO_COMBAT.bolt;
  let target = null, best = B.aimRange;
  c.enemies.forEach(e => {
    if (e.state === 'dying') return;
    const d = feetDist(e, hero);
    if (d <= best) { best = d; target = e; }
  });
  let dx, dy;
  if (target) { dx = target.x - hero.x; dy = target.y - hero.y; }
  else { dx = facing === 'left' ? -1 : facing === 'right' ? 1 : 0; dy = facing === 'up' ? -1 : facing === 'down' ? 1 : 0; }
  const len = Math.hypot(dx, dy) || 1;
  // Starts a little in front of the hero, at his feet (it's drawn at chest height).
  c.bolts.push({ x: hero.x + dx / len * 6, y: hero.y + dy / len * 6, dx: dx / len, dy: dy / len, travelled: 0, done: false });
  c.actionTimer = B.cooldown;
  c.effects.push({ kind: 'pulse', x: hero.x, y: hero.y - 8, t: 0, life: 0.15 });
  return true;
}
// 0 = ready, 1 = just used (for the button's refill ring).
function actionCooldownFraction(c) { return c ? c.actionTimer / HERO_COMBAT.bolt.cooldown : 0; }

// ---- DRAWING ----------------------------------------------------------------
// Returns depth-sort items for the enemies (drawn with the props and hero).
// toX/toY turn art px into screen px; s = screen px per art px.
function combatDrawItems(ctx, c, images, toX, toY, s, now) {
  return c.enemies.map(e => ({
    y: e.y,
    draw: () => {
      const img = images[e.type.sheet.path];
      // flip to face left/right — but a facing-down/up frame of a sheet with facings is never mirrored
      const flip = e.type.sheet.dirs && e.dir !== 'side' && e.state !== 'dying' ? false : (e.type.sheet.sideArtFacesLeft ? e.facing > 0 : e.facing < 0);
      if (e.flash > 0) ctx.globalAlpha = 0.45;
      const fb = e.size > 1 ? { w: e.type.fallback.w * e.size, h: e.type.fallback.h * e.size, color: e.type.fallback.color } : e.type.fallback;
      drawSpriteAnim(ctx, img, e.anim, toX(e.x), toY(e.y), s * e.size, flip, fb); // bosses draw at a whole-number size (crisp)
      ctx.globalAlpha = 1;
      if (e.frozen && e.state !== 'dying') drawTinted(ctx, img, e.anim, toX(e.x), toY(e.y), s * e.size, flip, 'rgba(120,210,255,0.55)');
      else if (e.poison && e.state !== 'dying') drawTinted(ctx, img, e.anim, toX(e.x), toY(e.y), s * e.size, flip, 'rgba(130,230,90,0.45)');
      // small health bar once it's been hurt (bosses: always, and wider)
      if (e.state !== 'dying' && (e.hp < e.stats.hp || e.boss)) {
        const w = 14 * e.size, x = toX(e.x - w / 2), y = toY(e.y - 24 * e.size);
        ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x, y, w * s, 2 * s);
        ctx.fillStyle = '#ff5c5c'; ctx.fillRect(x, y, Math.round(w * s * e.hp / e.stats.hp), 2 * s);
      }
    }
  }));
}

// The same frame again, coloured in (e.g. icy blue while frozen) — drawn on
// a small spare canvas so only the character's own pixels get the colour.
let tintCanvas = null;
function drawTinted(ctx, imageEntry, animator, x, y, s, flip, color) {
  if (!imageEntry || !imageEntry.ok) return;
  const d = animator.def, a = d.anims[animator.anim]; if (!a) return;
  const w = d.frameW * s, h = d.frameH * s;
  if (!tintCanvas) tintCanvas = document.createElement('canvas');
  if (tintCanvas.width < w || tintCanvas.height < h) { tintCanvas.width = Math.max(w, tintCanvas.width); tintCanvas.height = Math.max(h, tintCanvas.height); }
  const g = tintCanvas.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.clearRect(0, 0, tintCanvas.width, tintCanvas.height);
  g.globalCompositeOperation = 'source-over';
  g.drawImage(imageEntry.img, (a.reverse ? a.frames - 1 - animator.frame : animator.frame) * d.frameW, a.row * d.frameH, d.frameW, d.frameH, 0, 0, w, h);
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = color; g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = 'source-over';
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(tintCanvas, 0, 0, w, h, -d.anchorX * s, -d.anchorY * s, w, h);
  ctx.restore();
}

// Slashes and pulses, drawn on top of everything in the room.
function drawCombatEffects(ctx, c, toX, toY, s) {
  c.effects.forEach(f => {
    const k = f.t / f.life;
    ctx.save();
    if (f.kind === 'slash') {
      ctx.strokeStyle = `rgba(255,255,255,${1 - k})`;
      ctx.lineWidth = 2 * s;
      ctx.beginPath();
      ctx.arc(toX(f.x), toY(f.y), (10 + k * 6) * s, f.angle - 0.9, f.angle + 0.9);
      ctx.stroke();
    } else if (f.kind === 'aoe') {
      // ring growing out to the attack circle's edge
      const r = f.r * (0.55 + 0.45 * k);
      ctx.strokeStyle = `rgba(255,255,255,${0.55 * (1 - k)})`;
      ctx.lineWidth = Math.max(1, s);
      ctx.beginPath(); ctx.arc(toX(f.x), toY(f.y), r * s, 0, Math.PI * 2); ctx.stroke();
    } else if (f.kind === 'sparkle') {
      ctx.fillStyle = `rgba(255,236,140,${1 - k})`;
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2 + k, r = (2 + k * 6) * s;
        ctx.fillRect(Math.round(toX(f.x) + Math.cos(a) * r - s / 2), Math.round(toY(f.y) + Math.sin(a) * r - s / 2), s, s);
      }
    } else if (f.kind === 'burst') {
      ctx.fillStyle = `rgba(160,245,255,${1 - k})`;
      for (let i = 0; i < 6; i++) {
        const a = i * Math.PI / 3, r = (2 + k * 7) * s;
        ctx.fillRect(Math.round(toX(f.x) + Math.cos(a) * r - s), Math.round(toY(f.y) + Math.sin(a) * r - s), 2 * s, 2 * s);
      }
    } else if (f.kind === 'pulse') {
      ctx.strokeStyle = `rgba(110,230,255,${1 - k})`;
      ctx.lineWidth = 2 * s;
      ctx.beginPath();
      ctx.arc(toX(f.x), toY(f.y), (6 + k * 22) * s, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  });
}

// Money on the ground: the money picture (a little skull), lying still with a
// shadow and a glint now and then; without the picture, small yellow squares.
let MONEY_IMG = null;
function drawCoins(ctx, c, toX, toY, s, now) {
  const X = HERO_COMBAT.money;
  if (X.icon && !MONEY_IMG) { MONEY_IMG = new Image(); MONEY_IMG.src = X.icon; }
  if (MONEY_IMG && MONEY_IMG.complete && MONEY_IMG.naturalWidth) {
    const w = MONEY_IMG.naturalWidth * (X.iconScale || 1), h = MONEY_IMG.naturalHeight * (X.iconScale || 1);
    c.coins.forEach((k, i) => {
      const lift = k.t < 0.25 ? Math.round(Math.sin(k.t / 0.25 * Math.PI) * 4) : 0; // the little hop as it drops
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(Math.round(toX(k.x - w / 2 + 1)), Math.round(toY(k.y)), Math.round((w - 2) * s), s);
      ctx.drawImage(MONEY_IMG, Math.round(toX(k.x - w / 2)), Math.round(toY(k.y - h - lift)), Math.round(w * s), Math.round(h * s));
      if ((now / 120 + i * 7) % 20 < 1) { ctx.fillStyle = '#fff6c2'; ctx.fillRect(Math.round(toX(k.x - w / 2 + 1)), Math.round(toY(k.y - h)), s, s); } // glint
    });
    return;
  }
  c.coins.forEach((k, i) => {
    const bob = Math.round(Math.sin(now / 200 + i) * 1.5);
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(toX(k.x - 1.5), toY(k.y), 3 * s, s);
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(toX(k.x - 1.5), toY(k.y - 4 + bob), 3 * s, 3 * s);
    ctx.fillStyle = '#fff6c2'; ctx.fillRect(toX(k.x - 1.5), toY(k.y - 4 + bob), s, s);
  });
}

// Bolts in flight: a bright core with a short fading tail, at chest height.
// Enemy arrows: a thin line pointing the way they fly, with a bright tip.
function drawBolts(ctx, c, toX, toY, s) {
  (c.shots || []).forEach(sh => {
    const hx = sh.x, hy = sh.y - 10, tx = hx - sh.dx * 7, ty = hy - sh.dy * 7;
    ctx.strokeStyle = '#6b4a2a'; ctx.lineWidth = Math.max(1, s * 0.8);
    ctx.beginPath(); ctx.moveTo(toX(tx), toY(ty)); ctx.lineTo(toX(hx), toY(hy)); ctx.stroke();
    ctx.fillStyle = sh.color; ctx.fillRect(Math.round(toX(hx) - s), Math.round(toY(hy) - s), 2 * s, 2 * s);
  });
  c.bolts.forEach(b => {
    for (let i = 3; i >= 0; i--) {
      const tx = b.x - b.dx * i * 3, ty = b.y - 8 - b.dy * i * 3;
      ctx.fillStyle = i === 0 ? '#e8fdff' : `rgba(40,210,255,${0.95 - i * 0.2})`;
      const size = (i === 0 ? 3 : 2) * s;
      ctx.fillRect(Math.round(toX(tx) - size / 2), Math.round(toY(ty) - size / 2), size, size);
    }
  });
}

// Big centre messages. (Health, XP bar and wave counter are page elements — hud.js.)
// W/H = screen size in screen px.
function drawCombatHud(ctx, c, W, H, dpr) {
  if (!c.active) return;
  let title = null, sub = null;
  if (c.hero.ko && c.hero.koTime > 0.8) { title = 'KNOCKED OUT'; sub = 'tap to return to the hub'; }
  else if (c.banner) { title = c.banner.title; sub = c.banner.sub; }
  if (title) {
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, H / 2 - 50 * dpr, W, 90 * dpr);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
    ctx.font = `bold ${Math.round(24 * dpr)}px monospace`; ctx.fillText(title, W / 2, H / 2 - 8 * dpr);
    ctx.font = `${Math.round(14 * dpr)}px monospace`; ctx.fillText(sub, W / 2, H / 2 + 20 * dpr);
    ctx.textAlign = 'left';
  }
}

/* =============================================================================
   SWARM — Project 3
   -----------------------------------------------------------------------------
   A room's waves of enemies that appear AROUND THE HERO (just off-screen)
   until the room is beaten. Set in World Builder (room settings → Swarm);
   stored in the room as:

     swarm: {
       type: 'warrior',   // which enemy type the waves are made of
       waves: 3,          // how many waves
       firstWave: 6,      // enemies in wave 1
       addPerWave: 2,     // extra enemies in each wave after that
       groupSize: 2,      // how many appear at once
       spawnEvery: 1.5,   // seconds between groups appearing
       breakTime: 3,      // seconds of calm between waves
       startDelay: 2,     // seconds after arriving before wave 1
       toughness: 15,     // each wave has this much MORE health (percent)
       speedUp: 5,        // each wave is this much FASTER (percent)
       boss: { type: 'warrior', hp: 15, speed: 45, damage: 2, size: 2 },
                          // arrives with the final wave (leave boss out for none)

       // OPTIONAL — plan each wave yourself (World Builder: "Plan each wave").
       // When it's there, it decides the waves: how many, and who's in each.
       // type / waves / firstWave / addPerWave / toughness / speedUp are
       // then not used. hp / speed / damage are percent of that enemy
       // type's normal numbers (100 = normal, 150 = half as much again).
       waveList: [
         { enemies: [ { type: 'guard', count: 4 } ] },
         { enemies: [ { type: 'guard', count: 4, hp: 150, damage: 150 },
                      { type: 'archer', count: 2 } ] }
       ]
     }

   How it plays: wave 1 starts after startDelay. Groups keep appearing until
   the wave's enemies have all arrived; the wave is beaten when every one of
   them is down. A short break, then the next wave. The final wave brings the
   MINI BOSS. Beating the last wave (boss included) CLEARS the room: the
   room's locked portals open, and the swarm stays beaten for the rest of
   the run (runRoom.swarmCleared). Placed enemies are separate — they're
   still there to fight for loot.
   ============================================================================= */

const SWARM_DEFAULTS = {
  type: null, waves: 3, firstWave: 6, addPerWave: 2, groupSize: 2,
  spawnEvery: 1.5, breakTime: 3, startDelay: 2, toughness: 15, speedUp: 5, boss: null
};

function createSwarm(room, runRoom) {
  if (!room.swarm) return null;
  const cfg = Object.assign({}, SWARM_DEFAULTS, room.swarm);
  if (!ENEMY_TYPES[cfg.type]) cfg.type = Object.keys(ENEMY_TYPES)[0];
  cfg.plan = Array.isArray(cfg.waveList) && cfg.waveList.length ? cfg.waveList : null;
  if (cfg.plan) cfg.waves = cfg.plan.length;
  return {
    cfg,
    phase: runRoom && runRoom.swarmCleared ? 'done' : 'waiting', // waiting | spawning | fighting | break | done
    t: 0, wave: 0, toSpawn: 0, spawnTimer: 0,
    queue: [] // this wave's enemies still to appear: { type, scaleHp, scaleSpeed, scaleDamage }
  };
}

// Are this room's locked portals open yet? (No swarm = nothing to beat = open.)
function portalsOpen(c) { return !c || !c.swarm || c.swarm.phase === 'done'; }

function updateSwarm(c, room, hero, view, dt) {
  const S = c.swarm, cfg = S.cfg;
  if (S.phase === 'done') return;
  S.t += dt;
  if (S.phase === 'waiting') {
    if (S.t >= cfg.startDelay) startSwarmWave(c, 1);
  } else if (S.phase === 'spawning') {
    S.spawnTimer -= dt;
    if (S.spawnTimer <= 0) {
      const n = Math.min(Math.max(1, cfg.groupSize), S.toSpawn);
      for (let i = 0; i < n; i++) spawnSwarmEnemy(c, room, hero, view, false);
      S.toSpawn -= n;
      S.spawnTimer = cfg.spawnEvery;
      if (S.toSpawn <= 0) {
        if (S.wave >= cfg.waves && cfg.boss) {
          spawnSwarmEnemy(c, room, hero, view, true);
          c.banner = { title: 'MINI BOSS', sub: 'beat it to open the way on', t: 0, life: 1.6 };
        }
        S.phase = 'fighting';
      }
    }
  } else if (S.phase === 'fighting') {
    const alive = c.enemies.some(e => e.swarm && e.state !== 'dying');
    if (!alive) {
      if (S.wave >= cfg.waves) {
        S.phase = 'done';
        c.runRoom.swarmCleared = true;
        const locked = (room.portals || []).some(p => p.locked);
        c.banner = { title: 'ROOM CLEARED', sub: locked ? 'the portal is open' : 'explore, or head on', t: 0, life: 2.5 };
      } else { S.phase = 'break'; S.t = 0; }
    }
  } else if (S.phase === 'break') {
    if (S.t >= cfg.breakTime) startSwarmWave(c, S.wave + 1);
  }
}

function startSwarmWave(c, n) {
  const S = c.swarm, cfg = S.cfg;
  S.wave = n; S.t = 0; S.spawnTimer = 0;
  S.queue = waveQueue(cfg, n);
  S.toSpawn = S.queue.length;
  S.phase = 'spawning';
  c.banner = { title: 'WAVE ' + n, sub: 'of ' + cfg.waves, t: 0, life: 1.2 };
}

// Who's in wave n, shuffled so a mixed wave arrives mixed.
function waveQueue(cfg, n) {
  const q = [], pct = (v) => (typeof v === 'number' && v > 0 ? v / 100 : 1);
  if (cfg.plan) {
    const w = cfg.plan[n - 1] || { enemies: [] };
    (w.enemies || []).forEach(g => {
      const type = ENEMY_TYPES[g.type] ? g.type : cfg.type;
      for (let i = 0; i < Math.round(g.count || 0); i++) q.push({ type, scaleHp: pct(g.hp), scaleSpeed: pct(g.speed), scaleDamage: pct(g.damage) });
    });
  } else {
    const count = Math.max(1, Math.round(cfg.firstWave + cfg.addPerWave * (n - 1)));
    for (let i = 0; i < count; i++) q.push({ type: cfg.type, scaleHp: 1 + (cfg.toughness / 100) * (n - 1), scaleSpeed: 1 + (cfg.speedUp / 100) * (n - 1), scaleDamage: 1 });
  }
  for (let i = q.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [q[i], q[j]] = [q[j], q[i]]; }
  return q;
}

// One enemy (or the boss) just outside the visible part of the room.
function spawnSwarmEnemy(c, room, hero, view, isBoss) {
  const S = c.swarm, cfg = S.cfg, n = S.wave;
  const spot = offscreenSpot(c, hero, view);
  let spawn, extra;
  if (isBoss) {
    const b = cfg.boss, type = ENEMY_TYPES[b.type] ? b.type : cfg.type;
    const attacks = {};
    if (b.damage !== undefined) (ENEMY_TYPES[type].attacks || []).forEach(a => { attacks[a.name] = { damage: b.damage }; });
    spawn = { type, x: spot.x, y: spot.y, hp: b.hp, speed: b.speed, attacks };
    extra = { size: Math.max(1, Math.round(b.size || 2)), alwaysChase: true, boss: true, swarm: true };
  } else {
    const next = S.queue.shift() || { type: cfg.type };
    spawn = { type: next.type, x: spot.x, y: spot.y };
    extra = { alwaysChase: true, swarm: true, scaleHp: next.scaleHp, scaleSpeed: next.scaleSpeed, scaleDamage: next.scaleDamage };
  }
  const e = makeEnemy(c, room, spawn, extra); // combat.js
  if (e) c.enemies.push(e);
}

// A random point a little way outside the screen edge, kept on the floor
// picture and out of props. Falls back to a ring around the hero if the
// view isn't known.
function offscreenSpot(c, hero, view) {
  const W = c.world.w, H = c.world.h, margin = 14;
  const v = view || { x: hero.x - 70, y: hero.y - 140, w: 140, h: 280 };
  // Try spots just past each screen edge; skip ones that fall off the floor
  // picture (near a room edge, only the sides with floor beyond them work).
  for (let tries = 0; tries < 24; tries++) {
    const side = Math.random() * (2 * v.w + 2 * v.h);
    let x, y;
    if (side < v.w) { x = v.x + side; y = v.y - margin; }                                  // top
    else if (side < 2 * v.w) { x = v.x + side - v.w; y = v.y + v.h + margin + 16; }        // bottom (feet, so a bit lower)
    else if (side < 2 * v.w + v.h) { x = v.x - margin; y = v.y + side - 2 * v.w; }         // left
    else { x = v.x + v.w + margin; y = v.y + side - 2 * v.w - v.h; }                       // right
    if (x < 8 || x > W - 8 || y < 20 || y > H - 1) continue;
    if (Math.hypot(x - hero.x, y - hero.y) >= 50) return { x: Math.round(x), y: Math.round(y) };
  }
  // Room smaller than the screen (or no floor beyond any edge): anywhere on the floor, away from the hero.
  let best = null;
  for (let i = 0; i < 12; i++) {
    const p = { x: 8 + Math.random() * (W - 16), y: 20 + Math.random() * (H - 21) };
    if (!best || Math.hypot(p.x - hero.x, p.y - hero.y) > Math.hypot(best.x - hero.x, best.y - hero.y)) best = p;
  }
  return { x: Math.round(best.x), y: Math.round(best.y) };
}

// One line for the HUD: "Wave 2/3 · 5 left", or "" with no swarm.
function swarmHudText(c) {
  const S = c && c.swarm;
  if (!S) return '';
  if (S.phase === 'done') return 'Room cleared';
  if (S.phase === 'waiting') return 'Swarm incoming…';
  const alive = c.enemies.filter(e => e.swarm && e.state !== 'dying').length;
  const bossToCome = S.phase === 'spawning' && S.wave >= S.cfg.waves && S.cfg.boss ? 1 : 0;
  if (S.phase === 'break') return 'Wave ' + S.wave + '/' + S.cfg.waves + ' beaten';
  return 'Wave ' + S.wave + '/' + S.cfg.waves + ' · ' + (alive + S.toSpawn + bossToCome) + ' left';
}

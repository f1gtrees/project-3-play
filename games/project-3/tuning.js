// ============================================================
// tuning.js — Project 3's balance numbers.
// Written by World Builder (Tuning button). Plain data — safe to
// hand-edit too. These numbers WIN over the defaults in the game's code.
//
// game:    whole-game settings (e.g. zoom).
// hero:    the hero's numbers.
// specials: each special attack's numbers; test: true = switched on when
//          the game starts (for play-testing).
// enemies: each enemy type's BASE numbers. Every enemy of that type
//          starts from these — placed or swarm. A placed enemy's own
//          numbers (set in the room editor) still override them.
//          attacks: per attack name — damage, cooldown (seconds
//          between uses), range (how close it must be, art px).
// ============================================================

const TUNING = {
  game: {
    zoom: 200
  },
  hero: {
    maxHp: 10,
    walkSpeed: 70,
    meleeRadius: 26,
    meleeDamage: 3,
    meleeCooldown: 0.6,
    meleeKnockback: 50,
    boltDamage: 1,
    boltCooldown: 0.8,
    boltSpeed: 170,
    boltRange: 150
  },
  specials: {
    iceSpike: {test: true, damage: 3, cooldown: 3, radius: 30, spikes: 8, freezeSeconds: 3},
    fireball: {test: true, cooldown: 1.5}
  },
  enemies: {
    warrior: {hp: 3, speed: 20, noticeRange: 130, attacks: {slash: {damage: 0.5, cooldown: 1.4, range: 15}}},
    guard: {hp: 6, speed: 10, noticeRange: 110, attacks: {thrust: {damage: 1, cooldown: 1.5, range: 26}}},
    archer: {hp: 3, speed: 30, noticeRange: 150, attacks: {shot: {damage: 0.5, cooldown: 1, range: 110}}}
  }
};

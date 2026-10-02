/* =============================================================================
   ENEMY TYPES — Project 3
   -----------------------------------------------------------------------------
   One entry per kind of enemy: its sprite sheet layout and its NORMAL
   numbers. World Builder reads this file too (it draws the sprites and shows
   these numbers as the defaults).

   Rooms place enemies with  enemySpawns: [ { type: 'warrior', x, y } ].
   Each placed enemy can override hp, speed, and any attack's damage /
   cooldown — anything it doesn't set comes from here.

   ATTACKS: a list, so an enemy can have several. Each one:
     name      — id used by rooms' overrides (keep it stable)
     label     — what World Builder shows
     anim      — which animation row to play
     range     — how close the hero must be to start it (art px)
     hitFrame  — which frame of that animation deals the damage
     damage    — how much health it takes
     cooldown  — seconds before this attack can be used again
     projectile — (ranged attacks only) { speed, color }: instead of
                  hitting up close, it lets go of a shot on hitFrame that
                  flies at where the hero is; props stop it.
   The enemy uses the first attack in the list that's in range and ready.
   keepAway  — (ranged enemies) backs off when the hero gets closer than this.
   An enemy without a 'hit' animation just pauses for a moment when hit.

   WARRIOR — assets/Warrior_v2_spritesheet.png (992×690), 62×69 frames,
   THREE FACINGS (side rows drawn facing LEFT):
     rows 0-2  idle   side / down / up    6 frames
     rows 3-5  walk   side / down / up   12 frames
     rows 6-8  attack side / down / up   11 frames (the slash lands on frame 5)
     row 9     death                     16 frames  (no hit row)
   A sheet with `dirs: true` names its animations <move>-<side|down|up>;
   the enemy turns to face where it's going (combat.js enemyAnim).

   GUARD — assets/Guard_v2_spritesheet.png (1292×670), 76×67 frames,
   THREE FACINGS (side rows face RIGHT). Melee: slower and tougher than the
   warrior; its attack is a burst of spikes all around it.
     rows 0-2  idle   down / up / side    6 frames
     rows 3-5  walk   down / side / up    6 frames
     rows 6-8  attack down / side / up   16 frames (the burst hits on frame 6)
     row 9     death                     17 frames  (no hit row)

   ARCHER — assets/Archer_v2_spritesheet.png (578×370), 34×37 frames,
   THREE FACINGS (side rows drawn facing RIGHT). Ranged: keeps its distance
   and shoots.
     rows 0-2  idle   side / down / up    6 frames
     rows 3-5  walk   side / down / up   10 frames
     rows 6-8  attack side / down / up    7 frames (the shot leaves on frame 3)
     row 9     death                     17 frames  (no hit row)
   ============================================================================= */
const ENEMY_TYPES = {
  warrior: {
    sheet: {
      path: 'assets/Warrior_v2_spritesheet.png',
      frameW: 62, frameH: 69,
      anchorX: 25, anchorY: 48,   // feet: the middle of the shadow
      sideArtFacesLeft: true,     // its side rows face LEFT — flipped to face right
      dirs: true,                 // has down / side / up rows: anims are <move>-<down|side|up>
      anims: {
        'idle-side':   { row: 0, frames: 6,  ms: 130 },
        'idle-down':   { row: 1, frames: 6,  ms: 130 },
        'idle-up':     { row: 2, frames: 6,  ms: 130 },
        'walk-side':   { row: 3, frames: 12, ms: 70 },
        'walk-down':   { row: 4, frames: 12, ms: 70 },
        'walk-up':     { row: 5, frames: 12, ms: 70 },
        'attack-side': { row: 6, frames: 11, ms: 70, loop: false },
        'attack-down': { row: 7, frames: 11, ms: 70, loop: false },
        'attack-up':   { row: 8, frames: 11, ms: 70, loop: false },
        death:         { row: 9, frames: 16, ms: 70, loop: false }
      }
    },
    fallback: { w: 14, h: 18, color: '#e07a3a' }, // greybox box if the sheet is missing

    hp: 3,
    speed: 55,            // art px per second (hero walks at 70)
    feet: { w: 10, h: 4 },// the part that bumps into props
    noticeRange: 130,     // starts chasing when the hero is this close (art px)
    attacks: [
      { name: 'slash', label: 'Sword slash', anim: 'attack', range: 20, hitFrame: 5, damage: 1, cooldown: 1.2 }
    ]
  },

  guard: {
    sheet: {
      path: 'assets/Guard_v2_spritesheet.png',
      frameW: 76, frameH: 67, anchorX: 37, anchorY: 45,
      sideArtFacesLeft: false,    // its side rows face RIGHT
      dirs: true,                 // down / side / up rows (in this sheet's own order)
      anims: {
        'idle-down':   { row: 0, frames: 6,  ms: 130 },
        'idle-up':     { row: 1, frames: 6,  ms: 130 },
        'idle-side':   { row: 2, frames: 6,  ms: 130 },
        'walk-down':   { row: 3, frames: 6,  ms: 140 },
        'walk-side':   { row: 4, frames: 6,  ms: 140 },
        'walk-up':     { row: 5, frames: 6,  ms: 140 },
        'attack-down': { row: 6, frames: 16, ms: 60, loop: false },
        'attack-side': { row: 7, frames: 16, ms: 60, loop: false },
        'attack-up':   { row: 8, frames: 16, ms: 60, loop: false },
        death:         { row: 9, frames: 17, ms: 60, loop: false }
      }
    },
    fallback: { w: 14, h: 18, color: '#2a2224' },

    hp: 5,
    speed: 40,
    feet: { w: 10, h: 4 },
    noticeRange: 110,
    attacks: [
      { name: 'thrust', label: 'Spike burst', anim: 'attack', range: 26, hitFrame: 6, damage: 1, cooldown: 1.6 }
    ]
  },

  archer: {
    sheet: {
      path: 'assets/Archer_v2_spritesheet.png',
      frameW: 34, frameH: 37, anchorX: 14, anchorY: 33,
      sideArtFacesLeft: false,    // its side rows face RIGHT
      dirs: true,                 // down / side / up rows
      anims: {
        'idle-side':   { row: 0, frames: 6,  ms: 130 },
        'idle-down':   { row: 1, frames: 6,  ms: 130 },
        'idle-up':     { row: 2, frames: 6,  ms: 130 },
        'walk-side':   { row: 3, frames: 10, ms: 85 },
        'walk-down':   { row: 4, frames: 10, ms: 85 },
        'walk-up':     { row: 5, frames: 10, ms: 85 },
        'attack-side': { row: 6, frames: 7,  ms: 100, loop: false },
        'attack-down': { row: 7, frames: 7,  ms: 100, loop: false },
        'attack-up':   { row: 8, frames: 7,  ms: 100, loop: false },
        death:         { row: 9, frames: 17, ms: 60,  loop: false }
      }
    },
    fallback: { w: 12, h: 16, color: '#5f8a8a' },

    hp: 2,
    speed: 50,
    feet: { w: 10, h: 4 },
    noticeRange: 150,
    keepAway: 60,          // backs off if the hero gets closer than this
    attacks: [
      { name: 'shot', label: 'Arrow', anim: 'attack', range: 110, hitFrame: 3, damage: 1, cooldown: 2.0,
        projectile: { speed: 120, color: '#ffe6a8' } }
    ]
  }
};

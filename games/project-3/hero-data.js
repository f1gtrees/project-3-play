/* =============================================================================
   HERO SPRITE SHEET — Project 3 (main hero, purchased pack)
   -----------------------------------------------------------------------------
   assets/Hero_main_spritesheet.png — 832×1235, every frame 64×65.
   One animation per row, frames left to right. Three facings; the SIDE rows
   are drawn facing RIGHT (flipped to face left).

     row  facing  move                 frames
      0   down    idle                 12
      1   down    walk                  8
      2   down    run (walk variant)    8
      3   down    thrust / lunge        4
      4   down    spin slash            7
      5   down    roll / hop            8
      6   side    idle                 12
      7   side    walk                  8
      8   side    run (walk variant)    8
      9   side    roll                  6
     10   side    thrust / lunge        4
     11   side    spin slash            5
     12   up      idle                 12
     13   up      walk                  8
     14   up      run (walk variant)    8
     15   up      thrust / lunge        4
     16   up      spin slash            7
     17   up      roll / hop            8
     18   —       death (skull burst)  13

   Names follow  <move>-<down|side|up>  so the game can pick the one for the
   way the hero is facing. The body is ~14×21 px inside the 64×65 frame (the
   extra room is for sword swings); anchorX / anchorY is where his feet are.
   If he looks like he's floating or sinking, nudge anchorY by 1.
   ============================================================================= */
const HERO_SHEET = {
  path: 'assets/Hero_main_spritesheet.png',
  frameW: 64, frameH: 65,
  anchorX: 19, anchorY: 44,
  sideArtFacesLeft: false, // side rows face right
  anims: {
    'idle-down':   { row: 0,  frames: 12, ms: 100 },
    'walk-down':   { row: 1,  frames: 8,  ms: 90 },
    'run-down':    { row: 2,  frames: 8,  ms: 80 },
    'thrust-down': { row: 3,  frames: 4,  ms: 70,  loop: false },
    'spin-down':   { row: 4,  frames: 7,  ms: 55,  loop: false },
    'roll-down':   { row: 5,  frames: 8,  ms: 60,  loop: false },

    'idle-side':   { row: 6,  frames: 12, ms: 100 },
    'walk-side':   { row: 7,  frames: 8,  ms: 90 },
    'run-side':    { row: 8,  frames: 8,  ms: 80 },
    'roll-side':   { row: 9,  frames: 6,  ms: 60,  loop: false },
    'thrust-side': { row: 10, frames: 4,  ms: 70,  loop: false },
    'spin-side':   { row: 11, frames: 5,  ms: 75,  loop: false },

    'idle-up':     { row: 12, frames: 12, ms: 100 },
    'walk-up':     { row: 13, frames: 8,  ms: 90 },
    'run-up':      { row: 14, frames: 8,  ms: 80 },
    'thrust-up':   { row: 15, frames: 4,  ms: 70,  loop: false },
    'spin-up':     { row: 16, frames: 7,  ms: 55,  loop: false },
    'roll-up':     { row: 17, frames: 8,  ms: 60,  loop: false },

    death:         { row: 18, frames: 13, ms: 90,  loop: false }
  },

  // Which animation the auto-attack plays (spin or thrust).
  meleeMove: 'spin'
};

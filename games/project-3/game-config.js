/* =============================================================================
   PROJECT 3 — GAME SETTINGS
   Change a number here, save, and reload the page on your phone.
   ============================================================================= */
const GAME_CONFIG = {
  ART_SCALE: 3,            // 1 art pixel = this many design pixels. (Was 2 — switched to 3 on 2026-09-29.)
  DESIGN_SHORT_SIDE: 390,  // design pixels across the phone's short side (phone held upright)
  START_ROOM: 'test-world',
  PLAYER_SPEED: 70,        // art pixels per second
  PLAYER_FEET: { w: 10, h: 4 }, // the small box at the hero's feet that bumps into things (art px)
  SHOW_BLOCKERS: true,     // true = draw the invisible blocking boxes in red (for testing). false = hide them.
  ROOM_SCRIPT_VERSION: Date.now() // always load the newest room files, so World Builder edits show up on the next reload
};

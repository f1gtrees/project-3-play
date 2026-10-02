// ============================================================
// world.config.js — Project 3's settings for World Builder
// (tools/world-builder/). World Builder is shared by every game,
// so each game tells it its own words and file names here.
// The game itself never reads this file.
// ============================================================
window.WORLD_CONFIG = {
  gameName: 'Project 3',
  roomsPath: 'rooms/',
  homeRoom: 'test-world',

  // Rooms are ONE big picture each (not a tile grid). New rooms made in
  // World Builder use this style, and these rooms open in the picture editor.
  roomStyle: 'big-image',

  // For World Builder's "Test walk" — match game-config.js.
  playerFeet: { w: 10, h: 4 },
  playerSpeed: 70,

  // "Open in game" opens this page with ?room=<id>.
  previewPage: 'index.html',

  // Hubs and portals. A room with hub: true is safe and refills health
  // (so does GAME_CONFIG.HUB_ROOM). Portals link rooms.
  portalListName: 'portals',
  hubFlag: 'hub',
  hubLabel: 'Hub',
  travelFlag: 'portal',
  travelLabel: 'Portal',
  areaLabel: 'Combat world',
  enemyListName: 'enemySpawns', // rooms with this list show as combat worlds on the map
  enemyZonesName: 'enemyZones', // rectangles that keep enemy groups in their area
  enemyTypesFile: 'enemy-data.js', // World Builder reads enemy sprites + normal numbers from here
  enemyTypesVar: 'ENEMY_TYPES',

  // The room swarm (swarm.js). World Builder's "Swarm" checkbox starts a
  // room with these numbers.
  swarmName: 'swarm',
  swarmDefaults: {
    type: 'warrior', waves: 3, firstWave: 6, addPerWave: 2, groupSize: 2,
    spawnEvery: 1.5, breakTime: 3, startDelay: 2, toughness: 15, speedUp: 5,
    boss: { type: 'warrior', hp: 15, speed: 45, damage: 2, size: 2 }
  },
  // TUNING — World Builder's Tuning button edits this file's numbers.
  tuningFile: 'tuning.js',
  tuningVar: 'TUNING',
  shopFile: 'shop-data.js',     // the wandering vendor + items (World Builder → Shop)
  shopVar: 'SHOP',
  vendorName: 'vendor',         // room setting: 'always' / 'never' (room editor → Vendor)
  themeFile: 'ui-theme.js',      // the look of menus / text boxes / mini map / HUD (World Builder → Style)
  themeVar: 'UI_THEME',
  themeCssFile: 'theme.js',     // the game's own code that turns the theme into CSS (the Style preview uses it)
  dialogueFile: 'dialogue-data.js', // text boxes (World Builder → Text)
  dialogueVar: 'DIALOGUE',
  roomTextName: 'introText',    // room setting: a script for the first time you walk in (room editor → Text on arrival)
  wallListName: 'walls',        // room list of walls: blocking boxes with no picture (room editor → Draw wall)
  lootListName: 'lootBoxes',    // room list of loot boxes (room editor → Loot box)
  lootDefaults: { box: 'supplyCrate', after: 'gone', respawnSeconds: 60 },
  lootTypesName: 'boxes',       // in the shop file: the box types a loot box can be (World Builder → Shop → Box types)
  lootArtName: 'chests',        // in the shop file: the chest art sheets (closed = first frame)
  specialsFile: 'specials.js', // the hero's special attacks — their numbers show on the Tuning screen
  specialsVar: 'SPECIALS',
  tuningGameFields: [           // whole-game settings: [name in tuning.js, label, step, the game's default]
    ['zoom', 'Game zoom (%)', 25, 300]
  ],
  tuningHeroFields: [           // [name in tuning.js, label, step, the game's default]
    ['maxHp', 'Health', 1, 5],
    ['walkSpeed', 'Walk speed (px/s)', 5, 70],
    ['meleeRadius', 'Attack circle size (px)', 1, 26],
    ['meleeDamage', 'Attack damage per swing', 0.25, 0.5],
    ['meleeCooldown', 'Seconds between swings', 0.05, 0.6],
    ['meleeKnockback', 'Attack shove', 5, 50],
    ['boltDamage', 'Bolt damage', 0.25, 0.5],
    ['boltCooldown', 'Bolt cooldown (s)', 0.1, 0.8],
    ['boltSpeed', 'Bolt speed (px/s)', 10, 170],
    ['boltRange', 'Bolt range (px)', 10, 150],
    ['moneyDropChance', 'Skull drop chance (%)', 5, 50],
    ['moneyCoinValue', 'Money per skull', 1, 1],
    ['moneyBossCoins', 'Skulls from a boss', 1, 5],
    ['moneyPickupRadius', 'Skull pickup reach (px)', 1, 10],
    ['moneyIconScale', 'Skull size on the ground (×)', 0.5, 1]
  ],
  // HUD — World Builder's HUD button lays these out and writes hud-layout.js.
  // x / y = where each starts (its centre, as a fraction of the screen).
  // visible: false = starts switched off (tick it in the HUD editor to add it).
  hudLayoutFile: 'hud-layout.js',
  hudLayoutVar: 'HUD_LAYOUT',
  hudElements: [
    { id: 'health', label: 'Health', kind: 'blocks', count: 5, x: 0.862, y: 0.025 },
    { id: 'wallet', label: 'Wallet (money)', kind: 'wallet', text: '125', x: 0.8, y: 0.053 },
    { id: 'swarm', label: 'Wave counter', kind: 'text', text: 'Wave 2/3 · 5 left', x: 0.5, y: 0.076 },
    { id: 'act', label: 'ACT button', kind: 'circle', text: 'ACT', size: 76, x: 0.841, y: 0.898 },
    { id: 'pause', label: 'Pause button (menu)', kind: 'square', text: 'II', size: 40, x: 0.08, y: 0.035, visible: false },
    { id: 'minimap', label: 'Mini map', kind: 'minimap', x: 0.16, y: 0.14, visible: false,
      // extra settings shown in the HUD editor: [name, label, step, default] — a step of 'yes' is a tick box
      settings: [['w', 'Width (px)', 5, 90], ['h', 'Height (px)', 5, 120], ['range', 'Shows (art px across, 0 = whole room)', 20, 0],
        ['opacity', 'Opacity (%)', 5, 85], ['enemies', 'Show enemies', 'yes', 0], ['round', 'Round', 'yes', 0]] }
  ],
  hudGrid: 10, // the HUD editor's grid: a line every 10% (halves and quarters drawn stronger)
  hudScreen: [390, 844], // the preview's phone (CSS px); the game fits the layout to any screen
  hudBackdropScale: 3, // = GAME_CONFIG.ART_SCALE, so the preview's floor looks like the game's
  routesFile: null
};

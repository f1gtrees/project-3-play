/* =============================================================================
   ROOM DATA — test-world (big-image room)
   Edited in World Builder (tools/world-builder/). Plain data, so World
   Builder can open it again.

   Floor: ONE picture (assets/test-world-ground.png), 1200×1800 art px.
   Props: separate pictures placed on top. anchorX/anchorY = each prop's base
   point inside its picture (where it meets the ground); block = its
   invisible blocking box, relative to that base point. All positions are in
   ART PIXELS. The big-image fields are read by the game, ignored by engine.js.
   ============================================================================= */
Engine.registerRoom('test-world', function buildRoom(spawnX, spawnY) {
  return {
    floorImage: 'floor',
    manifest: {
      floor: 'assets/test-world-ground.png',
      hut: 'assets/hut-green.png',
      cube: 'assets/metal-cube.png'
    },
    width: 1200, height: 1800,          // art px — only used if the floor picture is missing
    fallbackColor: '#c28462',  // greybox colour if the floor picture is missing
    // Enemies: type, where, which zone group; hp / speed / attacks only when different from the type's normal numbers.
    enemySpawns: [

    ],
    // Portals: walk onto one to travel to another room (to), arriving next to its portal toPortal.
    portals: [
      {id: "portal1", x: 198, y: 356, to: "combat-test"}
    ],
    // Zones: enemies in a group stay inside their zone.
    enemyZones: [

    ],

    propTypes: {
      hut: {image: "hut", anchorX: 36, anchorY: 62, block: {x: -19, y: -12, w: 38, h: 13}, fallbackColor: "#222"},
      cube: {image: "cube", anchorX: 11, anchorY: 19, block: {x: -10, y: -7, w: 20, h: 8}, fallbackColor: "#333"}
    },

    props: [
      {type: "hut", x: 352, y: 79},
      {type: "cube", x: 52, y: 279}
    ],

    // Player start. x = center, y = feet.
    player: {
      x: spawnX !== undefined ? spawnX : 200,
      y: spawnY !== undefined ? spawnY : 300,
      w: 14, h: 18,
      color: '#7fd1ff'
    }
  };
});

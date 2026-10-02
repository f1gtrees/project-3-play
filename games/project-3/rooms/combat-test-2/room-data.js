/* =============================================================================
   ROOM DATA — combat-test-2 ("Combat Test 2") — starter picture room
   Made by World Builder (tools/world-builder/). Floor = ONE picture
   (assets/combat-test-2.png). Place props in World Builder's room editor.
   All positions are in ART PIXELS.
   ============================================================================= */
Engine.registerRoom('combat-test-2', function buildRoom(spawnX, spawnY) {
  return {
    floorImage: 'floor',
    manifest: {
      floor: 'assets/combat-test-2.png'
    },
    width: 600, height: 600,          // art px — only used if the floor picture is missing
    fallbackColor: '#808080',  // greybox colour if the floor picture is missing

    propTypes: {
    },

    props: [
    ],

    // Player start. x = center, y = feet.
    player: {
      x: spawnX !== undefined ? spawnX : 300,
      y: spawnY !== undefined ? spawnY : 300,
      w: 14, h: 18,
      color: '#7fd1ff'
    }
  };
});

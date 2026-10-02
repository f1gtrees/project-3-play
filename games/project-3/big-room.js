/* =============================================================================
   BIG-IMAGE ROOM HELPERS — Project 3
   -----------------------------------------------------------------------------
   A room here is ONE big picture, not a tile grid. Everything in this file
   works in ART PIXELS (1 pixel of the painted image = 1 unit).

   Written generic on purpose — no Project 3 words in here — so these can
   move into engine.js later as NEW functions (additive only) once they've
   proven themselves on the phone. Until then they live in the game folder.
   ============================================================================= */

// How many real screen pixels one art pixel covers. Always a WHOLE number,
// so every art pixel is exactly the same size on screen: crisp, no uneven
// rows or columns. artScale is the one knob (GAME_CONFIG.ART_SCALE).
function computePixelScale(artScale, designShortSide) {
  const dpr = window.devicePixelRatio || 1;
  const cssShort = Math.min(window.innerWidth, window.innerHeight);
  return Math.max(1, Math.round(dpr * (cssShort / designShortSide) * artScale));
}

// The room's size in art pixels: taken from the image itself, or from the
// room's own width/height if the image failed to load (greybox fallback).
function getBigRoomSize(room, images) {
  // a room resized in World Builder keeps its own size; its picture sits at floorX/floorY
  if (room.customSize && room.width && room.height) return { w: room.width, h: room.height };
  const entry = images && images[room.floorImage];
  if (entry && entry.ok) return { w: entry.img.naturalWidth, h: entry.img.naturalHeight };
  return { w: room.width || 200, h: room.height || 200 };
}

// Camera = the art-pixel position of the screen's top-left corner.
// Per axis: follows the focus point, but never shows past the image's
// edges. If the image is smaller than the screen on an axis, it's centered.
function computeBigRoomCamera(worldW, worldH, viewW, viewH, focusX, focusY) {
  function axis(view, world, focus) {
    if (world <= view) return -(view - world) / 2;
    return Math.min(world - view, Math.max(0, focus - view / 2));
  }
  return { x: axis(viewW, worldW, focusX), y: axis(viewH, worldH, focusY) };
}

// Draws the whole floor image. camDev = camera in SCREEN pixels, already
// rounded to whole pixels (so the floor never shimmers while scrolling).
function drawBigRoomFloor(ctx, imageEntry, worldW, worldH, camDev, pxScale, fallbackColor) {
  const x = -camDev.x, y = -camDev.y, w = worldW * pxScale, h = worldH * pxScale;
  if (imageEntry && imageEntry.ok) {
    ctx.drawImage(imageEntry.img, x, y, w, h);
  } else {
    // Greybox: a checkerboard (16-art-px squares), so you can still see
    // yourself moving when the picture is missing.
    const base = fallbackColor || '#808080', cell = 16 * pxScale;
    ctx.fillStyle = base;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    for (let r = 0; r * cell < h; r++) {
      for (let c = (r % 2); c * cell < w; c += 2) {
        ctx.fillRect(x + c * cell, y + r * cell, Math.min(cell, w - c * cell), Math.min(cell, h - r * cell));
      }
    }
  }
}

// Where the floor picture goes in the room (art px): normally the whole room;
// in a resized room (customSize) it's the picture's own size at floorX/floorY,
// and the rest of the room is the fallback colour.
function getFloorRect(room, imageEntry, worldW, worldH) {
  if (room.customSize && imageEntry && imageEntry.ok) return { x: room.floorX || 0, y: room.floorY || 0, w: imageEntry.img.naturalWidth, h: imageEntry.img.naturalHeight };
  return { x: 0, y: 0, w: worldW, h: worldH };
}
// Like drawBigRoomFloor, for a resized room: fills the room, then the picture at its spot.
function drawBigRoomFloorAt(ctx, room, imageEntry, worldW, worldH, camDev, pxScale) {
  const r = getFloorRect(room, imageEntry, worldW, worldH);
  if (r.w === worldW && r.h === worldH && r.x === 0 && r.y === 0) return drawBigRoomFloor(ctx, imageEntry, worldW, worldH, camDev, pxScale, room.fallbackColor);
  ctx.fillStyle = room.fallbackColor || '#808080';
  ctx.fillRect(-camDev.x, -camDev.y, worldW * pxScale, worldH * pxScale);
  ctx.drawImage(imageEntry.img, -camDev.x + r.x * pxScale, -camDev.y + r.y * pxScale, r.w * pxScale, r.h * pxScale);
}

// Walls: invisible blocking boxes drawn straight onto the room (World Builder →
// Wall tool), with no picture — e.g. to close off the room's edges, then dress
// them with trees. room.walls = [ { x, y, w, h } ] (art px).
function getWallBlockers(room) {
  return (room.walls || []).filter(w => w && w.w > 0 && w.h > 0).map(w => ({ x: w.x, y: w.y, w: w.w, h: w.h }));
}

// Keeps a feet-anchored box (x = center, y = feet) inside the image.
function clampBoxToWorld(actor, worldW, worldH) {
  const half = actor.w / 2;
  actor.x = Math.min(worldW - half, Math.max(half, actor.x));
  actor.y = Math.min(worldH, Math.max(actor.h, actor.y));
}

/* -----------------------------------------------------------------------------
   PROPS — separate pictures placed on top of the floor (huts, rocks, cubes).
   A room lists:
     propTypes: { name: { image, src, anchorX, anchorY, block, fallbackColor } }
       image    — manifest key of the prop's picture (can be a whole tileset)
       src      — optional { x, y, w, h }: which part of that picture to use.
                  Leave it out to use the whole picture.
       anchorX/Y— the prop's BASE POINT inside its picture (where it meets
                  the ground). This is what gets placed at x/y, and it's
                  what decides who's drawn in front.
       block    — optional invisible blocking box, relative to the base
                  point: { x, y, w, h } (x/y = its top-left corner)
     props: [ { type, x, y } ]   — x/y = where the base point goes
   ----------------------------------------------------------------------------- */

// Every prop's blocking box, in room art pixels.
function getPropBlockers(room) {
  const out = [];
  (room.props || []).forEach(p => {
    const t = room.propTypes && room.propTypes[p.type];
    if (t && t.block) out.push({ x: p.x + t.block.x, y: p.y + t.block.y, w: t.block.w, h: t.block.h });
  });
  return out;
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// The actor's feet box (the part that bumps into things), in art pixels.
// feet = { w, h } — a small box centred on x, sitting on y.
function feetRect(actor, feet) {
  return { x: actor.x - feet.w / 2, y: actor.y - feet.h, w: feet.w, h: feet.h };
}

// Moves an actor by dx/dy but not into any blocker. Sideways and up/down
// are tried separately, so walking diagonally into a wall slides along it
// instead of sticking. Someone who is ALREADY inside a blocker (placed
// there, or shoved in) is allowed to move, so they can always walk out.
function moveActorWithBlockers(actor, dx, dy, feet, blockers) {
  const blocked = () => blockers.some(b => rectsOverlap(feetRect(actor, feet), b));
  const stuck = blocked();
  actor.x += dx;
  if (!stuck && blocked()) actor.x -= dx;
  actor.y += dy;
  if (!stuck && blocked()) actor.y -= dy;
}

// If an actor's feet start inside a blocker, move it to the nearest spot
// that's clear (searching outward in rings). Returns true if it moved.
function nudgeOutOfBlockers(actor, feet, blockers, worldW, worldH) {
  const blocked = () => blockers.some(b => rectsOverlap(feetRect(actor, feet), b));
  if (!blocked()) return false;
  const x0 = actor.x, y0 = actor.y;
  for (let r = 2; r <= 80; r += 2) {
    for (let i = 0; i < 16; i++) {
      const a = i / 16 * Math.PI * 2;
      actor.x = Math.round(x0 + Math.cos(a) * r);
      actor.y = Math.round(y0 + Math.sin(a) * r);
      const inWorld = actor.x - feet.w / 2 >= 0 && actor.x + feet.w / 2 <= worldW && actor.y - feet.h >= 0 && actor.y <= worldH;
      if (inWorld && !blocked()) return true;
    }
  }
  actor.x = x0; actor.y = y0; // nowhere clear nearby — leave it (it can still walk out)
  return false;
}

// Draws one prop with its base point at (baseX, baseY) in SCREEN pixels.
// Greybox fallback: if its picture is missing, draws its blocking box
// (or a small square) in a flat colour instead.
function drawProp(ctx, imageEntry, type, baseX, baseY, pxScale) {
  const s = pxScale;
  if (imageEntry && imageEntry.ok) {
    // src = which part of the picture this prop uses (one object on a
    // tileset). No src = the whole picture.
    const r = type.src || { x: 0, y: 0, w: imageEntry.img.naturalWidth, h: imageEntry.img.naturalHeight };
    ctx.drawImage(imageEntry.img, r.x, r.y, r.w, r.h,
      baseX - type.anchorX * s, baseY - type.anchorY * s, r.w * s, r.h * s);
    return;
  }
  const b = type.block || { x: -6, y: -12, w: 12, h: 12 };
  ctx.fillStyle = type.fallbackColor || '#333';
  ctx.fillRect(baseX + b.x * s, baseY + b.y * s, b.w * s, b.h * s);
}

// Draw order: anything whose base is higher up the screen is drawn first,
// so things lower down appear in front. items = [{ y, draw() }].
function drawDepthSorted(items) {
  items.sort((a, b) => a.y - b.y).forEach(it => it.draw());
}

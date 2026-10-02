/* =============================================================================
   ENGINE CORE
   -----------------------------------------------------------------------------
   This file knows NOTHING about any specific room, game, or asset. That's the
   whole point of it living here instead of in Driftmoor: a year from now, a
   brand new project should be able to grab this exact file untouched, write
   a new room-data file next to it, and be walking around in a room.

   What lives here (and ONLY here):
     - full-screen canvas setup (mobile-first — fills the real screen)
     - image preloading
     - tile-drawing primitives (source-sheet coordinates -> screen pixels)

   What does NOT live here (this belongs in each game's own room-data file):
     - which PNGs to load
     - tile coordinates, room size, colors
     - movement, input, character logic, menus, story — everything gameplay
   ============================================================================= */

const Engine = (() => {

  // ---- CANVAS SETUP (mobile-first, full-screen) ----------------------------
  // Fills the actual device screen rather than a fixed pixel box, and stays
  // crisp on retina/high-DPI phone screens via devicePixelRatio scaling.
  function setupCanvas(canvasEl) {
    const ctx = canvasEl.getContext('2d');

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      const cssW = window.innerWidth;
      const cssH = window.innerHeight;
      canvasEl.style.width  = cssW + 'px';
      canvasEl.style.height = cssH + 'px';
      canvasEl.width  = Math.round(cssW * dpr);
      canvasEl.height = Math.round(cssH * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // draw in CSS-pixel units, scaled for DPR
      ctx.imageSmoothingEnabled = false; // crisp pixel art, never blurred
    }

    resize();
    window.addEventListener('resize', resize);
    return ctx;
  }

  // ---- IMAGE PRELOADER --------------------------------------------------------
  // Never rejects — a failed image resolves with ok:false so callers can
  // fall back to a flat color instead of the whole boot sequence dying.
  function loadImages(manifest) {
    const keys = Object.keys(manifest);
    const images = {};
    const promises = keys.map(key => new Promise(resolve => {
      const img = new Image();
      img.onload  = () => { images[key] = { img, ok: true };  resolve(); };
      img.onerror = () => { images[key] = { img: null, ok: false }; resolve(); };
      img.src = manifest[key];
    }));
    return Promise.all(promises).then(() => images);
  }

  // ---- TILE DRAWING -----------------------------------------------------------
  // Draws one tile from a source sheet at a destination screen position.
  // All coordinates are in TILE units (not raw pixels) except px/py, which are
  // the destination's top-left corner in real screen pixels — the room-data
  // layer owns the decision of where on screen a tile grid starts.
  //
  // borderInset: crops source pixels off each edge before drawing — needed
  // for "swatch sheet" style assets that bake a browsing border into each
  // tile (confirmed issue on the LimeZu Room Builder sheets). Accepts either
  // a single number (same crop on all 4 sides) or a {top,left,right,bottom}
  // object — some swatches have a thin 1px border on two edges but a full
  // lighting gradient along another, which needs a different crop per side
  // (confirmed on the wood floor swatch, 2026-09-11).
  function drawTile(ctx, sheetEntry, srcTileSize, sx, sy, px, py, destTileSize, wTiles = 1, hTiles = 1, borderInset = 0, fallbackColor = '#c0c', destHTiles = null) {
    const dw = wTiles * destTileSize;
    const dh = (destHTiles !== null ? destHTiles : hTiles) * destTileSize; // lets art stretch taller than its own source crop
    if (sheetEntry && sheetEntry.ok) {
      const inset = typeof borderInset === 'number'
        ? { top: borderInset, left: borderInset, right: borderInset, bottom: borderInset }
        : { top: 0, left: 0, right: 0, bottom: 0, ...borderInset };
      const srcX = sx * srcTileSize + inset.left;
      const srcY = sy * srcTileSize + inset.top;
      const srcW = wTiles * srcTileSize - inset.left - inset.right;
      const srcH = hTiles * srcTileSize - inset.top - inset.bottom;
      ctx.drawImage(sheetEntry.img, srcX, srcY, srcW, srcH, px, py, dw, dh);
    } else {
      ctx.fillStyle = fallbackColor;
      ctx.fillRect(px, py, dw, dh);
    }
  }

  // ---- GRID UTILITIES -----------------------------------------------------------
  // Builds a cols x rows 2D array, every cell a copy of the given tile ref.
  // A room-data file uses this to describe its floor without engine.js ever
  // needing to know that room's actual dimensions.
  function buildGrid(cols, rows, fillTileRef) {
    const grid = [];
    for (let r = 0; r < rows; r++) {
      const row = [];
      for (let c = 0; c < cols; c++) row.push({ ...fillTileRef });
      grid.push(row);
    }
    return grid;
  }

  // Renders a full floor from room data: loops every cell in room.floor and
  // draws it at its grid position. originPx/originPy let a room start
  // somewhere other than the canvas's top-left corner (useful later once a
  // camera/viewport exists) — both default to 0 for now. room.offsetRows
  // (default 0) shifts the whole floor down to make room for a wall's
  // overhang above it — set by the room, engine doesn't assume a wall exists.
  function renderFloorGrid(ctx, images, room, originPx = 0, originPy = 0) {
    const offset = room.offsetRows || 0;
    for (let r = 0; r < room.rows; r++) {
      for (let c = 0; c < room.cols; c++) {
        const t = room.floor[r][c];
        const px = originPx + c * room.destTileSize;
        const py = originPy + (r + offset) * room.destTileSize;
        drawTile(ctx, images[t.sheet], room.srcTileSize, t.sx, t.sy, px, py, room.destTileSize, 1, 1, t.borderInset || 0, t.fallbackColor || room.fallbackColor || '#c0c');
      }
    }
  }

  // ---- FLOOR OVERLAY (decorative second floor layer) --------------------------
  // PRE-STEP-10 ADDITION: a second, OPTIONAL floor-level grid drawn
  // directly on top of room.floor — for trim/border/rug-edge tiles that
  // should sit flush on the ground ALONGSIDE the base floor tile, not
  // replace it. Purely visual: no collision, no Y-sorting against
  // entities or walls — a floor decal is always flat ground, never
  // occluded by or occluding anything. Nothing else in engine.js reads
  // this layer, so a room that never sets room.floorOverlay is completely
  // unaffected (renderFloorOverlay below just returns immediately).
  //
  // Sparse by design: most rooms only decorate a handful of cells (a
  // border strip, a rug's edge), not the whole floor. buildEmptyGrid sets
  // up an all-null grid; a room then assigns individual tile refs only to
  // the cells it wants decorated — a null cell draws nothing, letting the
  // base floor tile underneath show through untouched.
  function buildEmptyGrid(cols, rows) {
    const grid = [];
    for (let r = 0; r < rows; r++) {
      const row = [];
      for (let c = 0; c < cols; c++) row.push(null);
      grid.push(row);
    }
    return grid;
  }

  function renderFloorOverlay(ctx, images, room, originPx = 0, originPy = 0) {
    if (!room.floorOverlay) return;
    const offset = room.offsetRows || 0;
    for (let r = 0; r < room.rows; r++) {
      const row = room.floorOverlay[r];
      if (!row) continue;
      for (let c = 0; c < room.cols; c++) {
        const t = row[c];
        if (!t) continue;
        const px = originPx + c * room.destTileSize;
        const py = originPy + (r + offset) * room.destTileSize;
        drawTile(ctx, images[t.sheet], room.srcTileSize, t.sx, t.sy, px, py, room.destTileSize, 1, 1, t.borderInset || 0, t.fallbackColor || room.fallbackColor || '#c0c');
      }
    }
  }

  // Builds one row of wall cells, one per column — the wall equivalent of
  // buildGrid. A room-data file uses this for a simple "back wall only"
  // room shell without needing to know the engine's internals.
  //
  // PRE-STEP-10 GENERALIZATION: walls are no longer collision-locked to
  // row 0 — a room can now build a wall row at ANY row by passing r
  // explicitly. Every 2-argument call already committed in a room-data.js
  // file is untouched: r defaults to 0, so
  // Engine.buildWallRow(cols, fillTileRef) still produces exactly the same
  // row-0 wall it always did. To add an interior or side wall, call this
  // again for a different row and concat the results, e.g.:
  //   room.walls = [
  //     ...Engine.buildWallRow(cols, backWallTileRef, 0),
  //     ...Engine.buildWallRow(cols, sideWallTileRef, 3)
  //   ];
  // See isSolid and renderWallsAndEntities below for the collision and
  // rendering halves of this same change.
  function buildWallRow(cols, fillTileRef, r = 0) {
    const cells = [];
    for (let c = 0; c < cols; c++) cells.push({ c, r, ...fillTileRef });
    return cells;
  }

  // Renders a wall row. Walls are drawn TALLER than their real collision
  // footprint (hTiles) so the art visually bleeds down over the floor tile
  // in front of it — without this, a player standing "in front of" the
  // wall would show a hard edge-to-edge line instead of looking like they're
  // actually standing against it. Confirmed technique from prior Driftmoor
  // work. Drawn starting at the very top of the reserved offsetRows space
  // (originPy), not shifted like the floor — that's what lets its bottom
  // edge bleed down INTO the floor's row 0.
  // PRE-STEP-10 GENERALIZATION: this used to always draw at originPy —
  // correct only because every wall used to be row 0, the very top row,
  // so "the top of the reserved headroom" and "wall w's own row" were the
  // same position. Now that a wall can be built at any row (see
  // buildWallRow), each cell's vertical anchor is computed from its OWN
  // row the same way renderFloorGrid positions a floor tile, then the
  // same downward bleed is applied on top of that. This reduces to the
  // exact original formula when w.r is 0 and room.offsetRows is 1 (the
  // only case that existed before this change) — confirmed by hand, so
  // no visual change for any already-committed room.
  //
  // STILL A SEPARATE, UNSORTED PASS: this function alone is only correct
  // for a room with no entities that could ever stand in front of or
  // behind one of its walls. Since Step 9 every room always has at least
  // the player as an entity, use renderWallsAndEntities (below) instead
  // of calling this directly and renderEntities separately, unless a
  // room's walls are guaranteed to stay on the topmost row only.
  function renderWallRow(ctx, images, room, originPx = 0, originPy = 0) {
    const offset = room.offsetRows || 0;
    room.walls.forEach(w => {
      const hTiles = w.hTiles || 1;
      const bleed = w.overlapBleed !== undefined ? w.overlapBleed : (room.wallOverlapTiles || 0);
      const wr = w.r || 0;
      const px = originPx + w.c * room.destTileSize;
      const py = originPy + (wr + offset + 1 - hTiles) * room.destTileSize;
      drawTile(ctx, images[w.sheet], room.srcTileSize, w.sx, w.sy, px, py, room.destTileSize, 1, hTiles, w.borderInset || 0, w.fallbackColor || room.fallbackColor || '#c0c', hTiles + bleed);
    });
  }

  // Renders a character/NPC sprite that's taller than the single tile of
  // floor it actually stands on (confirmed: LimeZu character frames are
  // 2 tiles tall — head+body — but only occupy 1 tile of grid/collision
  // space, the feet tile). Anchored so the BOTTOM of the art lines up with
  // the sprite's tile — the opposite direction from the wall's downward
  // bleed, since here it's the sprite's OWN extra height, not an overlap
  // effect. Works for the player today; any future NPC uses this same call.
  //
  // Reads sprite.renderX/renderY (live tween position, in tile units) if
  // present, otherwise falls back to sprite.x/sprite.y (static position) —
  // this is what lets the same function draw a standing-still sprite AND
  // one mid-slide during grid movement without two separate code paths.
  //
  // ANIMATION: sprite.walkFrames is an OPTIONAL generic hook, shaped like:
  //   { down: {sy, frames:[sx,sx,...]}, up: {...}, left: {...}, right: {...} }
  // If present, sx/sy for the current frame are looked up from it using
  // sprite.facing + sprite.animFrame (both maintained by updateGridActor)
  // instead of using the sprite's own static sx/sy. This keeps engine.js
  // fully generic — it has no idea what those column numbers mean or which
  // character sheet they belong to, it just knows how to read the table a
  // room hands it. Any sprite without a walkFrames table (NPCs, static
  // props) just falls through to the old static sx/sy behavior unchanged.
  function renderSprite(ctx, images, room, sprite, originPx = 0, originPy = 0) {
    const hTiles = sprite.hTiles || 1;
    const wTiles = sprite.wTiles || 1;
    const offset = room.offsetRows || 0;
    const gx = sprite.renderX !== undefined ? sprite.renderX : sprite.x;
    const gy = sprite.renderY !== undefined ? sprite.renderY : sprite.y;
    const feetY = originPy + (gy + offset + 1) * room.destTileSize; // bottom edge of the sprite's tile
    const py = feetY - hTiles * room.destTileSize;
    const px = originPx + gx * room.destTileSize;

    let sx = sprite.sx, sy = sprite.sy;
    if (sprite.walkFrames) {
      const dir = sprite.walkFrames[sprite.facing || 'down'] || sprite.walkFrames.down;
      const frameIdx = sprite.animFrame || 0;
      sx = dir.frames[frameIdx % dir.frames.length];
      sy = dir.sy;
    }

    // STEP 9, piece 2: a sprite can optionally carry its OWN
    // fallbackColor, overriding the room's default — lets a placeholder
    // entity (no real art yet) render as a distinct, recognizable color
    // instead of blending into whatever flat color the room itself falls
    // back to. Existing sprites that don't set this are unaffected.
    // PRE-STEP-10 ADDITION: wTiles, same idea as hTiles but horizontal —
    // drawTile already accepted a wTiles argument from day one (used by
    // walls/floor), renderSprite just never read it off the sprite until
    // now. Any existing sprite without wTiles set is unaffected (defaults
    // to 1, byte-for-byte the old hardcoded behavior).
    drawTile(ctx, images[sprite.sheet], room.srcTileSize, sx, sy, px, py, room.destTileSize, wTiles, hTiles, sprite.borderInset || 0, sprite.fallbackColor || room.fallbackColor || '#c0c');
  }

  // ---- ENTITY RENDERING (Y-sorted) -------------------------------------------
  // STEP 9, piece 1. Draws a room's ENTITIES — a generic list a room
  // supplies at room.entities, eventually player + NPCs + monsters + props
  // + dropped items — in row order, back to front, so something standing
  // further "back" in the room (smaller row number) draws BEHIND something
  // standing further "front" (larger row number). That's the whole trick
  // that makes a top-down room with overlapping sprites look right: no
  // separate "layer," just draw order decided fresh every frame from
  // wherever everyone currently is.
  //
  // engine.js has zero idea what's actually IN that list — could be one
  // entity (today: just the player) or fifty. Each entity just needs the
  // same shape renderSprite already expects (x/y or renderX/renderY, sx/sy
  // or walkFrames, sheet, hTiles) — the exact shape createGridActor
  // already produces, so the player itself needs no special-casing to be
  // "an entity" too.
  //
  // Sorts a COPY (slice), never the room's own array — sorting in place
  // would silently reorder room.entities itself, which nothing else has
  // any reason to expect between frames.
  function renderEntities(ctx, images, room, entities, originPx = 0, originPy = 0) {
    const list = entities || [];
    const sorted = list.slice().sort((a, b) => {
      const ay = a.renderY !== undefined ? a.renderY : a.y;
      const by = b.renderY !== undefined ? b.renderY : b.y;
      return ay - by;
    });
    sorted.forEach(entity => renderSprite(ctx, images, room, entity, originPx, originPy));
  }

  // ---- WALLS + ENTITIES, Y-SORTED TOGETHER (pre-Step-10 generalization) -----
  // Once a wall can live on any row (not just row 0), it has to take part
  // in the SAME front-to-back sort as entities: a player standing further
  // from the camera than a wall needs to draw BEHIND it, one standing
  // closer needs to draw IN FRONT of it. Drawing all walls first and all
  // entities second (what renderWallRow + renderEntities do as two
  // separate passes) gets that backwards for any wall that isn't on the
  // topmost row — which used to be impossible, since row 0 IS the topmost
  // row, so the old two-pass order happened to always be correct by
  // coincidence.
  //
  // Call this instead of renderWallRow + renderEntities separately any
  // time room.walls might contain a row other than 0. It draws wall art
  // using the exact same positioning math renderWallRow uses, and draws
  // ordinary entities using the exact same renderSprite call renderEntities
  // uses — this function only decides the ORDER the two get drawn in nothing
  // about how either is drawn individually changes.
  function renderWallsAndEntities(ctx, images, room, entities, originPx = 0, originPy = 0) {
    const offset = room.offsetRows || 0;
    const wallItems = (room.walls || []).map(w => ({ type: 'wall', sortY: w.r || 0, wall: w }));
    const entityItems = (entities || []).map(e => ({
      type: 'entity',
      sortY: e.renderY !== undefined ? e.renderY : e.y,
      entity: e
    }));

    const merged = wallItems.concat(entityItems).sort((a, b) => a.sortY - b.sortY);

    merged.forEach(item => {
      if (item.type === 'wall') {
        const w = item.wall;
        const hTiles = w.hTiles || 1;
        const bleed = w.overlapBleed !== undefined ? w.overlapBleed : (room.wallOverlapTiles || 0);
        const wr = w.r || 0;
        const px = originPx + w.c * room.destTileSize;
        const py = originPy + (wr + offset + 1 - hTiles) * room.destTileSize;
        drawTile(ctx, images[w.sheet], room.srcTileSize, w.sx, w.sy, px, py, room.destTileSize, 1, hTiles, w.borderInset || 0, w.fallbackColor || room.fallbackColor || '#c0c', hTiles + bleed);
      } else {
        renderSprite(ctx, images, room, item.entity, originPx, originPy);
      }
    });
  }

  // ---- ATTACHED ENTITIES (rigid follow) --------------------------------------
  // STEP 9, piece 5. Lets an entity's position track an actor's, instead
  // of being independent — a held torch, an equipped weapon visual. Same
  // room.entities list as everything else; this is just a per-frame SYNC
  // step, called once before rendering, that overwrites an attached
  // entity's x/y (and renderX/renderY, to match mid-tween movement
  // exactly) based on whatever actor it's attached to, plus an offset.
  //
  // attachPropToActor(entity, actor, attachOffset) marks an entity as
  // attached — attachOffset is EITHER a fixed {dx, dy} (same relative
  // spot no matter which way the actor faces) OR a per-facing table
  // shaped exactly like walkFrames: {up:{dx,dy}, down:{dx,dy},
  // left:{dx,dy}, right:{dx,dy}} — for something that should always sit
  // "in front of" or "behind" the actor as they turn.
  //
  // This is RIGID attachment only: the entity snaps exactly to its
  // target's CURRENT position every single frame, including mid-slide —
  // there's no lag, it moves precisely WITH its actor. A trailing/delayed
  // follower (a pet a tile or two behind) is a meaningfully different
  // feature — it needs a short history of past positions to follow, not
  // just an offset from the current one — and isn't built here. Noted as
  // a reasonable future piece if ever wanted, not forgotten.
  function attachPropToActor(entity, actor, attachOffset) {
    entity.attachedTo = actor;
    entity.attachOffset = attachOffset || { dx: 0, dy: 0 };
    return entity;
  }

  // Call once per frame, AFTER updateGridActor (so it reads this frame's
  // updated actor position) and BEFORE renderEntities. Silently does
  // nothing to any entity that isn't attached — safe to call on the full
  // room.entities list every frame regardless of what's in it.
  function syncAttachedEntities(entities) {
    if (!entities) return;
    entities.forEach(entity => {
      if (!entity.attachedTo) return;
      const actor = entity.attachedTo;
      const offset = entity.attachOffset || { dx: 0, dy: 0 };
      // A fixed {dx, dy} offset vs a per-facing table are told apart by
      // shape: a fixed offset has its own dx/dy directly on it, a table
      // has facing names (up/down/left/right) as keys instead.
      let dx = 0, dy = 0;
      if ('dx' in offset || 'dy' in offset) {
        dx = offset.dx || 0;
        dy = offset.dy || 0;
      } else {
        const dir = offset[actor.facing || 'down'] || offset.down || { dx: 0, dy: 0 };
        dx = dir.dx || 0;
        dy = dir.dy || 0;
      }
      const baseX = actor.renderX !== undefined ? actor.renderX : actor.x;
      const baseY = actor.renderY !== undefined ? actor.renderY : actor.y;
      entity.x = actor.x + dx;
      entity.y = actor.y + dy;
      entity.renderX = baseX + dx;
      entity.renderY = baseY + dy;
      // An attached entity usually wants to visually face the same way
      // its actor does (a held torch pointing wherever the player looks)
      // — but only if it doesn't already control its own facing via its
      // own walkFrames table, which some future attached prop (a
      // companion with its own walk animation) might want to keep doing
      // independently.
      if (!entity.walkFrames) entity.facing = actor.facing;
    });
  }

  // ---- OVERLAP TRIGGERS (non-blocking entity detection) ----------------------
  // STEP 9, piece 3. Same split as everywhere else: engine.js only
  // establishes the FACT of what the actor is now standing on top of; the
  // room decides what that means by giving an entity its own onOverlap(ctx)
  // handler. Compares SETTLED tile position (actor.x/actor.y), matching
  // getFacingTile/getWarpAt — a trigger fires once an actor has actually
  // arrived on a tile, not mid-slide through it (the page calls this only
  // when !actor.moving, same guard warps already use).
  //
  // Not solid by default — an entity with no collision handling of its own
  // is just something you can walk onto, which is exactly what a loot
  // pickup or a pressure plate needs. (Blocking entities — an NPC you
  // can't walk through — aren't built here; that's future collision work,
  // separate from this overlap-only mechanism.)
  function getOverlappingEntities(actor, entities) {
    if (!entities) return [];
    // STEP 9, piece 5: same reasoning as getEntityAt above — an entity
    // ATTACHED to an actor (a held torch) shouldn't be able to fire an
    // overlap trigger just because it happens to be riding along on the
    // same or an adjacent tile; it belongs to the actor, not the tile.
    return entities.filter(e => e !== actor && !e.attachedTo && e.x === actor.x && e.y === actor.y);
  }

  // Calls onOverlap(ctx) — ctx is { actor, entity } — for every entity the
  // actor is now standing on that defines one; an entity with no
  // onOverlap (like Step 9 piece 2's static square) is silently skipped,
  // so this is safe to call every settled frame regardless of what's in
  // room.entities. Returns whatever each handler returns, collected into
  // an array, so a page can surface a string result (e.g. on the status
  // line) the same way it already does for Engine.triggerAction.
  //
  // Re-firing is entirely up to what the entity's OWN handler does: a
  // one-shot pickup removes itself from room.entities (e.g. via splice)
  // as part of handling its own overlap — once gone, getOverlappingEntities
  // simply won't find it next frame. A "stay armed" trigger (a pressure
  // plate) instead tracks its own state and decides for itself whether
  // firing again matters — engine.js doesn't assume either pattern.
  function checkOverlapTriggers(actor, entities) {
    const overlapping = getOverlappingEntities(actor, entities);
    const results = [];
    overlapping.forEach(entity => {
      if (entity.onOverlap) results.push(entity.onOverlap({ actor, entity }));
    });
    return results;
  }

  // ---- CAMERA (viewport centering + clamped scrolling) ----------------------
  // Computes an {originPx, originPy} offset to hand to renderFloorGrid /
  // renderWallRow / renderSprite — those functions already accepted an
  // origin, this is just what computes a non-zero one. Generic to any room
  // size/viewport combo; knows nothing about THIS room's dimensions beyond
  // what's passed in.
  //
  // Per axis, independently:
  //   - room smaller than the viewport on that axis -> center the room and
  //     hold it still (no scrolling needed, and scrolling would just show
  //     void space beyond the room's edge).
  //   - room bigger than the viewport -> follow the actor, but clamp so the
  //     camera never scrolls past the room's own edges (no void ever shown).
  // Followed position is the actor's TILE center (not its sprite's pixel
  // bounding box), so camera behavior doesn't depend on sprite art height —
  // a taller/shorter character sheet wouldn't change how the camera feels.
  // Every return value is integer-rounded (Math.round) so the floor/wall
  // grid never redraws at a fractional offset frame-to-frame, which is what
  // causes shimmer on scrolling pixel art.
  function computeCamera(room, viewportW, viewportH, actor) {
    const offset = room.offsetRows || 0;
    const roomW = room.cols * room.destTileSize;
    const roomH = (room.rows + offset) * room.destTileSize;

    const gx = actor.renderX !== undefined ? actor.renderX : actor.x;
    const gy = actor.renderY !== undefined ? actor.renderY : actor.y;
    const centerX = (gx + 0.5) * room.destTileSize;
    const centerY = (gy + offset + 0.5) * room.destTileSize;

    function axis(viewportSize, roomSize, centerPx) {
      if (roomSize <= viewportSize) {
        return Math.round((viewportSize - roomSize) / 2);
      }
      const desired = viewportSize / 2 - centerPx;
      const min = viewportSize - roomSize; // camera's most-negative allowed offset (room's bottom/right edge flush with viewport edge)
      const max = 0;                        // camera's most-positive allowed offset (room's top/left edge flush with viewport edge)
      return Math.round(Math.min(max, Math.max(min, desired)));
    }

    return {
      originPx: axis(viewportW, roomW, centerX),
      originPy: axis(viewportH, roomH, centerY)
    };
  }

  // ---- COLLISION ------------------------------------------------------------
  // Bounds + wall row, generic to any room's size/wall layout. A room can
  // pass a customSolidFn for extra solid things (furniture, NPCs) later —
  // not needed yet, so it's an optional 4th check.
  // STEP 8: gained a 4th optional check (ability gates) between walls and
  // customSolidFn. `actor` is optional so any existing caller that only
  // ever cared about bounds/walls keeps working unchanged — a gate check
  // with no actor to compare against just can't block anything, so it's
  // skipped. When an actor IS passed, a gated tile blocks unless
  // actor.abilities (a plain array of strings, defaulted to [] by
  // createGridActor) includes that gate's `requires` string.
  function isSolid(room, c, r, actor, customSolidFn) {
    if (c < 0 || r < 0 || c >= room.cols || r >= room.rows) return true;
    if (room.walls && room.walls.some(w => w.c === c && (w.r || 0) === r)) return true; // GENERALIZED (pre-Step-10): each wall cell now carries its own row instead of always meaning row 0
    if (actor) {
      const gate = getGateAt(room, c, r);
      if (gate) {
        const abilities = actor.abilities || [];
        if (!abilities.includes(gate.requires)) return true;
      }
    }
    if (customSolidFn && customSolidFn(c, r)) return true;
    return false;
  }

  // ---- WARPS (room transitions) -------------------------------
  // Pure lookup, same shape as isSolid — engine.js never navigates anywhere
  // or knows what a warp leads to. A room's own index.html decides what to
  // do with the result (today: fade out, then navigate to another room's
  // page). Keeping navigation out of here is what lets Step 7's in-engine
  // room loader reuse this same warp DATA without engine.js needing to
  // change again.
  function getWarpAt(room, c, r) {
    if (!room.warps) return null;
    return room.warps.find(w => w.c === c && w.r === r) || null;
  }

  // ---- ABILITY GATES (tile passable only with a matching ability flag) ------
  // STEP 8. Pure lookup, same shape/spirit as getWarpAt — engine.js has no
  // idea what a "gate" leads to or what ability names like 'cut' or 'boat'
  // MEAN, it just answers "is there a gate here, and if so, what string
  // does it require." A room lists these under room.gatedTiles: [{c, r,
  // requires}, ...]. isSolid (below) is what actually turns this into a
  // collision rule, by comparing `requires` against actor.abilities.
  function getGateAt(room, c, r) {
    if (!room.gatedTiles) return null;
    return room.gatedTiles.find(g => g.c === c && g.r === r) || null;
  }

  // ---- FACING TILE (interaction raycast) -------------------------------------
  // Returns the grid coordinates one tile in front of an actor, based on its
  // current actor.facing ('up'/'down'/'left'/'right', maintained by
  // updateGridActor). Pure geometry — no room lookup, no bounds checking, no
  // idea what's actually AT that tile. That's deliberate: this is the same
  // split as isSolid/getWarpAt — engine.js answers "where," the room decides
  // "so what." Uses actor.x/actor.y (the actor's settled grid tile), not
  // renderX/renderY, so a facing-tile query mid-step still resolves against
  // the tile the actor is walking FROM, not a fractional in-between position.
  // Works for the player today; any future NPC with a .facing field can use
  // this the same way.
  function getFacingTile(actor) {
    const deltas = {
      up:    { dx: 0, dy: -1 },
      down:  { dx: 0, dy: 1 },
      left:  { dx: -1, dy: 0 },
      right: { dx: 1, dy: 0 }
    };
    const d = deltas[actor.facing] || deltas.down;
    return { c: actor.x + d.dx, r: actor.y + d.dy };
  }

  // ---- ACTION DISPATCH (generic interaction hook) ----------------------------
  // STEP 8. Formalizes what the debug ACT button used to do ad hoc, directly
  // inside world/index.html: resolve where the actor is facing, look up
  // what's physically there, and hand a context object to whatever the
  // CURRENT ROOM says should happen. engine.js still has no idea what
  // "should happen" means for any tile — it only knows how to find out
  // where to look (via getFacingTile/isSolid, both already generic) and
  // who to hand the decision to.
  //
  // A room opts into handling actions by setting room.onAction = function(ctx)
  // {...} on the object its build function returns — see
  // rooms/test-room/room-data.js for the reference implementation (the
  // same tile-toggle debug demo the ACT button always did, just moved from
  // the page into the room). If a room doesn't define onAction,
  // triggerAction still resolves and returns the context object itself, so
  // a caller can inspect what's there without every room being required to
  // handle it.
  //
  // targetEntity/equippedItem are accepted now, ahead of the entity system
  // (Step 9) and inventory (Step 12) that will actually populate them —
  // today they'll just be null, passed through into ctx unchanged, so an
  // onAction handler written today keeps working unmodified once those
  // systems exist.
  // STEP 9, piece 4C: pure lookup, same shape/spirit as getWarpAt/getGateAt
  // — finds whatever entity (if any) currently occupies a specific tile.
  // Used by triggerAction below to resolve WHAT the player is facing when
  // ACT is pressed, so a room/entity can react to it, the same "engine
  // finds the fact" split as everything else here.
  function getEntityAt(entities, c, r) {
    if (!entities) return null;
    // STEP 9, piece 5: skips entities ATTACHED to an actor (a held torch,
    // an equipped weapon visual) — an attached entity conceptually
    // belongs to whoever it's attached to, not to whatever tile it
    // happens to be riding over, so it should never shadow or stand in
    // for the real thing actually sitting on that tile when resolving an
    // ACT target.
    return entities.find(e => !e.attachedTo && e.x === c && e.y === r) || null;
  }

  // STEP 9, piece 4C: `targetEntity` is now resolved INTERNALLY from an
  // `entities` list, rather than expected as an already-known argument —
  // this fills in a slot that's existed since Step 8 but had nothing real
  // to put in it until room.entities existed. A caller just hands over
  // the room's current entity list; triggerAction figures out on its own
  // whether anything is actually sitting on the faced tile.
  function triggerAction(room, actor, entities, equippedItem) {
    const facing = getFacingTile(actor);
    const inBounds = facing.c >= 0 && facing.r >= 0 && facing.c < room.cols && facing.r < room.rows;
    const solid = inBounds && isSolid(room, facing.c, facing.r, actor);
    const tileRef = (inBounds && room.floor && room.floor[facing.r]) ? room.floor[facing.r][facing.c] : null;
    // STEP 8C: the raw gate at the faced tile, or null — deliberately
    // separate from `solid`. `solid` answers "can the actor WALK there"
    // (a wall or an unmet gate both say no, same as always); `gate`
    // exists so a room can make its OWN independent decision about what
    // ACT should do near a gated tile, instead of that decision being
    // forced by whatever `solid` says. A room that doesn't care about the
    // distinction can keep doing exactly what ours does today (treat any
    // `solid` tile as "nothing to do here"). A room that DOES care — a
    // locked door you can inspect/unlock without yet being able to walk
    // through it, or fishing from a bank you can't yet boat across — can
    // check `ctx.gate` (what's required) against `ctx.equippedItem` /
    // `ctx.actor.abilities` FIRST, before ever looking at `ctx.solid`, and
    // run its own logic regardless of whether the tile currently blocks
    // movement. Neither pattern is built here — this field just makes
    // both possible, per room, per tile, whenever one's wanted.
    const gate = inBounds ? getGateAt(room, facing.c, facing.r) : null;
    const targetEntity = inBounds ? getEntityAt(entities, facing.c, facing.r) : null;

    const ctx = {
      room,
      actor,
      facing,              // {c, r} — the tile the actor is facing
      inBounds,
      solid,
      tileRef,             // the floor tile ref there, or null if out of bounds
      gate,                // the gate at that tile ({c, r, requires}), or null if none
      targetEntity,        // whatever entity is sitting on that tile, or null
      equippedItem: equippedItem || null
    };

    if (room.onAction) return room.onAction(ctx);
    return ctx;

  }

  // ---- TILE MUTATION (runtime floor/wall edits) -------------------------------
  // Generic primitive: patches one tile's ref in a room's floor grid or wall
  // row, at runtime, after the room has already loaded. engine.js has no
  // idea what a "tile ref" means beyond {sheet, sx, sy, ...} — the same
  // shape buildGrid/buildWallRow already produce — so a caller can hand this
  // a full replacement or just the fields that changed (patch is merged
  // onto the existing tile via Object.assign, not swapped wholesale). This
  // is the primitive a later interaction system builds on: cut bush -> dirt
  // tile, closed door -> open door, hoed soil, watered garden bed — none of
  // that logic lives here, just the ability to change what a tile IS.
  // Returns true if a tile was actually found and patched, false otherwise
  // (out-of-range c/r, or an unrecognized layer) so a caller can tell a real
  // mutation apart from a silent no-op.
  // STEP 8B (persistent tile state, session-only): setTile's actual patch
  // logic is split out into applyTilePatch below so the SAME patching code
  // runs whether a mutation is brand new or being re-applied to a freshly
  // rebuilt room on re-entry — one code path, not two that could drift
  // apart. setTile itself now takes an optional 5th argument, `persist`:
  // when true, the patch is also recorded in roomTileState (below), keyed
  // by whichever room is CURRENTLY active (Engine's own room-manager
  // bookkeeping — the caller doesn't need to know or pass a room name).
  // This is RAM-only and tied to this page load: it survives leaving and
  // re-entering a room, but NOT a page refresh — real save-file
  // persistence (surviving a refresh) is Step 12's job, layered on top of
  // this later, not replacing it.
  function applyTilePatch(room, layer, c, r, patch) {
    if (layer === 'floor') {
      if (!room.floor || !room.floor[r] || !room.floor[r][c]) return false;
      Object.assign(room.floor[r][c], patch);
      return true;
    }
    if (layer === 'wall') {
      if (!room.walls) return false;
      const w = room.walls.find(w => w.c === c);
      if (!w) return false;
      Object.assign(w, patch);
      return true;
    }
    return false;
  }

  function setTile(room, layer, c, r, patch, persist = false) {
    const applied = applyTilePatch(room, layer, c, r, patch);
    if (applied && persist && currentRoomName) {
      if (!roomTileState[currentRoomName]) roomTileState[currentRoomName] = {};
      if (!roomTileState[currentRoomName][layer]) roomTileState[currentRoomName][layer] = {};
      const key = `${c},${r}`;
      // Merge onto any earlier persisted patch for this same tile, same
      // rule setTile itself already uses (Object.assign, not a wholesale
      // replace) — so persisting two different fields of the same tile
      // across two separate setTile calls doesn't clobber each other.
      const existing = roomTileState[currentRoomName][layer][key] || {};
      roomTileState[currentRoomName][layer][key] = { ...existing, ...patch };
    }
    return applied;
  }

  // Re-applies every persisted patch recorded for roomId onto a freshly
  // built room object — called automatically by loadRoom right after a
  // room's build function returns, so a room never has to remember to ask
  // for its own persisted state; it just comes back already-changed. Order
  // isn't meaningful here (each key is one tile, patches for different
  // tiles don't interact), so a plain Object.keys walk is enough.
  function applyPersistedTileState(roomId, room) {
    const state = roomTileState[roomId];
    if (!state) return;
    Object.keys(state).forEach(layer => {
      Object.keys(state[layer]).forEach(key => {
        const [c, r] = key.split(',').map(Number);
        applyTilePatch(room, layer, c, r, state[layer][key]);
      });
    });
  }

  // ---- ROOM TILE STATE FROM ANYWHERE (Session 2) ------------------------------
  // setTile(..., persist) above can only change the room the player is
  // CURRENTLY in. Some things need to change a tile in a room that isn't
  // loaded right now — e.g. something that happens overnight while the
  // player is somewhere else entirely. setRoomTile records a patch for ANY
  // room by name, into the same roomTileState store setTile uses (so it's
  // saved and re-applied on the next visit exactly the same way), and if
  // that room happens to be the one currently loaded, also applies it live
  // so it shows up on the very next frame. engine.js still has no idea what
  // the patch MEANS — it's just fields merged onto a tile.
  function setRoomTile(roomId, layer, c, r, patch) {
    if (typeof roomId !== 'string' || (layer !== 'floor' && layer !== 'wall')) return false;
    if (!roomTileState[roomId]) roomTileState[roomId] = {};
    if (!roomTileState[roomId][layer]) roomTileState[roomId][layer] = {};
    const key = `${c},${r}`;
    const existing = roomTileState[roomId][layer][key] || {};
    roomTileState[roomId][layer][key] = { ...existing, ...patch };
    if (roomId === currentRoomName && currentRoom) applyTilePatch(currentRoom, layer, c, r, patch);
    return true;
  }

  // Read-only snapshot of every persisted tile patch, for every room:
  // { roomId: { layer: { "c,r": patch } } }. A deep copy, so changing it
  // can't silently change the real store — use setRoomTile for that.
  // Lets game code walk every changed tile in the whole world (e.g. to
  // update all of them at the start of a new day).
  function getAllRoomTileState() {
    return JSON.parse(JSON.stringify(roomTileState));
  }

  // ---- ENTITY STATE (persisted per-entity data) -------------------------------
  // STEP 9, piece 3B. Same RAM-only, page-session scope as roomTileState
  // above (survives leaving/re-entering a room, resets on refresh; real
  // save-file persistence is Step 12). Deliberately a SEPARATE mechanism
  // from tile persistence rather than reusing it, because the natural
  // unit of "was this already collected/triggered" is an entity's own
  // stable id, not a grid coordinate.
  //
  // This does NOT automatically re-apply itself the way
  // applyPersistedTileState does — a room's build function is expected to
  // call getEntityState ITSELF while deciding what to put in room.entities
  // (e.g. "don't even create this pickup if it's already been collected"),
  // because "existing but modified" doesn't make sense for something whose
  // usual persisted state is "shouldn't exist anymore." A room is always
  // free to interpret persisted entity state however it wants — this is
  // deliberately just a bare key/value store, not a policy.
  //
  // An entity that never calls setEntityState with persist:true simply
  // has no persisted state to find here — which is exactly what makes an
  // entity REGENERATE on every room visit: with nothing recorded, the
  // room's next build just creates a fresh copy of it again, same as
  // before this mechanism existed at all. Persistence here is opt-in per
  // entity, not a default.
  function setEntityState(entityId, patch, persist = false) {
    if (!persist || !currentRoomName) return;
    if (!roomEntityState[currentRoomName]) roomEntityState[currentRoomName] = {};
    const existing = roomEntityState[currentRoomName][entityId] || {};
    roomEntityState[currentRoomName][entityId] = { ...existing, ...patch };
  }

  function getEntityState(roomId, entityId) {
    const state = roomEntityState[roomId];
    if (!state) return null;
    return state[entityId] || null;
  }

  // STEP 9, piece 4B: the missing piece for an UNBOUNDED number of
  // persisted entities (placed furniture, dropped items — anything where
  // a room can't know the ids in advance the way it knows one fixed
  // 'test-room-loot-1'). Returns EVERY persisted record for a room, so a
  // build function can loop through however many there are and
  // reconstruct one entity per record — a shallow copy, so a caller can't
  // accidentally mutate the master store by editing what's returned.
  function getAllEntityState(roomId) {
    return { ...(roomEntityState[roomId] || {}) };
  }

  // The other missing half: permanently forgetting one persisted entity
  // (e.g. the player picks a placed item back up) — as opposed to
  // setEntityState, which only ever adds/merges, never removes.
  function clearEntityState(roomId, entityId) {
    if (!roomEntityState[roomId]) return;
    delete roomEntityState[roomId][entityId];
  }

  // Small convenience so callers placing an unbounded number of things
  // (unlike a room's own fixed, hand-picked ids like 'test-room-loot-1')
  // don't each need to invent their own uniqueness scheme.
  let entityIdCounter = 0;
  function generateEntityId(prefix) {
    entityIdCounter += 1;
    return `${prefix || 'entity'}-${Date.now()}-${entityIdCounter}`;
  }

  // STEP 9, piece 5: small convenience wrapping the exact
  // generate-id / optionally-persist / return-an-entity sequence
  // world/index.html's "place prop live" button was already doing by
  // hand. Deliberately does NOT push the result into room.entities
  // itself — only the caller knows which room/array it belongs to — and
  // only ever persists DATA fields (skips functions like onActionTarget),
  // since a persisted record is plain data that survives a rebuild; the
  // BEHAVIOR for a reconstructed entity still has to be supplied fresh by
  // whatever room rebuilds it, the same way it already does for loot and
  // placed props. propFields can include its own `id` to reuse a known,
  // fixed id (like a single named pickup) instead of generating one. No
  // separate roomName argument — setEntityState already persists against
  // whichever room is CURRENTLY active (Engine's own tracking), so this
  // only ever makes sense to call while that room is the one loaded.
  function placeProp(propFields, persist = false) {
    const id = propFields.id || generateEntityId('prop');
    const entity = { ...propFields, id };
    if (persist) {
      const persistable = {};
      Object.keys(propFields).forEach(key => {
        if (typeof propFields[key] !== 'function') persistable[key] = propFields[key];
      });
      setEntityState(id, persistable, true);
    }
    return entity;
  }

  // ---- EQUIPPED PROP (player-level, carries across rooms) --------------------
  // AUDIT FIX (generalizes the old single "equipped prop" slot): a plain,
  // TAG-KEYED data store — same page-session scope as playerAbilities —
  // for anything that should follow the PLAYER across rooms rather than
  // being tied to any one room's buildFn: a held torch, a following
  // companion, anything a project invents. engine.js assigns NO meaning
  // to a tag string, exactly the same way it assigns no meaning to an
  // ability name — 'torch', 'companion', 'weapon', five different things
  // attached at once, all look identical here. The single hardcoded
  // "equipped prop" concept this replaced was itself a boundary
  // violation: it baked in the game-specific assumption that there's
  // exactly one equippable thing and that "equipping" is even a concept
  // a given project has.
  //
  // Deliberately just data (propFields + an attachOffset per tag) —
  // engine.js does NOT automatically attach any of this to anything
  // itself; it's up to whatever calls Engine.loadRoom's onRoomReady (see
  // world/index.html) to decide whether and how to apply each tag every
  // time a room loads, which is also where a project decides the exact
  // per-tag, per-room condition for turning any of them off — see that
  // file's applyPlayerAttachmentsToCurrentRoom for the convention it
  // uses (ordinary room properties engine.js has no idea exist).
  let playerAttachments = {}; // tag -> { propFields, attachOffset }

  function setPlayerAttachment(tag, propFields, attachOffset) {
    playerAttachments[tag] = { propFields, attachOffset: attachOffset || { dx: 0, dy: 0 } };
  }
  function clearPlayerAttachment(tag) {
    delete playerAttachments[tag];
  }
  function getPlayerAttachment(tag) {
    return playerAttachments[tag] || null;
  }
  function getPlayerAttachments() {
    return { ...playerAttachments }; // shallow copy — caller can't mutate the master store by reference
  }

  // ---- WORLD FLAGS (generic condition store) ----------------------------------
  // STEP 9, piece 4. The simplest possible key/value store — no rooms, no
  // tiles, no entities involved, just a name and a value, same RAM/page-
  // session scope as everything else above. This is what "conditional
  // spawning" actually means in practice: a room's build function calls
  // getFlag() ITSELF while deciding what to put in room.entities (same
  // pattern as piece 3B's persisted-loot check), and engine.js never
  // assigns any meaning to a flag's name or value — 'testEventComplete',
  // 'metTheMayor', 'day', whatever a project needs later, all look
  // identical to engine.js.
  //
  // IMPORTANT LIMITATION, worth understanding rather than discovering by
  // surprise: because a room's entity list is only decided at BUILD time
  // (when the room is entered), flipping a flag while the player is
  // already standing in that room does NOT make anything appear or vanish
  // on the spot — the room has to be rebuilt (left and re-entered) to
  // reflect the new value. That's normal for most "X unlocks after event
  // Y" design (the event usually happens somewhere else). Something that
  // truly needs to appear INSTANTLY while the player watches (placing a
  // piece of furniture, for example) isn't a flag/conditional-spawn
  // problem at all — it's just pushing a new entity straight into
  // room.entities right then, which room.entities being a plain array
  // already supports with no extra mechanism needed.
  function setFlag(name, value) { worldFlags[name] = value; }
  function getFlag(name) { return Object.prototype.hasOwnProperty.call(worldFlags, name) ? worldFlags[name] : undefined; }

  // ---- FADE OVERLAY (generic screen transition) -----------------------------
  // A full-viewport div layered over the canvas via CSS opacity, NOT drawn
  // on the canvas itself — keeps this independent of any single room's
  // render loop. Starts fully opaque (black) so a page always boots hidden
  // until its own script explicitly reveals it; that's what makes a warp
  // feel like one continuous transition across two separate page loads
  // (fade to black -> navigate -> new page already starts black -> fade
  // in) instead of an abrupt flash-cut.
  //
  // fadeOut/fadeIn both return a Promise that resolves once the CSS
  // transition finishes, so callers can chain a navigation after a fade
  // completes rather than guessing a timeout.
  function createFadeOverlay() {
    const el = document.createElement('div');
    el.style.position = 'fixed';
    el.style.top = '0';
    el.style.left = '0';
    el.style.width = '100%';
    el.style.height = '100%';
    el.style.background = '#000';
    el.style.opacity = '1'; // start fully black — caller fades in once ready
    el.style.zIndex = '999';
    el.style.pointerEvents = 'none'; // never blocks dpad/touch input underneath
    document.body.appendChild(el);

    function fadeTo(opacity, ms) {
      return new Promise(resolve => {
        el.style.transition = `opacity ${ms}ms linear`;
        void el.offsetHeight; // force a reflow so the transition applies before the opacity change, not after
        el.style.opacity = String(opacity);
        setTimeout(resolve, ms);
      });
    }

    return {
      fadeIn: (ms = 300) => fadeTo(0, ms),  // reveal the room
      fadeOut: (ms = 300) => fadeTo(1, ms)  // hide to black
    };
  }

  // ---- 9-SLICE BOX (generic resizable window/panel renderer) ----------------
  // STEP 11, piece 1. Draws a rectangular box of ANY pixel size from a
  // small source image, by stretching only the parts that are safe to
  // stretch — a classic "9-slice": 4 corners copied pixel-for-pixel
  // (never stretched, so rounded corners/bevels stay crisp at any box
  // size), 4 edges stretched along ONE axis only, and a center stretched
  // both ways. This is screen-space UI chrome, NOT part of the room's
  // tile grid — no sx/sy tile-index math like drawTile uses, just plain
  // source pixel coordinates, since a UI frame image has no reason to
  // share a room's srcTileSize.
  //
  // engine.js has zero idea what's ever drawn INSIDE the box (dialogue
  // text, a menu, an inventory grid) — same split as everywhere else.
  // This only knows how to stretch a frame image without distorting its
  // border art. `inset` is how many source pixels from each edge are
  // border (not center fill) — {top, left, right, bottom}, independent
  // per side because border art isn't always symmetric (confirmed on the
  // Modern UI pack's window frame: sides/bottom are 15px, top is 18px —
  // one extra decorative band that doesn't wrap around). Same
  // fallbackColor convention as drawTile: an unloaded/failed image draws
  // a flat rect instead of nothing, so a page never shows a blank hole
  // while art is still loading or missing.
  function draw9SliceBox(ctx, imageEntry, srcW, srcH, inset, px, py, destW, destH, fallbackColor = '#c0c') {
    if (!imageEntry || !imageEntry.ok) {
      ctx.fillStyle = fallbackColor;
      ctx.fillRect(px, py, destW, destH);
      return;
    }
    const img = imageEntry.img;
    const top = inset.top || 0, left = inset.left || 0, right = inset.right || 0, bottom = inset.bottom || 0;
    const midSrcW = Math.max(0, srcW - left - right);
    const midSrcH = Math.max(0, srcH - top - bottom);
    // Guards against a box requested SMALLER than its own border insets
    // (e.g. a page miscalculates and asks for a 20px-wide box on a frame
    // whose insets alone total 30px) — clamped to 0 rather than a
    // negative width, which drawImage would otherwise throw on.
    const midDestW = Math.max(0, destW - left - right);
    const midDestH = Math.max(0, destH - top - bottom);

    // 4 corners — copied at native size, never stretched.
    if (top > 0 && left > 0) ctx.drawImage(img, 0, 0, left, top, px, py, left, top);
    if (top > 0 && right > 0) ctx.drawImage(img, srcW - right, 0, right, top, px + destW - right, py, right, top);
    if (bottom > 0 && left > 0) ctx.drawImage(img, 0, srcH - bottom, left, bottom, px, py + destH - bottom, left, bottom);
    if (bottom > 0 && right > 0) ctx.drawImage(img, srcW - right, srcH - bottom, right, bottom, px + destW - right, py + destH - bottom, right, bottom);

    // 4 edges — stretched along the ONE axis that runs the box's length.
    if (midDestW > 0 && top > 0) ctx.drawImage(img, left, 0, midSrcW, top, px + left, py, midDestW, top);
    if (midDestW > 0 && bottom > 0) ctx.drawImage(img, left, srcH - bottom, midSrcW, bottom, px + left, py + destH - bottom, midDestW, bottom);
    if (midDestH > 0 && left > 0) ctx.drawImage(img, 0, top, left, midSrcH, px, py + top, left, midDestH);
    if (midDestH > 0 && right > 0) ctx.drawImage(img, srcW - right, top, right, midSrcH, px + destW - right, py + top, right, midDestH);

    // Center — stretched both ways.
    if (midDestW > 0 && midDestH > 0) ctx.drawImage(img, left, top, midSrcW, midSrcH, px + left, py + top, midDestW, midDestH);
  }

  // ---- TEXT LAYOUT (generic canvas text wrapping + multi-line draw) ---------
  // STEP 11, piece 2. Same spirit as draw9SliceBox: a content-blind canvas
  // primitive, not a dialogue system. wrapText has no idea whether the
  // string it's wrapping is dialogue, a menu label, or a debug message —
  // it just measures words against ctx.font (the CALLER sets ctx.font
  // before calling this; engine.js doesn't own font choice, that's page
  // styling) and breaks them into lines that fit maxWidth. Standard
  // greedy word-wrap: a single word longer than maxWidth on its own is
  // NOT split mid-word (that's a font/box-sizing mismatch for the page to
  // fix, not something engine.js should paper over by hyphenating).
  function wrapText(ctx, text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let current = '';
    words.forEach(word => {
      const test = current ? current + ' ' + word : word;
      if (current && ctx.measureText(test).width > maxWidth) {
        lines.push(current);
        current = word;
      } else {
        current = test;
      }
    });
    if (current) lines.push(current);
    return lines;
  }

  // Draws an array of lines (e.g. wrapText's own output) top-to-bottom at
  // a fixed line height — the other half of "don't make every page
  // rewrite this loop by hand." ctx.font/fillStyle are still the
  // caller's responsibility, set before calling this, same as wrapText.
  function drawTextLines(ctx, lines, px, py, lineHeight) {
    lines.forEach((line, i) => ctx.fillText(line, px, py + i * lineHeight));
  }

  // ---- TEXT REVEAL (generic character-count-over-time timer) ----------------
  // STEP 11, piece 3 — the typewriter effect deliberately deferred when
  // the dialogue box first shipped. Same content-blind spirit as
  // draw9SliceBox/wrapText: this has no idea it's revealing dialogue, a
  // menu label, or anything else — it only tracks "how many characters of
  // THIS string should be visible right now," given how much time has
  // passed since start() was called.
  //
  // A page creates ONE of these near boot (same per-page-instance pattern
  // as createDirectionalInput/createStateStack/createEventQueue) and
  // calls start() again each time a new string begins revealing — e.g.
  // once per dialogue line, not a fresh createTextReveal() per line.
  function createTextReveal(charsPerSecond = 30) {
    let text = '';
    let startedAt = 0;
    let skipped = false;

    // Begins revealing a NEW string from scratch, timed from `now` — the
    // caller's own timestamp reading, same convention createInputGate
    // already uses; engine.js doesn't read the clock itself here either.
    function start(newText, now) {
      text = newText || '';
      startedAt = now;
      skipped = false;
    }

    // The substring that should be visible at time `now` — the whole
    // string instantly if skip() was called, otherwise however many
    // characters charsPerSecond has revealed since start().
    function getVisibleText(now) {
      if (skipped) return text;
      const elapsedSec = Math.max(0, now - startedAt) / 1000;
      const count = Math.floor(elapsedSec * charsPerSecond);
      return text.slice(0, Math.min(count, text.length));
    }

    // True once every character is visible, whether that's because time
    // ran out naturally or skip() cut it short — a caller asking "can I
    // advance to the next line yet" only ever needs this, never the two
    // reasons separately.
    function isComplete(now) {
      return skipped || getVisibleText(now).length >= text.length;
    }

    // Jumps straight to the full string — the standard "player tapped
    // while it was still revealing" response, so they're never stuck
    // waiting out an animation with no way to hurry it.
    function skip() {
      skipped = true;
    }

    return { start, getVisibleText, isComplete, skip };
  }

  // ---- ROOM MANAGER (in-engine room swapping, no page reload) ---------------
  // STEP 7. Replaces the old "page-per-room, warp = window.location.href"
  // approach with a single long-lived page that swaps room data in memory.
  // engine.js still knows NOTHING about any specific room here — it only
  // knows the MECHANISM: a room registers itself under a string name, and
  // loadRoom(name, ...) is how something (a warp, a menu, anything) asks to
  // go there.
  //
  // A "room module" is a script that, when it runs, calls
  // Engine.registerRoom(name, buildFn). buildFn(spawnC, spawnR, spawnFacing)
  // must return a FRESH room object (same shape a room-data.js used to
  // assign to the old global ROOM: cols, rows, floor, walls, warps,
  // manifest, player, etc.) — called again from scratch every time the
  // room is entered, which is what stops one visit's runtime tile
  // mutations (setTile) from leaking into the next.
  //
  // IMPORTANT PATH GOTCHA (the kind of thing that eats a whole session if
  // it's not called out up front): a room-data.js file is loaded via a
  // dynamically-created <script> tag whose src is resolved relative to
  // roomsBasePath — but once that script is RUNNING, any relative path IT
  // writes (e.g. an image manifest path) resolves against the PAGE's own
  // URL (world/index.html), not against the script file's own folder.
  // Dynamic <script src> does not change the document's base URL. So every
  // room-data.js manifest path must be written relative to where
  // world/index.html lives (e.g. "rooms/test-room/assets/foo.png"), never
  // relative to the room-data.js file itself (e.g. NOT "assets/foo.png").
  const roomRegistry = {};        // name -> buildFn
  const loadedRoomScripts = new Set(); // names whose <script> has already resolved once
  const roomImageCache = {};      // image src path -> {img, ok} — shared across ALL rooms, so two rooms pointing at the same sheet don't reload it twice
  const roomTileState = {};       // STEP 8B: room name -> { layer -> { "c,r" -> patch } } — persisted tile mutations, RAM-only, lives for this page load (see setTile/applyPersistedTileState)
  const roomEntityState = {};     // STEP 9, piece 3B: room name -> { entityId -> patch } — persisted entity state, same RAM-only/page-session scope as roomTileState, see setEntityState/getEntityState
  const worldFlags = {};          // STEP 9, piece 4: name -> value, generic world-state store, same RAM/page-session scope as everything else here — NOT tied to any one room, tile, or entity. Meant for broader state later (quest progress, event completion, eventually day/night once Step 13's clock exists). See setFlag/getFlag below.

  let roomsBasePath = 'rooms/';
  let roomScriptVersion = 1;
  let roomFadeOverlay = null;
  let onRoomReadyCallback = null;
  let currentRoom = null;
  let currentRoomName = null;

  // STEP 8D: PLAYER-LEVEL PERSISTENT STATE (page-session, RAM-only within
  // this closure — see exportSaveState/importSaveState below for the
  // actual cross-session persistence). This exists because abilities belong to the PLAYER's
  // ongoing identity across the whole world, not to any single room
  // visit — but createGridActor builds a brand new actor object from
  // scratch every time a room is (re)built (correct for spawn
  // position/sprite/animation state, which SHOULD reset per visit; wrong
  // for abilities, which shouldn't vanish just because the player walked
  // into another room and back). loadRoom syncs this list onto
  // room.player.abilities right after a room is built, the same way
  // applyPersistedTileState syncs persisted tile patches. Plain string
  // names only — engine.js never assigns any of them meaning.
  let playerAbilities = [];

  // STEP 12: PLAYER-LEVEL PERSISTENT ITEM STORE — same page-session,
  // RAM-only scope as playerAbilities right above it, for the exact same
  // reason: what the player is carrying belongs to their ongoing
  // identity across the whole world, not to any single room visit.
  // Plain id-string -> count map. engine.js never assigns any meaning to
  // an id ("torch", "goldCoin", "testAbilityKey" all look identical here)
  // — what an item IS (its icon, its name, whether it's equippable,
  // whether picking it up should also call grantAbility) is entirely a
  // room/page decision, made by whatever code calls addItem. See
  // addItem/removeItem/getItemCount/getAllItems below.
  let playerItems = {};

  function grantAbility(name) {
    if (!playerAbilities.includes(name)) playerAbilities.push(name);
  }
  function revokeAbility(name) {
    const idx = playerAbilities.indexOf(name);
    if (idx !== -1) playerAbilities.splice(idx, 1);
  }
  function hasAbility(name) {
    return playerAbilities.includes(name);
  }
  function getAbilities() {
    return playerAbilities.slice(); // copy — callers can't mutate the master list by reference
  }

  // STEP 12: qty defaults to 1 (the common case — picking up one item),
  // but takes any positive number so a room could hand over a stack at
  // once (e.g. "found 5 arrows") without calling this in a loop.
  function addItem(id, qty = 1) {
    playerItems[id] = (playerItems[id] || 0) + qty;
  }

  // Returns false (and changes nothing) if fewer than qty are currently
  // held — an all-or-nothing removal, same spirit as a real inventory
  // ("you need 3 wood to build this, you only have 2" shouldn't silently
  // take the 2 you have and leave you thinking the craft succeeded).
  // Deletes the key entirely once a count hits zero, rather than leaving
  // a lingering `0` around — keeps getAllItems clean for any caller that
  // just wants "what do I actually have."
  function removeItem(id, qty = 1) {
    const current = playerItems[id] || 0;
    if (current < qty) return false;
    const next = current - qty;
    if (next <= 0) delete playerItems[id];
    else playerItems[id] = next;
    return true;
  }

  function getItemCount(id) {
    return playerItems[id] || 0;
  }

  function getAllItems() {
    return { ...playerItems }; // shallow copy — same pattern as getPlayerAttachments/getAbilities, callers can't mutate the master store by reference
  }

  // ---- ROOM-RELATIVE ASSET PATHS ---------------------------------------------
  // AUDIT FIX (post-Step-9): a room-data.js file can now write manifest
  // paths relative to ITS OWN folder (e.g. 'assets/foo.png'), instead of
  // relative to world/index.html (e.g. 'rooms/test-room/assets/foo.png').
  // The old requirement broke room portability — renaming/moving a room
  // folder, or reusing one in a different game, meant hand-editing every
  // asset path inside it. The room manager already knows a room's own
  // base folder the instant it starts loading that room
  // (roomsBasePath + roomId + '/'), so it can resolve this automatically.
  //
  // A path is left UNTOUCHED if it's already absolute — has its own URI
  // scheme (http:, https:, data:, blob:, ...) or starts with '/' — so an
  // asset intentionally hosted elsewhere still works exactly as before.
  function isAbsoluteAssetPath(path) {
    return /^([a-z][a-z0-9+.-]*:)/i.test(path) || path.startsWith('/');
  }

  // Collapses '..'/'.' segments in a combined relative path (e.g.
  // 'rooms/room-two/../test-room/assets/foo.png' -> the same canonical
  // string test-room's OWN direct resolution produces:
  // 'rooms/test-room/assets/foo.png'). This matters beyond tidiness — the
  // shared image cache (roomImageCache) is keyed by this exact string, so
  // two rooms referencing the SAME underlying file need to resolve to the
  // IDENTICAL string or the cache silently stops recognizing them as the
  // same image and reloads it a second time.
  function normalizeAssetPath(path) {
    const stack = [];
    path.split('/').forEach(part => {
      if (part === '' || part === '.') return;
      if (part === '..') { stack.pop(); return; }
      stack.push(part);
    });
    return stack.join('/');
  }

  function resolveRoomManifest(roomId, manifest) {
    const resolved = {};
    Object.keys(manifest).forEach(key => {
      const path = manifest[key];
      resolved[key] = isAbsoluteAssetPath(path)
        ? path
        : normalizeAssetPath(`${roomsBasePath}${roomId}/${path}`);
    });
    return resolved;
  }

  // A room-data.js file calls this once, at the top level, when it loads.
  function registerRoom(name, buildFn) {
    roomRegistry[name] = buildFn;
  }

  // Call once, at page setup, before the first loadRoom(). Returns the fade
  // overlay it created, in case the page wants it for anything else (it
  // usually won't need to — loadRoom drives the overlay itself).
  //   opts.roomsBasePath — folder room-data.js files live under, relative to
  //                        the page (default 'rooms/')
  //   opts.version       — cache-busting ?v= suffix for room-data.js
  //                        fetches, same idea as the old manual ?v=14 on
  //                        script tags — bump it when a room-data.js file's
  //                        CONTENT changes (default 1)
  //   opts.onRoomReady   — callback(room, images, roomName), fired after a
  //                        new room's data is built and its images are
  //                        loaded, but BEFORE the fade-in — this is where
  //                        the page swaps in the new ROOM/images it renders
  //                        from each frame
  function initRoomManager(opts = {}) {
    roomsBasePath = opts.roomsBasePath || 'rooms/';
    roomScriptVersion = opts.version || 1;
    onRoomReadyCallback = opts.onRoomReady || null;
    roomFadeOverlay = createFadeOverlay();
    return roomFadeOverlay;
  }

  function loadRoomScript(name) {
    if (loadedRoomScripts.has(name)) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `${roomsBasePath}${name}/room-data.js?v=${roomScriptVersion}`;
      script.onload = () => { loadedRoomScripts.add(name); resolve(); };
      script.onerror = () => reject(new Error(`Engine.loadRoom: couldn't load script for room "${name}" (checked ${script.src})`));
      document.body.appendChild(script);
    });
  }

  function loadRoomImages(manifest) {
    const keys = Object.keys(manifest);
    const images = {};
    const promises = keys.map(key => {
      const src = manifest[key];
      const cached = roomImageCache[src];
      if (cached) { images[key] = cached; return Promise.resolve(); }
      return new Promise(resolve => {
        const img = new Image();
        img.onload  = () => { const entry = { img, ok: true };  roomImageCache[src] = entry; images[key] = entry; resolve(); };
        img.onerror = () => { const entry = { img: null, ok: false }; roomImageCache[src] = entry; images[key] = entry; resolve(); };
        img.src = src;
      });
    });
    return Promise.all(promises).then(() => images);
  }

  // The generic replacement for the old "warp -> fade out -> navigate to a
  // new page -> that page boots black -> fade in" flow. Same FEEL (fade to
  // black, swap, fade back in), no page reload. On the very first call
  // (nothing loaded yet) there's nothing on screen to fade out from, so
  // that half is skipped — the overlay already boots fully opaque.
  function loadRoom(roomId, targetCol, targetRow, spawnFacing) {
    const isFirstLoad = currentRoom === null;
    const doFadeOut = isFirstLoad ? Promise.resolve() : roomFadeOverlay.fadeOut(300);

    return doFadeOut
      .then(() => loadRoomScript(roomId))
      .then(() => {
        const buildFn = roomRegistry[roomId];
        if (!buildFn) throw new Error(`Engine.loadRoom: room "${roomId}" was never registered — check that its room-data.js calls Engine.registerRoom("${roomId}", ...)`);
        const room = buildFn(targetCol, targetRow, spawnFacing);
        currentRoom = room;
        currentRoomName = roomId;
        // AUDIT FIX: resolve this room's manifest paths from
        // room-relative to page-relative BEFORE anything downstream reads
        // them — loadRoomImages (below) and the shared roomImageCache
        // both expect fully-resolved paths.
        room.manifest = resolveRoomManifest(roomId, room.manifest);
        // STEP 8B: re-apply anything persisted from an earlier visit to
        // this same room, BEFORE images load / onRoomReady fires — so the
        // very first frame the page ever draws already shows the
        // persisted state, not a flash of the default room first.
        applyPersistedTileState(roomId, room);
        // STEP 8D: overwrite the freshly-built player's empty default
        // abilities with whatever's actually been granted this session —
        // without this, a granted ability silently disappears the moment
        // the player leaves and re-enters any room.
        if (room.player) room.player.abilities = playerAbilities.slice();
        return loadRoomImages(room.manifest);
      })
      .then(images => {
        if (onRoomReadyCallback) onRoomReadyCallback(currentRoom, images, currentRoomName);
        return roomFadeOverlay.fadeIn(300);
      });
  }

  function getCurrentRoomName() { return currentRoomName; }

  // ---- CROSS-SESSION SAVE / LOAD (generic serialization mechanism) ----------
  // Not a numbered roadmap step — Step 12 turned out to be Inventory, and
  // this is the "genuinely new piece of work" the persistence-model note
  // flagged as still open. Bundles/restores the SAME six RAM stores
  // already in scope in this closure (playerItems, playerAbilities,
  // playerAttachments, worldFlags, roomTileState, roomEntityState), plus
  // the two bits of "where was the player" state that live outside those
  // stores: currentRoomName and the current room's player actor's
  // position/facing.
  //
  // engine.js owns ONLY the generic bundle-into-JSON / restore-from-JSON /
  // read-and-write-localStorage mechanism here. It has zero opinion about
  // WHEN to save (on warp? on a timer? on bed interaction?), how many save
  // slots exist, or what to show the player when a save happens/fails —
  // all of that is index.html's call, per the Boundary Sentinel.

  function exportSaveState() {
    const player = currentRoom && currentRoom.player;
    return {
      playerItems: { ...playerItems },
      playerAbilities: playerAbilities.slice(),
      playerAttachments: { ...playerAttachments },
      worldFlags: { ...worldFlags },
      // roomTileState/roomEntityState are NESTED (room -> ... -> patch), so
      // a shallow copy wouldn't actually detach this snapshot from the
      // live store — a later setTile/setEntityState call could silently
      // mutate an already-exported save object through a shared inner
      // reference. Everything in both stores is already plain JSON-safe
      // data (strings/numbers/booleans/plain objects) by construction, so
      // a JSON round-trip is a simple, correct deep clone.
      roomTileState: JSON.parse(JSON.stringify(roomTileState)),
      roomEntityState: JSON.parse(JSON.stringify(roomEntityState)),
      currentRoomName,
      playerPosition: player ? { c: player.x, r: player.y, facing: player.facing } : null
    };
  }

  // Copies only the OWN enumerable keys of `source` onto `target`, for
  // restoring a store in place — several of these closure variables are
  // declared const, so the variable itself can never be reassigned to a
  // brand new object from outside; only its contents can change.
  //
  // The `__proto__` skip is the actual prototype-pollution guard: a JSON
  // blob can legally contain a literal "__proto__" key (JSON.parse itself
  // does nothing unsafe with it), but a later plain bracket-notation
  // assignment like `target[key] = value` WOULD reach through the
  // Object.prototype accessor and reassign target's real prototype if key
  // happened to be "__proto__". Every other key is ordinary data and safe
  // to copy through as-is.
  function copyOwnKeysInto(target, source) {
    if (!source || typeof source !== 'object' || Array.isArray(source)) return;
    Object.keys(source).forEach(key => {
      if (key === '__proto__') return;
      target[key] = source[key];
    });
  }

  function clearOwnKeys(target) {
    Object.keys(target).forEach(key => delete target[key]);
  }

  // Restores all six RAM stores from a previously-exported (or freshly
  // parsed straight out of localStorage) save object. Returns false and
  // changes NOTHING if saveData isn't a recognizable save object at all —
  // callers can check that before deciding what to do next. On success,
  // returns { currentRoomName, playerPosition } as plain data for the
  // CALLER to act on (e.g. by calling Engine.loadRoom(...) itself) —
  // engine.js restoring its own six stores is a different concern from
  // index.html deciding to warp the player there, per the Boundary
  // Sentinel note above this whole section.
  function importSaveState(saveData) {
    if (!saveData || typeof saveData !== 'object' || Array.isArray(saveData)) {
      return false;
    }

    clearOwnKeys(playerItems);
    copyOwnKeysInto(playerItems, saveData.playerItems);

    playerAbilities.length = 0; // empty the array in place, same "can't reassign from outside" reasoning as the object stores above
    if (Array.isArray(saveData.playerAbilities)) {
      saveData.playerAbilities.forEach(name => { if (typeof name === 'string') playerAbilities.push(name); });
    }

    clearOwnKeys(playerAttachments);
    copyOwnKeysInto(playerAttachments, saveData.playerAttachments);

    clearOwnKeys(worldFlags);
    copyOwnKeysInto(worldFlags, saveData.worldFlags);

    clearOwnKeys(roomTileState);
    copyOwnKeysInto(roomTileState, saveData.roomTileState);

    clearOwnKeys(roomEntityState);
    copyOwnKeysInto(roomEntityState, saveData.roomEntityState);

    return {
      currentRoomName: typeof saveData.currentRoomName === 'string' ? saveData.currentRoomName : null,
      playerPosition: (saveData.playerPosition && typeof saveData.playerPosition === 'object' && !Array.isArray(saveData.playerPosition))
        ? saveData.playerPosition
        : null
    };
  }

  // ---- localStorage WRAPPERS --------------------------------------------------
  // Thin on purpose — stringify/parse plus a try/catch around the actual
  // localStorage call. Storage can legitimately fail (disabled by the
  // browser/user, quota exceeded, private-browsing restrictions) and none
  // of that should ever crash the page. These fail QUIETLY, returning
  // false/null rather than throwing — whether that's worth telling the
  // player about is index.html's call, not engine.js's.
  function saveToStorage(slotKey) {
    try {
      localStorage.setItem(slotKey, JSON.stringify(exportSaveState()));
      return true;
    } catch (err) {
      return false;
    }
  }

  // Returns null for "no save under this slot" (a normal, expected case —
  // e.g. first-ever boot) AND for "storage access or parsing failed" alike
  // — either way there's nothing usable to hydrate from. Returns false
  // (distinct from null) only if a slot WAS found but its contents don't
  // look like a save object at all — see importSaveState above.
  function loadFromStorage(slotKey) {
    try {
      const raw = localStorage.getItem(slotKey);
      if (raw === null) return null;
      return importSaveState(JSON.parse(raw));
    } catch (err) {
      return null;
    }
  }

  function clearStorage(slotKey) {
    try {
      localStorage.removeItem(slotKey);
      return true;
    } catch (err) {
      return false;
    }
  }

  // ---- INPUT (keyboard + on-screen buttons, mobile-first) -------------------
  // Returns a small controller object: heldDir is the currently-pressed
  // direction (or null), read by the movement update each frame. Works for
  // any room — the room never wires its own key listeners.
  function createDirectionalInput() {
    let heldDir = null;
    let lastTouchTime = 0;
    // SLIDE FIX: iOS/Android Safari only ever fires touchstart on the
    // element a touch actually BEGAN on — sliding that same finger onto a
    // neighboring button fires touchmove on the ORIGINAL element, never
    // touchstart on the new one. Without tracking which touch is currently
    // "driving" and re-resolving its position on every move (below), a
    // direction change requires fully lifting and re-pressing, which is
    // exactly the lag this fixes.
    let activeTouchId = null;
    const buttons = []; // every wireButton call registers itself here: {el, dx, dy}
    function setDir(dx, dy) { heldDir = { x: dx, y: dy }; }
    function clearDir() { heldDir = null; }

    // KEY-SWAP FIX: same idea as the touch slide-fix above, for keyboard —
    // a single keyup listener that unconditionally clears direction means
    // releasing Right after switching to Down (while Right was still held)
    // wipes out Down's still-active movement too, not just Right's. Track
    // every currently-held direction key as a stack (most recently pressed
    // last); on release, fall back to whichever direction key (if any) is
    // still actually held, rather than clearing outright.
    const KEY_DIRS = {
      ArrowUp: { x: 0, y: -1 }, w: { x: 0, y: -1 },
      ArrowDown: { x: 0, y: 1 }, s: { x: 0, y: 1 },
      ArrowLeft: { x: -1, y: 0 }, a: { x: -1, y: 0 },
      ArrowRight: { x: 1, y: 0 }, d: { x: 1, y: 0 }
    };
    let heldKeys = []; // stack of key names, most-recently-pressed last

    window.addEventListener('keydown', e => {
      if (e.repeat) return;
      const dir = KEY_DIRS[e.key];
      if (!dir) return;
      heldKeys = heldKeys.filter(k => k !== e.key);
      heldKeys.push(e.key);
      setDir(dir.x, dir.y);
    });
    window.addEventListener('keyup', e => {
      if (!(e.key in KEY_DIRS)) return;
      heldKeys = heldKeys.filter(k => k !== e.key);
      if (heldKeys.length === 0) {
        clearDir();
      } else {
        const stillHeld = KEY_DIRS[heldKeys[heldKeys.length - 1]];
        setDir(stillHeld.x, stillHeld.y);
      }
    });

    // Resolves a touch's current screen position to whichever registered
    // dpad button (if any) it's physically over right now.
    function buttonAtPoint(x, y) {
      const el = document.elementFromPoint(x, y);
      if (!el) return null;
      return buttons.find(b => b.el === el || b.el.contains(el)) || null;
    }

    function wireButton(id, dx, dy) {
      const el = document.getElementById(id);
      if (!el) return;
      buttons.push({ el, dx, dy });

      el.addEventListener('touchstart', e => {
        e.preventDefault();
        lastTouchTime = Date.now();
        activeTouchId = e.changedTouches[0].identifier;
        setDir(dx, dy);
      }, { passive: false });
      el.addEventListener('touchend', e => {
        e.preventDefault();
        lastTouchTime = Date.now();
        // Only clear if THIS is the touch currently driving movement — a
        // second finger tapping and releasing a different button shouldn't
        // be able to cancel the first finger's still-held direction.
        const touch = e.changedTouches[0];
        if (touch.identifier === activeTouchId) { activeTouchId = null; clearDir(); }
      }, { passive: false });
      // Mobile Safari can fire a synthetic "ghost" mousedown/mouseup shortly
      // after a real touch sequence, as a compatibility fallback — and a
      // touch sequence interrupted mid-press by a page navigation (exactly
      // what a warp does if you're still holding the button when it fires)
      // makes this more likely, not less. Ignoring mouse events for a short
      // window after any real touch event stops a ghost click from being
      // read as a fresh press the instant a finger lifts.
      el.addEventListener('mousedown', () => { if (Date.now() - lastTouchTime > 500) setDir(dx, dy); });
      el.addEventListener('mouseup',   () => { if (Date.now() - lastTouchTime > 500) clearDir(); });
    }

    // SLIDE FIX (continued): re-resolves the actively-controlling touch's
    // direction on every move, and clears it the instant that finger slides
    // off every button entirely — not just off the one it started on. One
    // shared listener for all dpad buttons, since the slide can cross
    // between any of them.
    window.addEventListener('touchmove', e => {
      for (const touch of e.changedTouches) {
        if (touch.identifier !== activeTouchId) continue;
        const hit = buttonAtPoint(touch.clientX, touch.clientY);
        if (hit) setDir(hit.dx, hit.dy);
        else clearDir();
      }
    }, { passive: true });
    window.addEventListener('touchcancel', e => {
      for (const touch of e.changedTouches) {
        if (touch.identifier === activeTouchId) { activeTouchId = null; clearDir(); }
      }
    });

    return {
      getDir: () => heldDir,
      wireButton
    };
  }

  // ---- INPUT GATE (fixed lockout window after creation) --------------------
  // Wraps a directional-input controller so ALL input is ignored for a
  // fixed window (default 400ms) after this gate is created — e.g. right
  // after a warp's page navigation lands on a new room. Same {getDir()}
  // shape as createDirectionalInput, so it's a drop-in substitute anywhere
  // input is read.
  //
  // This is deliberately time-based rather than "wait for a release" —
  // whether a touch/click that started on the PREVIOUS page still reads as
  // "held" on the new page (after a real navigation, not a soft transition)
  // is inconsistent across browsers and not something client-side JS can
  // detect reliably; chasing a perfect release-detection heuristic kept
  // surfacing new edge cases. A flat lockout sidesteps that entirely, and
  // 400ms roughly matches the fade-in (300ms) finishing, so in practice you
  // can't act again until the screen has basically finished appearing —
  // which is how this kind of transition usually feels anyway. The one
  // honest tradeoff: holding a direction through the ENTIRE lockout window
  // without ever releasing will resume movement on its own once it expires
  // — true "must physically release" isn't guaranteed in that one edge
  // case, only for any hold that lets go at some point during or shortly
  // after the transition.
  // STEP 7 ADDITION: reset(). Originally this gate only ever needed ONE
  // lockout window, set at creation — back when every room was its own
  // page, a warp forced a full page reload, which naturally created a
  // brand new gate (and thus a fresh lockout) for free. Step 7 turned this
  // into one long-lived page, so nothing recreates the gate on a room
  // swap anymore — without reset(), the lockout would only ever apply once,
  // near the very start of the session, and every warp after that would
  // have zero protection against a held button carrying straight through.
  // reset() lets the page ask for a fresh lockout window on demand — call
  // it once per room swap (see Engine.loadRoom's onRoomReady callback).
  // AUDIT FIX (post-Step-9): reset()'s fixed timed window is right for a
  // FAST, BOUNDED operation ("just landed, ignore whatever's still held
  // for a beat") — it was never meant to cover a VARIABLE-LENGTH one. A
  // room load's actual duration depends on network speed and whether its
  // script/images are already cached — anywhere from a few milliseconds
  // to well over a second on a slow connection loading a room for the
  // first time. A fixed 400ms timeout can silently expire WHILE a room is
  // still loading, letting movement input process against the OLD room
  // for however long is left before the new one actually lands.
  //
  // lock()/unlock() are the fix: an unconditional, untimed block a caller
  // engages for the FULL duration of an operation it controls the start
  // and end of — call lock() the instant a room load begins, unlock()
  // only once that load has completely finished. getDir() now checks
  // BOTH the hard lock and the timed window; either one blocks input.
  function createInputGate(input, lockoutMs = 400) {
    let locked = false;
    let unlockAt = performance.now() + lockoutMs;
    return {
      getDir: () => {
        if (locked) return null;
        if (performance.now() < unlockAt) return null;
        return input.getDir();
      },
      lock: () => { locked = true; },
      unlock: () => { locked = false; },
      reset: () => { unlockAt = performance.now() + lockoutMs; }
    };
  }

  // ---- STATE STACK (generic input-context router) ---------------------------
  // STEP 10, piece 1. engine.js has no idea what a "state" IS beyond a name
  // a page chose plus whatever data/handlers it attached to that name —
  // same split as room-data.js. This exists because a real game needs more
  // than one thing competing for "what does an ACT press or a dpad hold
  // mean right now" (the world, a dialogue box, a menu, a minigame), and
  // something has to own deciding which one is currently in charge, in a
  // way that nests N levels deep (open a menu FROM a dialogue box) and
  // cleanly returns to wherever it was.
  //
  // A stack, not a single "current mode" variable, because returning from
  // a nested context needs to land back on whatever was open before it —
  // a submenu closes back to its parent menu, not straight to gameplay.
  //
  // engine.js provides ONLY the mechanism: push a named state (with
  // optional per-state onEnter/onExit/onUpdate handlers a page supplies),
  // pop it back off, and ask what's currently on top. It assigns NO
  // meaning to any state's name — 'world', 'dialogue', 'pause', anything a
  // project invents, all look identical here, the exact same split as room
  // names in the room registry. In particular: deciding WHICH named
  // state(s) should pause world movement/input is a page-level decision (a
  // page's own per-frame loop only runs its world-update logic from
  // whichever state's onUpdate handler it wired that logic into), never
  // engine.js's — an engine that hardcoded "a state named 'world' means
  // run movement" would be exactly the kind of game-specific policy baked
  // into the core the Boundary Sentinel exists to keep out.
  //
  // A page creates ONE of these near boot (same pattern as
  // createDirectionalInput/createInputGate — a per-page instance, not an
  // Engine-wide global, since unlike the room manager there's nothing
  // inherently singular about "a stack of input contexts" that deserves
  // living inside Engine's own module state).
  function createStateStack() {
    const stack = [];

    // handlers is optional: { onEnter(data), onExit(data), onUpdate(now, dt, data) }
    // — a page only supplies whichever of the three it actually needs.
    // onEnter fires synchronously the instant push() runs (so a caller can
    // rely on the state already being set up before push() returns);
    // onExit fires synchronously the instant pop() removes it. Neither
    // fires on any other schedule.
    function push(name, data, handlers) {
      const state = { name, data: data || {}, handlers: handlers || {} };
      stack.push(state);
      if (state.handlers.onEnter) state.handlers.onEnter(state.data);
      return state;
    }

    // Pops and returns the removed state (or null if the stack was
    // already empty — safe to call speculatively, e.g. an ACT press that
    // means "close whatever's open, if anything is").
    function pop() {
      const state = stack.pop();
      if (!state) return null;
      if (state.handlers.onExit) state.handlers.onExit(state.data);
      return state;
    }

    // The state currently "in charge" — whatever a page's own loop should
    // check before deciding whose input/update logic runs this frame.
    // null when the stack is empty (a page that always keeps at least a
    // base state pushed will never actually see this).
    function peek() {
      return stack.length ? stack[stack.length - 1] : null;
    }

    // A shallow copy of the full stack, bottom to top — for a page that
    // wants to render more than just the top (e.g. a paused world still
    // visible behind a menu). A copy, not the live array, so a caller
    // can't corrupt the router's own bookkeeping by mutating what this
    // returns.
    function getStack() {
      return stack.slice();
    }

    // True if a state with this name is ANYWHERE in the stack, not just
    // on top — useful for "is dialogue open at all right now" regardless
    // of whether something's nested on top of it.
    function isActive(name) {
      return stack.some(s => s.name === name);
    }

    // Call once per frame from the page's main loop. Dispatches to ONLY
    // the top state's onUpdate, if it defined one — states further down
    // the stack are paused by construction (that's the entire point of
    // this router), so they never get an update call while something
    // sits on top of them.
    function update(now, dt) {
      const top = peek();
      if (top && top.handlers.onUpdate) top.handlers.onUpdate(now, dt, top.data);
    }

    // Pops everything down to empty, firing each state's onExit on the
    // way out — for a hard reset (e.g. a debug "force back to world"
    // escape hatch) rather than popping one at a time.
    function clear() {
      while (stack.length) pop();
    }

    return { push, pop, peek, getStack, isActive, update, clear };
  }

  // ---- BLOCKING EVENT QUEUE (generic sequenced-event runner) ----------------
  // STEP 10, piece 2. The other half of "state-stack router + blocking
  // event queue" from the roadmap. A separate primitive from the state
  // stack above, on purpose: a state answers "what context is currently in
  // charge" (a single, possibly long-lived mode); an event queue answers
  // "run these specific things ONE AT A TIME, each waiting for the last to
  // say it's finished" (a short-lived sequence WITHIN whatever context is
  // current) — e.g. three dialogue lines in a row, each waiting for a tap
  // before the next appears. They're meant to be used TOGETHER (push a
  // 'dialogue' state, enqueue one event per line, pop the state once the
  // queue drains) but engine.js doesn't wire that connection itself — same
  // split as everywhere else: a page decides how its own named states
  // relate to its own queued events.
  //
  // An event is just { start(done) } — engine.js has no idea what
  // "start" DOES (show a line of text, play a sound, wait for a
  // keypress, run a timer), only that calling it begins the event, and
  // the event is considered finished the instant its own start() function
  // calls the done() callback it was handed. This mirrors
  // createFadeOverlay's promise-based fadeIn/fadeOut in spirit (both are
  // "tell me when this finishes") but uses a plain callback rather than a
  // Promise on purpose — a dialogue line's real "finish" condition is
  // often an input event (a tap) with no natural Promise to attach to, and
  // a callback-based contract doesn't require a page to wrap that in a
  // Promise just to satisfy this queue.
  function createEventQueue() {
    let queue = [];
    let active = null;

    function advance() {
      if (queue.length === 0) { active = null; return; }
      active = queue.shift();
      active.start(() => advance());
    }

    // Adds one event to the end of the line. If nothing is currently
    // running, starts it immediately; otherwise it waits its turn. A
    // caller wanting a whole sequence just calls this once per event, in
    // order — no separate "enqueue many" needed, since this already
    // preserves call order.
    function enqueue(event) {
      queue.push(event);
      if (!active) advance();
    }

    // True while any event is running OR still waiting its turn — the
    // flag a page's own onUpdate handler (or its main loop directly)
    // checks to know whether it should still be treating input/world
    // updates as blocked.
    function isBlocking() {
      return active !== null;
    }

    // How many events are still waiting (not counting whichever one is
    // currently active) — mostly a debug/inspection aid.
    function pending() {
      return queue.length;
    }

    // Hard-cancels everything queued AND whatever's currently active,
    // firing no callbacks — for abandoning a sequence early (e.g. the
    // player mashes a "skip cutscene" button). A cancelled active event's
    // own done() is deliberately never called, since the whole point is
    // abandoning it, not pretending it finished normally.
    function clear() {
      queue = [];
      active = null;
    }

    return { enqueue, isBlocking, pending, clear };
  }

  // ---- GRID MOVEMENT (grid-locked, tweened — Pokémon-style one-tile steps) --
  // Creates a movable actor at a starting tile. Same shape needed by
  // renderSprite (x, y, sx, sy, sheet, hTiles) plus movement-tracking
  // fields. Any future NPC that should walk around uses this same function.
  // animFrame/animTimer are generic animation-state fields — harmless/unused
  // for any actor whose spriteFields don't include a walkFrames table.
  function createGridActor(startC, startR, spriteFields) {
    return {
      x: startC, y: startR,
      targetX: startC, targetY: startR,
      moving: false, moveStart: 0,
      facing: 'down',
      animFrame: 0,
      abilities: [], // STEP 8: generic flag list for ability-gated tiles — empty by default, a room/page can push/splice strings into this at runtime
      lastGateBlock: null, // STEP 8: set by updateGridActor when a move is blocked specifically by an ability gate (see isSolid/getGateAt)
      ...spriteFields
    };
  }

  // Call once per frame. Starts a new tile-step if a direction is held and
  // the actor isn't already mid-step; advances the tween; updates
  // actor.renderX/renderY for renderSprite to read. moveMs controls how
  // long one tile-step takes (lower = snappier).
  //
  // ANIMATION: if the actor has a walkFrames table, this also advances
  // actor.animFrame while moving (cycling through that direction's frame
  // list on a timer, actor.frameMs or a 120ms default) and resets it to 0
  // (the direction's standing/idle pose) the instant the actor stops. This
  // is generic timing logic only — it has no idea how many frames a
  // direction has or what they look like, it just cycles through whatever
  // list the room handed it.
  function updateGridActor(actor, input, room, moveMs, now, customSolidFn) {
    const dir = input.getDir();

    if (!actor.moving && dir && (dir.x !== 0 || dir.y !== 0)) {
      actor.facing = dir.x === -1 ? 'left' : dir.x === 1 ? 'right' : dir.y === -1 ? 'up' : 'down';
      const nextC = actor.x + dir.x;
      const nextR = actor.y + dir.y;

      // STEP 8: figure out BEFORE the isSolid check whether the specific
      // reason (if any) this step gets blocked is an ability gate — a
      // plain wall bump needs no explanation (the wall is visibly right
      // there), but a gated tile looks like ordinary floor, so the page
      // needs some way to tell the player WHY they didn't move. Set to
      // null on every attempt so a page reading this doesn't act on a
      // stale value from several bumps ago.
      const gate = getGateAt(room, nextC, nextR);
      const abilities = actor.abilities || [];
      actor.lastGateBlock = (gate && !abilities.includes(gate.requires)) ? gate.requires : null;

      if (!isSolid(room, nextC, nextR, actor, customSolidFn)) {
        actor.targetX = nextC;
        actor.targetY = nextR;
        actor.moving = true;
        actor.moveStart = now;
      }
      // solid: face the direction but don't move — classic Pokémon "bump"
    }

    if (actor.moving) {
      const t = Math.min(1, (now - actor.moveStart) / moveMs);
      actor.renderX = actor.x + (actor.targetX - actor.x) * t;
      actor.renderY = actor.y + (actor.targetY - actor.y) * t;
      if (t >= 1) {
        actor.x = actor.targetX;
        actor.y = actor.targetY;
        actor.moving = false;
        actor.renderX = actor.x;
        actor.renderY = actor.y;
      }
    } else {
      actor.renderX = actor.x;
      actor.renderY = actor.y;
    }

    if (actor.walkFrames) {
      const dirFrames = actor.walkFrames[actor.facing];
      if (actor.moving && dirFrames) {
        const frameMs = actor.frameMs || 120;
        actor.animFrame = Math.floor(now / frameMs) % dirFrames.frames.length;
      } else {
        actor.animFrame = 0; // standing pose = first frame of the current facing
      }
    }
  }

  // ---- FREE MOVEMENT (smooth, non-grid — added for Space Truckers ports) ------
  // The smooth-movement counterpart to createGridActor/updateGridActor above.
  // Instead of snapping one whole tile per step, an actor glides any
  // distance per frame, and still can't pass through anything isSolid()
  // says is solid (walls, room edges, unmet ability gates, or whatever a
  // caller's customSolidFn adds). Works on the SAME actor objects
  // createGridActor makes, so renderSprite / renderWallsAndEntities /
  // computeCamera / getWarpAt / checkOverlapTriggers all keep working
  // unchanged — a room can use grid movement, free movement, or both.
  //
  // Same Boundary Sentinel split as everything else: this only knows boxes,
  // tiles, and distances. What moves, how fast, and why (a player, an enemy,
  // a thrown object) is entirely the caller's decision.
  //
  // UNITS: tile units, like the rest of the room API. actor.renderX/renderY
  // is the top-left of the actor's 1x1 tile cell (exactly what renderSprite
  // already draws from), and may be fractional.
  //
  // HITBOX: the part of that cell that actually collides, in tile units,
  // centered left-to-right and sitting at the BOTTOM of the cell — the
  // "feet" area, so a character's head can overlap a wall's lower edge the
  // way top-down games usually allow. Set actor.hitbox = { w, h } to change
  // it; defaults to 0.8 x 0.8.
  const DEFAULT_FREE_HITBOX = { w: 0.8, h: 0.8 };

  // The actor's collision box right now, as {left, top, right, bottom} in
  // tile units. Handy for any caller doing its own box-vs-box checks (two
  // actors touching, a projectile hitting something) — pure geometry.
  function getActorHitbox(actor) {
    const hb = actor.hitbox || DEFAULT_FREE_HITBOX;
    const gx = actor.renderX !== undefined ? actor.renderX : actor.x;
    const gy = actor.renderY !== undefined ? actor.renderY : actor.y;
    const left = gx + (1 - hb.w) / 2;
    const top = gy + 1 - hb.h;
    return { left, top, right: left + hb.w, bottom: top + hb.h };
  }

  // True if a box (tile units) overlaps any tile isSolid() reports as solid.
  function boxHitsSolid(room, actor, left, top, right, bottom, customSolidFn) {
    const eps = 1e-6;
    for (let r = Math.floor(top); r <= Math.floor(bottom - eps); r++) {
      for (let c = Math.floor(left); c <= Math.floor(right - eps); c++) {
        if (isSolid(room, c, r, actor, customSolidFn)) return true;
      }
    }
    return false;
  }

  // Moves an actor by (dx, dy) tile units, stopping flush against anything
  // solid and sliding along it (X and Y are resolved separately, so
  // running diagonally into a wall keeps you moving along the wall instead
  // of sticking). Long moves are split into small sub-steps so a fast
  // mover can't skip through a thin wall in one frame.
  //
  // Also keeps the grid-style fields other engine functions read in sync:
  //   - actor.x / actor.y  -> the tile under the hitbox's center (so warps,
  //                           overlap triggers, getFacingTile still work)
  //   - actor.facing       -> the direction moved furthest this call
  //   - actor.moving       -> whether it actually moved this call
  //   - actor.animFrame    -> walk animation, same rules as updateGridActor,
  //                           if the actor has a walkFrames table
  // Also sets actor.blockedX / actor.blockedY for this call, so a caller can
  // react to bumping into something if it wants to.
  //
  // `now` is the frame timestamp in ms (only used for walk animation timing).
  // Returns true if the actor moved at all.
  function moveFreeActor(actor, room, dx, dy, now, customSolidFn) {
    if (actor.renderX === undefined) actor.renderX = actor.x;
    if (actor.renderY === undefined) actor.renderY = actor.y;
    const hb = actor.hitbox || DEFAULT_FREE_HITBOX;
    const offX = (1 - hb.w) / 2;
    const offY = 1 - hb.h;
    const nudge = 1e-4; // keeps a flush edge from counting as "inside" the wall next frame

    actor.blockedX = false;
    actor.blockedY = false;
    let moved = false;

    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 0.25));
    const sx = dx / steps, sy = dy / steps;

    for (let i = 0; i < steps; i++) {
      if (sx !== 0 && !actor.blockedX) {
        const nx = actor.renderX + sx;
        const left = nx + offX, top = actor.renderY + offY;
        if (!boxHitsSolid(room, actor, left, top, left + hb.w, top + hb.h, customSolidFn)) {
          actor.renderX = nx; moved = true;
        } else {
          // Slide right up to the edge of the tile that blocked us.
          const flushX = sx > 0
            ? Math.floor(left + hb.w) - hb.w - offX - nudge
            : Math.floor(left) + 1 - offX + nudge;
          if ((sx > 0 && flushX > actor.renderX) || (sx < 0 && flushX < actor.renderX)) { actor.renderX = flushX; moved = true; }
          actor.blockedX = true;
        }
      }
      if (sy !== 0 && !actor.blockedY) {
        const ny = actor.renderY + sy;
        const left = actor.renderX + offX, top = ny + offY;
        if (!boxHitsSolid(room, actor, left, top, left + hb.w, top + hb.h, customSolidFn)) {
          actor.renderY = ny; moved = true;
        } else {
          const flushY = sy > 0
            ? Math.floor(top + hb.h) - hb.h - offY - nudge
            : Math.floor(top) + 1 - offY + nudge;
          if ((sy > 0 && flushY > actor.renderY) || (sy < 0 && flushY < actor.renderY)) { actor.renderY = flushY; moved = true; }
          actor.blockedY = true;
        }
      }
    }

    if (dx !== 0 || dy !== 0) {
      actor.facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    }
    actor.moving = moved;

    const box = getActorHitbox(actor);
    actor.x = Math.floor((box.left + box.right) / 2);
    actor.y = Math.floor((box.top + box.bottom) / 2);
    actor.targetX = actor.x;
    actor.targetY = actor.y;

    if (actor.walkFrames) {
      const dirFrames = actor.walkFrames[actor.facing];
      actor.animFrame = (moved && dirFrames) ? Math.floor(now / (actor.frameMs || 120)) % dirFrames.frames.length : 0;
    }
    return moved;
  }

  // ---- PATHFINDING (distance map + line of sight — added for Space Truckers) ---
  // Generic "how do I get there around the walls" tools. Same Boundary
  // Sentinel split as everything else: these only know tiles, solidity and
  // distances. WHO follows a path and WHY (an enemy chasing, an NPC walking
  // home, a pet following) is entirely the caller's decision.

  // Builds a map of how many steps every walkable tile is from one goal
  // tile, flooding outward around anything isSolid() says is solid. Moves
  // can be diagonal, but never cut a wall corner (a diagonal step is only
  // allowed when both tiles beside it are open too).
  //
  // Returns { goalC, goalR, dist, getNextStep(c, r) }:
  //   dist[r][c]        — steps from that tile to the goal (Infinity = can't get there)
  //   getNextStep(c, r) — the neighbouring tile {c, r} one step closer to the
  //                       goal, or null (already there, or no way through)
  //
  // One map serves any number of followers heading to the same goal, so a
  // caller only needs to rebuild it when the goal tile changes.
  // actor/customSolidFn are passed straight through to isSolid (so ability
  // gates and extra blockers work exactly as they do for movement).
  const PATH_DIRS = [
    [1, 0], [-1, 0], [0, 1], [0, -1],
    [1, 1], [1, -1], [-1, 1], [-1, -1]
  ];

  function buildDistanceMap(room, goalC, goalR, actor, customSolidFn) {
    const cols = room.cols, rows = room.rows;
    const dist = [];
    for (let r = 0; r < rows; r++) dist.push(new Array(cols).fill(Infinity));
    const open = (c, r) => c >= 0 && r >= 0 && c < cols && r < rows && !isSolid(room, c, r, actor, customSolidFn);
    // A move from (c, r) by (dc, dr) is allowed if the target is open and,
    // for a diagonal, both tiles it squeezes past are open too.
    const canStep = (c, r, dc, dr) => open(c + dc, r + dr) && (dc === 0 || dr === 0 || (open(c + dc, r) && open(c, r + dr)));

    if (goalC >= 0 && goalR >= 0 && goalC < cols && goalR < rows) {
      dist[goalR][goalC] = 0;
      const queue = [[goalC, goalR]];
      for (let head = 0; head < queue.length; head++) {
        const [c, r] = queue[head];
        const d = dist[r][c] + 1;
        PATH_DIRS.forEach(([dc, dr]) => {
          const nc = c + dc, nr = r + dr;
          if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) return;
          if (dist[nr][nc] <= d) return;
          // Movement is symmetric, so "can the follower step from the
          // neighbour to here" is the same check in reverse.
          if (!canStep(nc, nr, -dc, -dr)) return;
          dist[nr][nc] = d;
          queue.push([nc, nr]);
        });
      }
    }

    function getNextStep(c, r) {
      if (r < 0 || c < 0 || r >= rows || c >= cols) return null;
      let best = null, bestD = dist[r][c];
      PATH_DIRS.forEach(([dc, dr]) => {
        const nc = c + dc, nr = r + dr;
        if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) return;
        if (dist[nr][nc] < bestD && canStep(c, r, dc, dr)) { bestD = dist[nr][nc]; best = { c: nc, r: nr }; }
      });
      return best;
    }

    return { goalC, goalR, dist, getNextStep };
  }

  // True if a straight line between two points (tile units) crosses no
  // solid tile. Samples along the line every quarter tile — fine enough
  // that it can't hop over a one-tile wall.
  function isLineClear(room, x0, y0, x1, y1, actor, customSolidFn) {
    const dx = x1 - x0, dy = y1 - y0;
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 0.25));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      if (isSolid(room, Math.floor(x0 + dx * t), Math.floor(y0 + dy * t), actor, customSolidFn)) return false;
    }
    return true;
  }

  // ---- MAIN LOOP --------------------------------------------------------------
  // Thin requestAnimationFrame wrapper — hands the room a (now, dt) pair
  // each frame so it can update actors and re-render. No game logic here.
  // ---- GAME CLOCK (STEP 13, rebuilt Session 2) --------------------------------
  // Generic time-keeping primitive: counts "game minutes" as real time
  // passes, at whatever pace the caller picks. engine.js assigns NO meaning
  // to any of it — it doesn't know what morning, night, sleep, crops, or
  // shops are. It only knows three numbers (day, minute-of-day, pace) and
  // announces two events: "an hour boundary was crossed" and "a new day
  // began." Everything that gives time MEANING (when a day starts, what
  // ends it, what the screen looks like at 9 PM, what grows overnight) is
  // the page's / game's call, per the Boundary Sentinel.
  //
  // opts:
  //   msPerMinute  — real milliseconds per game minute (default 700)
  //   startMinute  — minute-of-day every new day begins at (default 0).
  //                  Minutes count from midnight: 6:00 AM = 360.
  //   endMinute    — optional. If set, the clock HOLDS once it reaches
  //                  this minute instead of running on forever; values past
  //                  1440 are fine (1560 = 2:00 AM the following night).
  //                  The clock never starts a new day on its own — only
  //                  advanceToNextDay() does that, so "what ends a day"
  //                  stays entirely the caller's decision.
  //   maxStepMs    — cap on how much real time one update() call can count
  //                  (default 250). Stops a backgrounded browser tab from
  //                  returning and dumping several game-hours in one frame.
  //
  // update(dt) must be called every frame by whoever owns the loop; nothing
  // here runs by itself.
  function createGameClock(opts = {}) {
    const msPerMinute = opts.msPerMinute || 700;
    const startMinute = opts.startMinute || 0;
    const endMinute = (typeof opts.endMinute === 'number') ? opts.endMinute : null;
    const maxStepMs = opts.maxStepMs || 250;

    let day = 1;
    let minute = startMinute;
    let accumulator = 0;
    let paused = false;
    const hourListeners = [];
    const dayListeners = [];

    function fire(list, payload) {
      list.forEach(fn => { try { fn(payload); } catch (err) { console.error(err); } });
    }

    function update(dt) {
      if (paused) return;
      if (endMinute !== null && minute >= endMinute) { accumulator = 0; return; }
      accumulator += Math.min(Math.max(dt, 0), maxStepMs);
      while (accumulator >= msPerMinute) {
        accumulator -= msPerMinute;
        minute++;
        if (minute % 60 === 0) fire(hourListeners, { day, minute });
        if (endMinute !== null && minute >= endMinute) { accumulator = 0; break; }
      }
    }

    // Jumps to the start of the next day and announces it. Listeners run
    // AFTER day/minute are already updated, so anything they read is the
    // new morning, not the night that just ended.
    function advanceToNextDay() {
      day++;
      minute = startMinute;
      accumulator = 0;
      fire(dayListeners, { day, minute });
    }

    // Plain data in/out, for saving — same JSON-safe shape either way.
    function getState() { return { day, minute }; }
    function setState(state) {
      if (!state || typeof state !== 'object') return false;
      if (typeof state.day === 'number' && state.day >= 1) day = Math.floor(state.day);
      if (typeof state.minute === 'number' && state.minute >= 0) minute = Math.floor(state.minute);
      accumulator = 0;
      return true;
    }

    return {
      update,
      advanceToNextDay,
      getState,
      setState,
      getDay: () => day,
      getMinute: () => minute,
      isAtEnd: () => endMinute !== null && minute >= endMinute,
      pause: () => { paused = true; },
      resume: () => { paused = false; },
      isPaused: () => paused,
      onHour: fn => { hourListeners.push(fn); },
      onDay: fn => { dayListeners.push(fn); }
    };
  }

  // ---- TIMING BAR (generic press-in-the-zone minigame primitive) -----------
  // A marker sweeps back and forth across a 0..1 track; the caller judges a
  // press by calling press(), which checks the marker against a target zone
  // and freezes the bar. Engine has no idea this is used for brewing coffee,
  // picking a lock, or anything else — it's just "sweep, press, judge",
  // reusable by any game that wants a timing-based skill check. Frame-rate
  // independent the same way createGameClock is: update(dt) accumulates
  // real elapsed time rather than assuming a fixed frame length.
  //
  // Options:
  //   speed      — track fraction covered per second (default 0.6, so one
  //                full sweep takes a bit under 2 seconds).
  //   zoneStart  — 0..1 position where the target zone begins (default 0.4).
  //   zoneWidth  — 0..1 width of the target zone (default 0.2).
  //   maxStepMs  — cap on how much real time one update() call can count
  //                (default 100), same backgrounded-tab guard as the clock.
  //
  // start() resets and begins a fresh sweep. update(dt) must be called every
  // frame while running — nothing here runs on its own. press() judges the
  // current marker position, returns true/false, and stops the sweep;
  // calling it again before the next start() just returns false and does
  // nothing further. render() is an optional default look (a bar, a
  // highlighted zone, a marker line) — a caller that wants its own visuals
  // can ignore it and read getPosition()/getZone()/isHit() instead.
  function createTimingBar(opts = {}) {
    const speed = (typeof opts.speed === 'number') ? opts.speed : 0.6;
    const zoneStart = (typeof opts.zoneStart === 'number') ? opts.zoneStart : 0.4;
    const zoneWidth = (typeof opts.zoneWidth === 'number') ? opts.zoneWidth : 0.2;
    const maxStepMs = opts.maxStepMs || 100;

    let pos = 0;
    let dir = 1;
    let running = false;
    let resolved = null; // null while running/idle, true/false once press() has judged a sweep

    function start() {
      pos = 0;
      dir = 1;
      running = true;
      resolved = null;
    }

    function update(dt) {
      if (!running) return;
      const step = Math.min(Math.max(dt, 0), maxStepMs);
      pos += dir * speed * (step / 1000);
      if (pos >= 1) { pos = 1; dir = -1; }
      else if (pos <= 0) { pos = 0; dir = 1; }
    }

    function press() {
      if (!running || resolved !== null) return false;
      const hit = pos >= zoneStart && pos <= zoneStart + zoneWidth;
      resolved = hit;
      running = false;
      return hit;
    }

    function render(ctx, px, py, w, h, styleOpts = {}) {
      const barColor = styleOpts.barColor || '#2c2420';
      const zoneColor = styleOpts.zoneColor || '#3ddc84';
      const markerColor = resolved === true ? '#3ddc84' : resolved === false ? '#e05c5c' : (styleOpts.markerColor || '#ffffff');
      ctx.save();
      ctx.fillStyle = barColor;
      ctx.fillRect(px, py, w, h);
      ctx.fillStyle = zoneColor;
      ctx.fillRect(px + zoneStart * w, py, zoneWidth * w, h);
      ctx.fillStyle = markerColor;
      const markerX = px + pos * w;
      ctx.fillRect(markerX - 2, py - 4, 4, h + 8);
      ctx.restore();
    }

    return {
      start,
      update,
      press,
      render,
      isRunning: () => running,
      isHit: () => resolved,
      getPosition: () => pos,
      getZone: () => ({ start: zoneStart, width: zoneWidth })
    };
  }

  // ---- UI LAYOUT RENDERER (generic, reads tools/ui-designer's export) ------
  // A ui-data.js export is plain data: canvas size, a manifest of any art
  // sheets used, and a list of elements (id, kind, x/y/w/h, props). This
  // section draws that data. Same split as everywhere else: engine.js knows
  // how to draw a "panel," a "text," or a "bar" shape — it has no idea one
  // says "$5" and means money. A game supplies that meaning two ways:
  //   - manifest paths -> real images, via loadUiLayoutImages()
  //   - live numbers/state -> the `values` map passed to renderUiLayout(),
  //     looked up by name (a text element's own props.valueKey; a bar
  //     element's own id, since a screen usually has at most one of a given
  //     bar and giving it a second name would be pure ceremony)
  //
  // UI_KIND_RENDERERS is deliberately mutable via registerUiKind(): if a
  // future mechanic needs a new kind of element, that's a NEW registry
  // entry (here and in ui-designer's own KIND_REGISTRY) — this function
  // and renderUiLayout() itself never need to change to support it.
  const UI_FONT_STACK = '-apple-system, "Segoe UI", Roboto, sans-serif';

  // Same table as ui-designer's own (designer.js keeps its own copy — this
  // tool has no build step to share a module between them, so the anchor
  // NAMES are the shared contract, not shared code). An element's x/y is
  // its literal pixel position on the LAYOUT's own design canvas
  // (layout.canvasW/canvasH); anchor says which edge/corner that position
  // is really measured from, so it can be re-measured against a DIFFERENT
  // actual screen size at render time without moving off that edge.
  const UI_ANCHOR_POINTS = {
    'top-left':      { h: 'left',   v: 'top' },
    'top-center':    { h: 'center', v: 'top' },
    'top-right':     { h: 'right',  v: 'top' },
    'center-left':   { h: 'left',   v: 'center' },
    'center':        { h: 'center', v: 'center' },
    'center-right':  { h: 'right',  v: 'center' },
    'bottom-left':   { h: 'left',   v: 'bottom' },
    'bottom-center': { h: 'center', v: 'bottom' },
    'bottom-right':  { h: 'right',  v: 'bottom' }
  };

  // Round-trips exactly (returns el.x/el.y unchanged) whenever targetW/H
  // equal the layout's own canvasW/H — anchoring only actually MOVES
  // anything once the target size differs from the design size. Element
  // width/height are never rescaled here, only repositioned — a HUD badge
  // stays the same pixel size on every device, just re-pinned to its edge.
  function resolveAnchoredRect(el, canvasW, canvasH, targetW, targetH) {
    const a = UI_ANCHOR_POINTS[el.anchor] || UI_ANCHOR_POINTS['top-left'];

    let offsetX;
    if (a.h === 'left') offsetX = el.x;
    else if (a.h === 'right') offsetX = canvasW - el.x - el.w;
    else offsetX = el.x - (canvasW - el.w) / 2;

    let offsetY;
    if (a.v === 'top') offsetY = el.y;
    else if (a.v === 'bottom') offsetY = canvasH - el.y - el.h;
    else offsetY = el.y - (canvasH - el.h) / 2;

    let x;
    if (a.h === 'left') x = offsetX;
    else if (a.h === 'right') x = targetW - offsetX - el.w;
    else x = (targetW - el.w) / 2 + offsetX;

    let y;
    if (a.v === 'top') y = offsetY;
    else if (a.v === 'bottom') y = targetH - offsetY - el.h;
    else y = (targetH - el.h) / 2 + offsetY;

    return { x, y, w: el.w, h: el.h };
  }

  function drawNineSliceRegion(ctx, img, sx, sy, srcSize, inset, px, py, destW, destH, fallbackColor = '#c0c') {
    if (!img) {
      ctx.fillStyle = fallbackColor;
      ctx.fillRect(px, py, destW, destH);
      return;
    }
    const clampedInset = Math.max(0, Math.min(inset || 0, Math.floor(srcSize / 2) - 1, Math.floor(destW / 2) - 1, Math.floor(destH / 2) - 1));
    if (clampedInset <= 0) {
      ctx.drawImage(img, sx, sy, srcSize, srcSize, px, py, destW, destH);
      return;
    }
    const midSrc = srcSize - clampedInset * 2;
    const midDestW = Math.max(0, destW - clampedInset * 2);
    const midDestH = Math.max(0, destH - clampedInset * 2);

    ctx.drawImage(img, sx, sy, clampedInset, clampedInset, px, py, clampedInset, clampedInset);
    ctx.drawImage(img, sx + srcSize - clampedInset, sy, clampedInset, clampedInset, px + destW - clampedInset, py, clampedInset, clampedInset);
    ctx.drawImage(img, sx, sy + srcSize - clampedInset, clampedInset, clampedInset, px, py + destH - clampedInset, clampedInset, clampedInset);
    ctx.drawImage(img, sx + srcSize - clampedInset, sy + srcSize - clampedInset, clampedInset, clampedInset, px + destW - clampedInset, py + destH - clampedInset, clampedInset, clampedInset);

    if (midDestW > 0) {
      ctx.drawImage(img, sx + clampedInset, sy, midSrc, clampedInset, px + clampedInset, py, midDestW, clampedInset);
      ctx.drawImage(img, sx + clampedInset, sy + srcSize - clampedInset, midSrc, clampedInset, px + clampedInset, py + destH - clampedInset, midDestW, clampedInset);
    }
    if (midDestH > 0) {
      ctx.drawImage(img, sx, sy + clampedInset, clampedInset, midSrc, px, py + clampedInset, clampedInset, midDestH);
      ctx.drawImage(img, sx + srcSize - clampedInset, sy + clampedInset, clampedInset, midSrc, px + destW - clampedInset, py + clampedInset, clampedInset, midDestH);
    }
    if (midDestW > 0 && midDestH > 0) {
      ctx.drawImage(img, sx + clampedInset, sy + clampedInset, midSrc, midSrc, px + clampedInset, py + clampedInset, midDestW, midDestH);
    }
  }

  const UI_KIND_RENDERERS = {
    panel(ctx, el, images, manifest, values) {
      const p = el.props;
      const sw = p.swatch;
      const sheetMeta = sw && manifest[sw.sheet];
      const imgEntry = sw && images[sw.sheet];
      if (sw && sheetMeta && typeof sheetMeta === 'object' && typeof sheetMeta.tileSize === 'number' && imgEntry && imgEntry.ok) {
        const size = sheetMeta.tileSize;
        const sx = (sheetMeta.originX || 0) + sw.sx * size;
        const sy = (sheetMeta.originY || 0) + sw.sy * size;
        drawNineSliceRegion(ctx, imgEntry.img, sx, sy, size, sw.borderInset || 0, el.x, el.y, el.w, el.h, p.fillColor);
      } else {
        ctx.fillStyle = p.fillColor;
        ctx.fillRect(el.x, el.y, el.w, el.h);
      }
      if (p.borderWidth > 0) {
        ctx.strokeStyle = p.borderColor;
        ctx.lineWidth = p.borderWidth;
        ctx.strokeRect(el.x + p.borderWidth / 2, el.y + p.borderWidth / 2, el.w - p.borderWidth, el.h - p.borderWidth);
      }
    },

    text(ctx, el, images, manifest, values) {
      const p = el.props;
      const raw = values[p.valueKey];
      const shown = (raw === undefined || raw === null) ? '' : String(raw);
      const full = `${p.prefix || ''}${shown}${p.suffix || ''}`;
      ctx.save();
      ctx.font = `${p.fontSize}px ${UI_FONT_STACK}`;
      ctx.fillStyle = p.color;
      ctx.textBaseline = 'middle';
      ctx.textAlign = p.align || 'left';
      let x = el.x;
      if (p.align === 'center') x = el.x + el.w / 2;
      else if (p.align === 'right') x = el.x + el.w;
      ctx.fillText(full, x, el.y + el.h / 2);
      ctx.restore();
    },

    // Live state comes from values[el.id] — { position, zoneStart,
    // zoneWidth, hit } in 0..1, matching createTimingBar's own
    // getPosition()/getZone()/isHit(). A game typically does:
    //   values[el.id] = { position: bar.getPosition(), ...bar.getZone(), hit: bar.isHit() }
    // No live entry (bar not running, or the id doesn't match anything
    // supplied) falls back to the design-time zoneStart/zoneWidth preview
    // with the marker frozen at rest — never a crash, just a static look.
    bar(ctx, el, images, manifest, values) {
      const p = el.props;
      const live = values[el.id];
      const zoneStart = (live && typeof live.zoneStart === 'number') ? live.zoneStart : p.zoneStart / 100;
      const zoneWidth = (live && typeof live.zoneWidth === 'number') ? live.zoneWidth : p.zoneWidth / 100;
      const position = (live && typeof live.position === 'number') ? live.position : 0.5;
      const hit = live ? live.hit : null;

      ctx.fillStyle = p.barColor;
      ctx.fillRect(el.x, el.y, el.w, el.h);
      ctx.fillStyle = p.zoneColor;
      ctx.fillRect(el.x + zoneStart * el.w, el.y, zoneWidth * el.w, el.h);
      ctx.fillStyle = hit === true ? p.zoneColor : hit === false ? '#e05c5c' : p.markerColor;
      const markerX = el.x + position * el.w;
      ctx.fillRect(markerX - 2, el.y - 4, 4, el.h + 8);
    }
  };

  function registerUiKind(name, drawFn) {
    UI_KIND_RENDERERS[name] = drawFn;
  }

  // Turns a layout's manifest (path + tile metadata) into a real images
  // map via loadImages() — same imageEntry shape ({img, ok}) as everywhere
  // else in engine.js. Tolerates an older export whose manifest values
  // were plain path strings (pre tile-metadata) by just using the string.
  function loadUiLayoutImages(layout) {
    const pathManifest = {};
    Object.keys(layout.manifest || {}).forEach((key) => {
      const entry = layout.manifest[key];
      const path = (typeof entry === 'string') ? entry : entry.path;
      if (path) pathManifest[key] = path;
    });
    return loadImages(pathManifest);
  }

  // px/py/scale let a page place the whole layout in screen space without
  // needing its own translate/scale boilerplate — e.g. a HUD anchored to a
  // corner while the design screen was authored at a different resolution
  // than the device's actual canvas. Defaults (0,0,1) draw at native size
  // wherever the caller's own ctx transform already puts (0,0).
  // opts.targetW/targetH: the ACTUAL size to fit the layout into, if it
  // differs from the size it was designed at (layout.canvasW/canvasH) —
  // this is what makes anchoring do anything. Omitted (or equal to the
  // design size), every element draws at exactly its designed position,
  // same as before anchoring existed.
  function renderUiLayout(ctx, layout, images, values, opts = {}) {
    const px = opts.px || 0, py = opts.py || 0, scale = opts.scale || 1;
    const targetW = (typeof opts.targetW === 'number') ? opts.targetW : layout.canvasW;
    const targetH = (typeof opts.targetH === 'number') ? opts.targetH : layout.canvasH;
    const manifest = layout.manifest || {};
    const vals = values || {};
    ctx.save();
    ctx.translate(px, py);
    ctx.scale(scale, scale);
    (layout.elements || []).forEach((el) => {
      const draw = UI_KIND_RENDERERS[el.kind];
      if (!draw) return;
      const rect = resolveAnchoredRect(el, layout.canvasW, layout.canvasH, targetW, targetH);
      // A shallow clone with the resolved x/y/w/h — id/kind/anchor/props
      // (and therefore a bar's values[el.id] lookup) are untouched, so
      // kind renderers need no anchoring awareness of their own.
      draw(ctx, { ...el, x: rect.x, y: rect.y, w: rect.w, h: rect.h }, images || {}, manifest, vals);
    });
    ctx.restore();
  }

  function startLoop(callback) {
    let lastTime = performance.now();
    function frame(now) {
      const dt = now - lastTime;
      lastTime = now;
      callback(now, dt);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  return {
    setupCanvas, loadImages, drawTile, buildGrid, buildEmptyGrid, renderFloorGrid, renderFloorOverlay, buildWallRow, renderWallRow, renderSprite, renderEntities, renderWallsAndEntities, getOverlappingEntities, checkOverlapTriggers, attachPropToActor, syncAttachedEntities,
    isSolid, getWarpAt, getGateAt, getEntityAt, getFacingTile, triggerAction, setTile, setRoomTile, getAllRoomTileState, setEntityState, getEntityState, getAllEntityState, clearEntityState, generateEntityId, placeProp, setPlayerAttachment, clearPlayerAttachment, getPlayerAttachment, getPlayerAttachments, setFlag, getFlag, createFadeOverlay, computeCamera, createDirectionalInput, createInputGate, createStateStack, createEventQueue, draw9SliceBox, wrapText, drawTextLines, createTextReveal, createGridActor, updateGridActor, moveFreeActor, getActorHitbox, buildDistanceMap, isLineClear, startLoop, createGameClock, createTimingBar, renderUiLayout, loadUiLayoutImages, registerUiKind, resolveAnchoredRect,
    registerRoom, initRoomManager, loadRoom, getCurrentRoomName,
    grantAbility, revokeAbility, hasAbility, getAbilities,
    addItem, removeItem, getItemCount, getAllItems,
    exportSaveState, importSaveState, saveToStorage, loadFromStorage, clearStorage
  };
})();

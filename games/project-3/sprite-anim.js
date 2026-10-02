/* =============================================================================
   SPRITE ANIMATION — Project 3
   -----------------------------------------------------------------------------
   Plays animations from a sprite sheet laid out in rows (one animation per
   row, frames left to right), with:
     - FLIP: draw any animation mirrored left/right (Penusbmic sheets only
       draw one side; flipping makes the other).
     - FEET ANCHOR: the point inside a frame that sits exactly on the
       character's x/y position (their feet), since the art sits somewhere
       inside its 32×32 box.

   Generic on purpose — no Project 3 words. A candidate to move into
   engine.js later (see PARKING_LOT.md). The sheet's actual layout lives in
   a separate data file (e.g. hero-data.js).

   A sheet definition looks like:
     { frameW, frameH, anchorX, anchorY,
       anims: { name: { row, frames, ms, loop, reverse } } }
     (reverse: true plays the row from its last frame back to its first)
   ============================================================================= */

function createSpriteAnimator(def, startAnim) {
  return { def, anim: startAnim, frame: 0, timer: 0 };
}

// Switch animation. Does nothing if it's already playing (so calling it
// every frame is fine — it won't keep restarting at frame 0).
function playSpriteAnim(animator, name) {
  if (animator.anim === name || !animator.def.anims[name]) return;
  animator.anim = name;
  animator.frame = 0;
  animator.timer = 0;
}

// Advance the animation. dtMs = time since last frame, in milliseconds.
function updateSpriteAnim(animator, dtMs) {
  const a = animator.def.anims[animator.anim];
  if (!a || a.frames <= 1) return;
  animator.timer += dtMs;
  while (animator.timer >= a.ms) {
    animator.timer -= a.ms;
    if (animator.frame < a.frames - 1) animator.frame++;
    else if (a.loop !== false) animator.frame = 0;
  }
}

// Draws the current frame with its feet anchor at (feetX, feetY), in
// SCREEN pixels. pxScale = screen pixels per art pixel (whole number).
// flip = true draws it mirrored left/right.
// Greybox fallback: if the sheet didn't load, draws a plain box instead.
function drawSpriteAnim(ctx, imageEntry, animator, feetX, feetY, pxScale, flip, fallback) {
  const d = animator.def, s = pxScale;
  const fx = Math.round(feetX), fy = Math.round(feetY);
  if (!imageEntry || !imageEntry.ok) {
    const fb = fallback || { w: 14, h: 18, color: '#7fd1ff' };
    ctx.fillStyle = fb.color;
    ctx.fillRect(fx - Math.round(fb.w * s / 2), fy - fb.h * s, fb.w * s, fb.h * s);
    return;
  }
  const a = d.anims[animator.anim];
  ctx.save();
  ctx.translate(fx, fy);
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(imageEntry.img,
    (a.reverse ? a.frames - 1 - animator.frame : animator.frame) * d.frameW, a.row * d.frameH, d.frameW, d.frameH,
    -d.anchorX * s, -d.anchorY * s, d.frameW * s, d.frameH * s);
  ctx.restore();
}

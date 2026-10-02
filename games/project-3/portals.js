/* =============================================================================
   PORTALS — Project 3
   -----------------------------------------------------------------------------
   Instant travel between rooms. A room lists them as:
     portals: [ { id, x, y, to, toPortal, locked } ]
       id        — this portal's name inside its room (e.g. 'p1')
       x, y      — where it sits on the floor (art px)
       to        — the room it leads to
       toPortal  — which portal in THAT room you come out next to.
                   Leave it out and you arrive at the portal there that
                   leads back here (or, failing that, the room's start point).
       locked    — true = shut until the room's swarm is beaten (swarm.js).
                   A room with no swarm has nothing to beat, so it's open.
   Placed and linked in World Builder.

   Walk onto a portal: the hero dissolves (the cyan teleport effect), the
   room swaps, and he re-forms next to the arrival portal. He has to step
   off a portal before it will work again, so arriving never bounces him
   straight back.
   ============================================================================= */

const PORTAL = {
  radius: 8,          // how close the hero's feet must get (art px)
  arriveOffset: 18,   // you appear this far BELOW the arrival portal
  teleportTime: 0.55  // seconds for the dissolve / re-form
};

// The portal under the hero's feet, or null. lockedOpen: whether this
// room's locked portals are open yet.
function portalAt(room, pos, lockedOpen) {
  return (room.portals || []).find(p => p.to && (!p.locked || lockedOpen) && Math.hypot(p.x - pos.x, p.y - pos.y) <= PORTAL.radius) || null;
}

// Where to put the hero after arriving in `room` from room `fromRoom`
// through a portal that named `toPortal`. Returns { x, y } or null.
function arrivalSpot(room, fromRoom, toPortal) {
  const list = room.portals || [];
  const p = (toPortal && list.find(q => q.id === toPortal)) || list.find(q => q.to === fromRoom) || null;
  return p ? { x: p.x, y: p.y + PORTAL.arriveOffset } : null;
}

// Greybox look until there's portal art: a glowing ring on the ground
// with sparks rising from it. Drawn under the hero and props.
// Locked portals (while shut) draw as a dim red ring with no sparks.
function drawPortals(ctx, room, toX, toY, s, now, lockedOpen) {
  (room.portals || []).forEach(p => {
    const cx = toX(p.x), cy = toY(p.y), pulse = 0.5 + 0.5 * Math.sin(now / 250);
    if (p.locked && !lockedOpen) {
      ctx.save();
      ctx.fillStyle = 'rgba(120,30,30,0.25)';
      ctx.beginPath(); ctx.ellipse(cx, cy, 11 * s, 5 * s, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(200,70,70,0.8)'; ctx.lineWidth = Math.max(2, s);
      ctx.beginPath(); ctx.ellipse(cx, cy, 11 * s, 5 * s, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
      return;
    }
    ctx.save();
    ctx.fillStyle = `rgba(40,210,255,${0.12 + pulse * 0.1})`;
    ctx.beginPath(); ctx.ellipse(cx, cy, 11 * s, 5 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = p.to ? `rgba(110,235,255,${0.7 + pulse * 0.3})` : 'rgba(150,150,150,0.7)';
    ctx.lineWidth = Math.max(2, s);
    ctx.beginPath(); ctx.ellipse(cx, cy, 11 * s, 5 * s, 0, 0, Math.PI * 2); ctx.stroke();
    // rising sparks
    ctx.fillStyle = 'rgba(200,250,255,0.9)';
    for (let i = 0; i < 4; i++) {
      const k = ((now / 900) + i / 4) % 1;
      const a = i * 1.7 + now / 700;
      ctx.fillRect(Math.round(cx + Math.cos(a) * 8 * s), Math.round(cy - k * 18 * s), s, s);
    }
    ctx.restore();
  });
}

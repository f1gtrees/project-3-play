/* =============================================================================
   NAV — Project 3 (finding a way around props)
   -----------------------------------------------------------------------------
   Lets enemies walk AROUND blocking props instead of pushing into them.

   buildNav(blockers, world, cell, pad) -> nav
     A grid over the room (cell × cell art px). A square is blocked if a
     body standing there (pad px either side of the feet) would touch a prop.
   clearLine(nav, a, b) -> true if you can walk straight from a to b.
   findPath(nav, from, to) -> [{x, y}, ...] waypoints (the corners you need),
     or null if there's no way. Ends at `to`.

   How enemies use it (combat.js): straight at the hero when nothing's in
   the way; otherwise follow the path, re-planned every half second.

   Generic on purpose — no Project 3 words. A candidate for the engine later.
   ============================================================================= */
function buildNav(blockers, world, cell, pad) {
  cell = cell || 8; pad = pad === undefined ? 6 : pad;
  const cols = Math.max(1, Math.ceil(world.w / cell)), rows = Math.max(1, Math.ceil(world.h / cell));
  const blocked = new Uint8Array(cols * rows);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x = c * cell + cell / 2, y = r * cell + cell / 2;
    // the feet are a short box at y: grow every prop box by the body's size
    if (blockers.some(b => x > b.x - pad && x < b.x + b.w + pad && y > b.y - 3 && y < b.y + b.h + pad)) blocked[r * cols + c] = 1;
  }
  return { cell, cols, rows, blocked, world };
}
function navCellOf(nav, p) {
  return { c: Math.max(0, Math.min(nav.cols - 1, Math.floor(p.x / nav.cell))), r: Math.max(0, Math.min(nav.rows - 1, Math.floor(p.y / nav.cell))) };
}
function navBlockedAt(nav, x, y) {
  const c = Math.floor(x / nav.cell), r = Math.floor(y / nav.cell);
  if (c < 0 || r < 0 || c >= nav.cols || r >= nav.rows) return true;
  return nav.blocked[r * nav.cols + c] === 1;
}
function clearLine(nav, a, b) {
  const d = Math.hypot(b.x - a.x, b.y - a.y), steps = Math.ceil(d / (nav.cell / 2));
  for (let i = 1; i < steps; i++) {
    const k = i / steps;
    if (navBlockedAt(nav, a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k)) return false;
  }
  return true;
}
// The nearest open square to p (if p itself is inside a blocked one).
function navNearestOpen(nav, p) {
  const s = navCellOf(nav, p);
  if (!nav.blocked[s.r * nav.cols + s.c]) return s;
  for (let rad = 1; rad < 8; rad++) for (let dr = -rad; dr <= rad; dr++) for (let dc = -rad; dc <= rad; dc++) {
    const r = s.r + dr, c = s.c + dc;
    if (r >= 0 && c >= 0 && r < nav.rows && c < nav.cols && !nav.blocked[r * nav.cols + c]) return { r, c };
  }
  return null;
}
function findPath(nav, from, to) {
  const s = navNearestOpen(nav, from), g = navNearestOpen(nav, to);
  if (!s || !g) return null;
  const C = nav.cols, N = C * nav.rows, start = s.r * C + s.c, goal = g.r * C + g.c;
  const gScore = new Float32Array(N).fill(Infinity), came = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
  const heap = []; // [f, index] binary heap
  const push = (f, i) => { heap.push([f, i]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
  const h = i => { const r = (i / C) | 0, c = i % C, dr = Math.abs(r - g.r), dc = Math.abs(c - g.c); return Math.max(dr, dc) + 0.414 * Math.min(dr, dc); };
  gScore[start] = 0; push(h(start), start);
  let found = false, guard = 0;
  while (heap.length && guard++ < N * 2) {
    const [, cur] = pop();
    if (cur === goal) { found = true; break; }
    if (closed[cur]) continue;
    closed[cur] = 1;
    const r = (cur / C) | 0, c = cur % C;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nc < 0 || nr >= nav.rows || nc >= C) continue;
      const ni = nr * C + nc;
      if (nav.blocked[ni] || closed[ni]) continue;
      if (dr && dc && (nav.blocked[r * C + nc] || nav.blocked[nr * C + c])) continue; // no cutting corners
      const ng = gScore[cur] + (dr && dc ? 1.414 : 1);
      if (ng < gScore[ni]) { gScore[ni] = ng; came[ni] = cur; push(ng + h(ni), ni); }
    }
  }
  if (!found) return null;
  const cells = [];
  for (let i = goal; i !== -1 && i !== start; i = came[i]) cells.push(i);
  cells.reverse();
  const pts = cells.map(i => ({ x: (i % C) * nav.cell + nav.cell / 2, y: ((i / C) | 0) * nav.cell + nav.cell / 2 }));
  pts.push({ x: to.x, y: to.y });
  // pull the string: keep only the corners you can't see past
  const out = []; let here = from, k = 0;
  while (k < pts.length) {
    let far = k;
    for (let j = pts.length - 1; j > k; j--) if (clearLine(nav, here, pts[j])) { far = j; break; }
    out.push(pts[far]); here = pts[far]; k = far + 1;
  }
  return out;
}

// ============================================================
// hud-layout.js — where Project 3's on-screen controls go.
// Written by World Builder (HUD button). Plain data — safe to hand-edit.
//
// elements: each one's CENTRE (x, y as a fraction of the screen: 0 = left
// / top, 1 = right / bottom), its size (scale, 1 = normal) and whether
// it's shown. Fractions mean the layout fits any phone.
// screen: the reference screen it was laid out on — on other screens the
// controls grow or shrink to match (hud.js hudFit).
// stamp: changes on every export — phones drop any spots they saved by
// double-tapping before this layout, so World Builder's layout wins.
// ============================================================

const HUD_LAYOUT = {
  stamp: 1790969630828,
  screen: { w: 390, h: 844 },
  elements: {
    health: { x: 0.8, y: 0.2, scale: 1, visible: true },
    wallet: { x: 0.85, y: 0.15, scale: 1, visible: true },
    swarm: { x: 0.796, y: 0.034, scale: 1, visible: false },
    act: { x: 0.188, y: 0.83, scale: 1, visible: false },
    pause: { x: 0.85, y: 0.1, scale: 1, visible: true },
    minimap: { x: 0.15, y: 0.15, scale: 0.6, visible: true, w: 90, h: 120, range: 0, opacity: 85, enemies: 0, round: 0 }
  }
};

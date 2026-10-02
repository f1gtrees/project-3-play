/* =============================================================================
   THEME — Project 3: turns ui-theme.js into the page's look
   -----------------------------------------------------------------------------
   themeCss(theme, base) -> CSS text for every styled part:
     panel    -> .menu-panel (+ .menu-title, .menu-header, .menu-wallet)
     button   -> .menu-btn          buttonOn -> .menu-btn.on / :active
     textBox  -> .talk-box, .talk-text, .talk-next
     nameTab  -> .talk-name
     minimap  -> .hud-minimap
     hud      -> .hud-box text (wallet, wave counter)
   base = the path to the game folder from the page using it ('' in the game;
   World Builder passes its own so its preview shows the same thing).
   applyTheme(theme) puts it on the page (once, replacing any older one).

   World Builder's Style screen loads THIS file too, so its preview always
   matches the game. Generic — the class names are the only game-specific
   part (listed above).
   (Boxes that are already placed on screen — text box, mini map — keep
   their placement when they get decorations; the others become
   position: relative so the ornaments sit on their corners.)
   ============================================================================= */
function themeFont(T, name) {
  const f = (T.fonts || []).find(x => x.name === name);
  if (!f) return 'monospace';
  return f.file ? '"' + f.name + '", monospace' : (f.css || 'monospace');
}
function themeColor(hex, alpha) {
  const h = String(hex || '#000000').replace('#', ''), n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16) || 0;
  const a = alpha === undefined ? 1 : Math.max(0, Math.min(100, alpha)) / 100;
  return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
}
function themeCss(T, base) {
  base = base || '';
  const S = T.styles || {}, out = [];
  (T.fonts || []).forEach(f => {
    if (f.file) out.push('@font-face { font-family: "' + f.name + '"; src: url("' + base + f.file + '"); font-display: block; }');
  });
  // a box's frame + fill
  const box = (st) => {
    if (!st) return '';
    const fr = st.frame && T.frames && T.frames[st.frame - 1];
    const col = themeColor(st.bg, st.bgAlpha);
    let c;
    if (fr && st.border) {
      // the fill reaches under the frame, stopping `fillInset` px in from the outside edge
      const ins = st.fillInset !== undefined && st.fillInset !== '' ? Number(st.fillInset) : Math.round(st.border / 3);
      c = 'background: linear-gradient(' + col + ', ' + col + ') center / calc(100% - ' + 2 * ins + 'px) calc(100% - ' + 2 * ins + 'px) no-repeat; background-origin: border-box; background-clip: border-box; ' +
        'border: ' + st.border + 'px solid transparent; border-image: url("' + base + fr + '") ' + (st.slice || 6) + ' fill / ' + st.border + 'px stretch; image-rendering: pixelated; border-radius: 0; ';
    } else c = 'background: ' + col + '; border: none; border-image: none; ';
    return c;
  };
  const text = (st, sizeMul) => st ? 'font-family: ' + themeFont(T, st.font) + '; font-size: ' + Math.round((st.size || 10) * (sizeMul || 1)) + 'px; color: ' + (st.color || '#fff') + '; -webkit-font-smoothing: none; font-smooth: never; font-synthesis: none; ' : '';
  // little ornaments on a box's edges (::before = left, ::after = right)
  const deco = (sel, st, positioned) => {
    if (!st || !st.deco || !T.decorations || !T.decorations[st.deco - 1]) return;
    const url = base + T.decorations[st.deco - 1], k = st.decoScale || 1, w = 16 * k, h = 32 * k, b = st.border || 0;
    const common = 'content: ""; position: absolute; width: ' + w + 'px; height: ' + h + 'px; background: url("' + url + '") no-repeat 0 0 / ' + w + 'px ' + h + 'px; image-rendering: pixelated; pointer-events: none; ';
    const place = st.decoPlace || 'top-corners';
    const left = place === 'sides' ? 'left: ' + (-b - 4 * k) + 'px; top: calc(50% - ' + h / 2 + 'px);' : 'left: ' + (-b + 2 * k) + 'px; top: ' + (-b - h + 6 * k) + 'px;';
    const right = place === 'sides' ? 'right: ' + (-b - 12 * k) + 'px; top: calc(50% - ' + h / 2 + 'px); transform: scaleX(-1);' : 'right: ' + (-b - 6 * k) + 'px; top: ' + (-b - h + 6 * k) + 'px; transform: scaleX(-1);';
    out.push(sel + ' { ' + (positioned ? '' : 'position: relative; ') + 'overflow: visible; }');
    if (place !== 'top-right') out.push(sel + '::before { ' + common + left + ' }');
    if (place !== 'top-left') out.push(sel + '::after { ' + common + right + ' }');
  };
  const P = S.panel, B = S.button, BO = S.buttonOn, TB = S.textBox, N = S.nameTab, M = S.minimap, H = S.hud;
  if (P) {
    out.push('.menu-panel { ' + box(P) + ' }');
    out.push('.menu-title { ' + text(P) + ' letter-spacing: 1px; }');
    // pixel fonts: no fake bold (it smears them) — pick P3 Bold for bold text instead
    out.push('.menu-wallet, .menu-info, .menu-info.menu-section { font-family: ' + themeFont(T, P.font) + '; -webkit-font-smoothing: none; font-synthesis: none; }');
    out.push('.menu-main b, .menu-btn small, .menu-right { font-synthesis: none; }');
    out.push('.menu-wallet, .menu-info.menu-section { color: ' + (P.color || '#ffe28a') + '; }');
    out.push('.menu-info { color: ' + (P.accent || '#eee') + '; }');
    if (P.deco) {
      // ornaments sit outside the panel, so the item list scrolls instead of the panel
      out.push('.menu-panel { display: flex; flex-direction: column; } .menu-items { overflow-y: auto; min-height: 0; }');
      deco('.menu-panel', P);
    }
  }
  if (B) {
    out.push('.menu-btn { ' + box(B) + text(B) + ' }');
    out.push('.menu-btn small, .menu-main small { color: ' + (B.accent || '#cfc7b0') + '; font-family: ' + themeFont(T, B.font) + '; font-size: ' + Math.round((B.size || 10) * 0.6) + 'px; }');
    out.push('.menu-right { font-family: ' + themeFont(T, B.font) + '; font-size: ' + Math.round((B.size || 10) * 0.9) + 'px; }');
    if (B.deco) {
      // room for the ornaments at the sides of each button
      const k = B.decoScale || 1;
      out.push('.menu-items { padding: ' + (6 * k) + 'px ' + (14 * k) + 'px; }');
      deco('.menu-btn', B);
    }
  }
  if (BO) out.push('.menu-btn.on, .menu-btn:active { ' + box(BO) + 'color: ' + (BO.color || '#fff') + '; }');
  if (TB) {
    out.push('.talk-box { ' + box(TB) + ' }');
    out.push('.talk-text { ' + text(TB) + ' }');
    out.push('.talk-next { color: ' + (TB.accent || '#ffe28a') + '; font-family: ' + themeFont(T, TB.font) + '; }');
    deco('.talk-box', TB, true);
  }
  if (N) out.push('.talk-name { ' + box(N) + text(N) + ' border-radius: ' + (N.frame ? 0 : 3) + 'px; }');
  if (M) { out.push('.hud-minimap { ' + box(M) + ' padding: 0; }'); deco('.hud-minimap', M, true); }
  if (H) {
    out.push('.hud-wallet, .hud-swarm { ' + box(H) + ' }');
    out.push('.hud-money, .hud-swarm-text, .hud-lv { font-family: ' + themeFont(T, H.font) + '; font-size: ' + (H.size || 10) + 'px; color: ' + (H.color || '#ffe28a') + '; -webkit-font-smoothing: none; }');
  }
  return out.join('\n');
}
function applyTheme(T, base, doc) {
  doc = doc || document;
  if (!T) return;
  let el = doc.getElementById('ui-theme');
  if (!el) { el = doc.createElement('style'); el.id = 'ui-theme'; doc.head.appendChild(el); }
  el.textContent = themeCss(T, base);
}

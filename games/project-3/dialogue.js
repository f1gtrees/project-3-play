/* =============================================================================
   DIALOGUE — Project 3: text boxes
   -----------------------------------------------------------------------------
   Plays a script from dialogue-data.js (World Builder → Text): the game
   pauses, a text box appears where the layout says (a share of the screen,
   so it fits any phone), the text types itself out, and a tap goes on —
   first tap finishes the line, next tap turns the page. After the last page
   the box closes and `then` runs (e.g. open the shop).

   const talk = createDialogue({ onOpen, onClose });   // pause / un-pause here
   talk.play(scriptId, then)   // no script (or '') = just runs then()
   talk.playEvent(eventKey, then)  // the script set for that moment in DIALOGUE.events —
                                   // a list of scripts there = one picked at random each time
                                   // (never the same one twice in a row)
   talk.isOpen()

   Generic on purpose — a candidate for the engine later.
   ============================================================================= */
function createDialogue(opts) {
  opts = opts || {};
  const D = () => (typeof DIALOGUE !== 'undefined' && DIALOGUE) || { box: {}, scripts: {}, events: {} };
  const root = document.createElement('div');
  root.className = 'talk-screen hidden';
  root.innerHTML = '<div class="talk-box"><div class="talk-name"></div><div class="talk-row"><span class="talk-icon"></span><div class="talk-text"></div></div><div class="talk-next">▼</div></div>';
  document.body.appendChild(root);
  const box = root.querySelector('.talk-box'), nameEl = root.querySelector('.talk-name'), textEl = root.querySelector('.talk-text'),
    iconEl = root.querySelector('.talk-icon'), nextEl = root.querySelector('.talk-next');
  let pages = [], page = 0, shown = 0, full = '', timer = null, then = null;

  function layout() {
    const B = D().box || {}, W = window.innerWidth, H = window.innerHeight;
    const w = (B.w || 0.9) * W, h = (B.h || 0.2) * H;
    box.style.width = w + 'px'; box.style.minHeight = h + 'px';
    box.style.left = Math.max(4, Math.min(W - w - 4, (B.x === undefined ? 0.5 : B.x) * W - w / 2)) + 'px';
    box.style.top = Math.max(4, Math.min(H - h - 4, (B.y === undefined ? 0.8 : B.y) * H - h / 2)) + 'px';
    // text sizes / fonts come from the theme (ui-theme.js); without one, from the box settings
    if (typeof UI_THEME === 'undefined') { textEl.style.fontSize = (B.textSize || 15) + 'px'; nameEl.style.fontSize = (B.nameSize || 13) + 'px'; }
  }
  window.addEventListener('resize', () => { if (isOpen()) layout(); });

  function showPage() {
    const p = pages[page] || {};
    nameEl.textContent = p.speaker || ''; nameEl.style.display = p.speaker ? '' : 'none';
    iconEl.innerHTML = p.icon !== undefined && p.icon !== null && p.icon !== '' && typeof iconHtml === 'function' ? iconHtml({ icon: Number(p.icon) }) : '';
    iconEl.style.display = iconEl.innerHTML ? '' : 'none';
    full = String(p.text || ''); shown = 0; textEl.textContent = ''; nextEl.style.visibility = 'hidden';
    clearInterval(timer);
    const speed = (D().box || {}).typeSpeed;
    if (!speed) { shown = full.length; textEl.textContent = full; nextEl.style.visibility = 'visible'; return; }
    timer = setInterval(() => {
      shown++; textEl.textContent = full.slice(0, shown);
      if (shown >= full.length) { clearInterval(timer); nextEl.style.visibility = 'visible'; }
    }, 1000 / speed);
  }
  function tap(e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    if (shown < full.length) { clearInterval(timer); shown = full.length; textEl.textContent = full; nextEl.style.visibility = 'visible'; return; }
    page++;
    if (page < pages.length) showPage(); else finish();
  }
  root.addEventListener('touchstart', tap, { passive: false });
  root.addEventListener('mousedown', tap);
  window.addEventListener('keydown', e => { if (isOpen() && (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyE')) tap(e); }, true);

  function finish() {
    clearInterval(timer);
    root.classList.add('hidden');
    if (opts.onClose) opts.onClose();
    const t = then; then = null;
    if (t) t();
  }
  function play(id, next) {
    const S = id && D().scripts && D().scripts[id];
    const list = S && (S.pages || []).filter(p => p && (p.text || p.speaker));
    if (!list || !list.length) { if (next) next(); return; }
    pages = list; page = 0; then = next || null;
    root.classList.remove('hidden');
    layout();
    if (opts.onOpen) opts.onOpen();
    showPage();
  }
  function isOpen() { return !root.classList.contains('hidden'); }
  // A moment's script: one name, or a list to pick from at random (not the last one again).
  const lastPick = {};
  function pickFor(key, v) {
    if (!Array.isArray(v)) return v || '';
    const list = v.filter(Boolean);
    if (list.length < 2) return list[0] || '';
    const choices = list.filter(x => x !== lastPick[key]);
    return (lastPick[key] = choices[Math.floor(Math.random() * choices.length)]);
  }
  return {
    play: (id, next) => play(pickFor('play:' + id, id), next), isOpen,
    playEvent: (key, next) => play(pickFor(key, (D().events || {})[key]), next)
  };
}

/* =============================================================================
   MENU — Project 3
   -----------------------------------------------------------------------------
   The start of the game's menu system: full-screen menu pages on top of the
   game. The pause button opens the "pause" page; later pages (inventory,
   settings, stash, vendors...) are added the same way.

   const menu = createMenu({ onOpen, onClose });
   menu.addPage('pause', {
     title: 'Paused',
     items: [
       { label: 'Resume', close: true },              // closes the menu
       { label: 'Inventory', page: 'inventory' },     // opens another page (with a Back button)
       { label: 'Settings', soon: true },             // greyed out: "coming soon"
       { label: 'Do a thing', action: () => { ... } }, // runs code (menu stays open unless it returns 'close')
       { label: 'Whetstone', sub: '+15% damage', right: '8', disabled: true }, // a second line + a right-hand badge (e.g. a price)
       { label: 'Wallet: 12', info: true }             // just a line to read, not a button
     ],
     header: () => 'html shown above the items (optional)',
     closeLabel: 'Leave', onLeave: () => { ... }   // a close button at the bottom (+ what happens after it)
   });
   menu.open('pause'); menu.close(); menu.isOpen();

   onOpen / onClose: the game pauses and un-pauses itself here.
   A page's items can also be a function returning the list, so a page can
   show things that change (e.g. what's in your bag right now).
   ============================================================================= */
function createMenu(opts) {
  opts = opts || {};
  const pages = {};
  let stack = []; // page ids, the one on screen last

  const root = document.createElement('div');
  root.className = 'menu-screen hidden';
  root.innerHTML = '<div class="menu-panel"><h2 class="menu-title"></h2><div class="menu-header"></div><div class="menu-items"></div></div>';
  document.body.appendChild(root);
  const titleEl = root.querySelector('.menu-title'), headerEl = root.querySelector('.menu-header'), itemsEl = root.querySelector('.menu-items');
  // touches on the dim background don't reach the game underneath
  root.addEventListener('touchstart', e => { if (e.target === root) e.preventDefault(); }, { passive: false });

  function button(label, className, onTap) {
    const b = document.createElement('button');
    b.className = 'menu-btn' + (className ? ' ' + className : '');
    b.textContent = label;
    if (onTap) b.addEventListener('click', onTap);
    else b.disabled = true;
    return b;
  }

  const esc = t => String(t).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
  // label + optional second line (sub) + optional right-hand badge (right, may be html)
  // (bad = a red second line, e.g. a shop item's drawback; icon = html for a picture on the left)
  function fill(el, it) {
    if (!it.sub && !it.bad && !it.icon && it.right === undefined) { el.textContent = it.label; return; }
    el.innerHTML = (it.icon || '') + '<span class="menu-main"><b>' + esc(it.label) + '</b>' + (it.sub ? '<small>' + esc(it.sub) + '</small>' : '') +
      (it.bad ? '<small class="menu-bad">' + esc(it.bad) + '</small>' : '') + '</span>' +
      (it.right !== undefined ? '<span class="menu-right">' + it.right + '</span>' : '');
    el.classList.add('rich');
  }
  function render() {
    const id = stack[stack.length - 1], page = pages[id];
    if (!page) return;
    titleEl.textContent = typeof page.title === 'function' ? page.title() : (page.title || '');
    const head = page.header ? page.header() : '';
    headerEl.innerHTML = head || ''; headerEl.style.display = head ? '' : 'none';
    itemsEl.innerHTML = '';
    const items = typeof page.items === 'function' ? page.items() : (page.items || []);
    items.forEach(it => {
      if (it.soon) { const b = button(it.label, 'soon'); b.innerHTML = it.label + ' <small>coming soon</small>'; itemsEl.appendChild(b); return; }
      if (it.info) { const d = document.createElement('div'); d.className = 'menu-info' + (it.className ? ' ' + it.className : ''); fill(d, it); itemsEl.appendChild(d); return; }
      const b = button(it.label, it.className, it.disabled ? null : () => {
        if (it.close) return close();
        if (it.page) { stack.push(it.page); return render(); }
        if (it.action && it.action() === 'close') close();
        else render();
      });
      fill(b, it);
      itemsEl.appendChild(b);
    });
    if (stack.length > 1) itemsEl.appendChild(button('‹ Back', 'back', () => { stack.pop(); render(); }));
    else {
      const cl = typeof page.closeLabel === 'function' ? page.closeLabel() : page.closeLabel; // (can be a function, like title)
      if (cl) itemsEl.appendChild(button(cl, 'back', () => { close(); if (page.onLeave) page.onLeave(); }));
    }
  }

  function open(id) {
    if (!pages[id]) return;
    const wasOpen = isOpen();
    stack = [id];
    root.classList.remove('hidden');
    render();
    if (!wasOpen && opts.onOpen) opts.onOpen();
  }
  function close() {
    if (!isOpen()) return;
    stack = [];
    root.classList.add('hidden');
    if (opts.onClose) opts.onClose();
  }
  function isOpen() { return !root.classList.contains('hidden'); }

  return {
    addPage(id, page) { pages[id] = page; if (stack.includes(id)) render(); },
    open, close, isOpen, refresh: () => { if (isOpen()) render(); }, current: () => stack[stack.length - 1] || null,
    back() { if (stack.length > 1) { stack.pop(); render(); } else close(); }
  };
}

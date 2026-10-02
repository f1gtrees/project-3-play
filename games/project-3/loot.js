/* =============================================================================
   LOOT BOXES — Project 3
   -----------------------------------------------------------------------------
   A loot box is a BOX TYPE (shop-data.js → boxes, World Builder → Shop →
   Box types): its chest art, the coins inside, and what you can take —
     random: true  -> roll `picks` things from its contents list, each line's
                      chance being its share (60 / 30 / 10 …)
     random: false -> every line is inside, each with its own chance (%)
     choose: 'one' -> take ONE of them;  'all' -> get the lot
   A content line = { type: 'item' | 'special' | 'money', id ('*' = any one at
   random), chance, min / max (money) }.

   Boxes in rooms (room editor → Loot box) are stored in the room as:
     lootBoxes: [ { id, x, y, box: 'supplyCrate',
       after: 'gone' | 'respawn' | 'stay',  // once you take something
       respawnSeconds: 60 } ]               // (respawn) turns up again elsewhere
   (Older boxes with contents / offers / moneyMin / moneyMax still work.)
   The vendor can sell box types too (shop.js — vendor sections, kind 'box').

   Walk close and press and hold on it (interact.js). It opens — with the
   on-screen opening (chest-show.js) if the type has show: true — the coins
   go straight into your wallet, then a menu shows what's inside.
   Leave a room box without taking anything and it stays open for later.
   Everything resets at the hub, like the rest of the run.
   ============================================================================= */
const LOOT_DEFAULTS = { box: '', contents: 'items', offers: 2, moneyMin: 3, moneyMax: 8, after: 'gone', respawnSeconds: 60 };

function boxType(id) { return (SHOP.boxes || []).find(b => b.id === id) || null; }
function chestArt(id) { return (SHOP.chests || []).find(c => c.id === id) || null; }

// This run's state of every box in the room (kept in runRoom.loot by id).
function lootRoomState(room, runRoom) {
  runRoom.loot = runRoom.loot || {};
  (room.lootBoxes || []).forEach(b => {
    if (!runRoom.loot[b.id]) runRoom.loot[b.id] = { state: 'closed', x: b.x, y: b.y, offers: null, money: 0 };
  });
  return runRoom.loot;
}
const lootDef = (room, id) => Object.assign({}, LOOT_DEFAULTS, (room.lootBoxes || []).find(b => b.id === id) || {});
// A room box's type: its `box`, or one made from the older fields.
function roomBoxType(D) {
  const T = D.box && boxType(D.box);
  if (T) return T;
  const c = D.contents || 'items';
  return { id: '', name: 'Loot', chest: '', show: false, moneyMin: D.moneyMin || 0, moneyMax: D.moneyMax || 0, random: true,
    picks: c === 'money' ? 0 : (D.offers || 2), choose: 'one', contents: c === 'money' ? [] : [{ type: c === 'specials' ? 'special' : 'item', id: '*', chance: 100 }] };
}

// ---- what's inside ----
const lineChance = e => Math.max(0, e.chance === undefined ? 100 : Number(e.chance) || 0);
function weightedPick(list, weight) {
  const total = list.reduce((t, x) => t + weight(x), 0);
  if (total <= 0) return -1;
  let r = Math.random() * total;
  for (let i = 0; i < list.length; i++) { r -= weight(list[i]); if (r <= 0) return i; }
  return list.length - 1;
}
// One content line -> one concrete thing ({ item } / { special } / { money }), or null if nothing fits.
function resolveLine(e, used, specials, shop) {
  if (e.type === 'money') {
    const lo = Math.min(e.min || 0, e.max || 0), hi = Math.max(e.min || 0, e.max || 0);
    return { money: Math.round(lo + Math.random() * (hi - lo)) };
  }
  if (e.type === 'special') {
    const pool = (!e.id || e.id === '*' ? Object.keys(SPECIALS) : [e.id]).filter(k => SPECIALS[k] && !specials.owned.has(k) && !used.has('s:' + k));
    if (!pool.length) return null;
    const k = pool[Math.floor(Math.random() * pool.length)]; used.add('s:' + k);
    return { special: k };
  }
  // item
  const pool = (!e.id || e.id === '*' ? (SHOP.items || []) : [shopItem(e.id)].filter(Boolean))
    .filter(it => itemAvailable(shop, it, specials.owned) && !used.has('i:' + it.id));
  const i = weightedPick(pool, it => Math.max(0, it.weight === undefined ? 1 : it.weight));
  if (i < 0) return null;
  used.add('i:' + pool[i].id);
  return { item: pool[i].id };
}
// Open a box type: coins into the wallet, and the list of things inside.
function rollBox(T, hero, specials, shop) {
  const lo = Math.min(T.moneyMin || 0, T.moneyMax || 0), hi = Math.max(T.moneyMin || 0, T.moneyMax || 0);
  const money = Math.round(lo + Math.random() * (hi - lo));
  hero.money = (hero.money || 0) + money;
  const used = new Set(), offers = [], lines = (T.contents || []).filter(e => lineChance(e) > 0);
  if (T.random !== false) {
    const pool = lines.slice(), n = Math.max(0, Math.round(T.picks === undefined ? 1 : T.picks));
    let guard = 0;
    while (offers.length < n && pool.length && guard++ < 100) {
      const i = weightedPick(pool, lineChance), o = resolveLine(pool[i], used, specials, shop);
      if (!o) { pool.splice(i, 1); continue; }  // nothing left of that kind
      offers.push(o);
      if (pool[i].type !== 'money' && pool[i].id && pool[i].id !== '*') pool.splice(i, 1); // a named thing only once
    }
  } else {
    lines.forEach(e => { if (Math.random() * 100 < lineChance(e)) { const o = resolveLine(e, used, specials, shop); if (o) offers.push(o); } });
  }
  return { money, offers, choose: T.choose === 'all' ? 'all' : 'one', name: T.name || 'Loot' };
}
// Taking one thing.
function applyLoot(pick, hero, specials, shop) {
  if (pick.money) hero.money = (hero.money || 0) + pick.money;
  if (pick.special) { toggleSpecial(specials, pick.special, true); shop.fx = { color: 'orange', t: 0 }; }
  if (pick.item) {
    const it = shopItem(pick.item);
    if (it) {
      itemChanges(it).forEach(e => applyEffect(hero, e.stat, e.add));
      shop.bought[it.id] = (shop.bought[it.id] || 0) + 1; shop.log.push(it.id);
      shop.fx = { color: buffColor(it), t: 0 };
    }
  }
}

// Every frame: boxes waiting to come back turn up somewhere new.
function updateLoot(room, runRoom, clock, hero, blockers, world) {
  const L = lootRoomState(room, runRoom);
  Object.keys(L).forEach(id => {
    const st = L[id];
    if (st.state === 'waiting' && clock >= st.respawnAt) {
      const spot = (typeof vendorSpot === 'function' && vendorSpot(hero, blockers, world)) || { x: st.x, y: st.y };
      Object.assign(st, { state: 'closed', x: spot.x, y: spot.y, offers: null, money: 0 });
    }
  });
}

// How big a room box is drawn (art px): its chest art × scale, or the icon.
function lootSize(room, id) {
  const T = roomBoxType(lootDef(room, id)), art = chestArt(T.chest), G = SHOP.loot || {}, I = SHOP.icons || { size: 16 };
  if (art) { const k = T.scale || 1; return { w: art.frameW * k, h: art.frameH * k, art, k }; }
  const sz = I.size * (G.scale || 1); return { w: sz, h: sz, art: null, k: G.scale || 1 };
}

// Boxes you can press on right now (interact.js targets).
function lootTargets(room, runRoom, openBox) {
  const G = SHOP.loot || {}, L = runRoom.loot || {};
  return Object.keys(L).filter(id => L[id].state === 'closed' || L[id].state === 'open').map(id => {
    const st = L[id], sz = lootSize(room, id);
    return { key: 'loot:' + id, x: st.x, y: st.y, range: G.talkRange || 30, holdSeconds: G.holdSeconds || 0.8,
      box: { x: st.x - sz.w / 2, y: st.y - sz.h - (G.bubbleLift || 4) - 11, w: sz.w, h: sz.h + (G.bubbleLift || 4) + 11 }, open: () => openBox(id) };
  });
}

// Opening a room box: coins on the first open, and the things to choose from.
function openLootBox(room, runRoom, id, hero, specials, shop) {
  const st = runRoom.loot[id];
  if (st.state === 'closed') {
    const r = rollBox(roomBoxType(lootDef(room, id)), hero, specials, shop);
    Object.assign(st, { state: 'open', money: r.money, offers: r.offers, choose: r.choose, name: r.name });
    if (!st.offers.length) st.offers = null;
  }
  return st;
}
// You took something (or there was nothing to take): what happens to the box.
function finishLootBox(room, runRoom, id, clock) {
  const st = runRoom.loot[id], D = lootDef(room, id);
  if (D.after === 'respawn') { st.state = 'waiting'; st.respawnAt = clock + Math.max(1, D.respawnSeconds); }
  else if (D.after === 'stay') st.state = 'empty';
  else st.state = 'gone';
  st.offers = null;
}
// A room box as a menu "session" (see addLootPage).
function roomLootSession(room, runRoom, id, clock) {
  return { st: runRoom.loot[id], finish: () => finishLootBox(room, runRoom, id, clock()), bought: false };
}
// A box bought from the vendor: rolled now, gone once you've taken from it.
function boughtLootSession(T, hero, specials, shop) {
  const r = rollBox(T, hero, specials, shop);
  const st = { state: 'open', money: r.money, offers: r.offers.length ? r.offers : null, choose: r.choose, name: r.name };
  return { st, finish: () => { st.offers = null; }, bought: true };
}

// ---- drawing ----
function drawChestFrame(ctx, images, art, frame, cx, bottomY, scale) {
  const im = images[art.path];
  if (!im || !im.ok) return false;
  const w = art.frameW * scale, h = art.frameH * scale;
  ctx.drawImage(im.img, frame * art.frameW, 0, art.frameW, art.frameH, Math.round(cx - w / 2), Math.round(bottomY - h), w, h);
  return true;
}
function lootDrawItems(ctx, runRoom, images, toX, toY, s, room) {
  const G = SHOP.loot || {}, I = SHOP.icons, img = I && images[I.path], L = (runRoom && runRoom.loot) || {};
  return Object.keys(L).filter(id => ['closed', 'open', 'empty'].includes(L[id].state)).map(id => {
    const st = L[id];
    return { y: st.y, draw: () => {
      if (st.state === 'empty') ctx.globalAlpha = 0.5;
      const sz = room ? lootSize(room, id) : { art: null, k: G.scale || 1 };
      if (sz.art && drawChestFrame(ctx, images, sz.art, st.state === 'closed' ? 0 : sz.art.frames - 1, toX(st.x), toY(st.y), sz.k * s)) { ctx.globalAlpha = 1; return; }
      const k = G.scale || 1, n = st.state === 'closed' ? (G.icon !== undefined ? G.icon : 196) : (G.openIcon !== undefined ? G.openIcon : 197);
      const isz = I ? I.size : 16, x = Math.round(toX(st.x) - isz * k * s / 2), y = Math.round(toY(st.y) - isz * k * s);
      if (img && img.ok) ctx.drawImage(img.img, (n % I.cols) * isz, Math.floor(n / I.cols) * isz, isz, isz, x, y, isz * k * s, isz * k * s);
      else { ctx.fillStyle = '#c9862f'; ctx.fillRect(x, y, isz * k * s, isz * k * s); }
      ctx.globalAlpha = 1;
    } };
  });
}
function drawLootBars(ctx, runRoom, images, toX, toY, s, now, hero, it, room) {
  const G = SHOP.loot || {}, B = SHOP.vendor.bubble, L = (runRoom && runRoom.loot) || {};
  Object.keys(L).forEach(id => {
    const st = L[id];
    if (st.state !== 'closed' && st.state !== 'open') return;
    const near = hero && Math.hypot(hero.x - st.x, hero.y - st.y) <= (G.talkRange || 30);
    const progress = it && it.target === 'loot:' + id ? it.progress : 0;
    if (!near && !progress) return; // only shows when you're close (less clutter)
    const h = room ? lootSize(room, id).h : (SHOP.icons ? SHOP.icons.size : 16) * (G.scale || 1);
    drawHoldBar(ctx, images[B.path], B, toX(st.x), toY(st.y - h - (G.bubbleLift || 4)), progress, near, s, G.bubbleWidth || 2, now);
  });
}
// A chest's closed frame as a small picture for menus.
function chestIconHtml(T) {
  const art = T && chestArt(T.chest);
  if (!art) return typeof iconHtml === 'function' ? iconHtml({ icon: (SHOP.loot || {}).icon }) : '';
  const k = Math.max(1, Math.floor(40 / Math.max(art.frameW, art.frameH)));
  return '<span class="item-ico" style="background-image:url(' + art.path + ');background-position:0 0;background-size:' + art.frameW * art.frames * k + 'px ' + art.frameH * k +
    'px;width:' + art.frameW * k + 'px;height:' + art.frameH * k + 'px"></span>';
}

// ---- the menu page (menu.js) ----
// getSession() -> { st, finish, bought } (roomLootSession / boughtLootSession).
// afterTake() (optional): runs after you take something (e.g. a text box).
function addLootPage(menu, getSession, hero, specials, shop, afterTake) {
  const offerRow = o => {
    if (o.money) return { label: o.money + ' ' + ((typeof HERO_COMBAT !== 'undefined' && HERO_COMBAT.money.name) || 'coins'), icon: '<span class="coin-ico big-coin"></span>' };
    if (o.special) { const S = SPECIALS[o.special] || {}; return { label: S.label || o.special, sub: 'Special' + (S.build ? ' · ' + S.build : '') }; }
    const it = shopItem(o.item) || { name: o.item, desc: '' };
    return { label: it.name, sub: it.desc, bad: drawbackText(it), icon: iconHtml(it) };
  };
  const done = (S) => { S.finish(); menu.close(); if (afterTake) afterTake(); };
  menu.addPage('loot', {
    title: () => { const S = getSession(); return String((S && S.st.name) || 'Loot').toUpperCase(); },
    header: () => {
      const S = getSession(), st = S && S.st;
      return st && st.money ? '<div class="menu-wallet">+' + coinHtml(st.money) + ' found</div>' : '';
    },
    items: () => {
      const S = getSession(), st = S && S.st;
      if (!st || !st.offers) return [{ label: 'It’s empty.', info: true }];
      if (st.choose === 'all') {
        return st.offers.map(o => Object.assign(offerRow(o), { info: true, className: 'shop-item rich' })).concat([{ label: 'Take all', className: 'take-all',
          action: () => { st.offers.forEach(o => applyLoot(o, hero, specials, shop)); done(S); } }]);
      }
      return st.offers.map(o => Object.assign(offerRow(o), { right: 'Take', className: 'shop-item',
        action: () => { applyLoot(o, hero, specials, shop); done(S); } }));
    },
    closeLabel: () => { const S = getSession(); return S && S.bought && S.st.offers ? 'Leave it (it’s lost)' : 'Leave'; }
  });
}

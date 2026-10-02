/* =============================================================================
   SHOP — Project 3: the wandering vendor, buying, and the run's upgrades
   -----------------------------------------------------------------------------
   The numbers and the item list live in shop-data.js (World Builder → Shop).

   How it plays:
     - Arriving in a FIGHT room, the vendor may be there (vendor.appearChance %,
       or the room's own setting: 'always' / 'never' — World Builder → room →
       Vendor). They stand somewhere random, away from you.
     - Walk up to them and PRESS AND HOLD ON THEM (interact.js; E on the Mac):
       the bar over their head fills up, and after vendor.holdSeconds their
       shop opens: the sections of slots set in vendor.sections (World
       Builder → Shop → Vendor menu) — items, specials and loot boxes, fixed
       or random, some only once per run (then that slot shows Sold out).
     - Buy something and (vendor.leaveAfterBuy) they pack up and leave.
       vendor.respawnSeconds later they turn up again somewhere else (in
       whatever fight room you're in) with a new selection. Walk away
       without buying and they stay put.
     - A loot box bought here opens straight away (loot.js), with the
       on-screen opening if its type has show on (chest-show.js).
     - Everything bought lasts for the RUN and is wiped at the hub.

   Items can be switched off (off: true — never offered), carry an icon
   (a square from SHOP.icons), and have a catch: debuff: true + drawbacks,
   applied along with the effects and shown in red.

   What items do (their effects, [{ stat, add }]) — kept on the hero as
   hero.mods and read by combat.js (damage), specials.js (cooldown, area,
   special.<id>.<number>) and the page (speed):
     damage +%   speed +%   cooldown (specials sooner) +%   area (specials bigger) +%
     maxHp +n (can be negative; never below 1)   heal n (right away)
     special.<id>.<number> +n — e.g. special.fireball.count +1

   Generic shape: the vendor is a sheet + a few numbers, the effects are a
   short list of named stats — a candidate for the engine later.
   ============================================================================= */

function emptyMods() { return { damage: 0, speed: 0, cooldown: 0, area: 0, special: {} }; }

function createShop() {
  return {
    vendor: null,     // { x, y, anim, offers: [items] } while they're in this room
    away: 0,          // seconds until they come back (after a purchase)
    bought: {},       // item id -> how many this run
    log: [],          // item ids in the order bought (for the inventory page)
    onceSold: {},     // 'section:slot' -> true: a one-per-run slot that's been bought
    near: false       // hero is inside talkRange right now
  };
}

// The hub: a fresh run — no upgrades, no purchases, vendor ready to appear.
function resetRunShop(shop, hero, baseMaxHp) {
  shop.vendor = null; shop.away = 0; shop.bought = {}; shop.log = []; shop.onceSold = {}; shop.near = false;
  hero.mods = emptyMods();
  hero.maxHp = baseMaxHp; hero.hp = Math.min(hero.hp, hero.maxHp);
}

// ---- items ----
function shopItem(id) { return (SHOP.items || []).find(it => it.id === id) || null; }
// Specials an item needs (from effects like special.fireball.count).
function itemChanges(item) { return (item.effects || []).concat(item.debuff ? (item.drawbacks || []) : []); }
function itemNeeds(item) {
  return itemChanges(item).map(e => /^special\.([^.]+)\./.exec(e.stat || '')).filter(Boolean).map(m => m[1]);
}
function itemAvailable(shop, item, owned) {
  if (item.off) return false;
  if (item.max && (shop.bought[item.id] || 0) >= item.max) return false;
  return itemNeeds(item).every(id => owned.has(id));
}
// A random few, weighted, never the same item twice in one visit.
function rollOffers(shop, owned, count) {
  const pool = (SHOP.items || []).filter(it => itemAvailable(shop, it, owned));
  const out = [], n = Math.max(0, Math.round(count !== undefined ? count : (SHOP.vendor.offers || 3)));
  while (out.length < n && pool.length) {
    const total = pool.reduce((t, it) => t + Math.max(0, it.weight === undefined ? 1 : it.weight), 0);
    let r = Math.random() * total, pick = 0;
    for (let i = 0; i < pool.length; i++) { r -= Math.max(0, pool[i].weight === undefined ? 1 : pool[i].weight); if (r <= 0) { pick = i; break; } }
    out.push(pool.splice(pick, 1)[0]);
  }
  return out;
}

// ---- the shop menu: sections of slots (vendor.sections) ----
// Without sections: one list of `offers` random items (the older setup).
function vendorSections() {
  const V = SHOP.vendor;
  if (V.sections && V.sections.length) return V.sections;
  return [{ title: '', slots: Array.from({ length: Math.max(0, Math.round(V.offers || 3)) }, () => ({ kind: 'item', id: '*' })) }];
}
// What's on sale this visit: one row per slot, in order.
//   row = { key, section, kind, once, price, item | special | box, sold, empty }
function rollStock(shop, owned) {
  const V = SHOP.vendor, used = new Set(), out = [];
  vendorSections().forEach((sec, si) => (sec.slots || []).forEach((sl, j) => {
    const row = { key: si + ':' + j, section: si, kind: sl.kind || 'item', once: !!sl.once, sold: false, empty: false };
    out.push(row);
    if (row.once && shop.onceSold[row.key]) { row.sold = true; return; }
    if (sl.chance !== undefined && Math.random() * 100 >= sl.chance) { row.empty = true; return; }
    const any = !sl.id || sl.id === '*', has = (v) => v !== undefined && v !== '' && v !== null;
    if (row.kind === 'special') {
      const pool = (any ? Object.keys(SPECIALS) : [sl.id]).filter(k => SPECIALS[k] && !owned.has(k) && !used.has('s:' + k));
      if (!pool.length) { row.empty = true; return; }
      row.special = pool[Math.floor(Math.random() * pool.length)]; used.add('s:' + row.special);
      row.price = has(sl.price) ? sl.price : (V.specialPrice !== undefined ? V.specialPrice : 25);
    } else if (row.kind === 'box') {
      const pool = (any ? (SHOP.boxes || []) : [typeof boxType === 'function' ? boxType(sl.id) : null]).filter(b => b && !used.has('b:' + b.id));
      if (!pool.length) { row.empty = true; return; }
      row.box = pool[Math.floor(Math.random() * pool.length)]; used.add('b:' + row.box.id);
      row.price = has(sl.price) ? sl.price : (row.box.price || 0);
    } else {
      const pool = (any ? (SHOP.items || []) : [shopItem(sl.id)].filter(Boolean)).filter(it => itemAvailable(shop, it, owned) && !used.has('i:' + it.id));
      const total = pool.reduce((t, it) => t + Math.max(0, it.weight === undefined ? 1 : it.weight), 0);
      if (!pool.length || total <= 0) { row.empty = true; return; }
      let r = Math.random() * total, pick = pool[pool.length - 1];
      for (const it of pool) { r -= Math.max(0, it.weight === undefined ? 1 : it.weight); if (r <= 0) { pick = it; break; } }
      row.item = pick; used.add('i:' + pick.id);
      row.price = has(sl.price) ? sl.price : pick.price;
    }
  }));
  return out;
}
// Buy one row: pay, apply it (a box is opened by the game — see the
// afterBuy hook), mark the slot sold. Returns false if you can't afford it.
function buyRow(shop, hero, row, specials) {
  if (row.sold || row.empty || (hero.money || 0) < row.price) return false;
  hero.money -= row.price;
  if (row.item) {
    itemChanges(row.item).forEach(e => applyEffect(hero, e.stat, e.add));
    shop.bought[row.item.id] = (shop.bought[row.item.id] || 0) + 1;
    shop.log.push(row.item.id);
    shop.fx = { color: buffColor(row.item), t: 0 }; // a glow on the hero
  }
  if (row.special) { toggleSpecial(specials, row.special, true); shop.fx = { color: 'orange', t: 0 }; }
  row.sold = true;
  if (row.once) shop.onceSold[row.key] = true;
  if (SHOP.vendor.leaveAfterBuy !== false) vendorLeaves(shop);
  return true;
}
function vendorLeaves(shop) {
  shop.leaving = shop.vendor ? { x: shop.vendor.x, y: shop.vendor.y, t: 0 } : null; // a puff where they stood
  shop.vendor = null;
  shop.away = Math.max(1, SHOP.vendor.respawnSeconds || 60);
}

// Which glow plays when it's bought: the item's own `buff`, else by what it does.
function buffColor(item) {
  if (item.buff) return item.buff;
  const first = ((item.effects || [])[0] || {}).stat || '';
  if (first === 'damage') return 'blue';
  if (first === 'maxHp' || first === 'heal') return 'green';
  if (first.startsWith('special.') || first === 'cooldown' || first === 'area') return 'orange';
  return 'purple';
}
function applyEffect(hero, stat, add) {
  const M = hero.mods || (hero.mods = emptyMods());
  add = Number(add) || 0;
  if (stat === 'maxHp') { hero.maxHp = Math.max(1, hero.maxHp + add); hero.hp = Math.min(hero.hp, hero.maxHp); }
  else if (stat === 'heal') hero.hp = Math.min(hero.maxHp, hero.hp + add);
  else if (stat.startsWith('special.')) {
    const [, id, key] = stat.split('.');
    const S = M.special[id] || (M.special[id] = {});
    S[key] = (S[key] || 0) + add;
  } else M[stat] = (M[stat] || 0) + add;
}

// Buy: pay, apply, the vendor leaves. Returns false if you can't afford it.
function buyItem(shop, hero, item) {
  if ((hero.money || 0) < item.price) return false;
  hero.money -= item.price;
  itemChanges(item).forEach(e => applyEffect(hero, e.stat, e.add));
  shop.bought[item.id] = (shop.bought[item.id] || 0) + 1;
  shop.log.push(item.id);
  shop.leaving = shop.vendor ? { x: shop.vendor.x, y: shop.vendor.y, t: 0 } : null; // a puff where they stood
  shop.fx = { color: buffColor(item), t: 0 }; // a glow on the hero
  shop.vendor = null;
  shop.away = Math.max(1, SHOP.vendor.respawnSeconds || 60);
  return true;
}

// ---- where the vendor stands ----
// A random spot on the floor, out of props, at least minDistance from the hero.
function vendorSpot(hero, blockers, world) {
  const V = SHOP.vendor, feet = { w: 24, h: 6 };
  let best = null;
  for (let i = 0; i < 40; i++) {
    const x = 20 + Math.random() * Math.max(1, world.w - 40), y = 30 + Math.random() * Math.max(1, world.h - 40);
    const box = { x: x - feet.w / 2, y: y - feet.h, w: feet.w, h: feet.h };
    if (blockers.some(b => box.x < b.x + b.w && box.x + box.w > b.x && box.y < b.y + b.h && box.y + box.h > b.y)) continue;
    const d = Math.hypot(x - hero.x, y - hero.y);
    if (d >= (V.minDistance || 80)) return { x: Math.round(x), y: Math.round(y) };
    if (!best || d > best.d) best = { x: Math.round(x), y: Math.round(y), d };
  }
  return best;
}
function placeVendor(shop, hero, blockers, world, owned, spot) {
  spot = spot || vendorSpot(hero, blockers, world);
  if (!spot) return false;
  shop.vendor = { x: spot.x, y: spot.y, anim: createSpriteAnimator(SHOP.vendor.sheet, 'idle'), offers: rollStock(shop, owned) };
  shop.near = false;
  return true;
}
// roomRule: 'always' | 'never' | undefined (= random). fight: is this a fight room.
function vendorEnterRoom(shop, roomRule, fight, hero, blockers, world, owned) {
  shop.vendor = null; shop.near = false; shop.leaving = null;
  shop.roomOk = fight && roomRule !== 'never';
  if (!shop.roomOk || shop.away > 0) return;
  if (roomRule === 'always' || Math.random() * 100 < (SHOP.vendor.appearChance || 0)) placeVendor(shop, hero, blockers, world, owned);
}

// Every frame (not while paused): the buy glow, the leaving puff, coming back.
function updateShop(shop, hero, blockers, world, owned, dt) {
  if (shop.fx) { shop.fx.t += dt; const B = SHOP.buffs; if (!B || shop.fx.t * 1000 >= B.frames * B.ms) shop.fx = null; }
  if (shop.leaving) { shop.leaving.t += dt; if (shop.leaving.t > 0.6) shop.leaving = null; }
  if (!shop.roomOk) return false;
  if (!shop.vendor && shop.away > 0) {
    shop.away -= dt;
    if (shop.away <= 0) { shop.away = 0; placeVendor(shop, hero, blockers, world, owned); }
  }
  const v = shop.vendor;
  if (!v) return false;
  updateSpriteAnim(v.anim, dt * 1000);
  const near = Math.hypot(hero.x - v.x, hero.y - v.y) <= (SHOP.vendor.talkRange || 22);
  shop.near = near;
  return false;
}
// The vendor as something to press and hold on (interact.js), or nothing.
function vendorTarget(shop, open) {
  const v = shop.vendor, V = SHOP.vendor, sh = V.sheet;
  if (!v) return null;
  return { key: 'vendor', x: v.x, y: v.y, range: V.talkRange || 40, holdSeconds: V.holdSeconds || 1.2, open,
    box: { x: v.x - sh.anchorX, y: v.y - sh.anchorY - (V.bubbleLift || 6) - V.bubble.frameH, w: sh.frameW, h: sh.anchorY + (V.bubbleLift || 6) + V.bubble.frameH } };
}

// ---- drawing ----
// The vendor joins the depth-sorted list; the talk bubble and the leaving puff go on top.
function vendorDrawItems(ctx, shop, images, toX, toY, s, now) {
  const v = shop.vendor;
  if (!v) return [];
  return [{ y: v.y, draw: () => {
    drawSpriteAnim(ctx, images[SHOP.vendor.sheet.path], v.anim, toX(v.x), toY(v.y), s, false, { w: 16, h: 22, color: '#c9a14a' });
  } }];
}
function drawShopOnTop(ctx, shop, images, toX, toY, s, now, hero, it) {
  // the buff glow rising around the hero after a purchase
  const BF = SHOP.buffs;
  if (shop.fx && BF && hero) {
    const img = images[BF[shop.fx.color]], f = Math.min(BF.frames - 1, Math.floor(shop.fx.t * 1000 / BF.ms)), k = 1.5; // drawn 1.5× so it wraps the hero
    if (img && img.ok) {
      ctx.save(); ctx.globalAlpha = 0.6; // see-through, so the hero still shows inside the column of light
      ctx.drawImage(img.img, f * BF.frameW, 0, BF.frameW, BF.frameH,
        Math.round(toX(hero.x) - BF.anchorX * s * k), Math.round(toY(hero.y) - BF.anchorY * s * k + s * 2), BF.frameW * s * k, BF.frameH * s * k);
      ctx.restore();
    }
  }
  const v = shop.vendor, B = SHOP.vendor.bubble;
  if (v) {
    // the bar over their head: fills while you press and hold on them
    const V = SHOP.vendor, bob = Math.round(Math.sin(now / 250) * 1);
    const progress = it && it.target === 'vendor' ? it.progress : 0;
    drawHoldBar(ctx, images[B.path], B, toX(v.x), toY(v.y - V.sheet.anchorY - (V.bubbleLift || 6) + bob), progress, shop.near, s, V.bubbleWidth || 2, now);
  }
  if (shop.leaving) {
    const L = shop.leaving, k = L.t / 0.6;
    ctx.save(); ctx.globalAlpha = 1 - k; ctx.fillStyle = '#e8dcc0';
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4, r = (4 + k * 14);
      ctx.fillRect(Math.round(toX(L.x + Math.cos(a) * r) - s), Math.round(toY(L.y - 10 + Math.sin(a) * r * 0.7) - s), 2 * s, 2 * s);
    }
    ctx.restore();
  }
}

// ---- menu pages (menu.js) ----
const coinHtml = n => '<span class="coin-ico"></span>' + n;
// A stat's name for the shop's red "catch" line.
function statLabel(stat) {
  const s = (SHOP.stats || []).find(x => x.key === stat);
  if (s) return s.label.replace(/\s*\(%\)/, '');
  const m = /^special\.([^.]+)\.(.+)$/.exec(stat || '');
  if (m && typeof SPECIALS !== 'undefined' && SPECIALS[m[1]]) {
    const t = (SPECIALS[m[1]].tune || []).find(x => x[0] === m[2]);
    return SPECIALS[m[1]].label + ' ' + (t ? t[1].replace(/\s*\(.*\)/, '').toLowerCase() : m[2]);
  }
  return stat;
}
function drawbackText(item) {
  if (!item.debuff || !(item.drawbacks || []).length) return '';
  return item.drawbacks.map(d => {
    const pct = (SHOP.stats || []).some(x => x.key === d.stat && /%/.test(x.label)) ? '%' : '';
    return (d.add > 0 ? '+' : '') + d.add + pct + ' ' + statLabel(d.stat);
  }).join(', ');
}
// The item's picture from the icon sheet (a CSS-cropped square), or nothing.
function iconHtml(item) {
  const I = SHOP.icons;
  if (!I || item.icon === undefined || item.icon === null || item.icon < 0) return '';
  const col = item.icon % I.cols, row = Math.floor(item.icon / I.cols), k = 2;
  return '<span class="item-ico" style="background-image:url(' + I.path + ');background-position:-' + col * I.size * k + 'px -' + row * I.size * k +
    'px;background-size:' + I.cols * I.size * k + 'px auto;width:' + I.size * k + 'px;height:' + I.size * k + 'px"></span>';
}
// hooks (optional): afterBuy(row) — row.box set for a loot box (the game opens it),
// onLeave() — e.g. a text box (dialogue.js)
function addShopPages(menu, shop, hero, specials, hooks) {
  hooks = hooks || {};
  const secs = () => vendorSections();
  menu.addPage('shop', {
    title: 'VENDOR',
    header: () => '<div class="menu-wallet">' + coinHtml(hero.money || 0) + '</div>',
    items: () => {
      const v = shop.vendor;
      if (!v) return [{ label: 'They’ve packed up and gone.', info: true }];
      const out = [];
      secs().forEach((sec, si) => {
        const rows = v.offers.filter(r => r.section === si && !r.empty);
        if (!rows.length) return;
        if (sec.title) out.push({ label: sec.title, info: true, className: 'menu-section' });
        rows.forEach(r => {
          if (r.sold) { out.push({ label: r.once ? 'Sold out' : 'Sold', info: true, className: 'sold-slot' }); return; }
          let row;
          if (r.item) row = { label: r.item.name, sub: r.item.desc, bad: drawbackText(r.item), icon: iconHtml(r.item) };
          else if (r.special) { const S = SPECIALS[r.special] || {}; row = { label: S.label || r.special, sub: 'Special' + (S.build ? ' · ' + S.build : '') }; }
          else row = { label: r.box.name, sub: r.box.desc, icon: typeof chestIconHtml === 'function' ? chestIconHtml(r.box) : '' };
          out.push(Object.assign(row, { right: r.price ? coinHtml(r.price) : 'Free', className: 'shop-item', disabled: (hero.money || 0) < r.price,
            action: () => {
              if (!buyRow(shop, hero, r, specials)) return undefined;
              // a box, or the vendor leaving: close the shop; otherwise keep shopping
              if (r.box || SHOP.vendor.leaveAfterBuy !== false) { menu.close(); if (hooks.afterBuy) hooks.afterBuy(r); }
              return undefined;
            } }));
        });
      });
      if (!out.some(r => !r.info)) out.push({ label: 'Nothing left to sell you.', info: true });
      return out;
    },
    closeLabel: 'Leave',
    onLeave: () => { if (hooks.onLeave) hooks.onLeave(); }
  });
  menu.addPage('inventory', {
    title: 'INVENTORY',
    header: () => '<div class="menu-wallet">' + coinHtml(hero.money || 0) +
      '<span class="menu-hp">♥ ' + (Math.round(hero.hp * 10) / 10) + ' / ' + hero.maxHp + '</span></div>',
    items: () => {
      const out = [];
      const owned = [...specials.owned];
      out.push({ label: 'Specials', info: true, className: 'menu-section' });
      if (!owned.length) out.push({ label: 'None yet', sub: 'beat a mini boss to open a chest', info: true });
      owned.forEach(id => out.push({ label: SPECIALS[id] ? SPECIALS[id].label : id, sub: SPECIALS[id] ? SPECIALS[id].build : '', info: true }));
      out.push({ label: 'Bought this run', info: true, className: 'menu-section' });
      const ids = Object.keys(shop.bought);
      if (!ids.length) out.push({ label: 'Nothing yet', sub: 'find the vendor in a fight room', info: true });
      ids.forEach(id => { const it = shopItem(id); out.push({ label: (it ? it.name : id) + (shop.bought[id] > 1 ? '  ×' + shop.bought[id] : ''), sub: it ? it.desc : '', bad: it ? drawbackText(it) : '', icon: it ? iconHtml(it) : '', info: true }); });
      return out;
    }
  });
}

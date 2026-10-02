// ============================================================
// shop-data.js — Project 3's wandering vendor and what they sell.
// Written by World Builder (Shop button). Plain data — safe to hand-edit.
//
// vendor: offers (items shown per visit), appearChance (% in a fight
//   room), respawnSeconds (comes back this long after a purchase),
//   talkRange (walk this close to trade), minDistance (never appears
//   closer than this to the player), plus its sprite sheet.
// items: price, weight (how often it's picked), max (most per run,
//   0 = no limit), effects: [{ stat, add }] — stats are listed below,
//   or "special.<id>.<number>" to change a special's own number.
//   icon (a square of the icons sheet), debuff + drawbacks (the catch,
//   shown in red), off: true (switched off — never offered).
// ============================================================

const SHOP = {
  vendor: {
    sheet: {
      path: "assets/shop/merchant.png",
      frameW: 41,
      frameH: 33,
      anchorX: 21,
      anchorY: 30,
      anims: {
        idle: { row: 0, frames: 10, ms: 110 }
      }
    },
    bubble: { path: "assets/shop/talk-bubble.png", frameW: 13, frameH: 11, frames: 10 },
    offers: 3,
    leaveAfterBuy: true,
    specialPrice: 25,
    sections: [
      {
        title: "Upgrades",
        slots: [
          { kind: "item", id: "whetstone", price: 15 },
          { kind: "item", id: "heartFlask", price: 15 },
          { kind: "item", id: "swiftBoots", price: 15 }
        ]
      },
      {
        title: "Loot boxes",
        slots: [
          { kind: "box", id: "supplyCrate", once: true, price: 0 },
          { kind: "box", id: "gamblersChest", chance: 50, once: true }
        ]
      }
    ],
    appearChance: 100,
    respawnSeconds: 90,
    talkRange: 40,
    holdSeconds: 1.5,
    bubbleWidth: 2.5,
    bubbleLift: 6,
    minDistance: 80
  },
  icons: { path: "assets/ui/icons.png", size: 16, cols: 12 },
  loot: {
    icon: 196,
    openIcon: 197,
    scale: 1,
    holdSeconds: 0.8,
    talkRange: 30,
    bubbleWidth: 2,
    bubbleLift: 4,
    show: { size: 6, hold: 0.6, dim: 70, rays: true }
  },
  chests: [
    {
      id: "big-red",
      name: "Big chest (red)",
      path: "assets/chests/big-red.png",
      frameW: 38,
      frameH: 24,
      frames: 35,
      ms: 45
    },
    {
      id: "big-gold",
      name: "Big chest (gold)",
      path: "assets/chests/big-gold.png",
      frameW: 38,
      frameH: 24,
      frames: 35,
      ms: 45
    },
    {
      id: "big-steel",
      name: "Big chest (steel)",
      path: "assets/chests/big-steel.png",
      frameW: 38,
      frameH: 24,
      frames: 35,
      ms: 45
    },
    {
      id: "small-red",
      name: "Small chest (red)",
      path: "assets/chests/small-red.png",
      frameW: 17,
      frameH: 10,
      frames: 32,
      ms: 45
    },
    {
      id: "small-gold",
      name: "Small chest (gold)",
      path: "assets/chests/small-gold.png",
      frameW: 17,
      frameH: 10,
      frames: 32,
      ms: 45
    },
    {
      id: "small-steel",
      name: "Small chest (steel)",
      path: "assets/chests/small-steel.png",
      frameW: 17,
      frameH: 10,
      frames: 32,
      ms: 45
    },
    {
      id: "crate-red",
      name: "Crate (red)",
      path: "assets/chests/crate-red.png",
      frameW: 22,
      frameH: 26,
      frames: 40,
      ms: 45
    },
    {
      id: "crate-gold",
      name: "Crate (gold)",
      path: "assets/chests/crate-gold.png",
      frameW: 22,
      frameH: 26,
      frames: 40,
      ms: 45
    },
    {
      id: "crate-steel",
      name: "Crate (steel)",
      path: "assets/chests/crate-steel.png",
      frameW: 22,
      frameH: 26,
      frames: 40,
      ms: 45
    },
    {
      id: "round-red",
      name: "Round chest (red)",
      path: "assets/chests/round-red.png",
      frameW: 20,
      frameH: 19,
      frames: 40,
      ms: 45
    },
    {
      id: "round-gold",
      name: "Round chest (gold)",
      path: "assets/chests/round-gold.png",
      frameW: 20,
      frameH: 19,
      frames: 40,
      ms: 45
    },
    {
      id: "round-steel",
      name: "Round chest (steel)",
      path: "assets/chests/round-steel.png",
      frameW: 20,
      frameH: 19,
      frames: 40,
      ms: 45
    },
    {
      id: "urn-red",
      name: "Urn (red)",
      path: "assets/chests/urn-red.png",
      frameW: 28,
      frameH: 16,
      frames: 19,
      ms: 45
    },
    {
      id: "urn-gold",
      name: "Urn (gold)",
      path: "assets/chests/urn-gold.png",
      frameW: 28,
      frameH: 16,
      frames: 19,
      ms: 45
    },
    {
      id: "urn-steel",
      name: "Urn (steel)",
      path: "assets/chests/urn-steel.png",
      frameW: 28,
      frameH: 16,
      frames: 19,
      ms: 45
    }
  ],
  boxes: [
    {
      id: "supplyCrate",
      name: "Supply crate",
      desc: "Pick 1 of 2 items",
      chest: "crate-red",
      scale: 1,
      show: true,
      price: 10,
      moneyMin: 3,
      moneyMax: 8,
      random: true,
      picks: 2,
      choose: "one",
      contents: [
        { type: "item", id: "whetstone", chance: 100 },
        { type: "item", id: "heartFlask", chance: 50 },
        { type: "item", id: "swiftBoots", chance: 50 }
      ]
    },
    {
      id: "specialChest",
      name: "Special chest",
      desc: "",
      chest: "big-gold",
      scale: 1,
      show: true,
      price: 30,
      moneyMin: 0,
      moneyMax: 0,
      random: false,
      picks: 2,
      choose: "one",
      contents: [
        { type: "special", id: "iceSpike", chance: 100 },
        { type: "special", id: "fireball", chance: 100 },
        { type: "special", id: "boomerangAxe", chance: 100 },
        { type: "special", id: "poisonBottle", chance: 100 },
        { type: "special", id: "runeSpell", chance: 100 },
        { type: "special", id: "chainLightning", chance: 100 }
      ]
    },
    {
      id: "gamblersChest",
      name: "Gambler’s chest",
      desc: "Anything could be inside",
      chest: "round-steel",
      scale: 1,
      show: true,
      price: 15,
      moneyMin: 0,
      moneyMax: 0,
      random: true,
      picks: 3,
      choose: "one",
      contents: [
        { type: "money", min: 1, max: 35, chance: 35 }
      ]
    },
    {
      id: "coinUrn",
      name: "Coin urn",
      desc: "A handful of coins",
      chest: "urn-gold",
      scale: 1,
      show: false,
      price: 0,
      moneyMin: 5,
      moneyMax: 12,
      random: false,
      picks: 0,
      choose: "all",
      contents: []
    }
  ],
  buffs: {
    frameW: 18,
    frameH: 27,
    anchorX: 9,
    anchorY: 26,
    frames: 24,
    ms: 45,
    blue: "assets/shop/buff-blue.png",
    green: "assets/shop/buff-green.png",
    orange: "assets/shop/buff-orange.png",
    purple: "assets/shop/buff-purple.png"
  },
  stats: [
    { key: "damage", label: "Damage (%)" },
    { key: "maxHp", label: "Max health" },
    { key: "heal", label: "Heal now" },
    { key: "speed", label: "Walk speed (%)" },
    { key: "cooldown", label: "Specials faster (%)" },
    { key: "area", label: "Specials area (%)" }
  ],
  items: [
    { id: "whetstone", name: "The Switch", desc: "+15% damage", price: 10, weight: 3, max: 0, icon: 188,
      effects: [
        { stat: "damage", add: 15 }
      ] },
    { id: "heartFlask", name: "Organic Demon Lettuce", desc: "+1 max health", price: 15, weight: 2, max: 0, icon: 6,
      effects: [
        { stat: "maxHp", add: 1 },
        { stat: "heal", add: 1 }
      ] },
    { id: "bandage", name: "Bandage", desc: "Heal 2", price: 5, weight: 3, max: 0, off: true,
      effects: [
        { stat: "heal", add: 2 }
      ] },
    { id: "swiftBoots", name: "Juke Boots", desc: "+10% walk speed", price: 8, weight: 2, max: 3, icon: 174,
      effects: [
        { stat: "speed", add: 10 }
      ] },
    { id: "focusCharm", name: "Focus charm", desc: "Specials fire 15% sooner", price: 12, weight: 2, max: 3, off: true,
      effects: [
        { stat: "cooldown", add: 15 }
      ] },
    { id: "wideSigil", name: "Wide sigil", desc: "Specials reach 20% further", price: 12, weight: 2, max: 3, off: true,
      effects: [
        { stat: "area", add: 20 }
      ] },
    { id: "glassCannon", name: "Glass cannon", desc: "+40% damage", price: 14, weight: 1, max: 1, off: true,
      effects: [
        { stat: "damage", add: 40 }
      ],
      debuff: true, drawbacks: [
        { stat: "maxHp", add: -2 }
      ] },
    { id: "twinFlame", name: "Twin flame", desc: "+1 fireball", price: 15, weight: 2, max: 2, off: true,
      effects: [
        { stat: "special.fireball.count", add: 1 }
      ],
      debuff: true, drawbacks: [
        { stat: "maxHp", add: -1 }
      ] },
    { id: "spareAxe", name: "Spare axe", desc: "+1 boomerang axe", price: 15, weight: 2, max: 2, off: true,
      effects: [
        { stat: "special.boomerangAxe.axes", add: 1 }
      ] },
    { id: "longChain", name: "Long chain", desc: "Lightning jumps once more", price: 12, weight: 2, max: 2, off: true,
      effects: [
        { stat: "special.chainLightning.chain", add: 1 }
      ] },
    { id: "frostbite", name: "Frostbite", desc: "Ice spike: +2 spikes, +0.5 damage", price: 12, weight: 2, max: 2, off: true,
      effects: [
        { stat: "special.iceSpike.spikes", add: 2 },
        { stat: "special.iceSpike.damage", add: 0.5 }
      ] },
    { id: "leech", name: "Leech vial", desc: "Poison heals 20% more", price: 10, weight: 2, max: 2, off: true,
      effects: [
        { stat: "special.poisonBottle.healPct", add: 20 }
      ] },
    { id: "runeInk", name: "Rune ink", desc: "Rune aura +6 radius", price: 10, weight: 2, max: 3, off: true,
      effects: [
        { stat: "special.runeSpell.radius", add: 6 }
      ] }
  ]
};

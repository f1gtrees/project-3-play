// ============================================================
// dialogue-data.js — Project 3's text boxes.
// Written by World Builder (Text button). Plain data — safe to hand-edit.
//
// box: where the text box sits (x, y = its centre; w, h = its size — all a
//   share of the screen, 0–1), textSize / nameSize (px), typeSpeed
//   (letters a second; 0 = all at once).
// scripts: pages of { speaker, text, icon } — a tap turns the page.
// events: which script plays at each moment ('' = none); eventList names them.
// ============================================================

const DIALOGUE = {
  box: { x: 0.5, y: 0.8, w: 0.92, h: 0.2, textSize: 15, nameSize: 13, typeSpeed: 45 },
  eventList: [
    { key: "vendorBefore", label: "Vendor: before the shop opens" },
    { key: "vendorAfterBuy", label: "Vendor: after you buy something" },
    { key: "vendorLeave", label: "Vendor: you leave without buying" },
    { key: "lootBefore", label: "Loot box: before it opens" },
    { key: "lootAfter", label: "Loot box: after you take something" },
    { key: "bossAppears", label: "Mini boss appears" },
    { key: "roomCleared", label: "Room cleared (swarm beaten)" }
  ],
  events: {
    "vendorBefore": ["vendorHello","vendorHello2","vendorhello3"],
    "vendorAfterBuy": "vendorThanks2",
    "vendorLeave": "vendorThanks2",
    "lootBefore": "",
    "lootAfter": "",
    "bossAppears": "",
    "roomCleared": ""
  },
  scripts: {
    "vendorHello": { pages: [
      { speaker: "Vendor", text: "Ah, you're not dead yet... bummer." }
    ] },
    "vendorHello2": { pages: [
      { speaker: "Vendor", text: "Upgrades? I didn't think it was a skill issue we were dealing with." }
    ] },
    "vendorThanks2": { pages: [
      { speaker: "Vendor", text: "I'll be seeing youuuuuu" }
    ] },
    "vendorhello3": { pages: [
      { speaker: "Vendor", text: "I swear I know you from somewhere... that island that was on the news? ah, forget it." }
    ] },
    "miniboss": { pages: [
      { speaker: "", text: "ah land he comin.. ", icon: 0 }
    ] },
    "arrival": { pages: [
      { speaker: "", text: "What up shawty. Don't die..." }
    ] }
  }
};

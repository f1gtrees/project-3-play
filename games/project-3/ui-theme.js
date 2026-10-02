// ============================================================
// ui-theme.js — how Project 3's menus, text boxes, mini map and HUD look.
// Written by World Builder (Style button). ONE place: change a style and
// every menu / text box using it changes. Plain data — safe to hand-edit.
//
// fonts: { name, file, pixel } — pixel = the size where one font pixel is
//   one screen pixel (multiples look sharpest). frames / decorations:
//   pictures (numbered from 1 in the styles; 0 = none).
// styles: frame, slice, border, bg + bgAlpha, fillInset, font, size, color, accent,
//   deco, decoPlace, decoScale — for panel, button, buttonOn, textBox,
//   nameTab, minimap, hud.
// ============================================================

const UI_THEME = {
  fonts: [
    { name: "P3 Classic", file: "assets/fonts/p3-classic.ttf", pixel: 10 },
    { name: "P3 Bold", file: "assets/fonts/p3-bold.ttf", pixel: 10 },
    { name: "P3 Tiny", file: "assets/fonts/p3-tiny.ttf", pixel: 7 },
    { name: "Monospace (built in)", file: "", css: "monospace", pixel: 1 }
  ],
  frames: [
    "assets/ui/frames/frame-01.png",
    "assets/ui/frames/frame-02.png",
    "assets/ui/frames/frame-03.png",
    "assets/ui/frames/frame-04.png",
    "assets/ui/frames/frame-05.png",
    "assets/ui/frames/frame-06.png",
    "assets/ui/frames/frame-07.png",
    "assets/ui/frames/frame-08.png",
    "assets/ui/frames/frame-09.png",
    "assets/ui/frames/frame-10.png"
  ],
  decorations: [
    "assets/ui/decorations/deco-01.png",
    "assets/ui/decorations/deco-02.png",
    "assets/ui/decorations/deco-03.png",
    "assets/ui/decorations/deco-04.png",
    "assets/ui/decorations/deco-05.png",
    "assets/ui/decorations/deco-06.png",
    "assets/ui/decorations/deco-07.png",
    "assets/ui/decorations/deco-08.png"
  ],
  styles: {
    panel: { frame: 9, slice: 6, border: 12, bg: "#1c1a22", bgAlpha: 100, font: "P3 Classic", size: 20, color: "#ffe28a", accent: "#cfc7b0", deco: 0, decoPlace: "top-corners", decoScale: 2 },
    button: { frame: 4, slice: 5, border: 8, bg: "#6ee6ff", bgAlpha: 10, font: "P3 Classic", size: 20, color: "#ffffff", accent: "#cfc7b0", deco: 0, decoPlace: "sides", decoScale: 1 },
    buttonOn: { frame: 5, slice: 5, border: 8, bg: "#6ee6ff", bgAlpha: 35, font: "P3 Classic", size: 20, color: "#ffffff", accent: "#cfc7b0", deco: 0, decoPlace: "sides", decoScale: 1 },
    textBox: { frame: 9, slice: 6, border: 12, bg: "#14121a", bgAlpha: 94, font: "P3 Classic", size: 20, color: "#f4efe2", accent: "#ffe28a", deco: 0, decoPlace: "top-corners", decoScale: 2 },
    nameTab: { frame: 0, slice: 5, border: 0, bg: "#ffe28a", bgAlpha: 100, font: "P3 Bold", size: 10, color: "#1c1a22", accent: "#1c1a22", deco: 0, decoPlace: "sides", decoScale: 1 },
    minimap: { frame: 9, slice: 6, border: 8, bg: "#0a0a0e", bgAlpha: 85, font: "P3 Classic", size: 10, color: "#ffe28a", accent: "#ffe28a", deco: 0, decoPlace: "top-corners", decoScale: 1 },
    hud: { frame: 0, slice: 5, border: 0, bg: "#000000", bgAlpha: 40, font: "P3 Classic", size: 10, color: "#ffe28a", accent: "#ffe28a", deco: 0, decoPlace: "sides", decoScale: 1 }
  }
};

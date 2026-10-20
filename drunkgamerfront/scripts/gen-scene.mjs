// Generates public/scene.svg — the pixel-art "Neon Street" hero. Deterministic (seeded).
import { writeFileSync } from "node:fs";

const W = 320, H = 210;
let seed = 7;
const rand = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const int = (a, b) => a + Math.floor(rand() * (b - a + 1));
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const out = [];
const rect = (x, y, w, h, fill, extra = "") => out.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"${extra}/>`);
const glyph = (rows, ox, oy, colors, px = 1) =>
  rows.forEach((row, r) => [...row].forEach((ch, c) => { if (colors[ch]) rect(ox + c * px, oy + r * px, px, px, colors[ch]); }));

// sky bands with dithered seams
const bands = ["#07060d", "#0a0816", "#0e0a1f", "#140c29", "#1d0f33", "#2a1240"];
const bh = 24;
bands.forEach((c, i) => {
  rect(0, i * bh, W, bh + 1, c);
  if (i + 1 < bands.length) for (let x = 0; x < W; x += 2) rect(x + (i % 2), (i + 1) * bh - 1, 1, 1, bands[i + 1]);
});
rect(0, bands.length * bh, W, H, bands.at(-1));

// stars
for (let i = 0; i < 110; i++) rect(int(0, W - 1), int(0, 119), 1, 1, pick(["#ffffff", "#c9c4dc", "#8f8aa6", "#00e5ff"]));

// moon
glyph(["...####...", ".########.", ".##o#####.", "####o#####", "##########", "#####oo###", "#####oo###", ".########.", ".##o#####.", "...####..."],
  262, 14, { "#": "#ffe9a8", o: "#e8c97a" }, 2);

// back skyline
for (let x = 0; x < W;) { const w = int(10, 22), h = int(30, 62); rect(x, H - 22 - h, w, h + 22, "#120d22"); x += w; }

// front skyline with lit windows
for (let x = -4; x < W;) {
  const w = int(16, 30), h = int(18, 44), top = H - 22 - h;
  rect(x, top, w, h + 22, "#0b0816");
  for (let wy = top + 4; wy < H - 26; wy += 5)
    for (let wx = x + 3; wx < x + w - 3; wx += 4)
      if (rand() < 0.28) rect(wx, wy, 2, 2, pick(["#ffd36b", "#ff2e88", "#00e5ff", "#ffd36b"]));
  x += w + int(0, 3);
}

// the bar
const bx = 118, bw = 84, by = H - 60;
rect(bx, by, bw, 60, "#1a1726");
rect(bx - 2, by - 3, bw + 4, 4, "#2b2540");
rect(bx + 8, by + 6, bw - 16, 14, "#0b0a12");
rect(bx + 8, by + 6, bw - 16, 1, "#ff2e88");
rect(bx + 8, by + 19, bw - 16, 1, "#ff2e88");
rect(bx + 8, by + 6, 1, 14, "#ff2e88");
rect(bx + bw - 9, by + 6, 1, 14, "#ff2e88");
glyph(["#####", ".###.", "..#..", "..#..", ".###."], bx + 13, by + 9, { "#": "#00e5ff" });
const font = { O: ["###", "#.#", "#.#", "#.#", "###"], P: ["###", "#.#", "###", "#..", "#.."], E: ["###", "#..", "##.", "#..", "###"], N: ["#.#", "###", "###", "#.#", "#.#"] };
[..."OPEN"].forEach((ch, i) => glyph(font[ch], bx + 24 + i * 5, by + 9, { "#": "#ff2e88" }));
for (const wx of [bx + 6, bx + bw - 32]) {
  rect(wx, by + 26, 26, 20, "#ff9a3c");
  rect(wx, by + 26, 26, 20, "#ffd36b", ' opacity="0.55"');
  rect(wx, by + 26, 26, 1, "#2b2540");
  rect(wx, by + 45, 26, 1, "#2b2540");
  rect(wx + 13, by + 26, 1, 20, "#2b2540");
}
for (const [px, hy] of [[bx + 9, 33], [bx + 21, 35], [bx + bw - 29, 34], [bx + bw - 17, 32]]) {
  rect(px + 1, by + hy, 3, 3, "#3a1d14");
  rect(px, by + hy + 4, 5, 46 - hy - 4, "#3a1d14");
}
rect(bx + bw - 12, by + 30, 2, 3, "#ffffff");
rect(bx + bw - 12, by + 33, 2, 2, "#ffb703");
rect(bx + 36, by + 26, 12, 34, "#0b0a12");
rect(bx + 37, by + 27, 10, 32, "#00e5ff", ' opacity="0.25"');
rect(0, H - 4, W, 4, "#06050b");

writeFileSync(new URL("../public/scene.svg", import.meta.url),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" shape-rendering="crispEdges">${out.join("")}</svg>\n`);
console.log(`scene.svg: ${out.length} rects`);

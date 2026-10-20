# Neon Street Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a static Neon Street landing page at `/` and the restyled game at `/play/`, built from the existing `drunkgamerfront` Vite project and deployed to Cloudflare Pages.

**Architecture:** Vite multi-page build — `index.html` is plain HTML + CSS (no React), `play/index.html` mounts the React game. Pure logic (categories, turn order, API URL joining) lives in `src/lib/` and is unit-tested with `node --test`. A Node script generates the pixel-art hero scene into `public/scene.svg`.

**Tech Stack:** Vite 8 beta (already pinned), React 19, plain CSS with custom properties, Node 22 built-in test runner, Wrangler (via `npx`) for Cloudflare Pages.

Spec: `docs/superpowers/specs/2026-10-20-neon-street-site-design.md`

## Global Constraints

- Spacing values only from `--s1..--s5` = `8 / 16 / 24 / 40 / 64px` (1–4px borders/shadows are exempt).
- Colours only from tokens: `--ink #0b0a12`, `--bg2 #0f0d18`, `--panel #14111f`, `--line #2b2540`, `--text #ece8f7`, `--dim #8f8aa6`, `--pink #ff2e88`, `--cyan #00e5ff`, `--amber #ffd36b`, `--violet #b07cff`, `--lime #7dff6b`, `--orange #ff9a3c`.
- Fonts: Pixelify Sans 700 (display), Press Start 2P (≤17px: kickers/buttons/tags), Silkscreen (labels/chips/names), VT323 (body ≥18px).
- Category colours: chaos→pink, dare→amber, truth→cyan, opinion→violet, power→lime, `person|group_round_based:N`→orange `RULE · NR`.
- The player named `Host` (created by `/create-room`) is never shown and never takes turns.
- No backend changes. No new runtime dependencies.
- All motion disabled under `prefers-reduced-motion: reduce`.
- Run every command from `drunkgamerfront/` unless stated.

## File map

| File | Responsibility |
|---|---|
| `vite.config.js` | multi-page inputs |
| `package.json` | add `test`, `gen:scene` scripts |
| `index.html` | landing page markup |
| `play/index.html` | game page shell |
| `public/scene.svg` | generated pixel hero (committed) |
| `public/favicon.svg` | pixel cocktail favicon |
| `public/_redirects` | `/play` → `/play/` |
| `.env.production` | `VITE_API_BASE` |
| `scripts/gen-scene.mjs` | deterministic pixel scene generator |
| `src/styles/tokens.css` | design tokens + fonts + base reset |
| `src/styles/pixel.css` | shared pixel components (box, btn, chip, tag, scanlines) |
| `src/styles/landing.css` | landing-only layout |
| `src/styles/play.css` | game-only layout |
| `src/landing.js` | imports landing CSS |
| `src/lib/categories.js` (+ `.test.js`) | category → label/colour, avatar colours |
| `src/lib/turn.js` (+ `.test.js`) | Host filtering, turn index, rule selectors |
| `src/lib/api.js` (+ `.test.js`) | URL join + fetch wrapper |
| `src/play/main.jsx` | React mount |
| `src/play/useRoom.js` | room state + API actions |
| `src/play/App.jsx` | screen switch |
| `src/play/StartScreen.jsx`, `LobbyScreen.jsx`, `GameScreen.jsx`, `GameCard.jsx` | screens |
| delete `src/App.jsx`, `src/App.css`, `src/index.css`, `src/main.jsx`, `src/assets/react.svg`, `public/vite.svg` | replaced |

---

### Task 1: Pure logic modules with tests

**Files:**
- Modify: `drunkgamerfront/package.json` (scripts)
- Create: `src/lib/categories.js`, `src/lib/categories.test.js`, `src/lib/turn.js`, `src/lib/turn.test.js`, `src/lib/api.js`, `src/lib/api.test.js`

**Interfaces:**
- Produces:
  - `categoryInfo(category: string|null) → { label: string, color: string, isRule: boolean }`
  - `avatarColor(index: number) → string` (CSS var)
  - `playersInGame(room) → Player[]` (Host removed), `playerId(p) → string`
  - `turnIndex(playerCount: number, cardCounter: number) → number`
  - `rulesForPlayer(activeRules, id) → Rule[]`, `groupRules(activeRules) → Rule[]`
  - `joinUrl(base, path) → string`, `createApi(base, fetchImpl?) → api(path, {method, body}) → Promise<object>` (throws `Error` with `.status`), `api` (default instance)

- [ ] **Step 1: Install deps and add scripts**

Run: `npm install`

In `package.json` `"scripts"` add:
```json
    "test": "node --test src/lib/",
    "gen:scene": "node scripts/gen-scene.mjs"
```

- [ ] **Step 2: Write failing tests**

`src/lib/categories.test.js`:
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { categoryInfo, avatarColor } from "./categories.js";

test("maps plain categories to label + colour", () => {
  assert.deepEqual(categoryInfo("chaos"), { label: "CHAOS", color: "var(--pink)", isRule: false });
  assert.deepEqual(categoryInfo("dare"), { label: "DARE", color: "var(--amber)", isRule: false });
  assert.deepEqual(categoryInfo("truth"), { label: "TRUTH", color: "var(--cyan)", isRule: false });
  assert.deepEqual(categoryInfo("opinion"), { label: "OPINION", color: "var(--violet)", isRule: false });
  assert.deepEqual(categoryInfo("power"), { label: "POWER", color: "var(--lime)", isRule: false });
});

test("round-based categories become orange rules with round count", () => {
  assert.deepEqual(categoryInfo("person_round_based:2"), { label: "RULE · 2R", color: "var(--orange)", isRule: true });
  assert.deepEqual(categoryInfo("group_round_based:4"), { label: "RULE · 4R", color: "var(--orange)", isRule: true });
});

test("unknown or missing category falls back to a neutral card tag", () => {
  assert.deepEqual(categoryInfo(null), { label: "CARD", color: "var(--dim)", isRule: false });
  assert.deepEqual(categoryInfo("mystery"), { label: "CARD", color: "var(--dim)", isRule: false });
});

test("avatar colours cycle through six neon colours", () => {
  assert.equal(avatarColor(0), "var(--pink)");
  assert.equal(avatarColor(1), "var(--cyan)");
  assert.equal(avatarColor(6), "var(--pink)");
});
```

`src/lib/turn.test.js`:
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { playersInGame, playerId, turnIndex, rulesForPlayer, groupRules } from "./turn.js";

const room = { players: [{ id: "h", name: "Host" }, { id: "a", name: "Jake" }, { playerId: "b", name: "Sofia" }] };

test("playersInGame drops the Host player", () => {
  assert.deepEqual(playersInGame(room).map((p) => p.name), ["Jake", "Sofia"]);
  assert.deepEqual(playersInGame(null), []);
});

test("playerId supports id and playerId", () => {
  assert.equal(playerId({ id: "x" }), "x");
  assert.equal(playerId({ playerId: "y" }), "y");
});

test("turnIndex: first card is player 0, then rotates", () => {
  assert.equal(turnIndex(3, 0), 0);
  assert.equal(turnIndex(3, 1), 0);
  assert.equal(turnIndex(3, 2), 1);
  assert.equal(turnIndex(3, 4), 0);
  assert.equal(turnIndex(0, 5), 0);
});

test("rule selectors split person and group rules", () => {
  const rules = [
    { ruleId: "1", type: "person", playerId: "a" },
    { ruleId: "2", type: "group" },
    { ruleId: "3", type: "person", playerId: "b" },
  ];
  assert.deepEqual(rulesForPlayer(rules, "a").map((r) => r.ruleId), ["1"]);
  assert.deepEqual(groupRules(rules).map((r) => r.ruleId), ["2"]);
  assert.deepEqual(groupRules(undefined), []);
});
```

`src/lib/api.test.js`:
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { joinUrl, createApi } from "./api.js";

test("joinUrl never doubles or drops the slash", () => {
  assert.equal(joinUrl("https://x.com/", "/state/AB"), "https://x.com/state/AB");
  assert.equal(joinUrl("https://x.com", "state/AB"), "https://x.com/state/AB");
});

test("api posts JSON and returns parsed body", async () => {
  let seen;
  const api = createApi("https://x.com/", async (url, init) => {
    seen = { url, init };
    return { ok: true, status: 200, json: async () => ({ roomId: "ABC" }) };
  });
  const data = await api("/create-room", { method: "POST", body: { hostName: "Host" } });
  assert.deepEqual(data, { roomId: "ABC" });
  assert.equal(seen.url, "https://x.com/create-room");
  assert.equal(seen.init.method, "POST");
  assert.equal(seen.init.body, JSON.stringify({ hostName: "Host" }));
});

test("api throws server error message with status", async () => {
  const api = createApi("https://x.com", async () => ({ ok: false, status: 404, json: async () => ({ error: "Room not found" }) }));
  await assert.rejects(api("/state/ZZ"), (e) => e.message === "Room not found" && e.status === 404);
});
```

- [ ] **Step 3: Run tests, expect failure**

Run: `npm test`
Expected: FAIL — `Cannot find module '.../categories.js'` (and turn.js, api.js).

- [ ] **Step 4: Implement**

`src/lib/categories.js`:
```js
const BASE = {
  chaos: { label: "CHAOS", color: "var(--pink)" },
  dare: { label: "DARE", color: "var(--amber)" },
  truth: { label: "TRUTH", color: "var(--cyan)" },
  opinion: { label: "OPINION", color: "var(--violet)" },
  power: { label: "POWER", color: "var(--lime)" },
};

const RULE = /^(person|group)_round_based:(\d+)$/;

export function categoryInfo(category) {
  const rule = RULE.exec(category || "");
  if (rule) return { label: `RULE · ${rule[2]}R`, color: "var(--orange)", isRule: true };
  const base = BASE[category];
  if (base) return { ...base, isRule: false };
  return { label: "CARD", color: "var(--dim)", isRule: false };
}

const AVATAR_COLORS = ["var(--pink)", "var(--cyan)", "var(--amber)", "var(--violet)", "var(--lime)", "var(--orange)"];

export function avatarColor(index) {
  return AVATAR_COLORS[index % AVATAR_COLORS.length];
}
```

`src/lib/turn.js`:
```js
export function playerId(p) {
  return p.id || p.playerId;
}

export function playersInGame(room) {
  return (room?.players || []).filter((p) => p.name !== "Host");
}

// cardCounter is how many cards have been dealt; card N belongs to player (N-1) % count.
export function turnIndex(playerCount, cardCounter) {
  const dealt = Number(cardCounter || 0);
  if (!playerCount || dealt <= 0) return 0;
  return (dealt - 1) % playerCount;
}

export function rulesForPlayer(activeRules, id) {
  return (activeRules || []).filter((r) => r.type === "person" && r.playerId === id);
}

export function groupRules(activeRules) {
  return (activeRules || []).filter((r) => r.type === "group");
}
```

`src/lib/api.js`:
```js
const DEFAULT_BASE = "https://oq99xk9tcl.execute-api.us-east-1.amazonaws.com";

export function joinUrl(base, path) {
  return `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

export function createApi(base, fetchImpl = (...args) => fetch(...args)) {
  return async function api(path, { method = "GET", body } = {}) {
    const res = await fetchImpl(joinUrl(base, path), {
      method,
      headers: { "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data?.error || `HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return data;
  };
}

export const api = createApi(import.meta.env?.VITE_API_BASE || DEFAULT_BASE);
```

- [ ] **Step 5: Run tests, expect pass**

Run: `npm test`
Expected: all tests pass (`# fail 0`).

- [ ] **Step 6: Commit**

```bash
git add drunkgamerfront/package.json drunkgamerfront/package-lock.json drunkgamerfront/src/lib
git commit -m "feat(front): category, turn and api helpers with tests"
```

---

### Task 2: Design tokens, shared pixel CSS, pixel scene + favicon

**Files:**
- Create: `scripts/gen-scene.mjs`, `public/scene.svg` (generated), `public/favicon.svg`, `src/styles/tokens.css`, `src/styles/pixel.css`

**Interfaces:**
- Produces CSS classes used by Tasks 3–4: `.px-title`, `.kick`, `.vt`, `.box`, `.btn` (`.btn--ghost`), `.chip`, `.tag`, `.scan`, `.err`, and `.sr-only`.
- Produces `/scene.svg` (320×210 viewBox, bottom-anchored skyline) and `/favicon.svg`.

- [ ] **Step 1: Write the scene generator**

`scripts/gen-scene.mjs`:
```js
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
```

- [ ] **Step 2: Generate and check**

Run: `npm run gen:scene`
Expected: `scene.svg: <N> rects` with N > 500, and `public/scene.svg` exists.

- [ ] **Step 3: Favicon**

`public/favicon.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges">
  <rect width="16" height="16" fill="#0b0a12"/>
  <rect x="2" y="3" width="12" height="2" fill="#ff2e88"/>
  <rect x="4" y="5" width="8" height="2" fill="#ff2e88"/>
  <rect x="6" y="7" width="4" height="2" fill="#ff2e88"/>
  <rect x="7" y="9" width="2" height="3" fill="#00e5ff"/>
  <rect x="5" y="12" width="6" height="2" fill="#00e5ff"/>
</svg>
```

- [ ] **Step 4: Tokens**

`src/styles/tokens.css`:
```css
:root {
  --ink: #0b0a12;
  --bg2: #0f0d18;
  --panel: #14111f;
  --line: #2b2540;
  --text: #ece8f7;
  --dim: #8f8aa6;
  --pink: #ff2e88;
  --cyan: #00e5ff;
  --amber: #ffd36b;
  --violet: #b07cff;
  --lime: #7dff6b;
  --orange: #ff9a3c;

  --s1: 8px;
  --s2: 16px;
  --s3: 24px;
  --s4: 40px;
  --s5: 64px;

  --f-display: "Pixelify Sans", ui-monospace, monospace;
  --f-press: "Press Start 2P", ui-monospace, monospace;
  --f-label: "Silkscreen", ui-monospace, monospace;
  --f-body: "VT323", ui-monospace, monospace;

  color-scheme: dark;
}

*, *::before, *::after { box-sizing: border-box; }
html, body { margin: 0; background: var(--ink); color: var(--text); }
body { font-family: var(--f-body); font-size: 21px; line-height: 1.2; -webkit-font-smoothing: antialiased; }
button { font: inherit; color: inherit; }
a { color: inherit; }
img { display: block; max-width: 100%; }

:focus-visible { outline: 3px solid var(--cyan); outline-offset: 3px; }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition: none !important; }
}
```

- [ ] **Step 5: Shared pixel components**

`src/styles/pixel.css`:
```css
.px-title {
  font-family: var(--f-display); font-weight: 700; letter-spacing: .05em; line-height: .95; color: #fff; margin: 0;
  text-shadow: -3px 0 0 var(--pink), 3px 0 0 var(--cyan), 0 0 22px rgba(255, 46, 136, .5);
}
.kick { font-family: var(--f-press); font-size: 11px; letter-spacing: .3em; color: var(--cyan); text-shadow: 0 0 10px rgba(0, 229, 255, .6); margin: 0; }
.vt { font-family: var(--f-body); color: #c9c3dc; font-size: 21px; line-height: 1.2; margin: 0; }

.box { background: var(--panel); border: 2px solid var(--line); box-shadow: 4px 4px 0 #000; }

.btn {
  font-family: var(--f-press); font-size: 14px; letter-spacing: .18em; color: #fff; text-decoration: none; cursor: pointer;
  background: #120f1d; border: 3px solid var(--cyan); min-height: 56px; padding: 0 var(--s3);
  display: inline-flex; align-items: center; justify-content: center; gap: var(--s2);
  box-shadow: 0 0 0 3px var(--ink), 0 0 18px rgba(0, 229, 255, .5), inset 0 0 18px rgba(0, 229, 255, .15);
  transition: transform .08s, box-shadow .08s;
}
.btn:hover { box-shadow: 0 0 0 3px var(--ink), 0 0 26px rgba(0, 229, 255, .75), inset 0 0 22px rgba(0, 229, 255, .25); }
.btn:active { transform: translate(2px, 2px); }
.btn:disabled { opacity: .45; cursor: not-allowed; transform: none; }
.btn--ghost { border-color: var(--line); color: var(--dim); box-shadow: none; }
.btn--ghost:hover { color: var(--text); border-color: var(--dim); box-shadow: none; }

.chip {
  font-family: var(--f-label); font-size: 11px; letter-spacing: .1em; color: var(--dim); text-decoration: none; white-space: nowrap;
  border: 2px solid var(--line); background: var(--bg2); height: 32px; padding: 0 12px;
  display: inline-flex; align-items: center; gap: var(--s1);
}
a.chip:hover { color: var(--text); border-color: var(--dim); }

.tag {
  font-family: var(--f-press); font-size: 8px; letter-spacing: .15em; color: var(--ink);
  height: 20px; padding: 0 var(--s1); display: inline-flex; align-items: center; white-space: nowrap;
}

.err { font-family: var(--f-body); font-size: 19px; color: #ffd0e2; border: 2px solid var(--pink); background: rgba(255, 46, 136, .1); padding: var(--s1) var(--s2); }

.scan { position: relative; }
.scan::after {
  content: ""; position: absolute; inset: 0; pointer-events: none; z-index: 50;
  background: repeating-linear-gradient(to bottom, rgba(255, 255, 255, .04) 0 1px, transparent 1px 3px); mix-blend-mode: overlay;
}

.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
```

- [ ] **Step 6: Commit**

```bash
git add drunkgamerfront/scripts drunkgamerfront/public/scene.svg drunkgamerfront/public/favicon.svg drunkgamerfront/src/styles/tokens.css drunkgamerfront/src/styles/pixel.css
git commit -m "feat(front): neon street tokens, pixel components and generated scene"
```

---

### Task 3: Landing page + multi-page build

**Files:**
- Modify: `index.html` (replace), `vite.config.js`
- Create: `src/landing.js`, `src/styles/landing.css`, `play/index.html` (temporary shell, filled in Task 4), `public/_redirects`

**Interfaces:**
- Consumes: Task 2 CSS classes, `/scene.svg`, `/favicon.svg`.
- Produces: build outputs `dist/index.html` and `dist/play/index.html`.

- [ ] **Step 1: Vite multi-page config**

`vite.config.js`:
```js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        play: resolve(import.meta.dirname, "play/index.html"),
      },
    },
  },
});
```

- [ ] **Step 2: Landing markup** — `index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <title>Drunk Gamer · the pass-the-phone party card game</title>
    <meta name="description" content="310 cards of dares, truths and rules that stick around. One phone, any crowd. Free, no app needed." />
    <meta property="og:title" content="Drunk Gamer" />
    <meta property="og:description" content="310 cards · one phone · pass it round and do what it says." />
    <meta name="theme-color" content="#0b0a12" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Pixelify+Sans:wght@700&family=Press+Start+2P&family=Silkscreen&family=VT323&display=swap" />
    <script type="module" src="/src/landing.js"></script>
  </head>
  <body>
    <header class="hero scan">
      <img class="hero__scene" src="/scene.svg" alt="" />
      <div class="hero__head">
        <h1 class="px-title hero__title">DRUNK GAMER</h1>
        <p class="kick hero__kick">LAST CALL · EVERY ROUND</p>
        <p class="vt hero__tag">310 cards · one phone · pass it round and do what it says</p>
      </div>
      <div class="hero__street" aria-hidden="true"></div>
      <div class="hero__under">
        <div class="hero__controls">
          <div class="row"><span class="grp"><a class="chip" href="#how">▸ HOW TO PLAY</a><span class="tag" style="background:var(--pink)">BETA</span></span></div>
          <a class="btn hero__play" href="/play/"><span aria-hidden="true">▶</span>DEAL ME IN<span aria-hidden="true">◀</span></a>
          <div class="row hero__foot">
            <span class="hero__round">ROUND #01</span>
            <span class="grp"><span class="chip">DARES</span><span class="chip">TRUTHS</span><span class="chip">CHAOS</span></span>
          </div>
        </div>
      </div>
    </header>

    <main class="land">
      <section id="how" class="sec">
        <div class="sec__head"><p class="kick">HOW IT WORKS</p><h2 class="px-title sec__title">THREE STEPS. NO SETUP.</h2></div>
        <ol class="steps">
          <li class="box step"><span class="step__n">01</span><h3 class="step__h">ADD YOUR CREW</h3><p class="vt">Type in everyone's name, in the order you're sitting. Nobody downloads anything.</p></li>
          <li class="box step"><span class="step__n">02</span><h3 class="step__h">DEAL A CARD</h3><p class="vt">The phone shows whose turn it is. Read the card out loud and do what it says.</p></li>
          <li class="box step"><span class="step__n">03</span><h3 class="step__h">RULES STICK</h3><p class="vt">Some cards set rules that last a few rounds. The game tracks them so you don't have to.</p></li>
        </ol>
      </section>

      <section class="sec">
        <div class="sec__head"><p class="kick">THE DECK</p><h2 class="px-title sec__title">310 CARDS. 6 FLAVOURS.</h2></div>
        <ul class="deck">
          <li class="box mini" style="--c:var(--pink)"><span class="tag">CHAOS</span><h3 class="mini__t">EYE CONTACT DUEL</h3><p class="vt mini__d">Pick someone. First to look away drinks.</p></li>
          <li class="box mini" style="--c:var(--amber)"><span class="tag">DARE</span><h3 class="mini__t">DANCE TAX</h3><p class="vt mini__d">Point at someone. They dance or drink.</p></li>
          <li class="box mini" style="--c:var(--orange)"><span class="tag">RULE · 1R</span><h3 class="mini__t">NO SMILING</h3><p class="vt mini__d">No smiling for one round. First to smile drinks.</p></li>
          <li class="box mini" style="--c:var(--cyan)"><span class="tag">TRUTH</span><h3 class="mini__t">WORST DATE</h3><p class="vt mini__d">Tell your worst date story.</p></li>
        </ul>
      </section>

      <section class="cta">
        <h2 class="px-title cta__title">READY WHEN YOU ARE.</h2>
        <p class="vt">Drink responsibly. Water counts too.</p>
        <a class="btn cta__btn" href="/play/"><span aria-hidden="true">▶</span>DEAL ME IN</a>
      </section>
    </main>

    <footer class="foot"><span>DRUNK GAMER</span><span>18+ · PLAY RESPONSIBLY</span></footer>
  </body>
</html>
```

`src/landing.js`:
```js
import "./styles/tokens.css";
import "./styles/pixel.css";
import "./styles/landing.css";
```

- [ ] **Step 3: Landing CSS** — `src/styles/landing.css`:
```css
.row { display: flex; align-items: center; justify-content: space-between; gap: var(--s1); }
.grp { display: flex; align-items: center; gap: var(--s1); }

/* hero */
.hero { --under: 240px; height: max(640px, 100svh); overflow: hidden; background: #0b0816; }
.hero::before { content: ""; position: absolute; inset: 0; z-index: 4; pointer-events: none; background: radial-gradient(120% 90% at 50% 40%, transparent 55%, rgba(0, 0, 0, .5)); }
.hero__scene { position: absolute; inset: 0 0 var(--under) 0; width: 100%; height: calc(100% - var(--under)); object-fit: cover; object-position: center bottom; image-rendering: pixelated; }
.hero__head { position: absolute; top: var(--s5); left: var(--s3); right: var(--s3); text-align: center; z-index: 3; }
.hero__title { font-size: clamp(52px, 9vw, 96px); }
.hero__kick { font-size: 13px; letter-spacing: .35em; margin-top: var(--s3); }
.hero__tag { font-size: 24px; color: #b9b3cf; margin-top: var(--s2); }
.hero__street { position: absolute; left: 0; right: 0; bottom: var(--under); height: 2px; background: var(--pink); box-shadow: 0 0 18px 4px rgba(255, 46, 136, .5); z-index: 2; }
.hero__under { position: absolute; left: 0; right: 0; bottom: 0; height: var(--under); background: linear-gradient(#0b0816, #05040a); display: flex; align-items: center; justify-content: center; z-index: 3; }
.hero__controls { width: min(560px, calc(100% - 2 * var(--s3))); display: flex; flex-direction: column; gap: var(--s2); }
.hero__play { height: 72px; font-size: 17px; letter-spacing: .2em; }
.hero__round { font-family: var(--f-body); font-size: 20px; color: var(--dim); letter-spacing: .1em; }

/* sections */
.land { padding: var(--s5) var(--s4); background: linear-gradient(#05040a, var(--ink) 240px); max-width: 1200px; margin: 0 auto; }
.sec + .sec { margin-top: var(--s5); }
.sec__head { text-align: center; margin-bottom: var(--s4); }
.sec__title { font-size: 36px; margin-top: var(--s2); text-shadow: -2px 0 var(--pink), 2px 0 var(--cyan); }
.steps, .deck { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--s3); }
.steps { grid-template-columns: repeat(3, 1fr); }
.step { padding: var(--s3); }
.step__n { font-family: var(--f-press); font-size: 22px; color: var(--pink); text-shadow: 0 0 12px rgba(255, 46, 136, .6); }
.step__h { font-family: var(--f-label); font-size: 16px; letter-spacing: .06em; margin: var(--s2) 0 var(--s1); font-weight: 400; }
.deck { grid-template-columns: repeat(4, 1fr); gap: var(--s2); }
.mini { padding: var(--s2); border: 3px solid var(--c); display: flex; flex-direction: column; gap: var(--s1); min-height: 150px; }
.mini .tag { background: var(--c); align-self: flex-start; }
.mini__t { font-family: var(--f-display); font-size: 18px; margin: var(--s1) 0 0; letter-spacing: .04em; }
.mini__d { font-size: 18px; line-height: 1.1; }
.cta { margin-top: var(--s5); padding: var(--s4); text-align: center; border: 2px dashed var(--line); display: flex; flex-direction: column; align-items: center; gap: var(--s1); }
.cta__title { font-size: 30px; text-shadow: -2px 0 var(--pink), 2px 0 var(--cyan); }
.cta__btn { margin-top: var(--s3); width: min(340px, 100%); height: 64px; }
.foot { display: flex; justify-content: space-between; gap: var(--s2); padding: var(--s3) var(--s4); border-top: 2px solid var(--line); font-family: var(--f-label); font-size: 11px; letter-spacing: .1em; color: var(--dim); }

@media (max-width: 900px) {
  .steps { grid-template-columns: 1fr; }
  .deck { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 520px) {
  .hero { --under: 290px; }
  .hero__head { top: 76px; }
  .hero__kick { font-size: 9px; letter-spacing: .25em; }
  .hero__tag { font-size: 20px; }
  .hero__play { height: 64px; font-size: 14px; }
  .hero__foot { flex-direction: column; align-items: stretch; gap: var(--s2); }
  .hero__foot .grp { justify-content: space-between; }
  .hero__foot .chip { flex: 1; justify-content: center; }
  .hero__round { text-align: center; }
  .land { padding: var(--s4) var(--s2); }
  .sec__title { font-size: 26px; }
  .deck { grid-template-columns: 1fr; }
  .foot { flex-direction: column; padding: var(--s3) var(--s2); }
}
```

- [ ] **Step 4: Temporary play shell + redirects**

`play/index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <title>Play · Drunk Gamer</title>
    <meta name="theme-color" content="#0b0a12" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Pixelify+Sans:wght@700&family=Press+Start+2P&family=Silkscreen&family=VT323&display=swap" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/play/main.jsx"></script>
  </body>
</html>
```

`public/_redirects`:
```
/play /play/ 301
```

Delete old entry so the build doesn't pull it in: `git rm drunkgamerfront/src/main.jsx` (App.jsx etc. are removed in Task 4). Create a placeholder so the play entry builds until Task 4: `src/play/main.jsx` containing `document.getElementById("root").textContent = "Loading…";`.

- [ ] **Step 5: Build + visual check**

Run: `npm run build` → Expected: `dist/index.html` and `dist/play/index.html` emitted, no errors.
Run: `npm run dev`, open `http://localhost:5173/` at 1440px, 768px and 375px: title clear of skyline, controls centred under the pink street line, sections stack on phone, no horizontal scroll.

- [ ] **Step 6: Commit**

```bash
git add -A drunkgamerfront
git commit -m "feat(front): static neon street landing page and multi-page build"
```

---

### Task 4: Restyled game at /play/

**Files:**
- Create: `src/play/main.jsx` (replace placeholder), `src/play/App.jsx`, `src/play/useRoom.js`, `src/play/StartScreen.jsx`, `src/play/LobbyScreen.jsx`, `src/play/GameScreen.jsx`, `src/play/GameCard.jsx`, `src/styles/play.css`, `.env.production`
- Delete: `src/App.jsx`, `src/App.css`, `src/index.css`, `src/assets/react.svg`, `public/vite.svg`

**Interfaces:**
- Consumes: `api` (Task 1), `categoryInfo`, `avatarColor`, `playersInGame`, `playerId`, `turnIndex`, `rulesForPlayer`, `groupRules` (Task 1); CSS from Task 2.
- `useRoom()` returns `{ screen, room, players, loading, error, createRoom, addPlayer(name) → Promise<boolean>, removePlayer(id), startGame, nextCard, reset }`.

- [ ] **Step 1: `.env.production`**
```
VITE_API_BASE=https://oq99xk9tcl.execute-api.us-east-1.amazonaws.com
```

- [ ] **Step 2: `src/play/useRoom.js`**
```js
import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { playerId, playersInGame } from "../lib/turn.js";

const KEY = "roomId";

function readSavedRoom() {
  try { return localStorage.getItem(KEY) || ""; } catch { return ""; }
}
function saveRoom(id) {
  try { id ? localStorage.setItem(KEY, id) : localStorage.removeItem(KEY); } catch { /* storage unavailable */ }
}

export function useRoom() {
  const [roomId, setRoomId] = useState(readSavedRoom);
  const [room, setRoom] = useState(null);
  const [screen, setScreen] = useState("start"); // start | lobby | game
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const run = useCallback(async (fn) => {
    setLoading(true);
    setError("");
    try {
      return await fn();
    } catch (e) {
      setError(e.message);
      return undefined;
    } finally {
      setLoading(false);
    }
  }, []);

  const forget = useCallback(() => {
    saveRoom("");
    setRoomId("");
    setRoom(null);
    setScreen("start");
  }, []);

  // Restore a saved room once on load (no polling).
  useEffect(() => {
    if (!roomId || room) return;
    run(async () => {
      try {
        const data = await api(`/state/${encodeURIComponent(roomId)}`);
        setRoom(data);
        setScreen(data?.currentCard ? "game" : "lobby");
      } catch (e) {
        if (e.status === 404) forget();
        else throw e;
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createRoom = () =>
    run(async () => {
      const data = await api("/create-room", { method: "POST", body: { hostName: "Host" } });
      saveRoom(data.roomId);
      setRoomId(data.roomId);
      setRoom({ roomId: data.roomId, players: [], cardCounter: 0, currentRound: 1, activeRules: [] });
      setScreen("lobby");
    });

  const addPlayer = async (name) => {
    const clean = name.trim();
    if (!clean) return false;
    const ok = await run(async () => {
      const res = await api("/add-player", { method: "POST", body: { roomId, name: clean } });
      setRoom((prev) => ({ ...prev, players: [...(prev?.players || []), res.player] }));
      return true;
    });
    return Boolean(ok);
  };

  const removePlayer = (id) =>
    run(async () => {
      await api("/remove-player", { method: "POST", body: { roomId, playerId: id } });
      setRoom((prev) => ({ ...prev, players: (prev?.players || []).filter((p) => playerId(p) !== id) }));
    });

  const nextCard = () =>
    run(async () => {
      const res = await api("/next-card", { method: "POST", body: { roomId } });
      setRoom((prev) => ({
        ...prev,
        currentCard: res.currentCard || res.card,
        cardCounter: Number(prev?.cardCounter || 0) + 1,
        currentRound: res.currentRound || prev?.currentRound || 1,
        activeRules: res.activeRules || prev?.activeRules || [],
      }));
      setScreen("game");
    });

  const reset = async () => {
    await run(async () => {
      if (roomId) await api("/reset", { method: "POST", body: { roomId } });
    });
    forget();
  };

  return {
    screen, room, loading, error,
    players: playersInGame(room),
    createRoom, addPlayer, removePlayer,
    startGame: nextCard, nextCard, reset,
  };
}
```

- [ ] **Step 3: Screens**

`src/play/StartScreen.jsx`:
```jsx
export default function StartScreen({ loading, error, onStart }) {
  return (
    <main className="screen screen--center">
      <div className="box panel start">
        <a className="chip start__back" href="/">◀ HOME</a>
        <p className="kick">INSERT FRIENDS TO CONTINUE</p>
        <h1 className="px-title start__title">DRUNK GAMER</h1>
        <p className="vt">Pass one phone around. It tells you whose turn it is and what to do.</p>
        {error && <p className="err" role="alert">⚠ {error}</p>}
        <button className="btn start__btn" onClick={onStart} disabled={loading}>
          {loading ? "LOADING…" : "▶ NEW GAME"}
        </button>
      </div>
    </main>
  );
}
```

`src/play/LobbyScreen.jsx`:
```jsx
import { useState } from "react";
import { avatarColor } from "../lib/categories.js";
import { playerId } from "../lib/turn.js";

export default function LobbyScreen({ players, loading, error, onAdd, onRemove, onStart }) {
  const [name, setName] = useState("");

  async function submit(e) {
    e.preventDefault();
    if (await onAdd(name)) setName("");
  }

  return (
    <main className="screen screen--center">
      <div className="box panel lobby">
        <p className="kick">PLAYER SELECT</p>
        <h1 className="px-title lobby__title">WHO'S PLAYING?</h1>
        <form className="lobby__field" onSubmit={submit}>
          <label htmlFor="name" className="sr-only">Player name</label>
          <input id="name" className="input" value={name} maxLength={24} autoComplete="off"
                 placeholder="ENTER NAME" onChange={(e) => setName(e.target.value)} disabled={loading} />
          <button className="btn lobby__add" disabled={loading || !name.trim()}>ADD</button>
        </form>
        {error && <p className="err" role="alert">⚠ {error}</p>}
        <ol className="roster">
          {players.length === 0 && <li className="roster__empty vt">No players yet. Add at least two for proper turns.</li>}
          {players.map((p, i) => (
            <li className="prow" key={playerId(p)}>
              <span className="avatar" style={{ background: avatarColor(i) }} aria-hidden="true">{p.name.slice(0, 1).toUpperCase()}</span>
              <span className="prow__name">{p.name}</span>
              <span className="prow__ord">P{i + 1}</span>
              <button className="prow__x" onClick={() => onRemove(playerId(p))} disabled={loading} aria-label={`Remove ${p.name}`}>✕</button>
            </li>
          ))}
        </ol>
        <button className="btn lobby__start" onClick={onStart} disabled={loading || players.length < 1}>▶ START GAME</button>
        <p className="hint">Add people in the order you're sitting. That's the turn order.</p>
      </div>
    </main>
  );
}
```

`src/play/GameCard.jsx`:
```jsx
import { categoryInfo } from "../lib/categories.js";

export default function GameCard({ card, dealt }) {
  if (!card?.title && !card?.description) {
    return (
      <article className="gcard gcard--empty">
        <h2 className="px-title gcard__title">READY?</h2>
        <p className="vt gcard__desc">Hit NEXT CARD to deal the first one.</p>
      </article>
    );
  }
  const cat = categoryInfo(card.category);
  return (
    <article className="gcard" style={{ "--c": cat.color }} aria-live="polite">
      <div className="gcard__top">
        <span className="tag" style={{ background: cat.color }}>{cat.label}</span>
        {card.id != null && <span className="gcard__no">#{String(card.id).padStart(3, "0")}</span>}
      </div>
      <h2 className="px-title gcard__title">{card.title}</h2>
      <p className="vt gcard__desc">{card.description}</p>
      <div className="gcard__bot"><span>CARD {dealt} THIS GAME</span><span aria-hidden="true">☠</span></div>
    </article>
  );
}
```

`src/play/GameScreen.jsx`:
```jsx
import GameCard from "./GameCard.jsx";
import { avatarColor } from "../lib/categories.js";
import { groupRules, playerId, rulesForPlayer, turnIndex } from "../lib/turn.js";

export default function GameScreen({ room, players, loading, error, onNext, onReset }) {
  const rules = room?.activeRules || [];
  const group = groupRules(rules);
  const turn = turnIndex(players.length, room?.cardCounter);
  const current = players[turn];
  const round = room?.currentRound || 1;

  return (
    <div className="game">
      <aside className="side" aria-label="Players">
        <div className="side__hd"><span className="kick side__kick">PLAYERS</span><span className="chip side__round">ROUND {round}</span></div>
        <ol className="side__list">
          {players.map((p, i) => {
            const mine = rulesForPlayer(rules, playerId(p));
            return (
              <li key={playerId(p)} className={"prow prow--game" + (i === turn ? " is-on" : "")} aria-current={i === turn ? "true" : undefined}>
                <span className="avatar" style={{ background: avatarColor(i) }} aria-hidden="true">{p.name.slice(0, 1).toUpperCase()}</span>
                <span className="prow__name">{p.name}</span>
                {mine.length > 0 && (
                  <span className="prow__rules">
                    {mine.map((r) => <span key={r.ruleId} className="rtag">{r.cardTitle} · {r.roundsRemaining}R</span>)}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
        {group.length > 0 && (
          <section className="grules">
            <h2 className="kick grules__kick">GROUP RULES</h2>
            {group.map((r) => (
              <div key={r.ruleId} className="box grule">
                <strong className="grule__t">{r.cardTitle}</strong>
                <p className="vt grule__d">{r.cardDescription}</p>
                <p className="grule__left">{r.roundsRemaining} ROUND{r.roundsRemaining === 1 ? "" : "S"} LEFT</p>
              </div>
            ))}
          </section>
        )}
      </aside>

      <div className="rules-strip" aria-label="Active rules">
        {group.map((r) => <span key={r.ruleId} className="rtag">{r.cardTitle} · ALL · {r.roundsRemaining}R</span>)}
        {players.flatMap((p) => rulesForPlayer(rules, playerId(p)).map((r) => (
          <span key={r.ruleId} className="rtag">{p.name}: {r.cardTitle} · {r.roundsRemaining}R</span>
        )))}
      </div>

      <main className="table">
        <p className="kick table__turn"><span className="table__round">ROUND {round} · </span>{(current?.name || "—").toUpperCase()}'S TURN</p>
        <GameCard key={room?.currentCard?.shownAt || "empty"} card={room?.currentCard} dealt={Number(room?.cardCounter || 0)} />
        <div className="table__acts">
          <button className="btn btn--ghost table__reset" onClick={onReset} disabled={loading}>RESET</button>
          <button className="btn table__next" onClick={onNext} disabled={loading || players.length === 0}>
            {loading ? "DEALING…" : "NEXT CARD ▶"}
          </button>
        </div>
        {error && <p className="err" role="alert">⚠ {error}</p>}
      </main>
    </div>
  );
}
```

`src/play/App.jsx`:
```jsx
import { useRoom } from "./useRoom.js";
import StartScreen from "./StartScreen.jsx";
import LobbyScreen from "./LobbyScreen.jsx";
import GameScreen from "./GameScreen.jsx";

export default function App() {
  const r = useRoom();
  if (r.screen === "lobby") {
    return <LobbyScreen players={r.players} loading={r.loading} error={r.error}
                        onAdd={r.addPlayer} onRemove={r.removePlayer} onStart={r.startGame} />;
  }
  if (r.screen === "game") {
    return <GameScreen room={r.room} players={r.players} loading={r.loading} error={r.error}
                       onNext={r.nextCard} onReset={r.reset} />;
  }
  return <StartScreen loading={r.loading} error={r.error} onStart={r.createRoom} />;
}
```

`src/play/main.jsx`:
```jsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "../styles/tokens.css";
import "../styles/pixel.css";
import "../styles/play.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

- [ ] **Step 4: `src/styles/play.css`**
```css
#root { min-height: 100svh; position: relative; }
#root::after {
  content: ""; position: fixed; inset: 0; pointer-events: none; z-index: 50;
  background: repeating-linear-gradient(to bottom, rgba(255, 255, 255, .035) 0 1px, transparent 1px 3px); mix-blend-mode: overlay;
}
body { background: radial-gradient(60% 50% at 50% 45%, rgba(255, 46, 136, .10), transparent 70%), var(--ink); }

.screen { min-height: 100svh; padding: var(--s5) var(--s3); }
.screen--center { display: grid; place-items: center; }
.panel { width: min(560px, 100%); padding: var(--s4); display: flex; flex-direction: column; }

/* start */
.start { gap: var(--s2); }
.start__back { align-self: flex-start; margin-bottom: var(--s2); }
.start__title { font-size: clamp(40px, 9vw, 64px); }
.start__btn { margin-top: var(--s3); height: 68px; font-size: 15px; }

/* lobby */
.lobby__title { font-size: 34px; margin-top: var(--s2); }
.lobby__field { display: flex; gap: var(--s2); margin-top: var(--s3); }
.input {
  flex: 1; min-width: 0; height: 56px; padding: 0 var(--s2); background: var(--ink); border: 2px solid var(--line);
  font-family: var(--f-body); font-size: 24px; color: var(--text); caret-color: var(--cyan); text-transform: uppercase;
}
.input::placeholder { color: #5d5873; }
.input:focus-visible { outline-offset: 0; border-color: var(--cyan); }
.lobby__add { width: 96px; height: 56px; padding: 0; font-size: 11px; }
.lobby .err { margin-top: var(--s2); }
.roster { list-style: none; margin: var(--s3) 0 0; padding: 0; display: flex; flex-direction: column; gap: var(--s1); }
.roster__empty { color: var(--dim); font-size: 19px; text-align: center; padding: var(--s2) 0; }
.lobby__start { margin-top: var(--s4); height: 68px; font-size: 15px; }
.hint { font-family: var(--f-body); font-size: 18px; color: var(--dim); text-align: center; margin: var(--s2) 0 0; }

/* player rows (lobby + sidebar) */
.prow { display: flex; align-items: center; flex-wrap: wrap; gap: var(--s2); min-height: 52px; padding: var(--s1) var(--s2); background: var(--bg2); border: 2px solid var(--line); }
.avatar { width: 32px; height: 32px; flex: none; display: grid; place-items: center; font-family: var(--f-press); font-size: 12px; color: var(--ink); }
.prow__name { flex: 1; font-family: var(--f-label); font-size: 15px; letter-spacing: .05em; text-transform: uppercase; overflow-wrap: anywhere; }
.prow__ord { font-family: var(--f-body); font-size: 18px; color: var(--dim); }
.prow__x { width: 32px; height: 32px; display: grid; place-items: center; cursor: pointer; background: none; border: 2px solid var(--line); color: var(--dim); font-family: var(--f-press); font-size: 10px; }
.prow__x:hover { color: var(--pink); border-color: var(--pink); }
.prow--game.is-on { border-color: var(--cyan); box-shadow: 0 0 14px rgba(0, 229, 255, .35); }
.prow--game.is-on .prow__name::after { content: " ◀"; color: var(--cyan); }
.prow__rules { flex-basis: 100%; display: flex; flex-wrap: wrap; gap: var(--s1); padding-left: 48px; }
.rtag { font-family: var(--f-body); font-size: 16px; color: var(--orange); border: 1px solid rgba(255, 154, 60, .5); padding: 0 6px; white-space: nowrap; text-transform: uppercase; }

/* game layout */
.game { display: grid; grid-template-columns: 280px 1fr; min-height: 100svh; }
.side { border-right: 2px solid var(--line); background: #0d0b15; padding: var(--s3); display: flex; flex-direction: column; gap: var(--s1); }
.side__hd { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--s1); }
.side__kick { font-size: 9px; }
.side__round { height: 26px; font-size: 10px; }
.side__list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--s1); }
.grules { margin-top: auto; padding-top: var(--s3); border-top: 2px dashed var(--line); }
.grules__kick { font-size: 9px; color: var(--orange); text-shadow: none; }
.grule { margin-top: var(--s1); padding: var(--s2); border-color: rgba(255, 154, 60, .6); }
.grule__t { font-family: var(--f-label); font-weight: 400; font-size: 13px; text-transform: uppercase; }
.grule__d { font-size: 17px; margin-top: 4px; }
.grule__left { font-family: var(--f-body); font-size: 16px; color: var(--orange); margin: 4px 0 0; }
.rules-strip { display: none; }

.table { padding: var(--s4) var(--s3); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--s3); }
.table__turn { font-size: 13px; letter-spacing: .2em; text-align: center; }
.table__round { display: none; }
.table__acts { display: flex; gap: var(--s2); width: min(440px, 100%); }
.table__reset { flex: 0 0 120px; padding: 0; font-size: 9px; height: 64px; }
.table__next { flex: 1; height: 64px; font-size: 13px; }
.table .err { width: min(440px, 100%); }

/* card */
.gcard {
  --c: var(--pink);
  width: min(440px, 100%); min-height: 420px; padding: var(--s4) var(--s3); display: flex; flex-direction: column;
  background: #120f1d; border: 4px solid var(--c);
  box-shadow: 0 0 0 4px var(--ink), 8px 8px 0 4px #000, 0 0 40px color-mix(in srgb, var(--c) 35%, transparent);
  animation: deal .22s ease-out;
}
.gcard--empty { --c: var(--line); justify-content: center; text-align: center; }
.gcard__top { display: flex; justify-content: space-between; align-items: center; }
.gcard__no { font-family: var(--f-body); font-size: 20px; color: var(--dim); }
.gcard__title { font-size: clamp(30px, 5vw, 40px); margin-top: var(--s5); overflow-wrap: anywhere; }
.gcard--empty .gcard__title { margin-top: 0; }
.gcard__desc { font-size: 28px; color: #e2dcf2; margin-top: var(--s2); }
.gcard__bot { margin-top: auto; padding-top: var(--s3); border-top: 2px dashed var(--line); display: flex; justify-content: space-between; font-family: var(--f-body); font-size: 18px; color: var(--dim); }
@keyframes deal { from { transform: translateY(12px) scale(.97); opacity: 0; } to { transform: none; opacity: 1; } }

@media (max-width: 760px) {
  .screen { padding: var(--s4) var(--s2); }
  .panel { padding: var(--s3); }
  .game { grid-template-columns: 1fr; grid-template-rows: auto auto 1fr; }
  .side { border-right: 0; border-bottom: 2px solid var(--line); padding: var(--s2); }
  .side__hd, .grules, .prow__rules { display: none; }
  .side__list { flex-direction: row; overflow-x: auto; scrollbar-width: none; }
  .prow--game { flex: none; min-height: 40px; padding: 0 10px; gap: var(--s1); flex-wrap: nowrap; }
  .prow--game .avatar { width: 20px; height: 20px; font-size: 9px; }
  .prow--game .prow__name { font-size: 12px; }
  .prow--game.is-on .prow__name::after { content: ""; }
  .rules-strip:not(:empty) { display: flex; flex-wrap: wrap; gap: 6px; padding: var(--s1) var(--s2); border-bottom: 2px solid var(--line); }
  .table { justify-content: flex-start; padding: var(--s3) var(--s2); gap: var(--s2); }
  .table__turn { font-size: 11px; }
  .table__round { display: inline; }
  .gcard { min-height: 340px; padding: var(--s3) var(--s2); }
  .gcard__title { margin-top: var(--s4); }
  .gcard__desc { font-size: 24px; }
  .table__reset { flex-basis: 96px; }
}
```

- [ ] **Step 5: Remove the old app**

```bash
git rm drunkgamerfront/src/App.jsx drunkgamerfront/src/App.css drunkgamerfront/src/index.css drunkgamerfront/src/assets/react.svg drunkgamerfront/public/vite.svg
```

- [ ] **Step 6: Verify**

Run: `npm test && npm run lint && npm run build` → all pass.
Run `npm run dev`, open `/play/` and play through: NEW GAME → add JAKE, SOFIA, DEV → START GAME → NEXT CARD ×10 → see turn rotate (JAKE, SOFIA, DEV…), card tag colour match category, a RULE card add an orange tag that counts down → RESET returns to start. Check 375px: player strip scrolls horizontally, rules strip shows, no horizontal page scroll. Reload mid-game → resumes on game screen.

- [ ] **Step 7: Commit**

```bash
git add -A drunkgamerfront
git commit -m "feat(front): neon street game screens at /play"
```

---

### Task 5: Deploy to Cloudflare Pages

**Files:** none (deploy + DNS). Requires the user to confirm the exact hostname before anything goes live.

- [ ] **Step 1: Confirm auth** — `npx wrangler whoami` (if not logged in: `npx wrangler login`, user completes in browser).
- [ ] **Step 2: Confirm hostname with user** — e.g. `drunkgamer.linesites.com`; confirm linesites zone is in the same Cloudflare account (`npx wrangler` cannot list zones; user confirms in dashboard).
- [ ] **Step 3: Build + deploy** — `npm run build && npx wrangler pages deploy dist --project-name drunk-gamer --branch main` (first run creates the project). Expected: a `*.drunk-gamer.pages.dev` URL.
- [ ] **Step 4: Smoke test** the pages.dev URL: landing loads, `/play` redirects to `/play/`, a game can be created (confirms CORS from the new origin).
- [ ] **Step 5: Custom domain** — Pages project → Custom domains → add the confirmed hostname (dashboard step; Cloudflare creates the CNAME automatically when the zone is on the account).

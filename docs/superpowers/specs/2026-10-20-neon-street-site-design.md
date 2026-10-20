# Drunk Gamer — Neon Street site design

**Date:** 2026-10-20
**Status:** Approved in brainstorming (visual companion screens `neon-street-v2`, `screens-v3`)
**Scope:** Landing page + full visual redesign of the existing game (start → lobby → game), deployed to Cloudflare Pages on a linesites subdomain. Backend (AWS Lambda + DynamoDB) is unchanged.

## 1. Goal

Turn the existing "Party Cards" Vite/React prototype into a public site:

- `/` — a fast, static marketing landing page that explains the game and sends people to play.
- `/play/` — the existing game flow, restyled.

Success = a stranger opening the link on a phone understands the game in one screen and can start a game in two taps; the game screen is readable when passed around a table.

## 2. Visual direction — "Neon Street"

Dive bar at night, rendered as pixel art (dark neon "Last Call" palette + Krillion-style pixel treatment).

### Tokens (single source: `src/styles/tokens.css`)

| Token | Value | Use |
|---|---|---|
| `--ink` | `#0b0a12` | page background |
| `--bg2` | `#0f0d18` | rows, inputs, chips |
| `--panel` | `#14111f` | boxes / panels |
| `--line` | `#2b2540` | 2px pixel borders |
| `--text` | `#ece8f7` | primary text |
| `--dim` | `#8f8aa6` | secondary text |
| `--pink` | `#ff2e88` | brand / chaos / street line |
| `--cyan` | `#00e5ff` | primary action, active turn |
| `--amber` | `#ffd36b` | dare |
| `--violet` | `#b07cff` | opinion |
| `--lime` | `#7dff6b` | power |
| `--orange` | `#ff9a3c` | round-based rules |
| `--s1..--s5` | `8 / 16 / 24 / 40 / 64px` | **only** spacing values allowed |

### Type (Google Fonts)

- **Pixelify Sans 700** — display titles; RGB-split `text-shadow: -3px 0 pink, 3px 0 cyan`.
- **Press Start 2P** — kickers, buttons, category tags (small sizes only, ≤17px).
- **Silkscreen** — labels, chips, player names.
- **VT323** — body copy, card descriptions (≥18px).
- Avoid words where Pixelify's "Z" reads as "8" in display titles.

### Signature elements

- **Pixel scene hero:** generated SVG (`shape-rendering: crispEdges`) — dithered night sky, stars, round moon, two skyline layers with lit windows, a bar with neon OPEN sign and patrons. A glowing pink "street line" splits the hero; controls sit "below street level".
- **Scanlines + vignette** overlays (pointer-events none).
- **Pixel boxes:** 2–4px borders, hard `4px 4px 0 #000` offset shadow; primary buttons get cyan border + outer/inner glow.
- **Category colours** (from card `category`):
  `chaos→pink`, `dare→amber`, `truth→cyan`, `opinion→violet`, `power→lime`, `person_round_based:N` / `group_round_based:N` → orange tag reading `RULE · NR`.

### Motion

Minimal and state-driven: card deal (short scale/translate in), active-player glow, button press (1–2px translate, shadow shrink). All disabled under `prefers-reduced-motion`.

## 3. Pages & components

### `/` Landing (`index.html`, static HTML + `landing.css`, no React)

1. **Hero** — HUD (menu / sound placeholders hidden until functional), title `DRUNK GAMER`, kicker `LAST CALL · EVERY ROUND`, tagline, pixel scene, below-street controls: `HOW TO PLAY` chip (anchors to section 2) + `BETA` tag, `▶ DEAL ME IN ◀` → `/play/`, category chips.
2. **How it works** — three numbered boxes (Add your crew / Deal a card / Rules stick).
3. **The deck** — 4 sample cards taken verbatim from `cards.json` (one per colour).
4. **CTA band** — "Ready when you are." + play button; responsible-drinking line.
5. **Footer** — domain + `18+ · PLAY RESPONSIBLY`.

Phone (<520px): two-line title, stacked footer row, full-width chips.

### `/play/` Game (`play/index.html` → React)

Components split out of the current 387-line `App.jsx`:

- `api.js` — `api(path, opts)`; base URL from `import.meta.env.VITE_API_BASE`, joined without double slashes.
- `useRoom.js` — room state + actions (create, add/remove player, next card, reset, restore from `localStorage`). Logic moved verbatim from `App.jsx`; debug `console.log`s removed.
- `StartScreen.jsx` — short pixel splash, "New game" button (still creates the room via `/create-room`).
- `LobbyScreen.jsx` — "WHO'S PLAYING?" panel, name field + ADD, roster rows (coloured initial, `P1..`, remove ✕), START GAME (disabled with <1 player), hint.
- `GameScreen.jsx` — desktop: 280px player sidebar (active glow, per-player rule tags, group rules at bottom) + centred card + RESET (ghost) / NEXT CARD. Phone: horizontal player strip, one row of rule tags, card, buttons.
- `GameCard.jsx` — category tag + `#id`, title, description, footer with card count. Empty state "READY?".
- `categories.js` — category → colour/label mapping (single place).

Player avatar colour = cycle `[pink, cyan, amber, violet, lime, orange]` by join order.

## 4. Architecture

- One Vite project (`drunkgamerfront/`) in **multi-page mode**: `build.rollupOptions.input = { main: index.html, play: play/index.html }`.
- Shared `src/styles/tokens.css` + `src/styles/pixel.css` (boxes, buttons, chips, tags, scanlines) imported by both pages.
- Pixel hero SVG generated once by `scripts/gen-scene.mjs` → `public/scene.svg` (committed), so the landing page stays static.
- Backend untouched. `CORS_ORIGIN` on the Lambda must allow the new origin (currently defaults to `*`, so no change required).

## 5. Deployment

- Cloudflare Pages project `drunk-gamer`, deployed with `npx wrangler pages deploy dist` from `drunkgamerfront/`.
- Custom domain: `drunkgamer.<linesites domain>` (exact host confirmed at deploy time) attached in the Pages project; DNS record created in the linesites zone.
- `public/_redirects`: `/play /play/ 301`.
- `VITE_API_BASE` set in `.env.production`.

## 6. Error handling

- API errors render in a pixel error box (`⚠ message`) inside the current screen; buttons re-enable.
- Lost room on reload (404 from `/state`) → clear `roomId`, return to start screen.
- Fonts fail → monospace fallbacks keep layout (fixed heights on chips/buttons).

## 7. Testing / verification

- `npm run lint` and `npm run build` pass.
- Manual run through: create room → add 3 players → start → 10 cards → see a round-based rule appear and count down → reset.
- Visual check at 375, 768, 1024, 1440px; keyboard focus visible on all controls; contrast ≥ 4.5:1 for body text (dim `#8f8aa6` on `#0b0a12` ≈ 6.0:1).
- Reduced motion respected.

## 8. Out of scope

Sound, settings menu, multi-device rooms, new cards, backend changes, analytics.

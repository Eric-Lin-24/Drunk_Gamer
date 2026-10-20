# Drunk Gamer — Edit Deck design

**Date:** 2026-10-20
**Status:** Approved in brainstorming (companion screen `edit-deck-layout`, option B)
**Builds on:** `2026-10-20-neon-street-site-design.md` (in-browser engine, Neon Street styling)

## Goal

Let players tune the deck before a game: change how many copies of each card are in the deck (0 = off), edit the wording of built-in cards, and add their own cards. Every card shows its copy count and the odds of it being the next card dealt.

## Where

The lobby becomes **GAME SETUP** with two tabs: `PLAYERS · n` (today's lobby) and `DECK · n`. START GAME sits under both tabs and is disabled when there are no players or the deck is empty.

## DECK tab

- Header line: `318 CARDS · 274 UNIQUE`.
- Search box (title + description, case-insensitive) and `+ NEW` button.
- Filter chips with share of the deck: `ALL`, `CHAOS 32%`, `DARE`, `TRUTH`, `OPINION`, `POWER`, `RULES`, `MINE` (custom cards).
- One row per card: category tag · title (+ `NEW` badge for custom, `EDITED` for changed built-ins) · one-line description · **odds** · **copies stepper** `− ×2 +` (0–5) · ✎ edit.
  - Odds = copies ÷ total copies in deck, shown as `0.7%`; `<0.1%` when tiny; `—` when 0 copies.
  - Rows with 0 copies are dimmed and struck through.
- `RESET DECK TO DEFAULT` at the bottom, with an inline "Are you sure?" confirm.

## Card editor (dialog; full-screen on phones)

- Title (required, ≤ 40 chars), What to do (required, ≤ 160 chars).
- Type chips: CHAOS, DARE, TRUTH, OPINION, POWER, RULE. RULE reveals **Who**: ONE PLAYER / EVERYONE and **Rounds**: 1–4 → stored as `person_round_based:N` / `group_round_based:N` (same format as built-in cards).
- Buttons: CANCEL · (built-in edited → `RESTORE ORIGINAL`) / (custom → `DELETE`) · SAVE. Escape closes.

## Data

`localStorage["drunkgamer:deck"]`:

```json
{ "copies": { "24": 0, "28": 2 }, "edits": { "28": { "title": "…", "description": "…", "category": "dare" } }, "custom": [ { "id": "c-…", "title": "…", "description": "…", "category": "chaos" } ] }
```

- `copies` only stores values ≠ 1. `edits` only stores built-ins that differ from the original. Custom ids are strings prefixed `c-`; built-in ids are numbers, so they never collide.
- `cards.json` is never modified; restore/reset just delete entries.
- The dealt deck is the expanded list (each card repeated `copies` times); the engine shuffles it like a physical pack.

## Units

- `src/lib/deck.js` (pure, unit-tested): `emptyDeckEdits`, `parseCategory`, `ruleCategory`, `deckRows`, `buildDeck`, `setCopies`, `saveCard`, `restoreCard`, `deleteCard`, `validateCard`, `filterRows`, `shareOf`, `formatOdds`.
- `src/play/useDeck.js`: load/save edits, memoised rows + built deck.
- `src/play/DeckPanel.jsx`, `src/play/CardEditor.jsx`; `LobbyScreen.jsx` gains tabs; `useGame.nextCard(cards)` takes the built deck.

## Out of scope

Share links, editing mid-game, bulk category toggles.

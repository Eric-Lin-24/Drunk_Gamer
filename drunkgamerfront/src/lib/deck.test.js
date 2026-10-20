import { test } from "node:test";
import assert from "node:assert/strict";
import {
  emptyDeckEdits, parseCategory, ruleCategory, deckRows, buildDeck, setCopies, saveCard,
  restoreCard, deleteCard, validateCard, filterRows, shareOf, formatOdds,
} from "./deck.js";

const BASE = [
  { id: 1, title: "Goblin Mode", description: "Act like a gremlin.", category: "person_round_based:1" },
  { id: 2, title: "Villain Monologue", description: "Evil speech.", category: "chaos" },
  { id: 3, title: "Worst Date", description: "Tell your worst date story.", category: "truth" },
  { id: 4, title: "Karaoke", description: "Sing a chorus.", category: "dare" },
];
const E = emptyDeckEdits();

test("parseCategory and ruleCategory round-trip", () => {
  assert.deepEqual(parseCategory("chaos"), { kind: "chaos" });
  assert.deepEqual(parseCategory("group_round_based:4"), { kind: "rule", who: "group", rounds: 4 });
  assert.equal(ruleCategory("person", 2), "person_round_based:2");
});

test("deckRows defaults to one copy each with equal odds", () => {
  const rows = deckRows(BASE, E);
  assert.equal(rows.length, 4);
  assert.ok(rows.every((r) => r.copies === 1 && r.odds === 0.25 && r.status === "base"));
});

test("copies change odds; zero copies means zero odds", () => {
  let e = setCopies(E, 2, 3);
  e = setCopies(e, 3, 0);
  const rows = deckRows(BASE, e);
  const by = Object.fromEntries(rows.map((r) => [r.card.id, r]));
  assert.equal(by[2].copies, 3);
  assert.equal(by[2].odds, 3 / 5);
  assert.equal(by[3].odds, 0);
});

test("setCopies clamps to 0..5 and forgets the default of 1", () => {
  assert.equal(setCopies(E, 2, 9).copies[2], 5);
  assert.equal(setCopies(E, 2, -1).copies[2], 0);
  assert.deepEqual(setCopies(setCopies(E, 2, 3), 2, 1).copies, {});
});

test("buildDeck repeats cards by copies and drops zeros", () => {
  const e = setCopies(setCopies(E, 2, 2), 3, 0);
  assert.deepEqual(buildDeck(deckRows(BASE, e)).map((c) => c.id), [1, 2, 2, 4]);
});

test("saveCard adds a custom card with a c- id", () => {
  const e = saveCard(BASE, E, { title: " Shot Roulette ", description: "Spin it.", category: "chaos" }, () => "x1");
  assert.deepEqual(e.custom, [{ id: "c-x1", title: "Shot Roulette", description: "Spin it.", category: "chaos" }]);
  const row = deckRows(BASE, e).at(-1);
  assert.equal(row.status, "custom");
  assert.equal(row.odds, 1 / 5);
});

test("saveCard edits a custom card in place", () => {
  let e = saveCard(BASE, E, { title: "A", description: "B", category: "chaos" }, () => "x1");
  e = saveCard(BASE, e, { id: "c-x1", title: "A2", description: "B2", category: "dare" });
  assert.deepEqual(e.custom, [{ id: "c-x1", title: "A2", description: "B2", category: "dare" }]);
});

test("saveCard stores an edit for a changed built-in, and drops it when changed back", () => {
  const e = saveCard(BASE, E, { id: 4, title: "Karaoke", description: "Sing a chorus the group picks.", category: "dare" });
  assert.deepEqual(e.edits[4], { title: "Karaoke", description: "Sing a chorus the group picks.", category: "dare" });
  const row = deckRows(BASE, e).find((r) => r.card.id === 4);
  assert.equal(row.status, "edited");
  assert.equal(row.card.description, "Sing a chorus the group picks.");
  const back = saveCard(BASE, e, { id: 4, title: "Karaoke", description: "Sing a chorus.", category: "dare" });
  assert.deepEqual(back.edits, {});
});

test("restoreCard and deleteCard", () => {
  let e = saveCard(BASE, E, { id: 4, title: "K", description: "D", category: "dare" });
  assert.deepEqual(restoreCard(e, 4).edits, {});
  e = saveCard(BASE, E, { title: "A", description: "B", category: "chaos" }, () => "x1");
  e = setCopies(e, "c-x1", 3);
  const gone = deleteCard(e, "c-x1");
  assert.deepEqual(gone.custom, []);
  assert.deepEqual(gone.copies, {});
});

test("validateCard requires text and enforces limits", () => {
  assert.deepEqual(validateCard({ title: "Ok", description: "Fine" }), {});
  assert.ok(validateCard({ title: " ", description: "x" }).title);
  assert.ok(validateCard({ title: "x".repeat(41), description: "x" }).title);
  assert.ok(validateCard({ title: "x", description: "" }).description);
  assert.ok(validateCard({ title: "x", description: "x".repeat(161) }).description);
});

test("filterRows by search text and filter", () => {
  const e = saveCard(BASE, E, { title: "Shot Roulette", description: "Spin.", category: "chaos" }, () => "x1");
  const rows = deckRows(BASE, e);
  assert.deepEqual(filterRows(rows, { query: "WORST" }).map((r) => r.card.id), [3]);
  assert.deepEqual(filterRows(rows, { filter: "chaos" }).map((r) => r.card.id), [2, "c-x1"]);
  assert.deepEqual(filterRows(rows, { filter: "rules" }).map((r) => r.card.id), [1]);
  assert.deepEqual(filterRows(rows, { filter: "mine" }).map((r) => r.card.id), ["c-x1"]);
  assert.equal(filterRows(rows, {}).length, 5);
});

test("shareOf weights by copies", () => {
  const rows = deckRows(BASE, setCopies(E, 2, 2));
  assert.equal(shareOf(rows, "chaos"), 2 / 5);
  assert.equal(shareOf(deckRows(BASE, BASE.reduce((e, c) => setCopies(e, c.id, 0), E)), "chaos"), 0);
});

test("formatOdds", () => {
  assert.equal(formatOdds(0), "—");
  assert.equal(formatOdds(0.0004), "<0.1%");
  assert.equal(formatOdds(0.00322), "0.3%");
  assert.equal(formatOdds(0.25), "25%");
});

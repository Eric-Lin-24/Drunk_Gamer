import { test } from "node:test";
import assert from "node:assert/strict";
import { newGame, addPlayer, removePlayer, dealCard, shuffle } from "./engine.js";

const CARDS = [
  { id: 1, title: "Goblin Mode", description: "Act like a gremlin.", category: "person_round_based:1" },
  { id: 2, title: "Villain Monologue", description: "Evil speech.", category: "chaos" },
  { id: 3, title: "No Smiling", description: "No smiling.", category: "group_round_based:1" },
  { id: 4, title: "Opera Mode", description: "Sing.", category: "person_round_based:2" },
];
// rand() = 0 makes shuffle a fixed rotation; we assert behaviour, not a specific order.
const opts = (over = {}) => {
  let n = 0;
  return { rand: () => 0, now: () => 1000, makeId: () => `id${++n}`, ...over };
};
const withPlayers = (...names) => names.reduce((g, name, i) => addPlayer(g, name, `p${i}`), newGame());
// Seeds a fixed deck order (must be CARDS.length long), then lets the engine deal.
const deal = (game, times, order) => {
  game = { ...game, deckOrder: order, deckPos: 0 };
  for (let i = 0; i < times; i++) game = dealCard(game, CARDS, opts());
  return game;
};

test("newGame starts empty on round 1", () => {
  assert.deepEqual(newGame(), { players: [], cardCounter: 0, currentRound: 1, activeRules: [], currentCard: null, deckOrder: null, deckPos: 0 });
});

test("addPlayer trims, caps at 24 chars and ignores blanks", () => {
  let g = addPlayer(newGame(), "  Jake  ", "a");
  g = addPlayer(g, "   ", "b");
  g = addPlayer(g, "x".repeat(30), "c");
  assert.deepEqual(g.players.map((p) => p.name), ["Jake", "x".repeat(24)]);
  assert.equal(g.players[0].id, "a");
});

test("removePlayer drops by id", () => {
  const g = removePlayer(withPlayers("Jake", "Sofia"), "p0");
  assert.deepEqual(g.players.map((p) => p.name), ["Sofia"]);
});

test("shuffle is a permutation and does not mutate input", () => {
  const ids = [1, 2, 3, 4, 5];
  const out = shuffle(ids, Math.random);
  assert.deepEqual([...out].sort(), ids);
  assert.deepEqual(ids, [1, 2, 3, 4, 5]);
});

test("dealCard refuses with no players", () => {
  assert.throws(() => dealCard(newGame(), CARDS, opts()), /at least 1 player/);
});

test("dealCard builds a deck, advances position and counter", () => {
  const g = dealCard(withPlayers("Jake"), CARDS, opts());
  assert.equal(g.deckOrder.length, 4);
  assert.equal(g.deckPos, 1);
  assert.equal(g.cardCounter, 1);
  assert.equal(g.currentCard.id, g.deckOrder[0]);
  assert.equal(g.currentCard.shownAt, 1000);
});

test("deck reshuffles after the last card", () => {
  let g = withPlayers("Jake");
  for (let i = 0; i < 5; i++) g = dealCard(g, CARDS, opts());
  assert.equal(g.deckPos, 1);
  assert.equal(g.cardCounter, 5);
});

test("person rule is attached to the player whose turn it was", () => {
  const g = deal(withPlayers("Jake", "Sofia"), 1, [4, 2, 2, 2]);
  assert.equal(g.activeRules.length, 1);
  assert.deepEqual(
    { type: g.activeRules[0].type, playerId: g.activeRules[0].playerId, playerName: g.activeRules[0].playerName, roundsRemaining: g.activeRules[0].roundsRemaining, cardTitle: g.activeRules[0].cardTitle },
    { type: "person", playerId: "p0", playerName: "Jake", roundsRemaining: 2, cardTitle: "Opera Mode" },
  );
});

test("person rule counts down on that player's later turns and expires", () => {
  // Jake gets Opera Mode (2 rounds). Turns: Jake, Sofia, Jake(-1), Sofia, Jake(-1 → gone)
  const order = [4, 2, 2, 2]; // 5th deal reshuffles; Opera Mode is not re-dealt with rand()=0
  assert.equal(deal(withPlayers("Jake", "Sofia"), 3, order).activeRules[0].roundsRemaining, 1);
  assert.equal(deal(withPlayers("Jake", "Sofia"), 5, order).activeRules.length, 0);
});

test("round advances after everyone has had a turn; group rules count down then", () => {
  const order = [3, 2, 2, 2];
  const afterOne = deal(withPlayers("Jake", "Sofia"), 1, order);
  assert.equal(afterOne.currentRound, 1);
  assert.equal(afterOne.activeRules[0].type, "group");
  const afterTwo = deal(withPlayers("Jake", "Sofia"), 2, order);
  assert.equal(afterTwo.currentRound, 2);
  assert.equal(afterTwo.activeRules.length, 0);
});

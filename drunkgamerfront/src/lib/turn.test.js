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

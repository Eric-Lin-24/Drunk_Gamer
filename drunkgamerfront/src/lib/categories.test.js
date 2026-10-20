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

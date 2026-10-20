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

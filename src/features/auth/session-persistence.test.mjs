import assert from "node:assert/strict";
import test from "node:test";
import { readPersistedAuthSession, savePersistedAuthSession, clearPersistedAuthSession } from "./session-contract.ts";

function memoryStorage() {
  const values = new Map();
  return {
    get: async (key) => values.get(key) ?? null,
    set: async (key, value) => values.set(key, value),
    remove: async (key) => values.delete(key),
    values,
  };
}

test("persists and restores the C端 business token and user profile", async () => {
  const storage = memoryStorage();
  const session = { accessToken: "business-token", user: { id: "42", nickname: "小明" } };

  await savePersistedAuthSession(session, storage);

  assert.deepEqual(await readPersistedAuthSession(storage), session);
});

test("ignores malformed persisted sessions and can clear them", async () => {
  const storage = memoryStorage();
  await storage.set("esports.auth.session", "not-json");

  assert.equal(await readPersistedAuthSession(storage), null);
  await clearPersistedAuthSession(storage);
  assert.equal(storage.values.has("esports.auth.session"), false);
});

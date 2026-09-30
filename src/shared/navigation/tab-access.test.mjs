import assert from "node:assert/strict";
import test from "node:test";
import {
  canOpenTab,
  getProtectedNavigationAction,
  getTabPressAction,
  isProtectedTab,
} from "./tab-access.ts";

test("only order, message, and mine require authentication", () => {
  assert.equal(isProtectedTab("index"), false);
  assert.equal(isProtectedTab("order"), true);
  assert.equal(isProtectedTab("message"), true);
  assert.equal(isProtectedTab("mine"), true);
});

test("unauthenticated users can open home but not protected tabs", () => {
  assert.equal(canOpenTab("index", false), true);
  assert.equal(canOpenTab("order", false), false);
  assert.equal(canOpenTab("message", false), false);
  assert.equal(canOpenTab("mine", false), false);
});

test("authenticated users can open every tab", () => {
  assert.equal(canOpenTab("index", true), true);
  assert.equal(canOpenTab("order", true), true);
  assert.equal(canOpenTab("message", true), true);
  assert.equal(canOpenTab("mine", true), true);
});

test("unauthenticated protected tab presses open login instead of changing tabs", () => {
  assert.deepEqual(getTabPressAction("order", false), {
    type: "login",
    replaceCurrentRoute: true,
  });
  assert.deepEqual(getTabPressAction("message", false), {
    type: "login",
    replaceCurrentRoute: true,
  });
  assert.deepEqual(getTabPressAction("mine", false), {
    type: "login",
    replaceCurrentRoute: true,
  });
});

test("authenticated and home tab presses navigate to the requested tab", () => {
  assert.deepEqual(getTabPressAction("index", false), {
    type: "navigate",
    tab: "index",
  });
  assert.deepEqual(getTabPressAction("mine", true), {
    type: "navigate",
    tab: "mine",
  });
});

test("quick match requires authentication before navigation", () => {
  assert.deepEqual(getProtectedNavigationAction("match", false), {
    type: "login",
    replaceCurrentRoute: true,
  });
  assert.deepEqual(getProtectedNavigationAction("match", true), {
    type: "navigate",
    destination: "match",
  });
});

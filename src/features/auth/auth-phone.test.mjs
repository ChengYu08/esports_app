import assert from "node:assert/strict";
import test from "node:test";
import { isFullMainlandPhone, resolveAuthPhone } from "./auth-phone.ts";

test("uses the login phone when the profile API returns a masked phone", () => {
  assert.equal(resolveAuthPhone("132****7734", "13258137734"), "13258137734");
});

test("keeps complete profile phones and does not treat incomplete phones as valid", () => {
  assert.equal(resolveAuthPhone("13258137734", "13800138000"), "13258137734");
  assert.equal(resolveAuthPhone("132****7734", "1327734"), "132****7734");
  assert.equal(isFullMainlandPhone("13258137734"), true);
  assert.equal(isFullMainlandPhone("132****7734"), false);
});

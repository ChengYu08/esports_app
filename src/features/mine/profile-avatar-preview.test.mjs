import test from "node:test";
import assert from "node:assert/strict";

import { createProfileAvatarPreviewParams } from "./profile-avatar-preview.ts";

test("creates single-image preview params for a profile avatar", () => {
  assert.deepEqual(
    createProfileAvatarPreviewParams("https://cdn.test/avatar.jpg"),
    { images: JSON.stringify(["https://cdn.test/avatar.jpg"]), index: "0" },
  );
});

test("does not create preview params when the profile has no avatar", () => {
  assert.equal(createProfileAvatarPreviewParams(), null);
  assert.equal(createProfileAvatarPreviewParams("  "), null);
});

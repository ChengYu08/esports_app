import test from "node:test";
import assert from "node:assert/strict";

import { createImagePreviewParams, parseImagePreviewParams } from "./image-preview.params.ts";

test("round trips preview images and clamps an invalid index", () => {
  const params = createImagePreviewParams(["https://cdn.test/a.jpg", "https://cdn.test/b.jpg"], 9);

  assert.deepEqual(parseImagePreviewParams(params), {
    images: ["https://cdn.test/a.jpg", "https://cdn.test/b.jpg"],
    index: 1,
  });
});

test("returns an empty gallery for malformed route data", () => {
  assert.deepEqual(parseImagePreviewParams({ images: "%7Bbad" }), { images: [], index: 0 });
});

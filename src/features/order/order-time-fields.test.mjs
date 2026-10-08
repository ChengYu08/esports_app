import test from "node:test";
import assert from "node:assert/strict";

import { readOrderTimeFields } from "./order-time-fields.ts";

test("maps the order lifecycle time fields used by the PC order model", () => {
  assert.deepEqual(
    readOrderTimeFields({
      createTime: "2026-10-08T10:00:00",
      paidTime: "2026-10-08T10:01:00",
      acceptedTime: "2026-10-08T10:02:00",
      serviceStartTime: "2026-10-08T10:05:00",
      serviceEndTime: "2026-10-08T11:05:00",
      completedTime: "2026-10-08T11:06:00",
    }),
    {
      createTime: "2026-10-08T10:00:00",
      paidTime: "2026-10-08T10:01:00",
      acceptedTime: "2026-10-08T10:02:00",
      serviceStartTime: "2026-10-08T10:05:00",
      serviceEndTime: "2026-10-08T11:05:00",
      completedTime: "2026-10-08T11:06:00",
    },
  );
});

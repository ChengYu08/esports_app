import { describe, expect, it } from "vitest";

import { createTeenRequestGuard } from "./teen-request-guard";

describe("createTeenRequestGuard", () => {
  it("A 的异步快照在切换 B 后失效，A→B→A 也不能复活", () => {
    const guard = createTeenRequestGuard();
    guard.beginSession();
    const aSnapshot = guard.snapshot();

    guard.beginSession();
    expect(guard.isCurrent(aSnapshot)).toBe(false);

    guard.beginSession();
    expect(guard.isCurrent(aSnapshot)).toBe(false);
  });

  it("账号内 open/close 成功后，较早的 status 快照失效", () => {
    const guard = createTeenRequestGuard();
    const session = guard.beginSession();
    const statusSnapshot = guard.snapshot();

    guard.invalidateStatus();

    expect(guard.isSessionCurrent(session)).toBe(true);
    expect(guard.isCurrent(statusSnapshot)).toBe(false);
  });
});

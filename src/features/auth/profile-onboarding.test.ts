import { describe, expect, it } from "vitest";

import { isProfileIncomplete } from "./profile-onboarding";

describe("isProfileIncomplete", () => {
  it("新注册用户（默认昵称+未设性别+未实名）需要完善资料", () => {
    expect(
      isProfileIncomplete({ nickname: "盼友_123456789012", gender: 0, isRealName: 0 }),
    ).toBe(true);
  });

  it("改过昵称的用户不弹", () => {
    expect(
      isProfileIncomplete({ nickname: "大熊猫", gender: 0, isRealName: 0 }),
    ).toBe(false);
  });

  it("已实名的用户不弹（即使昵称仍是默认）", () => {
    expect(
      isProfileIncomplete({ nickname: "盼友_123456789012", gender: 0, isRealName: 1 }),
    ).toBe(false);
  });

  it("已设性别的用户不弹（男=1/女=2）", () => {
    expect(
      isProfileIncomplete({ nickname: "盼友_123456789012", gender: 1, isRealName: 0 }),
    ).toBe(false);
    expect(
      isProfileIncomplete({ nickname: "盼友_123456789012", gender: 2, isRealName: 0 }),
    ).toBe(false);
  });

  it("字段缺失时按未设置处理", () => {
    expect(isProfileIncomplete({})).toBe(true);
    expect(isProfileIncomplete({ nickname: "" })).toBe(true);
  });
});

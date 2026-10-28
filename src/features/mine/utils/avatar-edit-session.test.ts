import { describe, expect, it } from "vitest";

import {
  beginAvatarEdit,
  completeAvatarEdit,
} from "./avatar-edit-session";

describe("avatar-edit-session 会话桥接", () => {
  it("begin 后 complete(uri) 解析出裁剪结果", async () => {
    const pending = beginAvatarEdit();
    completeAvatarEdit("file://cropped.jpg");
    await expect(pending).resolves.toBe("file://cropped.jpg");
  });

  it("complete(null) 表示用户取消", async () => {
    const pending = beginAvatarEdit();
    completeAvatarEdit(null);
    await expect(pending).resolves.toBeNull();
  });

  it("未 begin 时 complete 为 no-op 不抛错", () => {
    expect(() => completeAvatarEdit("file://x")).not.toThrow();
  });

  it("取消后重新 begin 可开启新会话", async () => {
    const first = beginAvatarEdit();
    completeAvatarEdit(null);
    await expect(first).resolves.toBeNull();

    const second = beginAvatarEdit();
    completeAvatarEdit("file://second.jpg");
    await expect(second).resolves.toBe("file://second.jpg");
  });
});

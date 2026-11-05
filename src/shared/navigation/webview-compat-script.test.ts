import vm from "node:vm";
import { describe, expect, it } from "vitest";

import { WEBVIEW_COMPAT_SCRIPT } from "@/shared/navigation/webview-compat-script";

// 模拟 Android 11 自带 WebView（Chrome 87）缺失的新 API
const LEGACY_RUNTIME_SETUP = `
  delete Array.prototype.at;
  delete String.prototype.at;
  delete Object.hasOwn;
  delete Array.prototype.findLast;
  delete Array.prototype.findLastIndex;
  delete Array.prototype.toReversed;
  delete Array.prototype.toSorted;
  delete Array.prototype.toSpliced;
`;

function createLegacyContext() {
  const context = vm.createContext({
    crypto: {
      getRandomValues(target: Uint8Array) {
        for (let index = 0; index < target.length; index++) {
          target[index] = index + 1;
        }
        return target;
      },
    },
  });
  vm.runInContext(LEGACY_RUNTIME_SETUP, context);
  vm.runInContext(WEBVIEW_COMPAT_SCRIPT, context);
  return context;
}

describe("WEBVIEW_COMPAT_SCRIPT", () => {
  it("补齐旧 WebView 缺失的数组与字符串 at", () => {
    const context = createLegacyContext();

    expect(vm.runInContext("[1, 2, 3].at(-1)", context)).toBe(3);
    expect(vm.runInContext("'盼之'.at(0)", context)).toBe("盼");
    expect(vm.runInContext("[1, 2, 3].at(5)", context)).toBeUndefined();
  });

  it("补齐 Object.hasOwn 与数组查找方法", () => {
    const context = createLegacyContext();

    expect(vm.runInContext("Object.hasOwn({ a: 1 }, 'a')", context)).toBe(true);
    expect(vm.runInContext("Object.hasOwn({ a: 1 }, 'b')", context)).toBe(false);
    expect(
      vm.runInContext("[1, 2, 3].findLast((item) => item < 3)", context),
    ).toBe(2);
    expect(
      vm.runInContext("[1, 2, 3].findLastIndex((item) => item < 3)", context),
    ).toBe(1);
  });

  it("补齐不可变数组方法且不修改原数组", () => {
    const context = createLegacyContext();

    expect(vm.runInContext("[1, 2].toReversed().join(',')", context)).toBe(
      "2,1",
    );
    expect(
      vm.runInContext("[3, 1, 2].toSorted((a, b) => a - b).join(',')", context),
    ).toBe("1,2,3");
    expect(vm.runInContext("[1, 2, 3].toSpliced(1, 1).join(',')", context)).toBe(
      "1,3",
    );
    expect(
      vm.runInContext(
        "var list = [1]; list.toSorted(); list.join(',')",
        context,
      ),
    ).toBe("1");
  });

  it("补齐 crypto.randomUUID 并返回标准 UUID", () => {
    const context = createLegacyContext();

    expect(
      vm.runInContext(
        "crypto.randomUUID()",
        context,
      ),
    ).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});

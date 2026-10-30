import { describe, expect, it } from "vitest";

import { normalizeVersion, decideAppUpgrade } from "./app-upgrade-gate";
import type { AppVersionVO } from "./app-upgrade.contract";

describe("normalizeVersion", () => {
  it("trims whitespace and strips the leading v/V prefix", () => {
    expect(normalizeVersion("  v1.2.3 ")).toBe("1.2.3");
    expect(normalizeVersion("V2.0.0")).toBe("2.0.0");
    expect(normalizeVersion("1.2.3")).toBe("1.2.3");
  });

  it("keeps inner letters untouched", () => {
    expect(normalizeVersion("1.2.3-beta.1")).toBe("1.2.3-beta.1");
  });
});

describe("decideAppUpgrade", () => {
  const base: AppVersionVO = {
    versionNo: "1.1.0",
    packageUrl: "https://oss.example.com/app.apk",
    updateContent: "修复已知问题",
  };

  it("returns no update when latest is null", () => {
    expect(decideAppUpgrade(null, "1.0.0").hasUpdate).toBe(false);
  });

  it("returns no update when versionNo or packageUrl is missing", () => {
    expect(decideAppUpgrade({ versionNo: "1.1.0" }, "1.0.0").hasUpdate).toBe(
      false,
    );
    expect(decideAppUpgrade({ ...base, packageUrl: undefined }, "1.0.0").hasUpdate).toBe(
      false,
    );
  });

  it("returns no update when versions match after normalization", () => {
    expect(decideAppUpgrade({ ...base, versionNo: "v1.0.0" }, "V1.0.0").hasUpdate).toBe(
      false,
    );
  });

  it("returns update when versions differ and there is a package url", () => {
    const decision = decideAppUpgrade(base, "1.0.0");
    expect(decision.hasUpdate).toBe(true);
    expect(decision.forceUpdate).toBe(false);
    expect(decision.latest).toBe(base);
  });

  it("compares segments numerically, not lexicographically", () => {
    expect(
      decideAppUpgrade({ ...base, versionNo: "1.0.10" }, "1.0.9").hasUpdate,
    ).toBe(true);
  });

  it("accepts versions with more or fewer than 3 numeric segments", () => {
    expect(
      decideAppUpgrade({ ...base, versionNo: "1.1" }, "1.0.0").hasUpdate,
    ).toBe(true);
    expect(
      decideAppUpgrade({ ...base, versionNo: "1.0.0.1" }, "1.0.0").hasUpdate,
    ).toBe(true);
    expect(
      decideAppUpgrade({ ...base, versionNo: "1.0" }, "1.0.0").hasUpdate,
    ).toBe(false);
    expect(
      decideAppUpgrade({ ...base, versionNo: "1.0.0" }, "1.0.0.0.1").hasUpdate,
    ).toBe(false);
  });

  it("returns no update when the latest version is lower than current", () => {
    expect(decideAppUpgrade(base, "1.1.0").hasUpdate).toBe(false);
    expect(decideAppUpgrade({ ...base, versionNo: "0.0.1" }, "1.0.0").hasUpdate).toBe(
      false,
    );
  });

  it("returns no update when either version is not strictly numeric dot-separated", () => {
    expect(
      decideAppUpgrade(
        { ...base, versionNo: "1.0.0-beta.1" },
        "1.0.0",
      ).hasUpdate,
    ).toBe(false);
    expect(decideAppUpgrade(base, "1.0.0-beta.1").hasUpdate).toBe(false);
    expect(decideAppUpgrade({ ...base, versionNo: "1..0" }, "1.0.0").hasUpdate).toBe(
      false,
    );
    expect(decideAppUpgrade({ ...base, versionNo: "v" }, "1.0.0").hasUpdate).toBe(
      false,
    );
    expect(decideAppUpgrade({ ...base, versionNo: "" }, "1.0.0").hasUpdate).toBe(
      false,
    );
  });

  it("marks force update when needForceUpdate is 1", () => {
    const decision = decideAppUpgrade({ ...base, needForceUpdate: 1 }, "1.0.0");
    expect(decision.hasUpdate).toBe(true);
    expect(decision.forceUpdate).toBe(true);
  });

  it("prefers needForceUpdate over the version's own forceUpdate flag", () => {
    const decision = decideAppUpgrade(
      { ...base, needForceUpdate: 0, forceUpdate: 1 },
      "1.0.0",
    );
    expect(decision.forceUpdate).toBe(false);
  });

  it("falls back to the version's own forceUpdate flag", () => {
    const decision = decideAppUpgrade({ ...base, forceUpdate: 1 }, "1.0.0");
    expect(decision.forceUpdate).toBe(true);
  });
});

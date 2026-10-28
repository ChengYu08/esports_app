import { describe, expect, it } from "vitest";

import { decideOtaGate, parseOtaConfig } from "./ota-update-gate";

const configWith = (version: unknown, extra: Record<string, unknown> = {}) =>
  JSON.stringify({ version, ...extra });

describe("parseOtaConfig", () => {
  it("parses a valid config", () => {
    expect(
      parseOtaConfig(
        configWith(2, {
          updateStrategy: "silentAndLater",
        }),
      ),
    ).toEqual({
      version: 2,
      updateStrategy: "silentAndLater",
    });
  });

  it("accepts null updateStrategy", () => {
    expect(parseOtaConfig(configWith(2, { updateStrategy: null }))).toEqual({
      version: 2,
      updateStrategy: null,
    });
  });

  it("ignores legacy checkStrategy without failing", () => {
    expect(
      parseOtaConfig(
        configWith(2, {
          updateStrategy: "alertUpdateAndIgnoreError",
          checkStrategy: "both",
        }),
      ),
    ).toEqual({
      version: 2,
      updateStrategy: "alertUpdateAndIgnoreError",
    });
  });

  it("rejects missing or invalid payloads", () => {
    expect(parseOtaConfig(null)).toBeNull();
    expect(parseOtaConfig(undefined)).toBeNull();
    expect(parseOtaConfig("")).toBeNull();
    expect(parseOtaConfig("not json")).toBeNull();
    expect(parseOtaConfig("null")).toBeNull();
    expect(parseOtaConfig("[]")).toBeNull();
    expect(parseOtaConfig('{"version":"2"}')).toBeNull();
    expect(parseOtaConfig('{"version":-1}')).toBeNull();
    expect(parseOtaConfig('{"version":1.5}')).toBeNull();
    expect(parseOtaConfig("{}")).toBeNull();
  });

  it("rejects unknown updateStrategy values", () => {
    expect(
      parseOtaConfig(configWith(2, { updateStrategy: "alertAlways" })),
    ).toBeNull();
  });
});

describe("decideOtaGate", () => {
  it("triggers when the configured version is newer", () => {
    expect(decideOtaGate(configWith(3), 2)).toMatchObject({
      trigger: true,
      config: { version: 3 },
    });
  });

  it("triggers when local version is 0 (first hot update)", () => {
    expect(decideOtaGate(configWith(1), 0)).toMatchObject({ trigger: true });
  });

  it("does not trigger when versions are equal", () => {
    expect(decideOtaGate(configWith(2), 2).trigger).toBe(false);
  });

  it("does not trigger when the local version is newer", () => {
    expect(decideOtaGate(configWith(2), 3).trigger).toBe(false);
  });

  it("does not trigger without config", () => {
    expect(decideOtaGate(null, 2)).toEqual({ trigger: false, config: null });
  });
});

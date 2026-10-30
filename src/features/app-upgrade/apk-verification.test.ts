import { describe, expect, it } from "vitest";

import { decideMd5Verification } from "./apk-verification";

const MD5_A = "d41d8cd98f00b204e9800998ecf8427e";

describe("decideMd5Verification", () => {
  it("skips when the backend record has no md5 (old data compatibility)", () => {
    expect(decideMd5Verification(undefined, MD5_A)).toBe("skip");
    expect(decideMd5Verification("", MD5_A)).toBe("skip");
    expect(decideMd5Verification("   ", MD5_A)).toBe("skip");
  });

  it("matches case-insensitively", () => {
    expect(decideMd5Verification(MD5_A.toUpperCase(), MD5_A)).toBe("match");
    expect(decideMd5Verification(MD5_A, MD5_A.toUpperCase())).toBe("match");
    expect(decideMd5Verification(`  ${MD5_A}  `, ` ${MD5_A} `)).toBe("match");
  });

  it("reports mismatch on different hashes", () => {
    expect(decideMd5Verification(MD5_A, "0123456789abcdef0123456789abcdef")).toBe(
      "mismatch",
    );
  });

  it("reports mismatch when the local hash is unreadable", () => {
    expect(decideMd5Verification(MD5_A, null)).toBe("mismatch");
  });
});

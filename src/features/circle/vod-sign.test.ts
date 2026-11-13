import { describe, expect, it } from "vitest";

import {
  buildVolcAuthorization,
  canonicalQuery,
  crc32Hex,
  CRC32_TEST_VECTOR,
  formatVolcXDate,
} from "@/features/circle/vod-sign";

function utf8(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

describe("crc32Hex", () => {
  it("命中 IEEE 802.3 标准测试向量", () => {
    expect(crc32Hex(utf8("123456789"))).toBe(CRC32_TEST_VECTOR);
  });

  it("输出恒为 8 位小写十六进制（零填充）", () => {
    const value = crc32Hex(utf8("a"));
    expect(value).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe("formatVolcXDate", () => {
  it("去掉毫秒与分隔符，形如 YYYYMMDDTHHMMSSZ", () => {
    expect(formatVolcXDate(new Date("2026-11-09T08:30:05.123Z"))).toBe(
      "20261109T083005Z",
    );
  });
});

describe("canonicalQuery", () => {
  it("按 key 字典序排序并编码拼接", () => {
    expect(
      canonicalQuery({
        Version: "2022-01-01",
        Action: "ApplyUploadInfo",
        FileName: "视频.mp4",
      }),
    ).toBe("Action=ApplyUploadInfo&FileName=%E8%A7%86%E9%A2%91.mp4&Version=2022-01-01");
  });
});

describe("buildVolcAuthorization", () => {
  const headers = {
    "X-Date": "20261109T083005Z",
    "x-security-token": "sts-token",
  };

  it("生成 Credential/SignedHeaders/Signature 三段式", () => {
    const auth = buildVolcAuthorization({
      method: "GET",
      params: { Action: "ApplyUploadInfo", Version: "2022-01-01" },
      headers,
      accessKeyId: "ak-test",
      secretAccessKey: "sk-test",
    });
    expect(auth).toMatch(
      /^HMAC-SHA256 Credential=ak-test\/20261109\/cn-north-1\/vod\/request, SignedHeaders=x-date;x-security-token, Signature=[0-9a-f]{64}$/,
    );
  });

  it("按实际请求头值生成 ApplyUploadInfo 签名", () => {
    const auth = buildVolcAuthorization({
      method: "GET",
      params: { Action: "ApplyUploadInfo", Version: "2022-01-01" },
      headers,
      accessKeyId: "ak-test",
      secretAccessKey: "sk-test",
    });
    // 固定向量由独立的 Node crypto HMAC-SHA256 计算，规范头包含 X-Date 与 STS Token 的真实值。
    expect(auth.split("Signature=")[1]).toBe(
      "a2463c1f2230684d480e403f6d7d51fdccb862c650d6a126e0d820e670bca2bd",
    );
  });

  it("同输入产生确定性签名（本地幂等）", () => {
    const args = {
      method: "POST" as const,
      params: { Action: "CommitUploadInfo", Version: "2022-01-01" },
      headers: {
        ...headers,
        "Content-Type": "application/json",
        "X-Content-Sha256": "abc",
      },
      body: '{"SessionKey":"k"}',
      accessKeyId: "ak-test",
      secretAccessKey: "sk-test",
    };
    expect(buildVolcAuthorization(args)).toBe(buildVolcAuthorization(args));
  });

  it("content-type 不进入 SignedHeaders，X-Content-Sha256 进入", () => {
    const auth = buildVolcAuthorization({
      method: "POST",
      params: { Action: "CommitUploadInfo", Version: "2022-01-01" },
      headers: {
        ...headers,
        "Content-Type": "application/json",
        "X-Content-Sha256": "abc",
      },
      accessKeyId: "ak",
      secretAccessKey: "sk",
    });
    const signed = /SignedHeaders=([^,]+),/.exec(auth)?.[1];
    expect(signed).toBe("x-content-sha256;x-date;x-security-token");
  });
});

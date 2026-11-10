import { HmacSHA256, SHA256 } from "crypto-js";

/**
 * 火山引擎 V4 请求签名（HMAC-SHA256）纯函数内核。
 *
 * 协议逆向自火山官方 Web 上传 SDK tt-uploader@1.6.2（isVolcengine 分支）：
 * - 算法名 "HMAC-SHA256"，Credential 尾缀 "/{region}/{service}/request"；
 * - 时间头 X-Date，值为 "YYYYMMDDTHHMMSSZ"（ISO 去毫秒再去 :- 分隔）；
 * - Canonical Request = METHOD\n路径(固定"/")\n排序编码后的query\n规范头\n\n签名头列表\nbody的sha256hex；
 * - content-type / content-length / user-agent 等不参与签名（SDK 的 unsigned 名单）；
 * - 签名密钥链：Hmac(日期8, secret) → Hmac(region) → Hmac(service) → Hmac("request")。
 */

export const VOD_API_HOST = "https://vod.volcengineapi.com";
export const VOD_REGION = "cn-north-1";
export const VOD_SERVICE = "vod";

/** 不参与签名的请求头（与 tt-uploader 的 $o 名单一致）。 */
const UNSIGNED_HEADERS = new Set([
  "authorization",
  "content-type",
  "content-length",
  "user-agent",
  "presigned-expires",
  "expect",
  "x-amzn-trace-id",
]);

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let value = n;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[n] = value;
  }
  return table;
})();

/** TOS 上传要求的 crc32 校验值：8 位小写十六进制（零填充）。 */
export function crc32Hex(bytes: Uint8Array): string {
  let crc = -1;
  for (let i = 0; i < bytes.length; i += 1) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return ((~crc) >>> 0).toString(16).padStart(8, "0");
}

/** X-Date 取值：ISO 去毫秒再去 ":-"，形如 20261109T123456Z。 */
export function formatVolcXDate(time: Date): string {
  return time.toISOString().replace(/\.\d{3}Z$/, "Z").replace(/[:-]/g, "");
}

/** query 规范化：按 key 排序后 RFC3986 编码拼接。 */
export function canonicalQuery(params: Record<string, string>): string {
  return Object.keys(params)
    .sort()
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join("&");
}

/** 头值规范化：折叠连续空白并去首尾空白（与 SDK canonicalHeaderValues 一致）。 */
function canonicalHeaderValue(value: string): string {
  return value.replace(/\s+/g, " ").replace(/^\s+|\s+$/g, "");
}

/**
 * 生成火山 OpenAPI 的 Authorization 头。
 *
 * @param params 请求 query（已包含全部参数，签名与实际请求必须完全一致）
 * @param headers 请求头（不含 Authorization；X-Date / x-security-token / X-Content-Sha256 需已就位）
 * @param body 请求体文本；无 body 时传 undefined（按空串签名）
 */
export function buildVolcAuthorization({
  method,
  params,
  headers,
  body,
  accessKeyId,
  secretAccessKey,
}: {
  method: "GET" | "POST" | "PUT";
  params: Record<string, string>;
  headers: Record<string, string>;
  body?: string;
  accessKeyId: string;
  secretAccessKey: string;
}): string {
  const xDate = headers["X-Date"];
  const date8 = xDate.slice(0, 8);

  const signableNames = Object.keys(headers)
    .map((name) => name.toLowerCase())
    .filter((name) => !UNSIGNED_HEADERS.has(name))
    .sort();
  const canonicalHeaders = signableNames
    .map((name) => `${name}:${canonicalHeaderValue(headers[name] ?? "")}`)
    .join("\n");
  const signedHeaders = signableNames.join(";");

  const bodyHash = headers["X-Content-Sha256"] ?? SHA256(body ?? "").toString();
  const canonicalRequest = [
    method.toUpperCase(),
    "/",
    canonicalQuery(params),
    `${canonicalHeaders}\n`,
    signedHeaders,
    bodyHash,
  ].join("\n");

  const credential = `${date8}/${VOD_REGION}/${VOD_SERVICE}/request`;
  const stringToSign = [
    "HMAC-SHA256",
    xDate,
    credential,
    SHA256(canonicalRequest).toString(),
  ].join("\n");

  const kDate = HmacSHA256(date8, `${secretAccessKey}`);
  const kRegion = HmacSHA256(VOD_REGION, kDate);
  const kService = HmacSHA256(VOD_SERVICE, kRegion);
  const kSigning = HmacSHA256("request", kService);
  const signature = HmacSHA256(stringToSign, kSigning).toString();

  return `HMAC-SHA256 Credential=${accessKeyId}/${credential}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
}

/** 校验和测试向量：crc32("123456789") = 0xCBF43926（IEEE 802.3 标准）。 */
export const CRC32_TEST_VECTOR = "cbf43926";

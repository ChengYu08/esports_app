import { md5 } from "./md5";
import type { HttpMethod, SsoClientConfig } from "./types";

const randomString = () => String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
const encode = (value: unknown) => encodeURIComponent(String(value)).replace(/[*~!()']/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

export function createSignature(data: Record<string, unknown> | undefined, method: HttpMethod, config: SsoClientConfig, timestamp = Date.now()): Record<string, string> {
  const random = randomString();
  const payload = data ?? {};
  let source = "";
  if (method === "GET") {
    const values: Record<string, unknown> = { ...payload, PZTimestamp: timestamp, Random: random };
    for (const key of Object.keys(values).sort()) {
      const value = values[key];
      if (value === null || value === undefined || typeof value === "object") continue;
      source += `${key}=${encode(value)}&`;
    }
    source += "accessKey=3qXyB7uf";
  } else {
    source = `PZTimestamp=${timestamp}&Random=${random}&2147483647=${encode(JSON.stringify(payload))}&accessKey=3qXyB7uf`;
  }
  return {
    "Content-Type": "application/json",
    PZVersion: config.appVersion ?? "1.0.0",
    PZPlatform: config.clientAppId,
    PZOs: config.os ?? "Unknown",
    PZTimestamp: String(timestamp),
    Random: random,
    Skey: "CLIENT",
    sign: md5(source),
  };
}

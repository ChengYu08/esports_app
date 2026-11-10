import { SHA256 } from "crypto-js";
import { File } from "expo-file-system";

import type { VodUploadSign } from "@/features/circle/circle-publish.api";
import {
  buildVolcAuthorization,
  canonicalQuery,
  crc32Hex,
  formatVolcXDate,
  VOD_API_HOST,
} from "@/features/circle/vod-sign";

/**
 * 火山 VOD 视频直传（RN 移植 tt-uploader Vid 模式协议）。
 *
 * 链路：ApplyUploadInfo(火山 OpenAPI) → TOS 直传(<10MB) / 分片(≥10MB，5MB/片) → CommitUploadInfo → vid。
 * TOS 侧鉴权用 Apply 返回的 Auth 头 + content-crc32；OpenAPI 侧用后端 STS 凭证做火山 V4 签名。
 */

/** 小于 2×分片大小走直传（与 tt-uploader 判定一致）。 */
const DIRECT_UPLOAD_THRESHOLD = 10 * 1024 * 1024;
const PART_SIZE = 5 * 1024 * 1024;

type VodAddress = {
  /** TOS 请求的 authorization 头（Apply 下发的临时签名）。 */
  auth: string;
  /** 对象存储 StoreUri。 */
  oid: string;
  /** 形如 https://{UploadHost}。 */
  host: string;
  sessionKey: string;
  uploadHeader: Record<string, string>;
};

function resolveSignTime(sign: VodUploadSign): Date {
  const parsed = Date.parse(sign.currentTime);
  return Number.isFinite(parsed) ? new Date(parsed) : new Date();
}

/** 火山 OpenAPI 请求头（含 V4 签名）；body 存在时补 JSON 头与内容摘要。 */
function volcApiHeaders({
  sign,
  params,
  method,
  body,
}: {
  sign: VodUploadSign;
  params: Record<string, string>;
  method: "GET" | "POST";
  body?: string;
}): Record<string, string> {
  const headers: Record<string, string> = {
    "X-Date": formatVolcXDate(resolveSignTime(sign)),
    "x-security-token": sign.sessionToken,
  };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    headers["X-Content-Sha256"] = SHA256(body).toString();
  }
  headers.Authorization = buildVolcAuthorization({
    method,
    params,
    headers,
    body,
    accessKeyId: sign.accessKeyId,
    secretAccessKey: sign.secretAccessKey,
  });
  return headers;
}

/** UploadHeader 兼容对象与 [{Key, Value}] 两种形状（火山版本差异）。 */
function normalizeUploadHeader(header: unknown): Record<string, string> {
  if (Array.isArray(header)) {
    return Object.fromEntries(
      header
        .filter((item): item is { Key: string; Value: string } => Boolean(item?.Key))
        .map((item) => [item.Key, String(item.Value)]),
    );
  }
  if (header && typeof header === "object") {
    return Object.fromEntries(
      Object.entries(header).map(([key, value]) => [key, String(value)]),
    );
  }
  return {};
}

async function parseVolcResponse<T>(response: Response, fallback: string): Promise<T> {
  const payload = await response.json().catch(() => null);
  const meta = payload?.ResponseMetadata;
  if (!response.ok || meta?.Error) {
    throw new Error(meta?.Error?.Message || fallback);
  }
  return (payload?.Result ?? {}) as T;
}

type ApplyResult = {
  CandidateUploadAddresses?: {
    MainUploadAddresses?: {
      StoreInfos?: { Auth?: string; StoreUri?: string }[];
      UploadHosts?: string[];
      SessionKey?: string;
      UploadHeader?: unknown;
    }[];
  };
  UploadAddress?: {
    StoreInfos?: { Auth?: string; StoreUri?: string }[];
    UploadHosts?: string[];
    SessionKey?: string;
    UploadHeader?: unknown;
  };
};

async function applyUploadInfo({
  sign,
  fileSize,
  filename,
}: {
  sign: VodUploadSign;
  fileSize: number;
  filename: string;
}): Promise<VodAddress> {
  const params: Record<string, string> = {
    Action: "ApplyUploadInfo",
    Version: "2022-01-01",
    SpaceName: sign.spaceName,
    FileSize: String(fileSize),
    FileType: "video",
    NeedFallback: "true",
    FileName: filename,
  };
  const response = await fetch(`${VOD_API_HOST}/?${canonicalQuery(params)}`, {
    method: "GET",
    headers: volcApiHeaders({ sign, params, method: "GET" }),
  });
  const result = await parseVolcResponse<ApplyResult>(response, "获取上传地址失败");
  const address =
    result.CandidateUploadAddresses?.MainUploadAddresses?.[0] ?? result.UploadAddress;
  const store = address?.StoreInfos?.[0];
  if (!address || !store?.Auth || !store?.StoreUri || !address.UploadHosts?.length) {
    throw new Error("获取上传地址失败");
  }
  return {
    auth: store.Auth,
    oid: store.StoreUri,
    host: `https://${address.UploadHosts[0]}`,
    sessionKey: address.SessionKey ?? "",
    uploadHeader: normalizeUploadHeader(address.UploadHeader),
  };
}

async function commitUploadInfo({
  sign,
  address,
}: {
  sign: VodUploadSign;
  address: VodAddress;
}): Promise<string> {
  const body: Record<string, unknown> = { SessionKey: address.sessionKey };
  if (sign.handlerTemplateId) {
    body.Functions = [
      { Name: "StartWorkflow", Input: { TemplateId: sign.handlerTemplateId } },
    ];
  }
  const bodyText = JSON.stringify(body);
  const params: Record<string, string> = {
    Action: "CommitUploadInfo",
    Version: "2022-01-01",
    SpaceName: sign.spaceName,
  };
  const response = await fetch(`${VOD_API_HOST}/?${canonicalQuery(params)}`, {
    method: "POST",
    headers: volcApiHeaders({ sign, params, method: "POST", body: bodyText }),
    body: bodyText,
  });
  const result = await parseVolcResponse<{ Vid?: string }>(response, "视频提交失败");
  if (!result.Vid) {
    throw new Error("视频提交失败");
  }
  return result.Vid;
}

/** TOS 请求走 XHR：需要上传进度与二进制 body（Uint8Array/{uri}/文本）。 */
function tosRequest({
  method,
  url,
  headers,
  body,
  onProgress,
}: {
  method: "PUT" | "POST";
  url: string;
  headers: Record<string, string>;
  body: Uint8Array | { uri: string } | string;
  onProgress?: (loaded: number) => void;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    for (const [name, value] of Object.entries(headers)) {
      xhr.setRequestHeader(name, value);
    }
    if (onProgress) {
      xhr.upload.onprogress = (event) => {
        onProgress(event.loaded);
      };
    }
    xhr.onerror = () => reject(new Error("网络错误，上传失败"));
    xhr.ontimeout = () => reject(new Error("上传超时，请重试"));
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(`上传失败(${xhr.status})`));
        return;
      }
      // TOS 成功响应为 {success:0}；个别端点可能空 body，2xx 即视为成功。
      try {
        const payload = JSON.parse(xhr.responseText || "{}");
        if (payload.success !== undefined && payload.success !== 0) {
          reject(new Error(payload.error?.message || "上传失败"));
          return;
        }
      } catch {
        // 空/非 JSON body 忽略
      }
      resolve();
    };
    xhr.send(body);
  });
}

async function directUpload({
  address,
  uri,
  fileSize,
  onProgress,
}: {
  address: VodAddress;
  uri: string;
  fileSize: number;
  onProgress?: (percent: number) => void;
}): Promise<void> {
  const bytes = await new File(uri).bytes();
  await tosRequest({
    method: "PUT",
    url: `${address.host}/${address.oid}`,
    headers: {
      authorization: address.auth,
      "content-crc32": crc32Hex(bytes),
      "Content-Type": "application/octet-stream",
      ...address.uploadHeader,
    },
    body: { uri },
    onProgress: (loaded) => {
      onProgress?.(Math.min(99, Math.floor((loaded / fileSize) * 100)));
    },
  });
}

/** 顺序读文件并按 partSize 切片，避免整文件进内存。 */
async function* readSlices(file: File, partSize: number): AsyncGenerator<Uint8Array> {
  const reader = file.readableStream().getReader();
  let buffer = new Uint8Array(partSize);
  let filled = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    let position = 0;
    while (position < value.length) {
      const take = Math.min(partSize - filled, value.length - position);
      buffer.set(value.subarray(position, position + take), filled);
      filled += take;
      position += take;
      if (filled === partSize) {
        yield buffer;
        buffer = new Uint8Array(partSize);
        filled = 0;
      }
    }
  }
  if (filled > 0) {
    yield buffer.subarray(0, filled);
  }
}

async function multipartUpload({
  address,
  uri,
  fileSize,
  onProgress,
  cancelled,
}: {
  address: VodAddress;
  uri: string;
  fileSize: number;
  onProgress?: (percent: number) => void;
  cancelled?: () => boolean;
}): Promise<void> {
  const init = await tosRequestText({
    method: "POST",
    url: `${address.host}/${address.oid}?uploads`,
    headers: { authorization: address.auth, ...address.uploadHeader },
  });
  const uploadId = init?.payload?.uploadID;
  if (typeof uploadId !== "string" || !uploadId) {
    throw new Error("初始化分片上传失败");
  }

  const file = new File(uri);
  const partCrcs: string[] = [];
  let uploadedBytes = 0;
  for await (const slice of readSlices(file, PART_SIZE)) {
    if (cancelled?.()) {
      throw new Error("已取消上传");
    }
    const crc = crc32Hex(slice);
    await tosRequest({
      method: "PUT",
      url: `${address.host}/${address.oid}?partNumber=${partCrcs.length + 1}&uploadID=${encodeURIComponent(uploadId)}`,
      headers: {
        authorization: address.auth,
        "content-crc32": crc,
        "Content-Type": "application/octet-stream",
        ...address.uploadHeader,
      },
      body: slice,
      onProgress: (loaded) => {
        onProgress?.(
          Math.min(99, Math.floor(((uploadedBytes + loaded) / fileSize) * 100)),
        );
      },
    });
    partCrcs.push(crc);
    uploadedBytes += slice.byteLength;
  }
  if (partCrcs.length === 0) {
    throw new Error("视频文件为空");
  }

  // 分片合并：body 形如 "1:crc,2:crc"（TOS 约定，无 Content-Type）。
  await tosRequest({
    method: "POST",
    url: `${address.host}/${address.oid}?uploadID=${encodeURIComponent(uploadId)}`,
    headers: { authorization: address.auth, ...address.uploadHeader },
    body: partCrcs.map((crc, index) => `${index + 1}:${crc}`).join(","),
  });
}

/** TOS JSON 响应请求（初始化分片返回 {success:0, payload:{uploadID}}）。 */
function tosRequestText({
  method,
  url,
  headers,
}: {
  method: "PUT" | "POST";
  url: string;
  headers: Record<string, string>;
}): Promise<{ payload?: { uploadID?: string } } | null> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    for (const [name, value] of Object.entries(headers)) {
      xhr.setRequestHeader(name, value);
    }
    xhr.onerror = () => reject(new Error("网络错误，上传失败"));
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(`上传失败(${xhr.status})`));
        return;
      }
      try {
        const payload = JSON.parse(xhr.responseText || "{}");
        if (payload.success !== undefined && payload.success !== 0) {
          reject(new Error(payload.error?.message || "上传失败"));
          return;
        }
        resolve(payload);
      } catch {
        resolve(null);
      }
    };
    xhr.send();
  });
}

/**
 * 视频直传火山 VOD，返回火山媒资 vid。
 *
 * @param cancelled 分片之间的取消检查；直传阶段不可中断（≤10MB）。
 */
export async function uploadVideoToVod({
  uri,
  fileSize,
  filename,
  sign,
  onProgress,
  cancelled,
}: {
  uri: string;
  fileSize: number;
  filename: string;
  sign: VodUploadSign;
  onProgress?: (percent: number) => void;
  cancelled?: () => boolean;
}): Promise<string> {
  const address = await applyUploadInfo({ sign, fileSize, filename });
  if (fileSize < DIRECT_UPLOAD_THRESHOLD) {
    await directUpload({ address, uri, fileSize, onProgress });
  } else {
    await multipartUpload({ address, uri, fileSize, onProgress, cancelled });
  }
  const vid = await commitUploadInfo({ sign, address });
  onProgress?.(100);
  return vid;
}

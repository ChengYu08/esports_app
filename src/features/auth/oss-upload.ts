import CryptoJS from "crypto-js";
import { File } from "expo-file-system";

import type { ClientOssSts } from "./client-auth.api";

type UploadInput = {
  uri: string;
  mimeType?: string | null;
};

function normalizeEndpoint(endpoint: string) {
  const value = endpoint.trim().replace(/\/$/, "");
  if (/^https?:\/\//i.test(value)) return value.replace(/^http:\/\//i, "https://");
  return `https://${value}`;
}

export async function uploadClientObject(sts: ClientOssSts, objectKey: string, input: UploadInput) {
  const endpoint = normalizeEndpoint(sts.endpoint);
  const endpointUrl = new URL(endpoint);
  const uploadHost = endpointUrl.hostname.startsWith(`${sts.bucketName}.`)
    ? endpointUrl.hostname
    : `${sts.bucketName}.${endpointUrl.hostname}`;
  const uploadUrl = `https://${uploadHost}/${objectKey.split("/").map(encodeURIComponent).join("/")}`;
  const contentType = input.mimeType || "image/jpeg";
  const date = new Date().toUTCString();
  const securityTokenHeader = "x-oss-security-token";
  const overwriteHeader = "x-oss-forbid-overwrite";
  const headers = {
    "Content-Type": contentType,
    Date: date,
    [securityTokenHeader]: sts.securityToken,
    [overwriteHeader]: "true",
  };
  const canonicalizedHeaders = `${overwriteHeader}:true\n${securityTokenHeader}:${sts.securityToken}\n`;
  const canonicalizedResource = `/${sts.bucketName}/${objectKey}`;
  const stringToSign = `PUT\n\n${contentType}\n${date}\n${canonicalizedHeaders}${canonicalizedResource}`;
  const signature = CryptoJS.HmacSHA1(stringToSign, sts.accessKeySecret).toString(CryptoJS.enc.Base64);

  const localFile = new File(input.uri);
  if (!localFile.exists) throw new Error("读取图片失败：本地图片文件不存在");
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: { ...headers, Authorization: `OSS ${sts.accessKeyId}:${signature}` },
    body: localFile,
  });
  if (!response.ok) {
    const detail = (await response.text()).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    throw new Error(`OSS 上传失败（${response.status}${detail ? `：${detail.slice(0, 160)}` : ""}）`);
  }
  return `${sts.domain.replace(/\/$/, "")}/${objectKey}`;
}

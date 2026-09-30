import CryptoJS from "crypto-js";

import type { ClientOssSts } from "./client-auth.api";

type UploadInput = {
  uri: string;
  mimeType?: string | null;
};

function normalizeEndpoint(endpoint: string) {
  return endpoint.replace(/\/$/, "").replace(/^http:\/\//, "https://");
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
  const canonicalizedHeaders = `${securityTokenHeader}:${sts.securityToken}\n${overwriteHeader}:true\n`;
  const canonicalizedResource = `/${sts.bucketName}/${objectKey}`;
  const stringToSign = `PUT\n\n${contentType}\n${date}\n${canonicalizedHeaders}${canonicalizedResource}`;
  const signature = CryptoJS.HmacSHA1(stringToSign, sts.accessKeySecret).toString(CryptoJS.enc.Base64);

  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      ...headers,
      Authorization: `OSS ${sts.accessKeyId}:${signature}`,
    },
    body: await (await fetch(input.uri)).blob(),
  });
  if (!response.ok) throw new Error(`OSS 上传失败（${response.status}）`);
  return `${sts.domain.replace(/\/$/, "")}/${objectKey}`;
}

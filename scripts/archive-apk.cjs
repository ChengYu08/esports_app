const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { pipeline } = require("node:stream/promises");

async function md5(file) {
  const hash = createHash("md5");
  await pipeline(fs.createReadStream(file), hash);
  return hash.digest("hex");
}

/** 北京时间 YYYYMMDDHHmm（不依赖容器/本机 TZ） */
function beijingTimestamp(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value ?? "";
  // en-GB 偶发把 00 点格式成 24，归一成 00
  const hour = get("hour") === "24" ? "00" : get("hour");
  return `${get("year")}${get("month")}${get("day")}${hour}${get("minute")}`;
}

async function archive() {
  const root = path.resolve(__dirname, "..");
  const { expo } = JSON.parse(
    fs.readFileSync(path.join(root, "app.json"), "utf8"),
  );
  const output = path.join(root, "android/app/build/outputs/apk/release");
  const metadata = JSON.parse(
    fs.readFileSync(path.join(output, "output-metadata.json"), "utf8"),
  );
  const apk = metadata.elements?.[0];
  if (
    metadata.elements?.length !== 1 ||
    !apk?.outputFile ||
    apk.versionName !== expo.version
  ) {
    throw new Error(
      "Expected one release APK matching app.json version. Rebuild before archiving.",
    );
  }
  const source = path.join(output, path.basename(apk.outputFile));
  const checksum = await md5(source);
  const safe = (text) => String(text).replace(/[<>:"/\\|?*\x00-\x1f]/g, "_");
  // 固定东八区（Asia/Shanghai）：Drone 容器默认 UTC，避免文件名时间戳慢 8 小时
  const timestamp = beijingTimestamp();
  const abiLabel = safe(process.env.APK_ABI_LABEL || "arm64");
  const envLabel = safe(process.env.APK_ENV_LABEL || "prod");
  const name = `${safe(expo.name)}-${safe(apk.versionName)}-${abiLabel}-${envLabel}-${timestamp}`;
  const directory = path.join(root, "apks");
  fs.mkdirSync(directory, { recursive: true });
  const target = path.join(directory, `${name}.apk`);
  const temporary = `${target}.${process.pid}.tmp`;
  try {
    fs.copyFileSync(source, temporary);
    if ((await md5(temporary)) !== checksum)
      throw new Error("APK copy MD5 mismatch.");
    fs.renameSync(temporary, target);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
  const mapping = path.join(
    root,
    "android/app/build/outputs/mapping/release/mapping.txt",
  );
  if (fs.existsSync(mapping))
    fs.copyFileSync(mapping, path.join(directory, `${name}.mapping.txt`));
  console.log(
    `APK: ${target}\nMD5: ${checksum}\nSize: ${(fs.statSync(target).size / 1048576).toFixed(1)} MiB`,
  );
}

archive().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

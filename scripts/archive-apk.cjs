const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { pipeline } = require("node:stream/promises");

async function md5(file) {
  const hash = createHash("md5");
  await pipeline(fs.createReadStream(file), hash);
  return hash.digest("hex");
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
  // 本地时间：年月日时分，例如 202610201430
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const timestamp = [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    pad(now.getHours()),
    pad(now.getMinutes()),
  ].join("");
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

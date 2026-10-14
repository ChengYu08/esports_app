#!/usr/bin/env node
/**
 * SSO 登录验证码获取脚本
 * 用途：发送短信验证码并从 Redis 中获取验证码
 */
const crypto = require("crypto");
const https = require("https");
const Redis = require("redis");

// API 配置
const API = "https://api.jinliwangluo.com";
const CLIENT_ID = "dianjing-android";
const CLIENT_SECRET = "NgMI47zZU0dJyGQvzygjU1eVE06PalWa";
const ACCESS_KEY = "3qXyB7uf";
const VERSION = "0.1.0";

// Redis 配置（测试环境 - 公网域名）
const REDIS_HOST = "r-2vcmhog2137t6qszmipd.redis.cn-chengdu.rds.aliyuncs.com";
const REDIS_PORT = 6379;
const REDIS_PASSWORD = "NXfegIHBA5ME";
const REDIS_DB = 0;

/**
 * URL 编码（保留特殊字符）
 */
function customEncode(s) {
  return encodeURIComponent(s).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

/**
 * 紧凑 JSON（无空格）
 */
function compactJson(data) {
  return JSON.stringify(data);
}

/**
 * 计算签名
 */
function calculateSign(body, timestamp, random) {
  const signStr = `PZTimestamp=${timestamp}&Random=${random}&2147483647=${customEncode(body)}&accessKey=${ACCESS_KEY}`;
  return crypto.createHash("md5").update(signStr).digest("hex");
}

/**
 * 获取服务器时间戳
 */
async function getServerTimestamp() {
  return new Promise((resolve) => {
    https
      .get(`${API}/api/server/time`, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const json = JSON.parse(data);
            if (typeof json.data === "number" && json.data > 0) {
              resolve(Math.floor(json.data));
            } else {
              resolve(Date.now());
            }
          } catch {
            resolve(Date.now());
          }
        });
      })
      .on("error", () => resolve(Date.now()));
  });
}

/**
 * 构建请求头
 */
async function buildHeaders(body) {
  const timestamp = await getServerTimestamp();
  const random = String(Date.now()).slice(-6);
  const deviceId = crypto.randomUUID();

  return {
    "Content-Type": "application/json",
    PZVersion: VERSION,
    PZPlatform: CLIENT_ID,
    PZOs: "Unknown",
    PZTimestamp: String(timestamp),
    Random: random,
    Skey: "CLIENT",
    deviceId: deviceId,
    sign: calculateSign(body, timestamp, random),
  };
}

/**
 * 获取 Basic Auth
 */
function getBasicAuth() {
  const credentials = `${CLIENT_ID}:${CLIENT_SECRET}`;
  const encoded = Buffer.from(credentials).toString("base64");
  return `basic ${encoded}`;
}

/**
 * 发送 POST 请求
 */
async function apiPost(path, data, useAuth = false) {
  const body = compactJson(data);
  const headers = await buildHeaders(body);

  if (useAuth) {
    headers["AUTHORIZATION"] = getBasicAuth();
  }

  return new Promise((resolve, reject) => {
    const url = new URL(API + path);
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method: "POST",
      headers: {
        ...headers,
        "Content-Length": Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let responseData = "";
      res.on("data", (chunk) => (responseData += chunk));
      res.on("end", () =>
        resolve({ statusCode: res.statusCode, body: responseData }),
      );
    });

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

/**
 * 发送短信验证码
 */
async function sendSms(phone, template = "LOGIN") {
  console.log(`正在向 ${phone} 发送验证码...`);

  const response = await apiPost("/api/auth/public/common/sms", {
    phone,
    smsTemplate: template,
  });

  console.log(`发送状态: ${response.statusCode}`);
  if (response.statusCode !== 200) {
    console.log(`响应内容: ${response.body.slice(0, 200)}`);
    return false;
  }

  return true;
}

/**
 * 从 Redis 获取验证码
 */
async function getCodeFromRedis(phone) {
  const client = Redis.createClient({
    socket: {
      host: REDIS_HOST,
      port: REDIS_PORT,
    },
    password: REDIS_PASSWORD,
  });

  try {
    await client.connect();

    const key = `test:smsCode:COMMON:LOGIN:${phone}`;
    const value = await client.get(key);

    await client.disconnect();

    if (value) {
      return value.replace(/^"|"$/g, "");
    }

    return null;
  } catch (e) {
    console.log(`Redis 连接失败: ${e.message}`);
    return null;
  }
}

/**
 * 主函数
 */
async function main() {
  const phone = "16615550002";

  console.log("尝试从 Redis 获取现有验证码...");
  let code = await getCodeFromRedis(phone);

  if (code) {
    console.log(`✓ 找到现有验证码: ${code}`);
    return code;
  }

  console.log("未找到现有验证码，发送新验证码...");
  if (await sendSms(phone)) {
    await new Promise((resolve) => setTimeout(resolve, 1000));

    code = await getCodeFromRedis(phone);
    if (code) {
      console.log(`✓ 验证码: ${code}`);
      return code;
    } else {
      console.log("✗ 未能从 Redis 获取验证码");
      return null;
    }
  } else {
    console.log("✗ 短信发送失败");
    return null;
  }
}

if (require.main === module) {
  main()
    .then((code) => {
      if (code) {
        console.log(`\n验证码: ${code}`);
        process.exit(0);
      } else {
        console.log("\n获取验证码失败");
        process.exit(1);
      }
    })
    .catch((err) => {
      console.error("执行错误:", err);
      process.exit(1);
    });
}

module.exports = { main, getCodeFromRedis, sendSms };

#!/usr/bin/env node
/**
 * Load EXPO_PUBLIC_* from the env file of the chosen environment, then run the
 * given command. Shell variables already set win, matching @expo/env precedence.
 * Usage: node scripts/with-env.cjs <test|prod> <command...>
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const isWin = process.platform === 'win32';

const FILES = {
  test: '.env.development',
  prod: '.env.production',
};

const NODE_ENV_BY_KEY = {
  test: 'development',
  prod: 'production',
};

const [envKey, ...command] = process.argv.slice(2);
const file = FILES[envKey];
if (!file || command.length === 0) {
  console.error('Usage: node scripts/with-env.cjs <test|prod> <command...>');
  process.exit(1);
}

const fullPath = path.join(root, file);
if (!fs.existsSync(fullPath)) {
  console.error(`Missing ${file}. Create it from .env.example.`);
  process.exit(1);
}

// dev 模式下 babel-preset-expo 会把 `process.env.EXPO_PUBLIC_*` 改写为
// `require('expo/virtual/env').env.EXPO_PUBLIC_*`，而这个虚拟模块硬编码按
// .env → .env.development → .env.local → .env.development.local 的顺序合并
// （后面的覆盖前面的，见 @expo/metro-config/build/transform-worker/transform-worker.js）。
// 所以 prod 运行时必须让 .env.development.local 覆盖 .env.development 里的
// yingbowl 值；test 运行时把它删掉，让 .env.development 生效。
// .env.development.local 已加入 .gitignore，不会污染版本控制。
const devLocalPath = path.join(root, '.env.development.local');
if (envKey === 'prod') {
  fs.copyFileSync(fullPath, devLocalPath);
} else if (fs.existsSync(devLocalPath)) {
  fs.unlinkSync(devLocalPath);
}

const env = { ...process.env };
// 与 @expo/env 的 .env.${NODE_ENV} 选择对齐，避免 expo CLI 在 prod 时
// 继续按 NODE_ENV=development 加载 .env.development。
env.NODE_ENV = NODE_ENV_BY_KEY[envKey];

// 清掉 shell 里可能从上次运行继承下来的 EXPO_PUBLIC_*，避免旧值把所选 env 文件
// 的值挡回去（@expo/env 的规则是 “shell 已设置的 key 不覆盖”）。
for (const key of Object.keys(env)) {
  if (key.startsWith('EXPO_PUBLIC_')) {
    delete env[key];
  }
}

// 以所选 env 文件为最高优先级：无条件覆盖（包括 shell 中已有的值）。
const injectedKeys = [];
for (const line of fs.readFileSync(fullPath, 'utf8').split(/\r?\n/)) {
  if (line.trimStart().startsWith('#')) continue;
  const match = line.match(/^\s*(EXPO_PUBLIC_[A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (!match) continue;
  const [, key, value] = match;
  if (env[key] !== value) {
    env[key] = value;
    injectedKeys.push(key);
  }
}

// 声明 dotenv 已加载，阻止 @expo/env loadEnvFiles 二次加载 .env.development
// 盖掉这里的值。注意：哨兵名必须是 __EXPO_ENV_LOADED，且值必须是 JSON 数组，
// @expo/env 会 JSON.parse 它；子进程继承到非 JSON 值会抛错。
env.__EXPO_ENV_LOADED = '[]';

console.log(`[${envKey}] ${file} (${injectedKeys.length} vars) > ${command.join(' ')}`);

const child = spawn(command[0], command.slice(1), {
  cwd: root,
  env,
  stdio: 'inherit',
  shell: isWin,
});
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});

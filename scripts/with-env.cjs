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

const env = { ...process.env };
let count = 0;
for (const line of fs.readFileSync(fullPath, 'utf8').split(/\r?\n/)) {
  if (line.trimStart().startsWith('#')) continue;
  const match = line.match(/^\s*(EXPO_PUBLIC_[A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (!match) continue;
  const [, key, value] = match;
  if (env[key] === undefined) {
    env[key] = value;
    count += 1;
  }
}

console.log(`[${envKey}] ${file} (${count} vars) > ${command.join(' ')}`);

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

#!/usr/bin/env node
/**
 * Cross-platform Android release APK build (Node equivalent of build_apk.sh).
 * Usage: node scripts/build_apk.cjs [--init-signing] [--abi arm64|universal|all]
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const isWin = process.platform === 'win32';

const ABI_PRESETS = {
  arm64: { architectures: 'arm64-v8a', label: 'arm64' },
  universal: { architectures: 'armeabi-v7a,arm64-v8a', label: 'universal' },
};

function usage() {
  console.error('Usage: node scripts/build_apk.cjs [--init-signing] [--abi arm64|universal|all]');
}

function parseArgs(argv) {
  let initSigning = false;
  let abi = null;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--init-signing') {
      initSigning = true;
      continue;
    }
    if (arg === '--abi') {
      const value = argv[i + 1];
      if (!value || value.startsWith('-')) {
        usage();
        process.exit(1);
      }
      abi = value;
      i += 1;
      continue;
    }
    usage();
    process.exit(1);
  }
  return { initSigning, abi };
}

function resolveTargets(abiFlag) {
  if (abiFlag === 'all') {
    return [ABI_PRESETS.arm64, ABI_PRESETS.universal];
  }
  if (abiFlag === 'arm64' || abiFlag === 'universal') {
    return [ABI_PRESETS[abiFlag]];
  }
  if (abiFlag != null) {
    usage();
    process.exit(1);
  }
  if (process.env.REACT_NATIVE_ARCHITECTURES) {
    const architectures = process.env.REACT_NATIVE_ARCHITECTURES;
    const label =
      architectures === ABI_PRESETS.universal.architectures
        ? 'universal'
        : architectures === ABI_PRESETS.arm64.architectures
          ? 'arm64'
          : 'custom';
    return [{ architectures, label }];
  }
  return [ABI_PRESETS.arm64];
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? root,
    env: { ...process.env, ...options.env },
    stdio: 'inherit',
    shell: options.shell ?? false,
  });
  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function sleepSync(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    /* spin */
  }
}

function findJps() {
  const candidates = [];
  if (process.env.JAVA_HOME) {
    candidates.push(path.join(process.env.JAVA_HOME, 'bin', isWin ? 'jps.exe' : 'jps'));
  }
  candidates.push(isWin ? 'jps.exe' : 'jps');
  for (const candidate of candidates) {
    if (candidate.includes(path.sep) && !fs.existsSync(candidate)) continue;
    const probe = spawnSync(candidate, ['-l'], { encoding: 'utf8', shell: isWin && !candidate.includes(path.sep) });
    if (!probe.error && probe.status === 0) return candidate;
  }
  return null;
}

/** Kill leftover Gradle/Kotlin daemons (gradlew may already be gone after a partial clean). */
function stopGradleDaemons() {
  console.log('Stopping Gradle daemons...');
  const androidDir = path.join(root, 'android');
  const gradlew = path.join(androidDir, isWin ? 'gradlew.bat' : 'gradlew');
  if (fs.existsSync(gradlew)) {
    spawnSync(isWin ? 'gradlew.bat' : './gradlew', ['--stop'], {
      cwd: androidDir,
      stdio: 'inherit',
      shell: isWin,
    });
  }
  spawnSync(isWin ? 'gradle.bat' : 'gradle', ['--stop'], {
    stdio: 'ignore',
    shell: isWin,
  });

  const jps = findJps();
  if (!jps) return;
  const listed = spawnSync(jps, ['-l'], { encoding: 'utf8', shell: isWin && !jps.includes(path.sep) });
  if (listed.error || listed.status !== 0) return;
  const pids = new Set();
  for (const line of listed.stdout.split(/\r?\n/)) {
    const match = line.match(/^\s*(\d+)\s+(\S+)/);
    if (!match) continue;
    const name = match[2];
    if (name.includes('GradleDaemon') || name.includes('KotlinCompileDaemon')) {
      pids.add(match[1]);
    }
  }
  for (const pid of pids) {
    if (isWin) {
      spawnSync('taskkill', ['/F', '/PID', pid], { stdio: 'ignore', shell: true });
    } else {
      try {
        process.kill(Number(pid), 'SIGTERM');
      } catch {
        /* already exited */
      }
    }
  }
  if (pids.size > 0) sleepSync(1500);
}

/** Remove android/ ourselves with retries before expo --clean (avoids Windows EBUSY). */
function removeAndroidDirectory() {
  const androidDir = path.join(root, 'android');
  if (!fs.existsSync(androidDir)) return;
  console.log('Removing android/ before prebuild...');
  stopGradleDaemons();
  try {
    fs.rmSync(androidDir, { recursive: true, force: true, maxRetries: 15, retryDelay: 400 });
  } catch (error) {
    console.error(
      `Failed to remove android/: ${error.message}\n` +
        'Close Android Studio / Cursor Java indexing of this folder, then retry.',
    );
    process.exit(1);
  }
}

/**
 * bash 用 -Dorg.gradle.jvmargs="..." 传参；Windows cmd 会按空格拆开。
 * 改为写入 gradle.properties，效果等价且跨平台。
 */
function ensureGradleJvmArgs() {
  const file = path.join(root, 'android', 'gradle.properties');
  const desired = 'org.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=1024m';
  let text = fs.readFileSync(file, 'utf8');
  if (/^org\.gradle\.jvmargs=/m.test(text)) {
    text = text.replace(/^org\.gradle\.jvmargs=.*$/m, desired);
  } else {
    text += `\n${desired}\n`;
  }
  fs.writeFileSync(file, text);
}

function assembleAndArchive(target, buildEnv) {
  const gradlew = isWin ? 'gradlew.bat' : './gradlew';
  console.log(`Building APK (${target.label}: ${target.architectures})...`);
  run(
    gradlew,
    [
      ':app:assembleRelease',
      '--max-workers=4',
      '-Pkotlin.compiler.execution.strategy=in-process',
      '-Pkotlin.incremental=false',
      `-PreactNativeArchitectures=${target.architectures}`,
      '-Pandroid.enableMinifyInReleaseBuilds=true',
      '-Pandroid.enableShrinkResourcesInReleaseBuilds=true',
    ],
    {
      cwd: path.join(root, 'android'),
      env: buildEnv,
      shell: isWin,
    },
  );
  run(process.execPath, [path.join('scripts', 'archive-apk.cjs')], {
    env: { ...buildEnv, APK_ABI_LABEL: target.label },
  });
}

const { initSigning, abi } = parseArgs(process.argv.slice(2));
process.chdir(root);

run(process.execPath, [path.join('scripts', 'android-signing.cjs')]);
if (initSigning) {
  process.exit(0);
}

const targets = resolveTargets(abi);
const buildEnv = { NODE_ENV: 'production' };
const useBun =
  fs.existsSync(path.join(root, 'bun.lock')) || fs.existsSync(path.join(root, 'bun.lockb'));

removeAndroidDirectory();

if (useBun) {
  run('bunx', ['expo', 'prebuild', '--platform', 'android', '--clean', '--no-install'], {
    env: buildEnv,
    shell: isWin,
  });
} else {
  run('npx', ['--no-install', 'expo', 'prebuild', '--platform', 'android', '--clean', '--no-install'], {
    env: buildEnv,
    shell: isWin,
  });
}

ensureGradleJvmArgs();

for (const target of targets) {
  assembleAndArchive(target, buildEnv);
}

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

function fixture(t, script) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'apk-build-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'scripts'));
  fs.copyFileSync(path.join(__dirname, script), path.join(root, 'scripts', script));
  const run = () => spawnSync(process.execPath, [path.join(root, 'scripts', script)], {
    cwd: os.tmpdir(), encoding: 'utf8',
  });
  return { root, run };
}

test('archive uses root config, abi label, local YYYYMMDDHHmm name; overwrites same minute; rejects stale version', (t) => {
  const { root, run } = fixture(t, 'archive-apk.cjs');
  const output = path.join(root, 'android/app/build/outputs/apk/release');
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(root, 'app.json'), JSON.stringify({ expo: { name: '盼之电竞', version: '1.2.3' } }));
  const metadata = path.join(output, 'output-metadata.json');
  fs.writeFileSync(metadata, JSON.stringify({ elements: [{ versionName: '1.2.3', outputFile: 'app-release.apk' }] }));
  const namePattern = /^盼之电竞-1\.2\.3-arm64-\d{12}\.apk$/;
  const first = Buffer.from('first artifact');
  fs.writeFileSync(path.join(output, 'app-release.apk'), first);
  assert.equal(run().status, 0);
  let apks = fs.readdirSync(path.join(root, 'apks')).filter((f) => f.endsWith('.apk'));
  assert.equal(apks.length, 1);
  assert.match(apks[0], namePattern);
  assert.deepEqual(fs.readFileSync(path.join(root, 'apks', apks[0])), first);

  const runUniversal = () => spawnSync(process.execPath, [path.join(root, 'scripts', 'archive-apk.cjs')], {
    cwd: os.tmpdir(), encoding: 'utf8', env: { ...process.env, APK_ABI_LABEL: 'universal' },
  });
  const universalBytes = Buffer.from('universal artifact');
  fs.writeFileSync(path.join(output, 'app-release.apk'), universalBytes);
  assert.equal(runUniversal().status, 0);
  apks = fs.readdirSync(path.join(root, 'apks')).filter((f) => f.endsWith('.apk')).sort();
  assert.equal(apks.length, 2, 'different abi labels keep both apks');
  assert.match(apks.find((f) => f.includes('-universal-')), /^盼之电竞-1\.2\.3-universal-\d{12}\.apk$/);

  const second = Buffer.from('second artifact');
  fs.writeFileSync(path.join(output, 'app-release.apk'), second);
  assert.equal(run().status, 0);
  apks = fs.readdirSync(path.join(root, 'apks')).filter((f) => f.endsWith('.apk'));
  assert.equal(apks.length, 2, 'same minute same abi rebuild overwrites arm64 only');
  assert.deepEqual(fs.readFileSync(path.join(root, 'apks', apks.find((f) => f.includes('-arm64-')))), second);
  fs.writeFileSync(metadata, JSON.stringify({ elements: [{ versionName: 'old', outputFile: 'app-release.apk' }] }));
  assert.notEqual(run().status, 0);
});

test('signing survives deletion of generated android directory; incomplete files never rotate the key', (t) => {
  const { root, run } = fixture(t, 'android-signing.cjs');
  const first = run();
  assert.equal(first.status, 0, first.stderr);
  const key = path.join(root, '.android-signing/release.keystore');
  const credentials = path.join(root, '.android-signing/credentials.json');
  const original = fs.readFileSync(key);
  fs.mkdirSync(path.join(root, 'android'));
  fs.rmSync(path.join(root, 'android'), { recursive: true });
  const second = run();
  assert.equal(second.status, 0, second.stderr);
  assert.deepEqual(fs.readFileSync(key), original);
  assert.equal(fs.statSync(credentials).mode & 0o777, 0o600);
  fs.unlinkSync(credentials);
  assert.notEqual(run().status, 0);
  assert.deepEqual(fs.readFileSync(key), original);
});

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
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

test('archive uses root config and actual APK bytes, preserves previous builds, rejects stale version', (t) => {
  const { root, run } = fixture(t, 'archive-apk.cjs');
  const output = path.join(root, 'android/app/build/outputs/apk/release');
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(root, 'app.json'), JSON.stringify({ expo: { name: '盼之电竞', version: '1.2.3' } }));
  const metadata = path.join(output, 'output-metadata.json');
  fs.writeFileSync(metadata, JSON.stringify({ elements: [{ versionName: '1.2.3', outputFile: 'app-release.apk' }] }));
  for (const bytes of [Buffer.from('first artifact'), Buffer.from('second artifact')]) {
    fs.writeFileSync(path.join(output, 'app-release.apk'), bytes);
    const result = run();
    assert.equal(result.status, 0, result.stderr);
    const hash = createHash('md5').update(bytes).digest('hex');
    assert.deepEqual(fs.readFileSync(path.join(root, 'apks', `盼之电竞-1.2.3-${hash}.apk`)), bytes);
  }
  assert.equal(fs.readdirSync(path.join(root, 'apks')).length, 2);
  assert.equal(run().status, 0);
  assert.equal(fs.readdirSync(path.join(root, 'apks')).length, 2);
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

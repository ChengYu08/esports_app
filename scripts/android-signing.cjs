const fs = require('node:fs');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const directory = path.join(root, '.android-signing');
const keystore = path.join(directory, 'release.keystore');
const credentials = path.join(directory, 'credentials.json');

try {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  fs.chmodSync(directory, 0o700);
  if (!fs.existsSync(keystore) && !fs.existsSync(credentials)) {
    // Never silently replace a key left by the old script.
    if (fs.existsSync(path.join(root, 'android/app/release.keystore'))) {
      throw new Error('Existing key in android/app: migrate it to .android-signing before clean prebuild.');
    }
    const password = randomBytes(32).toString('hex');
    const keyAlias = 'release';
    fs.writeFileSync(credentials, JSON.stringify({ keyAlias, password }, null, 2) + '\n', {
      flag: 'wx', mode: 0o600,
    });
    execFileSync('keytool', [
      '-genkeypair', '-keystore', keystore, '-storetype', 'PKCS12',
      '-alias', keyAlias, '-keyalg', 'RSA', '-keysize', '2048', '-validity', '10000',
      '-storepass:env', 'PZ_SIGNING_PASSWORD', '-keypass:env', 'PZ_SIGNING_PASSWORD',
      '-dname', 'CN=EsportsApp, OU=Mobile, O=EsportsApp, C=CN',
    ], { env: { ...process.env, PZ_SIGNING_PASSWORD: password }, stdio: ['ignore', 'pipe', 'pipe'] });
  }
  if (!fs.existsSync(keystore) || !fs.existsSync(credentials)) {
    throw new Error('Incomplete signing files. Restore .android-signing from backup; no key will be regenerated.');
  }
  fs.chmodSync(keystore, 0o600);
  fs.chmodSync(credentials, 0o600);
  const { keyAlias, password } = JSON.parse(fs.readFileSync(credentials, 'utf8'));
  if (!keyAlias || !password) throw new Error('Invalid signing credentials.');
  const certificate = execFileSync('keytool', [
    '-exportcert', '-rfc', '-keystore', keystore, '-alias', keyAlias,
    '-storepass:env', 'PZ_SIGNING_PASSWORD',
  ], { env: { ...process.env, PZ_SIGNING_PASSWORD: password }, stdio: ['ignore', 'pipe', 'pipe'] });
  fs.writeFileSync(path.join(directory, 'release-cert.pem'), certificate, { mode: 0o600 });
  console.log('Release signing verified: .android-signing/release.keystore (back up this entire directory).');
} catch (error) {
  // Do not print child-process arguments, environment or credentials.
  console.error(error.status !== undefined ? 'Keytool validation failed. Check Java and restore valid signing credentials.' : error.message);
  process.exitCode = 1;
}

#!/usr/bin/env bash
set -euo pipefail
IPA_PATH="$1"
EXPECTED_BUNDLE_ID="${BUNDLE_ID:?}"
EXPECTED_TEAM_ID="${DEVELOPMENT_TEAM:?}"
WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT
unzip -q "$IPA_PATH" -d "$WORK_DIR"
APP_PATH="$(find "$WORK_DIR/Payload" -maxdepth 1 -type d -name "*.app" -print -quit)"
[ -n "$APP_PATH" ] || { echo "IPA contains no app" >&2; exit 1; }
python3 - "$APP_PATH" "$EXPECTED_BUNDLE_ID" "${REACT_NATIVE_PROJECT:-false}" <<'PYTHON'
import pathlib, plistlib, sys
app = pathlib.Path(sys.argv[1])
with (app / 'Info.plist').open('rb') as f:
    info = plistlib.load(f)
if info.get('CFBundleIdentifier') != sys.argv[2]:
    sys.exit('IPA Bundle ID does not match BUNDLE_ID')
if info.get('CFBundleSupportedPlatforms') != ['iPhoneOS'] or info.get('DTPlatformName') != 'iphoneos':
    sys.exit('IPA must be built for iPhoneOS devices')
if sys.argv[3] == 'true':
    if info.get('UIDeviceFamily') != [1]:
        sys.exit('IPA UIDeviceFamily must be [1] (iPhone only)')
    bundle = app / 'main.jsbundle'
    if not bundle.is_file() or bundle.stat().st_size == 0:
        sys.exit('React Native IPA is missing a nonempty main.jsbundle; check the bundle build phase and SKIP_BUNDLING')
PYTHON
codesign --verify --deep --strict --verbose=2 "$APP_PATH"
SIGNING_INFO="$(codesign -dvvv "$APP_PATH" 2>&1)"
echo "$SIGNING_INFO" | grep -Eq "^Authority=(Apple Distribution|iPhone Distribution):"
echo "$SIGNING_INFO" | grep -Fx "TeamIdentifier=$EXPECTED_TEAM_ID"
codesign -d --entitlements :- "$APP_PATH" > "$WORK_DIR/entitlements.plist"
security cms -D -i "$APP_PATH/embedded.mobileprovision" > "$WORK_DIR/profile.plist"
python3 - "$WORK_DIR" "$EXPECTED_BUNDLE_ID" "$EXPECTED_TEAM_ID" <<'PYTHON'
import datetime, pathlib, plistlib, sys
root = pathlib.Path(sys.argv[1])
with (root / 'entitlements.plist').open('rb') as f:
    entitlements = plistlib.load(f)
with (root / 'profile.plist').open('rb') as f:
    profile = plistlib.load(f)
profile_entitlements = profile.get('Entitlements', {})
for source in (entitlements, profile_entitlements):
    if source.get('get-task-allow', False) is not False:
        sys.exit('IPA/profile must have get-task-allow=false for distribution')
    if source.get('application-identifier') != sys.argv[3] + '.' + sys.argv[2]:
        sys.exit('IPA/profile application-identifier does not match team and Bundle ID')
if 'ProvisionedDevices' in profile or profile.get('ProvisionsAllDevices'):
    sys.exit('IPA requires an App Store distribution profile')
expiry = profile.get('ExpirationDate')
if not expiry or expiry <= datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None):
    sys.exit('IPA provisioning profile has expired')
PYTHON
echo "Validated release IPA: $EXPECTED_BUNDLE_ID"


#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

case "${1:-}" in
  ""|--init-signing) ;;
  *) echo "Usage: $0 [--init-signing]" >&2; exit 1 ;;
esac

# Validate the persistent signing key BEFORE prebuild can clear android/.
node scripts/android-signing.cjs
if [[ "${1:-}" == "--init-signing" ]]; then exit 0; fi

export NODE_ENV=production
if [[ -f bun.lock || -f bun.lockb ]]; then
  bunx expo prebuild --platform android --clean --no-install
else
  npx --no-install expo prebuild --platform android --clean --no-install
fi

(
  cd android
  ./gradlew assembleRelease \
    '-Dorg.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=1024m' \
    --max-workers=4 \
    -Pkotlin.compiler.execution.strategy=in-process \
    -Pkotlin.incremental=false \
    -PreactNativeArchitectures="${REACT_NATIVE_ARCHITECTURES:-arm64-v8a}" \
    -Pandroid.enableMinifyInReleaseBuilds=true \
    -Pandroid.enableShrinkResourcesInReleaseBuilds=true
)

node scripts/archive-apk.cjs

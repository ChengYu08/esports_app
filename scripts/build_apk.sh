#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

usage() {
  echo "Usage: $0 [--init-signing] [--abi arm64|universal|all]" >&2
}

INIT_SIGNING=0
ABI=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --init-signing)
      INIT_SIGNING=1
      shift
      ;;
    --abi)
      if [[ $# -lt 2 || "$2" == -* ]]; then
        usage
        exit 1
      fi
      ABI="$2"
      shift 2
      ;;
    *)
      usage
      exit 1
      ;;
  esac
done

# Validate the persistent signing key BEFORE prebuild can clear android/.
node scripts/android-signing.cjs
if [[ "$INIT_SIGNING" -eq 1 ]]; then exit 0; fi

resolve_targets() {
  case "${1:-}" in
    all)
      echo "arm64-v8a|arm64"
      echo "armeabi-v7a,arm64-v8a|universal"
      ;;
    arm64|"")
      if [[ -n "${REACT_NATIVE_ARCHITECTURES:-}" && -z "${1:-}" ]]; then
        local label=custom
        if [[ "$REACT_NATIVE_ARCHITECTURES" == "arm64-v8a" ]]; then
          label=arm64
        elif [[ "$REACT_NATIVE_ARCHITECTURES" == "armeabi-v7a,arm64-v8a" ]]; then
          label=universal
        fi
        echo "${REACT_NATIVE_ARCHITECTURES}|${label}"
      else
        echo "arm64-v8a|arm64"
      fi
      ;;
    universal)
      echo "armeabi-v7a,arm64-v8a|universal"
      ;;
    *)
      usage
      exit 1
      ;;
  esac
}

assemble_and_archive() {
  local architectures="$1"
  local label="$2"
  echo "Building APK (${label}: ${architectures})..."
  (
    cd android
    ./gradlew :app:assembleRelease \
      '-Dorg.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=1024m' \
      --max-workers=4 \
      -Pkotlin.compiler.execution.strategy=in-process \
      -Pkotlin.incremental=false \
      -PreactNativeArchitectures="${architectures}" \
      -Pandroid.enableMinifyInReleaseBuilds=true \
      -Pandroid.enableShrinkResourcesInReleaseBuilds=true
  )
  APK_ABI_LABEL="$label" node scripts/archive-apk.cjs
}

export NODE_ENV=production

stop_gradle_daemons() {
  echo "Stopping Gradle daemons..."
  if [[ -f android/gradlew ]]; then
    (cd android && ./gradlew --stop) || true
  fi
  command -v gradle >/dev/null 2>&1 && gradle --stop >/dev/null 2>&1 || true
  if command -v jps >/dev/null 2>&1; then
    while read -r pid name; do
      case "$name" in
        *GradleDaemon*|*KotlinCompileDaemon*) kill "$pid" 2>/dev/null || true ;;
      esac
    done < <(jps -l 2>/dev/null || true)
    sleep 1
  fi
}

# Remove android/ before expo --clean to avoid Windows EBUSY on locked build outputs.
if [[ -d android ]]; then
  echo "Removing android/ before prebuild..."
  stop_gradle_daemons
  rm -rf android || {
    echo "Failed to remove android/. Close Android Studio / IDE Java indexing, then retry." >&2
    exit 1
  }
fi

if [[ -f bun.lock || -f bun.lockb ]]; then
  bunx expo prebuild --platform android --clean --no-install
else
  npx --no-install expo prebuild --platform android --clean --no-install
fi

while IFS= read -r target; do
  [[ -z "$target" ]] && continue
  architectures="${target%%|*}"
  label="${target##*|}"
  assemble_and_archive "$architectures" "$label"
done < <(resolve_targets "$ABI")

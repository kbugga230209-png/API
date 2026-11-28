#!/usr/bin/env bash
set -euo pipefail

ARCHIVE_PATH="${1:-ios/build/InkVault.xcarchive}"
OUTPUT_DIR="${2:-ios/build/ipa}"
IPA_NAME="${3:-INKVAULT.ipa}"

APP_PATH="${ARCHIVE_PATH}/Products/Applications/InkVault.app"

if [ ! -d "${APP_PATH}" ]; then
  echo "ERROR: InkVault.app not found at ${APP_PATH}" >&2
  exit 1
fi

if [ ! -f "${APP_PATH}/InkVault" ]; then
  echo "ERROR: Compiled Mach-O executable missing at ${APP_PATH}/InkVault" >&2
  exit 1
fi

if [ ! -f "${APP_PATH}/WebBundle/index.html" ]; then
  echo "ERROR: Bundled web assets missing at ${APP_PATH}/WebBundle/index.html" >&2
  exit 1
fi

if [ ! -f "${APP_PATH}/PrivacyInfo.xcprivacy" ]; then
  echo "ERROR: PrivacyInfo.xcprivacy missing inside ${APP_PATH}" >&2
  exit 1
fi

echo "=== Verifying compiled ARM64 Mach-O binary & Info.plist ==="
file "${APP_PATH}/InkVault"
plutil -lint "${APP_PATH}/Info.plist"

rm -rf "${OUTPUT_DIR}"
mkdir -p "${OUTPUT_DIR}/Payload"
cp -R "${APP_PATH}" "${OUTPUT_DIR}/Payload/InkVault.app"

# Ensure clean unsigned Payload layout (no .DS_Store, no stale _CodeSignature or mobileprovision)
find "${OUTPUT_DIR}/Payload" -name ".DS_Store" -delete || true
rm -rf "${OUTPUT_DIR}/Payload/InkVault.app/_CodeSignature" "${OUTPUT_DIR}/Payload/InkVault.app/embedded.mobileprovision"
chmod 0755 "${OUTPUT_DIR}/Payload/InkVault.app/InkVault"

# Uncrush loose AppIcon*.png files from Apple CgBI to standard ISO PNG so Windows AltServer/Sideloadly decode them cleanly
if command -v xcrun >/dev/null 2>&1; then
  for icon_png in "${OUTPUT_DIR}/Payload/InkVault.app"/AppIcon*.png; do
    if [ -f "${icon_png}" ]; then
      tmp_png="${icon_png}.uncrushed.png"
      if xcrun -sdk iphoneos pngcrush -q -revert-iphone-optimizations "${icon_png}" "${tmp_png}" 2>/dev/null && [ -s "${tmp_png}" ]; then
        mv "${tmp_png}" "${icon_png}"
        chmod 0644 "${icon_png}"
      else
        rm -f "${tmp_png}"
      fi
    fi
  done
fi

# Non-destructive code-signing dry-run on an isolated temporary copy to verify Mach-O & bundle signability
if command -v codesign >/dev/null 2>&1; then
  DRYRUN_DIR="$(mktemp -d)"
  cp -R "${OUTPUT_DIR}/Payload/InkVault.app" "${DRYRUN_DIR}/InkVault.app"
  echo "=== Running non-destructive code-signing dry-run on isolated copy ==="
  codesign --force --sign - --entitlements "ios/InkVaultApp/InkVault.entitlements" --timestamp=none "${DRYRUN_DIR}/InkVault.app"
  codesign --verify --deep --strict --verbose=2 "${DRYRUN_DIR}/InkVault.app"
  rm -rf "${DRYRUN_DIR}"
  echo "✓ Code-signing dry-run passed (original Payload/InkVault.app remains unsigned)"
fi

(
  cd "${OUTPUT_DIR}"
  zip -qry -X "${IPA_NAME}" Payload
  rm -rf Payload
)

ls -lh "${OUTPUT_DIR}/${IPA_NAME}"
echo "✓ Packaged unsigned AltStore-compatible IPA at ${OUTPUT_DIR}/${IPA_NAME}"

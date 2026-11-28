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

(
  cd "${OUTPUT_DIR}"
  zip -qry "${IPA_NAME}" Payload
  rm -rf Payload
)

ls -lh "${OUTPUT_DIR}/${IPA_NAME}"
echo "✓ Packaged sideload-ready IPA at ${OUTPUT_DIR}/${IPA_NAME}"

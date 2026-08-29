#!/usr/bin/env bash
# stage-sourcemaps — CEO 2026-08-29 P0-4 §14.
#
# Vite's build already emits hidden source maps (`sourcemap: 'hidden'`)
# but they land in `dist/public/assets/*.js.map`, right next to the
# JS. That is:
#   * publicly reachable on the hosted asset (any browser can pull it)
#   * an information leak (release-labelled comments, path structure)
#   * not the intent of `hidden` — Vite hides the source-map URL
#     from the JS file itself, but the file is still there.
#
# This script MOVES every `.map` file out of the public artifact into
# a sibling `dist/sourcemaps/` staging directory the deployer can:
#   * upload to Sentry / an error monitoring system
#   * ship as a private CI artifact
#   * discard once uploaded
#
# The public artifact after this runs contains ZERO `.map` files.
# The staged directory contains ONE `map-manifest.txt` file listing
# every source-map + its SHA-256 so uploads can be verified.
#
# Usage:
#   ./scripts/stage-sourcemaps.sh             # defaults to dist/public → dist/sourcemaps
#   ./scripts/stage-sourcemaps.sh <src> <dst> # override paths
#
# Exit codes:
#   0  success (even if zero .map files found — a build without any
#      maps is still a valid deploy state to accept)
#   1  I/O / permission error
set -eu
set -o pipefail

SRC_DIR="${1:-dist/public}"
DST_DIR="${2:-dist/sourcemaps}"

if [[ ! -d "${SRC_DIR}" ]]; then
  echo "[stage-sourcemaps] SRC_DIR ${SRC_DIR} does not exist — did the build finish?" >&2
  exit 1
fi

mkdir -p "${DST_DIR}"
: > "${DST_DIR}/map-manifest.txt"

count=0
while IFS= read -r -d '' map; do
  rel="${map#${SRC_DIR}/}"
  target="${DST_DIR}/${rel}"
  mkdir -p "$(dirname "${target}")"
  mv "${map}" "${target}"
  # SHA-256 for the manifest so ops can verify uploads.
  if command -v sha256sum >/dev/null 2>&1; then
    hash="$(sha256sum "${target}" | awk '{print $1}')"
  elif command -v shasum >/dev/null 2>&1; then
    hash="$(shasum -a 256 "${target}" | awk '{print $1}')"
  else
    hash="no-hash-tool"
  fi
  printf "%s\t%s\n" "${hash}" "${rel}" >> "${DST_DIR}/map-manifest.txt"
  count=$((count + 1))
done < <(find "${SRC_DIR}" -type f -name "*.map" -print0)

echo "[stage-sourcemaps] moved ${count} source-map file(s) from ${SRC_DIR} → ${DST_DIR}"
echo "[stage-sourcemaps] manifest: ${DST_DIR}/map-manifest.txt"

# Belt-and-braces: verify the public artifact contains ZERO .map files
# after this runs. If any survived, exit 1 so the deploy blocks.
remaining="$(find "${SRC_DIR}" -type f -name "*.map" | head -5)"
if [[ -n "${remaining}" ]]; then
  echo "[stage-sourcemaps] FAIL — source-map files SURVIVED in the public artifact:" >&2
  echo "${remaining}" >&2
  exit 1
fi

echo "[stage-sourcemaps] PASS — public artifact contains zero .map files."

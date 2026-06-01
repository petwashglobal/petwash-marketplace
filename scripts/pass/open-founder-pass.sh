#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PASS_FILE="$ROOT/first-founder-pass.pkpass"

if [[ ! -f "$PASS_FILE" ]]; then
  echo "Pass missing. Run ./scripts/pass/regenerate-founder-pass.sh"
  exit 1
fi

ls -lh "$PASS_FILE"
open "$PASS_FILE"

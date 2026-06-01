#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

if [[ ! -f ".env" ]]; then
  echo "Missing .env. Add wallet signing env locally or use Secret Manager before regenerating."
  exit 1
fi

node --env-file=.env node_modules/tsx/dist/cli.mjs scripts/pass/generate-first-founder-pass.ts
ls -lh first-founder-pass.pkpass

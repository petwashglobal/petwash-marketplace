#!/bin/bash
# PetWash GitHub Sync Script
# Pushes all local Replit commits to GitHub in one shot

set -e

REPO_URL="https://petwashglobal:${GITHUB_PERSONAL_ACCESS_TOKEN}@github.com/petwashglobal/petwash-marketplace.git"

if [ -z "$GITHUB_PERSONAL_ACCESS_TOKEN" ]; then
  echo "❌ GITHUB_PERSONAL_ACCESS_TOKEN not set — add it as a Replit secret"
  exit 1
fi

echo "🔄 Syncing to GitHub..."

LOCAL_SHA=$(git rev-parse HEAD)
REMOTE_SHA=$(git ls-remote "$REPO_URL" HEAD 2>/dev/null | awk '{print $1}')

if [ "$LOCAL_SHA" = "$REMOTE_SHA" ]; then
  echo "✅ Already in sync — GitHub is up to date ($(git rev-parse --short HEAD))"
  exit 0
fi

echo "   Local:  $(git rev-parse --short HEAD) — $(git log -1 --format='%s')"
echo "   Remote: ${REMOTE_SHA:0:8}"
echo "   Pushing..."

git -c credential.helper="" push --force "$REPO_URL" HEAD:main 2>&1

echo "✅ GitHub synced — $(git rev-parse --short HEAD)"

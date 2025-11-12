#!/bin/bash
set -euo pipefail
# Production build script for Pet Wash™
echo "🔨 Building production bundle..."
npm run build
echo "📦 Preparing production location..."
rm -rf server/public
mkdir -p server/public
echo "📦 Copying build contents..."
cp -R dist/public/. server/public/
echo "✅ Production build complete!"
echo "📋 Verifying build..."
if [ -f "server/public/index.html" ]; then
  echo "✅ index.html found in server/public"
else
  echo "❌ ERROR: index.html missing in server/public"
  exit 1
fi

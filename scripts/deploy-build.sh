#!/bin/bash
# Deployment Build Script
# This runs during Replit deployment to prepare production files

set -e

echo "================================"
echo "🚀 Pet Wash Deployment Build"
echo "================================"

# Step 1: Build frontend with Vite
echo ""
echo "📦 Step 1: Building frontend with Vite..."
npm run build

# Step 2: Copy dist/public to server/public
echo ""
echo "📋 Step 2: Cleaning and copying build files to server/public..."
# Clean old build completely
rm -rf server/public
mkdir -p server/public
# Copy fresh build
cp -R dist/public/* server/public/
# Remove any nested public folders or old files
rm -rf server/public/public server/public/*.old server/public/*.deprecated

# Step 3: Verify build
echo ""
echo "✅ Step 3: Verifying build..."
if [ -f "server/public/index.html" ]; then
    echo "✓ index.html found"
    echo "✓ Build size: $(du -sh server/public | cut -f1)"
    echo "✓ Files: $(find server/public -type f | wc -l) files"
else
    echo "❌ ERROR: index.html not found!"
    exit 1
fi

echo ""
echo "================================"
echo "✅ Deployment build complete!"
echo "================================"

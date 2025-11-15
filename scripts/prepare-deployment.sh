#!/bin/bash
# Pet Wash™ Deployment Preparation Script
# Run this to ensure production build is ready for deployment

set -e

echo "🚀 Pet Wash™ - Deployment Preparation"
echo "======================================"
echo ""

# Step 1: Clean old builds
echo "📦 Step 1: Cleaning old builds..."
rm -rf dist server/public
echo "✅ Old builds cleaned"
echo ""

# Step 2: Build production frontend
echo "🏗️  Step 2: Building production frontend..."
npm run build
echo "✅ Frontend built to dist/public/"
echo ""

# Step 3: Verify build
echo "✅ Step 3: Verifying build..."
if [ -f "dist/public/index.html" ]; then
    echo "✓ index.html found"
    echo "✓ Build size: $(du -sh dist/public | cut -f1)"
    echo "✓ Asset files: $(find dist/public/assets -type f | wc -l)"
else
    echo "❌ ERROR: index.html not found!"
    exit 1
fi
echo ""

echo "======================================"
echo "✅ Deployment build ready!"
echo ""
echo "Next steps:"
echo "1. dist/public/ will be included in deployment (per .deployignore)"
echo "2. Server will copy dist/public/ → server/public/ on startup"
echo "3. Click 'Publish' in Replit to deploy"
echo ""
echo "Note: .replit.deploy may remove some dev dependencies,"
echo "but tsx and TypeScript are in dependencies, not devDependencies"
echo "======================================"

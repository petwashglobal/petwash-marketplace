#!/bin/bash
# Production Deployment Optimizer
# Reduces deployment image size from 8+ GiB to under the limit

set -e

echo "🚀 Pet Wash™ - Production Deployment Optimization"
echo "================================================"

# Step 1: Clean build artifacts
echo "📦 Step 1/5: Cleaning build artifacts..."
rm -rf dist
rm -rf .vite
rm -rf node_modules/.cache
rm -rf coverage
echo "✅ Build artifacts cleaned"

# Step 2: Remove development-only files
echo "🗑️  Step 2/5: Removing development files..."
find . -name "*.test.ts" -type f -delete 2>/dev/null || true
find . -name "*.test.tsx" -type f -delete 2>/dev/null || true
find . -name "*.spec.ts" -type f -delete 2>/dev/null || true
find . -name "*.spec.tsx" -type f -delete 2>/dev/null || true
echo "✅ Development files removed"

# Step 3: Optimize node_modules
echo "📦 Step 3/5: Optimizing node_modules..."
# Remove unnecessary type definitions (not needed in production)
rm -rf node_modules/@types/vitest 2>/dev/null || true
rm -rf node_modules/@vitest 2>/dev/null || true
# Remove source maps from dependencies
find node_modules -name "*.map" -type f -delete 2>/dev/null || true
echo "✅ node_modules optimized"

# Step 4: Build production bundle
echo "🏗️  Step 4/5: Building production bundle..."
export NODE_ENV=production
export REPLIT_DEPLOYMENT=true
npm run build
echo "✅ Production build complete"

# Step 5: Report size
echo "📊 Step 5/5: Deployment size report..."
if command -v du &> /dev/null; then
    echo "dist/ size: $(du -sh dist | cut -f1)"
    echo "node_modules/ size: $(du -sh node_modules | cut -f1)"
fi

echo ""
echo "✅ Deployment optimization complete!"
echo "🚀 Ready to deploy to production"

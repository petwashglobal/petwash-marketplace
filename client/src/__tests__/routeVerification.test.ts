import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { navigationTree, type MenuItem } from '@/lib/navigationStructure';

/**
 * SUBTASK 1: Navigation traversal helper
 * Recursively extracts all paths from the navigationTree
 */
interface PathInfo {
  id: string;
  label: string;
  originalPath: string;
  canonicalPath: string;
}

function getAllPathsFromMenu(items: MenuItem[], pathInfos: PathInfo[] = []): PathInfo[] {
  for (const item of items) {
    // If item has a path, extract and normalize it
    if (item.path) {
      const canonicalPath = normalizeNavigationPath(item.path);
      pathInfos.push({
        id: item.id,
        label: item.label,
        originalPath: item.path,
        canonicalPath,
      });
    }
    
    // Recursively process children
    if (item.children && item.children.length > 0) {
      getAllPathsFromMenu(item.children, pathInfos);
    }
  }
  
  return pathInfos;
}

/**
 * Normalize navigation paths by:
 * - Stripping hash fragments (#deals, #benefits)
 * - Stripping query parameters (?key=value)
 * - Removing trailing slashes
 * - Keeping only the base path for route matching
 */
function normalizeNavigationPath(path: string): string {
  // Skip external URLs (http://, https://, mailto:, tel:, etc.)
  if (path.startsWith('http://') || 
      path.startsWith('https://') || 
      path.startsWith('mailto:') ||
      path.startsWith('tel:') ||
      path.includes('://')) {
    return ''; // Will be filtered out
  }
  
  // Remove hash and query params
  const basePathMatch = path.match(/^([^#?]*)/);
  const basePath = basePathMatch ? basePathMatch[1] : path;
  
  // Remove trailing slash (but keep '/' for root)
  return basePath === '/' ? basePath : basePath.replace(/\/$/, '');
}

/**
 * SUBTASK 2: App route catalog
 * Extract all route paths declared in App.tsx
 */
function getAppRoutePaths(): Set<string> {
  try {
    const appPath = join(__dirname, '../App.tsx');
    const appContent = readFileSync(appPath, 'utf-8');
    
    // Match both static and parameterized routes
    // Examples: path="/packages", path="/sitter-suite/sitter/:id"
    const routeRegex = /path="([^"]+)"/g;
    const routes = new Set<string>();
    
    let match;
    while ((match = routeRegex.exec(appContent)) !== null) {
      const routePath = match[1];
      // Normalize by removing trailing slashes
      const normalized = routePath === '/' ? routePath : routePath.replace(/\/$/, '');
      routes.add(normalized);
    }
    
    return routes;
  } catch (error) {
    console.error('Failed to read App.tsx:', error);
    return new Set();
  }
}

/**
 * Check if a navigation path matches any App route
 * Handles dynamic segments like :id, :slug, etc.
 */
function pathMatchesRoute(navPath: string, appRoutes: Set<string>): boolean {
  // Direct match
  if (appRoutes.has(navPath)) {
    return true;
  }
  
  // Check for dynamic segment matches
  // e.g., navPath="/sitter-suite/sitter/123" matches "/sitter-suite/sitter/:id"
  for (const route of appRoutes) {
    if (route.includes(':')) {
      // Convert route pattern to regex
      const pattern = route.replace(/:[^/]+/g, '[^/]+');
      const regex = new RegExp(`^${pattern}$`);
      if (regex.test(navPath)) {
        return true;
      }
    }
  }
  
  return false;
}

describe('Route Verification - Comprehensive navigationTree validation', () => {
  /**
   * SUBTASK 3: Comparison & reporting
   * Main test suite that validates ALL navigation paths exist in App.tsx
   */
  
  it('should successfully extract paths from navigationTree', () => {
    const allPaths = getAllPathsFromMenu(navigationTree);
    
    console.info(`📊 Extracted ${allPaths.length} paths from navigationTree`);
    
    // Expect at least 70 paths (navigationTree currently has 75 menu items with paths after cleanup)
    expect(allPaths.length).toBeGreaterThanOrEqual(70);
    
    // Verify we're getting valid paths
    const validPaths = allPaths.filter(p => p.canonicalPath !== '');
    expect(validPaths.length).toBeGreaterThanOrEqual(70);
  });
  
  it('should successfully extract routes from App.tsx', () => {
    const appRoutes = getAppRoutePaths();
    
    console.info(`📋 Extracted ${appRoutes.size} routes from App.tsx`);
    
    // Expect at least 150 routes in App.tsx
    expect(appRoutes.size).toBeGreaterThan(150);
    
    // Verify we're getting valid routes
    expect(appRoutes.has('/')).toBe(true); // Home route should exist
  });
  
  it('should verify ALL navigation paths exist in App.tsx routes', () => {
    const allNavPaths = getAllPathsFromMenu(navigationTree);
    const appRoutes = getAppRoutePaths();
    
    // Filter out external URLs and empty paths
    const internalPaths = allNavPaths.filter(p => p.canonicalPath !== '');
    
    console.info(`\n🔍 ROUTE VERIFICATION REPORT`);
    console.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.info(`📊 Total navigation paths: ${internalPaths.length}`);
    console.info(`📋 Total App.tsx routes: ${appRoutes.size}`);
    console.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    
    // SUBTASK 4: Edge handling - Check each path
    const missingRoutes: PathInfo[] = [];
    const matchedRoutes: PathInfo[] = [];
    
    for (const pathInfo of internalPaths) {
      if (pathMatchesRoute(pathInfo.canonicalPath, appRoutes)) {
        matchedRoutes.push(pathInfo);
      } else {
        missingRoutes.push(pathInfo);
      }
    }
    
    // Report results
    if (missingRoutes.length > 0) {
      console.error(`\n❌ MISSING ROUTES (${missingRoutes.length}):`);
      console.error(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      
      // Sort by canonical path for easier debugging
      const sortedMissing = missingRoutes.sort((a, b) => 
        a.canonicalPath.localeCompare(b.canonicalPath)
      );
      
      sortedMissing.forEach((pathInfo, index) => {
        console.error(`${index + 1}. [${pathInfo.id}] ${pathInfo.label}`);
        console.error(`   Original: ${pathInfo.originalPath}`);
        console.error(`   Canonical: ${pathInfo.canonicalPath}`);
      });
      
      console.error(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    }
    
    console.info(`✅ Matched routes: ${matchedRoutes.length}/${internalPaths.length}`);
    console.info(`❌ Missing routes: ${missingRoutes.length}/${internalPaths.length}`);
    
    if (matchedRoutes.length > 0) {
      console.info(`\n📈 Coverage: ${((matchedRoutes.length / internalPaths.length) * 100).toFixed(1)}%\n`);
    }
    
    // Assertion: All navigation paths must exist in App.tsx
    expect(missingRoutes).toEqual([]);
    
    // Assertion: Coverage should be high (expect all navigation paths to have matching routes)
    expect(matchedRoutes.length).toBeGreaterThan(70);
  });
  
  it('should handle hash-based navigation correctly', () => {
    const testPaths = [
      { original: '/packages#deals', canonical: '/packages' },
      { original: '/loyalty#benefits', canonical: '/loyalty' },
      { original: '/academy#courses', canonical: '/academy' },
    ];
    
    testPaths.forEach(({ original, canonical }) => {
      const normalized = normalizeNavigationPath(original);
      expect(normalized).toBe(canonical);
    });
  });
  
  it('should filter out external URLs', () => {
    const externalUrls = [
      'https://example.com',
      'http://example.com',
      'mailto:test@example.com',
    ];
    
    externalUrls.forEach(url => {
      const normalized = normalizeNavigationPath(url);
      expect(normalized).toBe('');
    });
  });
});

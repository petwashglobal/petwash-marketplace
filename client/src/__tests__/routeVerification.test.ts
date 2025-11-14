import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const getAppRoutes = (): string => {
  try {
    const appPath = join(__dirname, '../App.tsx');
    return readFileSync(appPath, 'utf-8');
  } catch (error) {
    console.error('Failed to read App.tsx:', error);
    return '';
  }
};

describe('Route Verification - Ensure all menu links have valid routes', () => {
  const appRoutesContent = getAppRoutes();

  it('should have App.tsx content available for testing', () => {
    expect(appRoutesContent.length).toBeGreaterThan(0);
    expect(appRoutesContent).toContain('Route path=');
  });

  it('should verify all Premium Features routes exist', () => {
    const premiumRoutes = [
      '/kenzo-ai',
      '/live-chat',
      '/settings/notifications',
      '/security/status'
    ];
    
    const missingRoutes = premiumRoutes.filter(route => 
      !appRoutesContent.includes(`path="${route}"`)
    );
    
    if (missingRoutes.length > 0) {
      console.error('❌ Missing Premium Features routes:', missingRoutes);
    }
    
    expect(missingRoutes).toEqual([]);
    expect(premiumRoutes.length).toBe(4);
  });

  it('should verify Academy main route exists', () => {
    expect(appRoutesContent).toContain('path="/academy"');
  });

  it('should verify all Franchise Management routes exist', () => {
    const franchiseRoutes = [
      '/franchise/dashboard',
      '/franchise/inbox',
      '/franchise/marketing',
      '/franchise/reports',
      '/franchise/support'
    ];
    
    const missingRoutes = franchiseRoutes.filter(route => 
      !appRoutesContent.includes(`path="${route}"`)
    );
    
    if (missingRoutes.length > 0) {
      console.error('❌ Missing Franchise Management routes:', missingRoutes);
    }
    
    expect(missingRoutes).toEqual([]);
    expect(franchiseRoutes.length).toBe(5);
  });

});

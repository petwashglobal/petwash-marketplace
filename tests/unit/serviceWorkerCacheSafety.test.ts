import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();

describe('signup service-worker cache safety', () => {
  it('ships kill workers for both historic service-worker paths', () => {
    const sw = fs.readFileSync(path.join(repoRoot, 'client/public/sw.js'), 'utf8');
    const legacy = fs.readFileSync(path.join(repoRoot, 'client/public/service-worker.js'), 'utf8');

    for (const source of [sw, legacy]) {
      expect(source).toContain('skipWaiting');
      expect(source).toContain('clients.claim');
      expect(source).toContain('caches.keys');
      expect(source).toContain('registration.unregister');
      expect(source).toContain('event.respondWith(fetch(event.request))');
    }
  });

  it('prevents Firebase Hosting from caching signup and service-worker scripts', () => {
    const firebase = JSON.parse(fs.readFileSync(path.join(repoRoot, 'firebase.json'), 'utf8'));
    const headers = firebase.hosting[0].headers as Array<{ source: string; headers: Array<{ key: string; value: string }> }>;

    const cacheHeaderFor = (source: string) =>
      headers.find((entry) => entry.source === source)?.headers.find((header) => header.key === 'Cache-Control')?.value;

    expect(cacheHeaderFor('/signup')).toContain('no-store');
    expect(cacheHeaderFor('/signup-lux')).toContain('no-store');
    expect(cacheHeaderFor('/signin')).toContain('no-store');
    expect(cacheHeaderFor('/wallet')).toContain('no-store');
    expect(cacheHeaderFor('/sw.js')).toContain('no-store');
    expect(cacheHeaderFor('/service-worker.js')).toContain('no-store');
  });
});

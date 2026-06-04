import React from 'react';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  language: 'en',
  navigate: vi.fn(),
  setLanguage: vi.fn(),
  logout: vi.fn(),
  auth: {
    user: {
      displayName: 'Nir Hadad',
    },
    loading: false,
    logout: vi.fn(),
  },
  whoami: {
    role: 'customer',
    isLoading: false,
  },
  queryData: new Map<string, unknown>(),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: (options: { queryKey?: readonly unknown[] }) => {
    const key = Array.isArray(options.queryKey) ? String(options.queryKey[0]) : '';
    return {
      data: mocks.queryData.get(key),
      isLoading: false,
      isError: false,
    };
  },
}));

vi.mock('@/auth/AuthProvider', () => ({
  useFirebaseAuth: () => mocks.auth,
}));

vi.mock('@/auth/useWhoami', () => ({
  useWhoami: () => mocks.whoami,
}));

vi.mock('@/lib/languageStore', () => ({
  useLanguage: () => ({
    language: mocks.language,
    setLanguage: mocks.setLanguage,
  }),
}));

vi.mock('wouter', async () => {
  const ReactModule = await import('react');
  return {
    Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) =>
      ReactModule.createElement('a', { href, ...props }, children),
    useLocation: () => ['/', mocks.navigate],
  };
});

import DashboardV2 from './DashboardV2';
import ProfileV2 from './ProfileV2';

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const APP_SRC = readFileSync(resolve(__dirname, '..', 'App.tsx'), 'utf8');

function htmlOf(node: React.ReactElement) {
  return renderToStaticMarkup(node);
}

describe('DashboardV2 and ProfileV2 launch gates', () => {
  it('keeps DashboardV2 behind VITE_DASHBOARD_V2_ENABLED with legacy Dashboard as the default', () => {
    expect(APP_SRC).toMatch(/const DashboardV2 = lazy\(\(\) => import\("@\/pages\/DashboardV2"\)\)/);
    expect(APP_SRC).toMatch(/VITE_DASHBOARD_V2_ENABLED === 'true'\s*\?\s*<DashboardV2 \/>\s*:\s*<Dashboard \/>/);
  });

  it('keeps ProfileV2 behind VITE_PROFILE_V2_ENABLED with legacy MyAccount as the default deep-edit route', () => {
    expect(APP_SRC).toMatch(/const ProfileV2 = lazy\(\(\) => import\("@\/pages\/ProfileV2"\)\)/);
    expect(APP_SRC).toMatch(/VITE_PROFILE_V2_ENABLED === 'true'\s*\?\s*<ProfileV2 \/>\s*:\s*<MyAccount \/>/);
    expect(APP_SRC).toMatch(/legacy MyAccount is the default \+ deep-edit target/);
  });
});

describe('DashboardV2 render contract', () => {
  beforeEach(() => {
    mocks.language = 'en';
    mocks.navigate.mockReset();
    mocks.queryData.clear();
    mocks.auth.loading = false;
    mocks.auth.user = { displayName: 'Nir Hadad' };
    mocks.whoami.role = 'customer';
    mocks.whoami.isLoading = false;
  });

  it('renders honest empty states without fake pets, live station counts, or fabricated activity', () => {
    const html = htmlOf(React.createElement(DashboardV2));

    expect(html).toContain('Add your first pet');
    expect(html).toContain('Find a station');
    expect(html).toContain('Your washes, rewards and receipts will appear here after your first visit.');
    expect(html).not.toContain('25K');
    expect(html).not.toMatch(/4\.9\s*\/\s*5|average rating/i);
    expect(html).not.toMatch(/live bay|available now|open now/i);
  });

  it('supports RTL copy and direction for Hebrew users', () => {
    mocks.language = 'he';

    const html = htmlOf(React.createElement(DashboardV2));

    expect(html).toContain('direction:rtl');
    expect(html).toContain('החיות שלי');
    expect(html).toContain('הוסיפו את החיה הראשונה');
    expect(html).toContain('התחילו שטיפה');
  });

  it('does not render the customer dashboard when the server role is provider', () => {
    mocks.whoami.role = 'provider';

    const html = htmlOf(React.createElement(DashboardV2));

    expect(html).toBe('');
    expect(mocks.navigate).toHaveBeenCalledTimes(0);
  });
});

describe('ProfileV2 render contract', () => {
  beforeEach(() => {
    mocks.language = 'en';
    mocks.queryData.clear();
    mocks.auth.user = { displayName: 'Nir Hadad' };
    mocks.logout.mockReset();
    mocks.setLanguage.mockReset();
  });

  it('renders an empty profile hub without leaking undefined/null placeholders', () => {
    mocks.auth.user = { displayName: '' };

    const html = htmlOf(React.createElement(ProfileV2));

    expect(html).toContain('Account');
    expect(html).toContain('Member');
    expect(html).toContain('Personal details');
    expect(html).toContain('₪0');
    expect(html).not.toContain('undefined');
    expect(html).not.toContain('null');
  });

  it('supports RTL copy and direction for Hebrew users', () => {
    mocks.language = 'he';

    const html = htmlOf(React.createElement(ProfileV2));

    expect(html).toContain('direction:rtl');
    expect(html).toContain('החשבון שלי');
    expect(html).toContain('פרטים אישיים');
    expect(html).toContain('שפה');
  });

  it('shows verified contact details only when real profile and verification data exist', () => {
    mocks.queryData.set('/api/user/profile', {
      displayName: 'Nir Hadad',
      email: 'nir@example.com',
      phone: '+972501234567',
      city: '',
      photoURL: '',
    });
    mocks.queryData.set('/api/user/settings/verification-status', {
      emailVerified: true,
      phoneVerified: true,
    });

    const html = htmlOf(React.createElement(ProfileV2));

    expect(html).toContain('nir@example.com');
    expect(html).toContain('+972501234567');
    expect(html).toContain('Edit profile');
  });
});

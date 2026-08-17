/**
 * Shared helpers for the /provider/pending Playwright coverage.
 *
 * These tests exercise the applicant status page end-to-end WITHOUT touching
 * production APIs, SMS, payments, or the DB. Every relevant network call is
 * intercepted with `page.route()` and served from a fixture DTO so the same
 * spec runs identically against localhost and CI.
 *
 * Auth handshake
 * ──────────────
 * `RequireAuth` only mounts `<ProviderPending />` when `useFirebaseAuth().user`
 * is truthy. `AuthProvider` exposes a dev-mode escape hatch that reads
 * `localStorage['petwash_dev_mode'] === 'true'` (gated by `import.meta.env.DEV`),
 * yielding a synthetic user whose `getIdToken()` resolves to the string
 * `'dev-token'`. That is exactly what these tests need — a real user object
 * without Firebase network — so we flip that flag in `addInitScript` before
 * the first navigation. Requires the app to be served by `npm run dev`
 * (Vite in dev mode); running against a production build would return the
 * user to the unauthenticated flow and the tests would land on /signin.
 *
 * Network interception
 * ────────────────────
 * We install one catch-all `/api/**` handler that:
 *   1. returns the caller-supplied fixture for `/api/provider-applications/my`
 *   2. echoes a synthetic 201 for `POST /api/provider-applications/my/documents`
 *   3. answers everything else with a benign 200 empty body
 * The last rule is defensive: the app has a fair bit of ambient polling
 * (whoami, notifications, session, etc.) and we do not want those to fall
 * through to the real backend during a spec run.
 */

import { expect, type Page } from '@playwright/test';

export const BASE_URL =
  process.env.BASE_URL ||
  (process.env.REPLIT_DEV_DOMAIN
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : 'http://localhost:5000');

/** Shape returned by GET /api/provider-applications/my. Kept loose on purpose. */
export interface AppFixture {
  id: number;
  applicationId?: string;
  stage: string;
  status: string;
  membershipNumber?: string;
  providerType?: string;
  rejectionReason?: string | null;
  documents: Array<{
    id: number;
    documentType: string;
    fileName?: string;
    verificationStatus: string;
    uploadedAt?: string;
  }>;
  tasks: Array<unknown>;
  requiredDocuments: string[];
  source: 'provider_applications' | 'provider_applicants';
  progress?: number;
  submittedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** Canonical (bridge) fixture: sitter mid-flow, one document still owed. */
export function bridgeSitterDocumentsPending(): AppFixture {
  return {
    id: 4711,
    applicationId: 'PW-APP-4711',
    stage: 'documents_pending',
    status: 'documents_pending',
    providerType: 'sitter',
    documents: [],
    tasks: [],
    requiredDocuments: ['home_photos'],
    source: 'provider_applications',
    progress: 0,
    submittedAt: '2026-08-14T09:00:00.000Z',
  };
}

/** Bridge fixture: walker — walker maps to dog_walking, which under the current
 *  KYC-disabled flag yields an EMPTY requiredDocuments set. This is deliberate;
 *  we want to prove the upload card DOES NOT render when the server says so. */
export function bridgeWalkerNoDocuments(): AppFixture {
  return {
    id: 4712,
    applicationId: 'PW-APP-4712',
    stage: 'documents_pending',
    status: 'documents_pending',
    providerType: 'walker',
    documents: [],
    tasks: [],
    requiredDocuments: [],
    source: 'provider_applications',
    progress: 0,
    submittedAt: '2026-08-14T09:05:00.000Z',
  };
}

/** Bridge fixture: station_operator — also expected to be documents-free. */
export function bridgeStationOperatorNoDocuments(): AppFixture {
  return {
    id: 4713,
    applicationId: 'PW-APP-4713',
    stage: 'documents_pending',
    status: 'documents_pending',
    providerType: 'station_operator',
    documents: [],
    tasks: [],
    requiredDocuments: [],
    source: 'provider_applications',
    progress: 0,
    submittedAt: '2026-08-14T09:10:00.000Z',
  };
}

/** Legacy fixture: applicant on the old provider_applicants table, mid-flow,
 *  home_photos still owed. Post-fix the shape must be FLAT (top-level `stage`,
 *  `status`, `documents`, `requiredDocuments`) — matching the bridge shape. */
export function legacyDocumentsPending(): AppFixture {
  return {
    id: 9001,
    stage: 'documents_pending',
    status: 'documents_pending',
    documents: [],
    tasks: [],
    requiredDocuments: ['home_photos'],
    source: 'provider_applicants',
    progress: 25,
    submittedAt: '2026-08-14T08:00:00.000Z',
  };
}

/** A fixture where one document has been uploaded and verified pending review. */
export function bridgeSitterOneDocUploaded(fileName = 'home-front.jpg'): AppFixture {
  return {
    ...bridgeSitterDocumentsPending(),
    stage: 'documents_under_review',
    status: 'documents_under_review',
    documents: [
      {
        id: 1,
        documentType: 'home_photos',
        fileName,
        verificationStatus: 'pending',
        uploadedAt: '2026-08-14T10:15:00.000Z',
      },
    ],
    progress: 25,
  };
}

export function bridgeApproved(): AppFixture {
  return {
    id: 4711,
    applicationId: 'PW-APP-4711',
    stage: 'approved',
    status: 'approved',
    providerType: 'sitter',
    documents: [],
    tasks: [],
    requiredDocuments: ['home_photos'],
    source: 'provider_applications',
    progress: 100,
  };
}

export function bridgeRejected(reason = 'Missing valid ID'): AppFixture {
  return {
    id: 4711,
    applicationId: 'PW-APP-4711',
    stage: 'rejected',
    status: 'rejected',
    providerType: 'sitter',
    rejectionReason: reason,
    documents: [],
    tasks: [],
    requiredDocuments: ['home_photos'],
    source: 'provider_applications',
  };
}

/**
 * Install the dev-mode localStorage flag + a synthetic i18n language preference
 * BEFORE the app boots. English is chosen so tests can key off stable ASCII
 * labels; the RTL Hebrew path is exercised indirectly by the same DOM ids
 * (`progress-dot-*`).
 */
export async function installDevAuth(page: Page) {
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem('petwash_dev_mode', 'true');
      window.localStorage.setItem('i18nextLng', 'en');
    } catch {
      /* private mode — the spec will fall to /signin and fail loudly */
    }
  });
}

/**
 * Route handler installer. Serves the supplied fixture for the /my endpoint
 * and returns a `setFixture` mutator so a test can flip the DTO between the
 * first and second fetch (e.g. simulate admin approval on refresh).
 *
 * The catch-all rule at the end is critical: without it every ambient poll
 * (whoami, notifications, feature flags) would either 404 or hit the real
 * backend, both of which pollute the run.
 */
export async function installApiRoutes(
  page: Page,
  initialFixture: AppFixture | { status: 404 } | null,
) {
  const state: { current: AppFixture | { status: 404 } | null } = {
    current: initialFixture,
  };

  await page.route('**/api/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    const method = req.method();

    // Primary target: applicant DTO. Serve fixture; 404 if the test asked for one.
    if (path === '/api/provider-applications/my' && method === 'GET') {
      const cur = state.current;
      if (!cur) {
        return route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'test fixture not installed' }),
        });
      }
      if ('status' in cur && cur.status === 404) {
        return route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'No application found' }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(cur),
      });
    }

    // Document upload endpoint — synthesise a 201 with the shape the client reads.
    if (path === '/api/provider-applications/my/documents' && method === 'POST') {
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          document: {
            id: 999,
            documentType: 'home_photos',
            fileName: 'uploaded.jpg',
            verificationStatus: 'pending',
          },
          allDocumentsUploaded: true,
        }),
      });
    }

    // Session probes — respond as authenticated dev user so ambient chrome
    // (headers, whoami-driven nav) does not race.
    if (/\/(auth\/session|session\/whoami|me|whoami)\b/.test(path)) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, uid: 'dev-user-12345', role: 'public' }),
      });
    }

    // CSRF token endpoint (POSTs would 403 without a token; we do not care
    // about the value in these tests but must respond promptly).
    if (path === '/api/csrf-token') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ token: 'test-csrf-token' }),
      });
    }

    // Everything else — safe empty. Keeps the app from hitting real services.
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, data: [], items: [] }),
    });
  });

  return {
    setFixture(next: AppFixture | { status: 404 } | null) {
      state.current = next;
    },
  };
}

/**
 * Wait for the pending page to have completed its first fetch (a specific
 * progress dot renders only after `appData` is set). Avoids racing the initial
 * loading spinner.
 */
export async function waitForPendingReady(page: Page) {
  await expect(page.getByTestId('progress-dot-documents_pending')).toBeVisible({
    timeout: 10_000,
  });
}

/** Convert an rgb(a) computed style string to [r,g,b] 0-255. */
export function parseRgb(css: string): [number, number, number] {
  const m = css.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (!m) throw new Error(`unrecognised colour: ${css}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

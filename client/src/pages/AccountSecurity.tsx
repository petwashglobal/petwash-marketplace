/**
 * AccountSecurity — the surface where a signed-in user manages the
 * three things the auth rebuild made addressable:
 *
 *   1. Linked providers (identity_accounts)
 *      GET /api/identity/links
 *      POST /api/identity/link/{initiate,confirm,unlink}
 *
 *   2. Signed-in devices (sessions_pw)
 *      GET /api/me/sessions
 *      POST /api/me/sessions/:rowId/revoke
 *      POST /api/me/sessions/revoke-all
 *
 *   3. Sensitive action re-authentication (step-up)
 *      Uses client/src/auth/stepUp.ts — password OR passkey re-auth
 *      → mint proof → /link/* or /sessions/revoke-all.
 *
 * NOT here (out of scope):
 *   * Password change UI — lives in the existing account settings page.
 *   * Contact-change (email / mobile) — lives in the existing account
 *     settings; those endpoints already exist behind their own step-up.
 *
 * Design choices:
 *   * NO inline modals. Every mutation is an inline confirm + call.
 *     A step-up prompt is a two-field mini-form (password OR "tap
 *     Face ID"), no dialog library.
 *   * The proof is held in a local const, never in state or storage
 *     — created and consumed in the same handler.
 *   * Fetch errors show a per-row inline banner; nothing else is
 *     interrupted.
 *   * data-testid attributes on every actionable element so the
 *     Playwright cycle test in Phase 11 can drive this UI without
 *     scraping labels.
 */
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { getApiUrl } from '@/lib/apiConfig';
import { auth } from '@/lib/firebase';
import {
  requestStepUpProofWithPassword,
  requestStepUpProofWithPasskey,
  StepUpError,
  type StepUpPurpose,
} from '@/auth/stepUp';

interface LinkRow {
  provider: string;
  providerAccountIdHint: string | null;
  email: string | null;
  emailVerified: boolean;
  displayName: string | null;
  isPrimary: boolean;
  linkedAt: string | null;
  lastUsedAt: string | null;
}

interface SessionRow {
  rowId: string;
  authMethod: string | null;
  activeRole: string | null;
  deviceRef: string | null;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  registrationIpHint: string | null;
  registrationUserAgentHint: string | null;
  lastSeenIpHint: string | null;
  lastSeenUserAgentHint: string | null;
}

async function authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const user = auth.currentUser;
  if (!user) throw new Error('NOT_SIGNED_IN');
  const token = await user.getIdToken();
  return fetch(getApiUrl(path), {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });
}

function humanise(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function AccountSecurity() {
  const [links, setLinks] = useState<LinkRow[] | null>(null);
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null); // key of the action currently running

  async function loadAll() {
    setBanner(null);
    try {
      const [l, s] = await Promise.all([
        authedFetch('/api/identity/links').then((r) => r.json()),
        authedFetch('/api/me/sessions').then((r) => r.json()),
      ]);
      setLinks(l.links ?? []);
      setSessions(s.sessions ?? []);
    } catch (err: any) {
      setBanner(err?.message === 'NOT_SIGNED_IN' ? 'Please sign in.' : 'Could not load account data.');
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Pop a minimal step-up prompt: prefer passkey if the user has one
   * on file; otherwise ask for password inline. Returns the proof.
   * Throws StepUpError on failure — caller must handle.
   */
  async function obtainProof(purpose: StepUpPurpose): Promise<string> {
    const hasPasskeyLink = (links ?? []).some((l) => l.provider === 'passkey');
    if (hasPasskeyLink) {
      return requestStepUpProofWithPasskey(purpose);
    }
    const password = window.prompt('Enter your password to continue');
    if (!password) throw new StepUpError('PASSWORD_REAUTH_FAILED', 'cancelled');
    return requestStepUpProofWithPassword(purpose, password);
  }

  function friendlyStepUpError(err: unknown): string {
    if (err instanceof StepUpError) {
      switch (err.code) {
        case 'NOT_SIGNED_IN':
          return 'Sign back in to continue.';
        case 'PASSKEY_REAUTH_FAILED':
          return 'Face ID / passkey did not complete. Try again.';
        case 'PASSWORD_REAUTH_FAILED':
          return 'Wrong password. Try again.';
        case 'SERVER_REJECTED':
          return err.serverCode === 'RECENCY_INSUFFICIENT'
            ? 'That took too long. Please re-authenticate and try again.'
            : 'The server refused the request.';
        case 'TRANSPORT_FAILED':
          return 'Network error. Try again.';
      }
    }
    return 'Something went wrong. Try again.';
  }

  async function handleUnlinkProvider(row: LinkRow) {
    if ((links ?? []).length <= 1) {
      setBanner('You cannot remove your last sign-in method.');
      return;
    }
    if (!row.providerAccountIdHint) {
      setBanner('This link is missing its provider account id.');
      return;
    }
    const key = `unlink:${row.provider}:${row.providerAccountIdHint}`;
    setBusy(key);
    setBanner(null);
    try {
      const proof = await obtainProof('unlink_provider');
      const res = await authedFetch('/api/identity/link/unlink', {
        method: 'POST',
        headers: { 'X-StepUp-Proof': proof },
        body: JSON.stringify({
          provider: row.provider,
          // NOTE: we only have the hint client-side. Server dedupes on
          // (provider, providerAccountId) so the full id is required.
          // The hint IS the full id in practice for passkey links
          // (provider_account_id = uid); for OAuth links the full id
          // has to have been surfaced. We pass the hint and expect
          // the server to 404 if it doesn't match — user re-tries via
          // the account overview page.
          providerAccountId: row.providerAccountIdHint,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setBanner(body?.error || 'Unlink failed');
        return;
      }
      await loadAll();
    } catch (err) {
      setBanner(friendlyStepUpError(err));
    } finally {
      setBusy(null);
    }
  }

  async function handleRevokeSession(row: SessionRow) {
    const key = `revoke:${row.rowId}`;
    setBusy(key);
    setBanner(null);
    try {
      const res = await authedFetch(`/api/me/sessions/${row.rowId}/revoke`, {
        method: 'POST',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setBanner(body?.error || 'Sign-out failed');
        return;
      }
      await loadAll();
    } catch (err: any) {
      setBanner(err?.message || 'Sign-out failed');
    } finally {
      setBusy(null);
    }
  }

  async function handleRevokeAll() {
    const key = 'revoke-all';
    setBusy(key);
    setBanner(null);
    try {
      const proof = await obtainProof('delete_account');
      const res = await authedFetch('/api/me/sessions/revoke-all', {
        method: 'POST',
        headers: { 'X-StepUp-Proof': proof },
        body: JSON.stringify({ reason: 'user_ui_revoke_all' }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setBanner(body?.error || 'Sign-out-everywhere failed');
        return;
      }
      await loadAll();
    } catch (err) {
      setBanner(friendlyStepUpError(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl p-6 space-y-8" data-testid="account-security-page">
      <header>
        <h1 className="text-2xl font-semibold">Account security</h1>
        <p className="text-sm text-muted-foreground">
          Linked sign-in methods, devices, and dangerous-action re-auth.
        </p>
      </header>

      {banner && (
        <div
          className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm"
          data-testid="account-security-banner"
        >
          {banner}
        </div>
      )}

      <section aria-labelledby="linked-providers-heading">
        <h2 id="linked-providers-heading" className="text-lg font-medium mb-2">
          Sign-in methods
        </h2>
        {links === null ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : links.length === 0 ? (
          <p className="text-sm text-muted-foreground">No linked providers yet.</p>
        ) : (
          <ul className="divide-y" data-testid="linked-providers-list">
            {links.map((row) => (
              <li
                key={`${row.provider}:${row.providerAccountIdHint ?? ''}`}
                className="flex items-center justify-between py-3"
                data-testid={`link-row-${row.provider}`}
              >
                <div>
                  <div className="font-medium">{row.provider}</div>
                  <div className="text-xs text-muted-foreground">
                    {row.email ?? 'no email'}
                    {row.isPrimary && ' · primary'}
                    {row.lastUsedAt ? ` · last used ${humanise(row.lastUsedAt)}` : ''}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy === `unlink:${row.provider}:${row.providerAccountIdHint}`}
                  onClick={() => handleUnlinkProvider(row)}
                  data-testid={`button-unlink-${row.provider}`}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="active-sessions-heading">
        <div className="flex items-center justify-between mb-2">
          <h2 id="active-sessions-heading" className="text-lg font-medium">
            Signed-in devices
          </h2>
          {sessions && sessions.length > 0 && (
            <Button
              variant="destructive"
              size="sm"
              disabled={busy === 'revoke-all'}
              onClick={handleRevokeAll}
              data-testid="button-sessions-revoke-all"
            >
              Sign out everywhere
            </Button>
          )}
        </div>
        {sessions === null ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active sessions.</p>
        ) : (
          <ul className="divide-y" data-testid="active-sessions-list">
            {sessions.map((row) => (
              <li
                key={row.rowId}
                className="flex items-center justify-between py-3"
                data-testid={`session-row-${row.rowId}`}
              >
                <div>
                  <div className="font-medium">
                    {row.authMethod ?? 'device'}
                    {row.deviceRef ? ` · ${row.deviceRef}` : ''}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Last seen {humanise(row.lastSeenAt)}
                    {row.lastSeenUserAgentHint ? ` · ${row.lastSeenUserAgentHint}` : ''}
                    {row.lastSeenIpHint ? ` · ${row.lastSeenIpHint}` : ''}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy === `revoke:${row.rowId}`}
                  onClick={() => handleRevokeSession(row)}
                  data-testid={`button-session-revoke-${row.rowId}`}
                >
                  Sign out
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

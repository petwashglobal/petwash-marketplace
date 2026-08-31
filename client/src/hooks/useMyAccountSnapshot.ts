/**
 * useMyAccountSnapshot — CEO P0-MY-ACCOUNT task #162 companion.
 *
 * PATCH mutation + fresh-read hook for the MyAccount page.
 * Complements useProfileCompleteness (which polls the same endpoint
 * but exposes the completeness projection).
 *
 * Discipline:
 *   • On PATCH success the mutation returns the server-persisted
 *     snapshot; the page renders THAT, never its own optimistic
 *     input (no false success).
 *   • On 409 UPDATE_PARTIAL_ROLLBACK_REQUIRED the outcome carries
 *     the snapshot the server DID persist so the client can render
 *     the partially-applied truth and surface a support CTA.
 *   • The mutation exposes an idle → saving → saved → error state
 *     the page renders as Saving.../Saved ✓.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export interface MyAccountSnapshot {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  emailVerified?: boolean;
  phone?: string | null;
  phoneVerified?: boolean;
  dateOfBirth?: string | null;
  language?: string | null;
  profileImageUrl?: string | null;
  address?: string | null;
  city?: string | null;
  postalCode?: string | null;
  country?: string | null;
}

export type DirectPatchField =
  | 'firstName' | 'lastName' | 'dateOfBirth' | 'language'
  | 'profileImageUrl' | 'address' | 'city' | 'postalCode' | 'country';

export type SnapshotOutcome =
  | { status: 'ok'; snapshot: MyAccountSnapshot }
  | { status: 'not_authenticated' }
  | { status: 'not_ready' }
  | { status: 'error' };

export type PatchOutcome =
  | { status: 'ok'; snapshot: MyAccountSnapshot; fannedOut: string[] }
  | { status: 'partial_rollback'; snapshot: MyAccountSnapshot; reasonCode: string }
  | { status: 'rejected'; reasonCode: string; fieldErrors?: Record<string, string> }
  | { status: 'not_authenticated' }
  | { status: 'error' };

export function useMyAccountSnapshot() {
  const q = useQuery<SnapshotOutcome>({
    queryKey: ['/api/me/profile', 'snapshot'],
    retry: false,
    staleTime: 20_000,
    queryFn: async () => {
      try {
        const res = await apiRequest('GET', '/api/me/profile');
        const body: any = await (res as Response).json();
        if (body?.snapshot) return { status: 'ok', snapshot: body.snapshot as MyAccountSnapshot };
        return { status: 'error' };
      } catch (err: any) {
        const code = err?.status ?? err?.response?.status;
        if (code === 401) return { status: 'not_authenticated' };
        if (code === 501) return { status: 'not_ready' };
        return { status: 'error' };
      }
    },
  });

  return {
    outcome: q.data,
    snapshot: q.data?.status === 'ok' ? q.data.snapshot : undefined,
    isLoading: q.isLoading,
    refetch: q.refetch,
  };
}

export function useMyAccountPatch() {
  const qc = useQueryClient();
  const m = useMutation<PatchOutcome, unknown, Partial<Record<DirectPatchField, string | null>>>({
    mutationFn: async (patch) => {
      try {
        const res = await apiRequest('/api/me/profile', { method: 'PATCH', body: patch });
        const body: any = await (res as Response).json();
        if (body?.snapshot && Array.isArray(body?.fannedOut)) {
          return { status: 'ok', snapshot: body.snapshot as MyAccountSnapshot, fannedOut: body.fannedOut };
        }
        return { status: 'error' };
      } catch (err: any) {
        const code = err?.status ?? err?.response?.status;
        const bodyErr: any = err?.body ?? {};
        if (code === 401) return { status: 'not_authenticated' };
        if (code === 409 && bodyErr?.error === 'UPDATE_PARTIAL_ROLLBACK_REQUIRED') {
          return { status: 'partial_rollback', snapshot: bodyErr.snapshot ?? {}, reasonCode: bodyErr.reasonCode ?? 'UNKNOWN' };
        }
        if (code === 400 && typeof bodyErr?.error === 'string') {
          return { status: 'rejected', reasonCode: bodyErr.error, fieldErrors: bodyErr.fieldErrors };
        }
        return { status: 'error' };
      }
    },
    onSuccess: () => {
      // Invalidate both the snapshot query and the completeness query
      // so the page + Attention feed re-render server truth in one
      // round-trip.
      qc.invalidateQueries({ queryKey: ['/api/me/profile'] });
    },
  });
  return {
    save: m.mutate,
    saveAsync: m.mutateAsync,
    isSaving: m.isPending,
    lastOutcome: m.data,
    reset: m.reset,
  };
}

/**
 * useProfileCompleteness — CEO P0-MY-ACCOUNT task #163.
 *
 * Client hook that fetches GET /api/me/profile and exposes:
 *   { profileState, missingFields, requiredActions[] }
 *
 * Every requiredAction carries a stable deepLinkCode the client
 * translates into the exact /my-account section route via
 * deepLinkForProfileAction — so the Attention CTA opens the
 * missing section, never a generic homepage.
 *
 * §72 discipline: outcome union distinguishes ok / not_authenticated
 * / error so the client renders honestly. When the server no
 * longer names a field, that Attention item disappears
 * automatically because the CompletenessOutcome no longer includes
 * a matching requiredAction.
 */
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export type ProfileState = 'COMPLETE' | 'INCOMPLETE';

export type MissingField =
  | 'firstName'
  | 'lastName'
  | 'email'
  | 'emailVerification'
  | 'mobile'
  | 'mobileVerification'
  | 'dateOfBirth'
  | 'language'
  | 'address'
  | 'termsAcceptance';

export type ProfileActionDeepLinkCode =
  | 'MY_ACCOUNT_PERSONAL'
  | 'MY_ACCOUNT_CONTACT_EMAIL'
  | 'MY_ACCOUNT_CONTACT_MOBILE'
  | 'MY_ACCOUNT_ADDRESS'
  | 'MY_ACCOUNT_PREFERENCES'
  | 'MY_ACCOUNT_TERMS';

export interface RequiredAction {
  code: string;                             // stable slug the UI translates
  deepLinkCode: ProfileActionDeepLinkCode;
}

export interface CompletenessOutcome {
  profileState: ProfileState;
  missingFields: MissingField[];
  requiredActions: RequiredAction[];
}

export type UseProfileCompletenessOutcome =
  | { status: 'ok'; completeness: CompletenessOutcome }
  | { status: 'not_authenticated' }
  | { status: 'not_ready' }                 // endpoint still returns 501 while effects wire lands
  | { status: 'error' };

/**
 * The Attention CTA / router uses this map to open the exact
 * section. If a new deepLinkCode is added on the server, adding it
 * here is what makes the client route to it — keeping the two
 * literally in sync stays a source-anchored regression pin.
 */
export function routeForProfileAction(code: ProfileActionDeepLinkCode): string {
  switch (code) {
    case 'MY_ACCOUNT_PERSONAL':        return '/my-account?section=personal';
    case 'MY_ACCOUNT_CONTACT_EMAIL':   return '/my-account?section=contact&change=email';
    case 'MY_ACCOUNT_CONTACT_MOBILE':  return '/my-account?section=contact&change=mobile';
    case 'MY_ACCOUNT_ADDRESS':         return '/my-account?section=address';
    case 'MY_ACCOUNT_PREFERENCES':     return '/my-account?section=preferences';
    case 'MY_ACCOUNT_TERMS':           return '/my-account?section=terms';
    // No default — an unknown code is a build error, not a runtime fallback.
  }
}

interface Options {
  enabled?: boolean;
  staleTimeMs?: number;
}

export function useProfileCompleteness(opts: Options = {}) {
  const enabled = Boolean(opts.enabled ?? true);
  const q = useQuery<UseProfileCompletenessOutcome>({
    queryKey: ['/api/me/profile'],
    enabled,
    retry: false,
    staleTime: opts.staleTimeMs ?? 30_000,
    queryFn: async () => {
      try {
        const res = await apiRequest('GET', '/api/me/profile');
        const body: any = await (res as Response).json();
        if (body && body.completeness && typeof body.completeness.profileState === 'string') {
          return { status: 'ok', completeness: body.completeness as CompletenessOutcome };
        }
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
    completeness: q.data?.status === 'ok' ? q.data.completeness : undefined,
    isLoading: q.isLoading,
    isError: q.isError,
    refetch: q.refetch,
  };
}

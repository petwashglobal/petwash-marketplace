/**
 * Lane A — Progressive signup UI shell.
 *
 * CEO FLY MODE II — AUTH CONVERSION P0 (2026-08-29).
 *
 * The ONE canonical progressive signup surface. Consumes:
 *   • client/src/lib/progressiveSignupState.ts — state machine.
 *   • GET /api/auth/account-resolution — server authority (§9).
 *
 * Rules (recap):
 *   • First screen: four buttons, nothing else. No DOB / name /
 *     password / consent UI before identity has been proven.
 *   • After each auth handshake succeeds and the server resolves the
 *     account, render ONE screen per requiredAction, in the server's
 *     order, with an explicit "N of M" progress cue.
 *   • Provider intent (returnTo / requestedService / firstTouch /
 *     authJourneyId) is passed through untouched — this shell never
 *     swallows query params.
 *
 * Scope of THIS commit (commit 3 on the Lane A branch):
 *   • Mount + state-machine driver + i18n-ready button labels.
 *   • Placeholder handlers for each method (real Firebase wiring
 *     lands in commit 4 alongside the personas.customerNew adapter
 *     extension).
 *   • Renders a stubbed message for AUTHENTICATING / CONTACT_VERIFY /
 *     ACCOUNT_RESOLUTION so the URL is testable even without live
 *     auth.
 *
 * Real Firebase / OTP / /api/auth/account-resolution wiring: commit 4.
 */
import { useEffect, useMemo, useReducer } from 'react';
import { useLocation } from 'wouter';
import {
  reduce,
  initialState,
  currentAction,
  progressLabel,
  type SignupState,
  type SignupEvent,
  type RequiredAction,
  type AccountResolution,
} from '@/lib/progressiveSignupState';

interface ProviderIntent {
  returnTo: string | null;
  requestedService: string | null;
  firstTouch: string | null;
  authJourneyId: string | null;
}

function useProviderIntent(): ProviderIntent {
  return useMemo(() => {
    const p = new URLSearchParams(window.location.search);
    return {
      returnTo: p.get('returnTo'),
      requestedService: p.get('requestedService'),
      firstTouch: p.get('firstTouch'),
      authJourneyId: p.get('authJourneyId'),
    };
  }, []);
}

/** Label for each requiredAction — kept static so screens are legible without live state. */
const ACTION_LABEL: Record<RequiredAction, { en: string; he: string }> = {
  mobile_verification: { en: 'Verify your mobile number', he: 'אימות מספר הנייד' },
  email_verification: { en: 'Verify your email', he: 'אימות כתובת האימייל' },
  first_name: { en: 'Your first name', he: 'שם פרטי' },
  last_name: { en: 'Your last name', he: 'שם משפחה' },
  date_of_birth: { en: 'Date of birth', he: 'תאריך לידה' },
  terms_acceptance: { en: 'Terms & Privacy', he: 'תנאי שימוש ופרטיות' },
};

interface RootProps {
  /**
   * Language toggle — pass 'he' for the Hebrew rendering. Kept as a
   * prop rather than an internal store so the harness can drive it.
   */
  language?: 'en' | 'he';
  /**
   * Test hook: when non-null, replaces the internal reducer with the
   * supplied one so a spec can inject a starting state. In production
   * this is undefined and the component uses the pure reducer.
   */
  initialStateOverride?: SignupState;
}

export default function SignUpProgressive({ language = 'en', initialStateOverride }: RootProps) {
  const intent = useProviderIntent();
  const [, navigate] = useLocation();
  const [state, dispatch] = useReducer(reduce, initialStateOverride ?? initialState);

  // Lane A — drives the network side of the state machine. The pure
  // reducer decides WHAT state we're in; this effect reacts to
  // transitions and fires the corresponding request. The Firebase
  // test adapter (tests/e2e/firebaseTestAdapter.ts) intercepts both
  // /api/auth/session and /api/auth/account-resolution so an E2E run
  // is fully deterministic.
  useEffect(() => {
    if (state.name !== 'AUTHENTICATING') return;
    // Detect the E2E test adapter shim (window.__FIREBASE_TEST_ADAPTER__).
    // When present, short-circuit real Firebase and mint the session
    // via the synthetic token — the harness route()-intercepts the
    // POST /api/auth/session call and returns the persona-shaped body.
    const shim = (typeof window !== 'undefined') && (window as any).__FIREBASE_TEST_ADAPTER__;
    const syntheticToken: string | null = shim?.enabled === true ? shim.syntheticIdToken : null;
    if (!syntheticToken) {
      // Real Firebase wiring lands in commit 6. For now we bail out
      // to METHOD_SELECTION on non-harness envs — the legacy /signup
      // continues to serve those users.
      dispatch({ kind: 'RESET' });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ idToken: syntheticToken }),
        });
        if (!res.ok || cancelled) {
          dispatch({ kind: 'RESET' });
          return;
        }
        dispatch({ kind: 'AUTH_SUCCESS' });
      } catch {
        if (!cancelled) dispatch({ kind: 'RESET' });
      }
    })();
    return () => { cancelled = true; };
  }, [state.name]);

  useEffect(() => {
    if (state.name !== 'ACCOUNT_RESOLUTION') return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/auth/account-resolution', {
          credentials: 'include',
        });
        if (!res.ok || cancelled) {
          dispatch({ kind: 'RESET' });
          return;
        }
        const resolution = (await res.json()) as AccountResolution;
        if (cancelled) return;
        dispatch({ kind: 'RESOLVED', resolution });
      } catch {
        if (!cancelled) dispatch({ kind: 'RESET' });
      }
    })();
    return () => { cancelled = true; };
  }, [state.name]);

  useEffect(() => {
    if (state.name !== 'ACTIVATION') return;
    // No network step required in the shell — the server marked the
    // account activated during the session exchange. Fire ACTIVATED
    // synchronously so the harness can watch the POST_LOGIN transition.
    dispatch({ kind: 'ACTIVATED' });
  }, [state.name]);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-start pt-16 px-6"
      dir={language === 'he' ? 'rtl' : 'ltr'}
      data-testid="signup-progressive-root"
      data-state={state.name}
    >
      <img
        src="/brand/petwash-logo-official.png"
        alt="PetWash"
        className="h-12 w-auto mb-8"
        decoding="async"
      />
      {state.name === 'METHOD_SELECTION' && (
        <MethodSelection language={language} dispatch={dispatch} />
      )}
      {(state.name === 'AUTHENTICATING' || state.name === 'CONTACT_VERIFY' ||
        state.name === 'ACCOUNT_RESOLUTION' || state.name === 'ACTIVATION') && (
        <TransientState language={language} state={state} />
      )}
      {state.name === 'PROFILE_COMPLETION' && (
        <ProfileCompletionScreen language={language} state={state} dispatch={dispatch} />
      )}
      {state.name === 'POST_LOGIN' && (
        <PostLogin destination={state.destination} navigate={navigate} dispatch={dispatch} />
      )}
      {state.name === 'DONE' && (
        <p data-testid="signup-progressive-done">✓</p>
      )}
      <IntentDebug intent={intent} />
    </div>
  );
}

// ─── Sub-screens ─────────────────────────────────────────────────────────

function MethodSelection({
  language,
  dispatch,
}: {
  language: 'en' | 'he';
  dispatch: (e: SignupEvent) => void;
}) {
  const he = language === 'he';
  const title = he ? 'צור חשבון PetWash' : 'Create your PetWash account';
  const already = he ? 'כבר יש לך חשבון?' : 'Already have an account?';
  const signIn = he ? 'התחבר' : 'Sign in';
  return (
    <div className="w-full max-w-md flex flex-col gap-3">
      <h1 className="text-2xl font-semibold text-center mb-4">{title}</h1>
      <button
        type="button"
        data-testid="cta-signin-google"
        data-action-id="signup-progressive-google"
        onClick={() => dispatch({ kind: 'CHOOSE_METHOD', method: 'google' })}
        className="w-full py-3 rounded-lg border font-medium"
      >
        {he ? 'המשך עם Google' : 'Continue with Google'}
      </button>
      <button
        type="button"
        data-testid="cta-signin-apple"
        data-action-id="signup-progressive-apple"
        onClick={() => dispatch({ kind: 'CHOOSE_METHOD', method: 'apple' })}
        className="w-full py-3 rounded-lg border font-medium"
      >
        {he ? 'המשך עם Apple' : 'Continue with Apple'}
      </button>
      <button
        type="button"
        data-testid="cta-signin-mobile"
        data-action-id="signup-progressive-mobile"
        onClick={() => dispatch({ kind: 'CHOOSE_METHOD', method: 'mobile' })}
        className="w-full py-3 rounded-lg border font-medium"
      >
        {he ? 'המשך עם נייד' : 'Continue with mobile'}
      </button>
      <button
        type="button"
        data-testid="cta-signin-email"
        data-action-id="signup-progressive-email"
        onClick={() => dispatch({ kind: 'CHOOSE_METHOD', method: 'email' })}
        className="w-full py-3 rounded-lg border font-medium"
      >
        {he ? 'המשך עם אימייל' : 'Continue with email'}
      </button>
      <p className="text-sm text-center mt-6 text-gray-600">
        {already}{' '}
        <a href="/signin" className="underline">
          {signIn}
        </a>
      </p>
    </div>
  );
}

function TransientState({
  language,
  state,
}: {
  language: 'en' | 'he';
  state: SignupState;
}) {
  const he = language === 'he';
  let text = '';
  if (state.name === 'AUTHENTICATING') text = he ? 'מתחבר…' : 'Signing in…';
  else if (state.name === 'CONTACT_VERIFY') text = he ? 'הזן את הקוד שנשלח' : 'Enter the code we sent';
  else if (state.name === 'ACCOUNT_RESOLUTION') text = he ? 'מכין את החשבון…' : 'Preparing your account…';
  else if (state.name === 'ACTIVATION') text = he ? 'מפעיל…' : 'Activating…';
  return (
    <p data-testid={`signup-progressive-transient-${state.name.toLowerCase()}`}>{text}</p>
  );
}

function ProfileCompletionScreen({
  language,
  state,
  dispatch,
}: {
  language: 'en' | 'he';
  state: SignupState;
  dispatch: (e: SignupEvent) => void;
}) {
  const he = language === 'he';
  const action = currentAction(state);
  const label = progressLabel(state);
  if (!action || !label) return null;
  const title = ACTION_LABEL[action][language];
  const nextLabel = label.current < label.total ? (he ? 'המשך' : 'Next') : (he ? 'סיים' : 'Finish');
  return (
    <div
      className="w-full max-w-md flex flex-col gap-4"
      data-testid={`signup-progressive-action-${action}`}
    >
      <p className="text-sm text-gray-500" data-testid="signup-progressive-progress">
        {label.current} {he ? 'מתוך' : 'of'} {label.total}
      </p>
      <h2 className="text-xl font-medium">{title}</h2>
      {/*
        Real form fields land in commit 4 alongside the Firebase test
        adapter personas.customerNew extension. The shell dispatches
        ACTION_COMPLETED on the Next button so the state machine can
        be exercised end-to-end without live data.
      */}
      <button
        type="button"
        data-testid="signup-progressive-next"
        onClick={() => dispatch({ kind: 'ACTION_COMPLETED' })}
        className="w-full py-3 rounded-lg border font-medium mt-6"
      >
        {nextLabel}
      </button>
    </div>
  );
}

function PostLogin({
  destination,
  navigate,
  dispatch,
}: {
  destination: string;
  navigate: (to: string) => void;
  dispatch: (e: SignupEvent) => void;
}) {
  // Fire the navigation on next tick so a test can observe the
  // POST_LOGIN state before we hand control back to the router.
  if (typeof queueMicrotask === 'function') {
    queueMicrotask(() => {
      navigate(destination || '/');
      dispatch({ kind: 'REACHED_DESTINATION' });
    });
  }
  return (
    <p data-testid="signup-progressive-postlogin" data-destination={destination}>
      →
    </p>
  );
}

function IntentDebug({ intent }: { intent: ProviderIntent }) {
  const anyIntent = intent.returnTo || intent.requestedService || intent.firstTouch || intent.authJourneyId;
  if (!anyIntent) return null;
  // Non-visible marker for E2E specs to assert intent survived the
  // whole flow without swallowing.
  return (
    <div
      hidden
      data-testid="signup-progressive-intent"
      data-return-to={intent.returnTo ?? ''}
      data-requested-service={intent.requestedService ?? ''}
      data-first-touch={intent.firstTouch ?? ''}
      data-auth-journey-id={intent.authJourneyId ?? ''}
    />
  );
}

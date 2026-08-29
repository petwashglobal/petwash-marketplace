/**
 * Lane A — Progressive signup UI shell pins.
 *
 * CEO FLY MODE II — AUTH CONVERSION P0 (2026-08-29).
 *
 * Locks the initial screen contract from CEO §19 — the first surface
 * a user sees is four buttons only. No name / DOB / password / consent
 * before identity is proven. Also locks the state machine wiring and
 * the intent-passthrough (§21) so provider intent survives the shell.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const ROOT = path.resolve(__dirname, '..', '..');

const SHELL = fs.readFileSync(
  path.resolve(ROOT, 'client', 'src', 'pages', 'SignUpProgressive.tsx'),
  'utf8',
);

const APP = fs.readFileSync(
  path.resolve(ROOT, 'client', 'src', 'App.tsx'),
  'utf8',
);

describe('CEO FLY MODE II §19 — signup first screen is FOUR buttons only', () => {
  it('MethodSelection renders exactly four continue buttons (google/apple/mobile/email)', () => {
    for (const method of ['google', 'apple', 'mobile', 'email']) {
      const attr = new RegExp(`data-testid="cta-signin-${method}"`);
      expect(SHELL).toMatch(attr);
      const actionId = new RegExp(`data-action-id="signup-progressive-${method}"`);
      expect(SHELL).toMatch(actionId);
    }
  });

  it('MethodSelection does NOT render name / DOB / password / consent fields on first screen', () => {
    // Locate the MethodSelection function body and scan it — any
    // input for name/DOB/password/consent in this pre-auth screen
    // violates the CEO §19 discipline.
    const idx = SHELL.indexOf('function MethodSelection');
    expect(idx).toBeGreaterThan(0);
    const nextFn = SHELL.indexOf('\nfunction ', idx + 1);
    const body = SHELL.slice(idx, nextFn > 0 ? nextFn : idx + 3000);
    // No <input …> tags at all in the MethodSelection screen.
    expect(body).not.toMatch(/<input\b/);
    // And no controlled `type="password"` etc. hidden somewhere.
    expect(body).not.toMatch(/type=["']password["']/);
    expect(body).not.toMatch(/type=["']date["']/);
  });

  it('each of the four buttons dispatches CHOOSE_METHOD with the matching method', () => {
    for (const method of ['google', 'apple', 'mobile', 'email']) {
      const pat = new RegExp(
        `dispatch\\(\\{[\\s\\S]{0,80}kind:\\s*'CHOOSE_METHOD',[\\s\\S]{0,80}method:\\s*'${method}'`,
      );
      expect(SHELL).toMatch(pat);
    }
  });
});

describe('CEO FLY MODE II §21 — provider intent passthrough', () => {
  it('shell reads returnTo / requestedService / firstTouch / authJourneyId from the URL', () => {
    for (const key of ['returnTo', 'requestedService', 'firstTouch', 'authJourneyId']) {
      expect(SHELL).toMatch(new RegExp(`p\\.get\\(['\\"]${key}['\\"]\\)`));
    }
  });

  it('shell exposes intent via a hidden data-testid marker (E2E can assert survival)', () => {
    expect(SHELL).toMatch(/data-testid="signup-progressive-intent"/);
    expect(SHELL).toMatch(/data-return-to=/);
    expect(SHELL).toMatch(/data-requested-service=/);
    expect(SHELL).toMatch(/data-first-touch=/);
    expect(SHELL).toMatch(/data-auth-journey-id=/);
  });

  it('the intent hydration is a useMemo — does not re-parse the URL on every render', () => {
    expect(SHELL).toMatch(/function useProviderIntent[\s\S]{0,120}useMemo\(\(\)/);
  });
});

describe('CEO FLY MODE II Lane A — state machine wiring', () => {
  it('shell drives the pure reducer from progressiveSignupState.ts', () => {
    expect(SHELL).toMatch(/from '@\/lib\/progressiveSignupState'/);
    expect(SHELL).toMatch(/useReducer\(reduce, initialStateOverride \?\? initialState\)/);
  });

  it('root element carries the current state name for E2E to observe', () => {
    // data-state="METHOD_SELECTION" etc. lets a Playwright spec wait
    // on state transitions without polling the DOM tree.
    expect(SHELL).toMatch(/data-testid="signup-progressive-root"/);
    expect(SHELL).toMatch(/data-state=\{state\.name\}/);
  });

  it('PROFILE_COMPLETION screen renders current action + progress label', () => {
    expect(SHELL).toMatch(/data-testid=\{`signup-progressive-action-\$\{action\}`\}/);
    expect(SHELL).toMatch(/data-testid="signup-progressive-progress"/);
    // Next button dispatches ACTION_COMPLETED so a spec can walk
    // through every requiredAction one screen at a time.
    expect(SHELL).toMatch(/dispatch\(\{ kind: 'ACTION_COMPLETED' \}\)/);
  });

  it('POST_LOGIN screen carries the server destination for the router to consume', () => {
    expect(SHELL).toMatch(/data-testid="signup-progressive-postlogin"/);
    expect(SHELL).toMatch(/data-destination=\{destination\}/);
  });
});

describe('CEO FLY MODE II Lane A — /signup-v2 route mount', () => {
  it('App.tsx mounts SignUpProgressive at /signup-v2 alongside legacy /signup', () => {
    expect(APP).toMatch(
      /const SignUpProgressive = lazy\(\(\) => import\("@\/pages\/SignUpProgressive"\)\)/,
    );
    expect(APP).toMatch(
      /<Route path="\/signup-v2">[\s\S]{0,400}<SignUpProgressive language=\{language\} \/>/,
    );
  });

  it('legacy /signup remains live (no accidental removal)', () => {
    // Until the E2E coverage lands, /signup keeps serving SignUpLuxury.
    expect(APP).toMatch(
      /<Route path="\/signup">[\s\S]{0,400}<SignUpLuxury/,
    );
  });
});

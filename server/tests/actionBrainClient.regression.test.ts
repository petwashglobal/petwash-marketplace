/**
 * client/src/lib/actionBrain.ts — source-anchored regression pin.
 *
 * Locks the shape of the client fetch helpers so a refactor that
 * silently drops the reason-code discipline (or double-generates the
 * idempotency key) is caught before it ships.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', '..', 'client', 'src', 'lib', 'actionBrain.ts'),
  'utf8',
);

describe('client actionBrain helpers (doctrine §41, §78, §98)', () => {
  it('exports listAvailableActions + executeAction + newIdempotencyKey', () => {
    expect(SRC).toMatch(/export async function listAvailableActions/);
    expect(SRC).toMatch(/export async function executeAction/);
    expect(SRC).toMatch(/export function newIdempotencyKey/);
  });

  it('endpoint paths match the server routes', () => {
    expect(SRC).toMatch(/\/api\/actions\/booking\/\$\{encodeURIComponent/);
    expect(SRC).toMatch(/\/api\/actions\/meet-greet\/\$\{encodeURIComponent/);
    expect(SRC).toMatch(/\/api\/actions\/prestige\/actions/);
    expect(SRC).toMatch(/\/api\/actions\/provider-application\/\$\{encodeURIComponent/);
    expect(SRC).toMatch(/\/api\/actions\/\$\{encodeURIComponent\(actionType\)\}\/execute/);
  });

  it('non-2xx responses map to ReasonCode-typed error — never raw error text (§78)', () => {
    // The helpers must return { ok: false, reasonCode } on non-ok.
    expect(SRC).toMatch(/reasonCode:\s*\([^)]*data\?\.reasonCode as ReasonCode\)/);
  });

  it('idempotency key is per-intent scope (doctrine §8)', () => {
    expect(SRC).toMatch(/scope:\s*['"]per-intent['"]/);
  });

  it('ExecuteActionBody does NOT contain impact / reauthProven / riskLevel / confirmationLevel (CEO §1, §2)', () => {
    // Client CANNOT declare its own security. If a refactor reintroduces
    // any of these fields, the server security model collapses.
    const idx = SRC.indexOf('interface ExecuteActionBody');
    const end = SRC.indexOf('}', idx);
    const body = SRC.slice(idx, end);
    expect(body).not.toMatch(/impact/);
    expect(body).not.toMatch(/reauthProven/);
    expect(body).not.toMatch(/riskLevel/);
    expect(body).not.toMatch(/confirmationLevel/);
  });

  it('rendering aids honour the doctrine: isProcessing, isRecoverableFailure, isStale', () => {
    expect(SRC).toMatch(/export function isTerminalSuccess/);
    expect(SRC).toMatch(/export function isProcessing/);
    expect(SRC).toMatch(/export function isRecoverableFailure/);
    expect(SRC).toMatch(/export function isStale/);
  });

  it('PAYMENT_UNCERTAIN treated as non-recoverable so the UI does NOT show "Pay Again" prematurely (§84)', () => {
    expect(SRC).toMatch(
      /result\.userMessage\.code\s*!==\s*['"]PAYMENT_UNCERTAIN['"]/,
    );
  });

  it('uses apiRequest (shared auth handshake), never bare fetch', () => {
    expect(SRC).toMatch(/apiRequest\(['"]GET['"],[\s\S]{0,200}pathFor/);
    expect(SRC).toMatch(/apiRequest\(['"]POST['"],[\s\S]{0,200}\/api\/actions/);
    // No bare fetch call.
    expect(SRC).not.toMatch(/\bfetch\(['"]/);
  });
});

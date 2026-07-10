/**
 * Lynx eReceipt (bay-transaction → fiscal receipt) — regression pin (2026-07-10).
 *
 * Verified against the Nayax Developer Portal (via MCP): a lastSales TransactionID
 * becomes its electronic receipt via
 *   POST /operational/v1/ereceipt/generate   (Bearer User Token, application/json)
 * → { ReceiptURL, EmailSent, EreceiptID }. This ties a bay sale to its receipt for
 * reconciliation. Two guardrails pinned here:
 *   1. Nayax's doc misspells the keys (`TrasactionID` / `TrasactionSiteID`); since we
 *      can't live-test (dark until token), we send BOTH spellings.
 *   2. The endpoint EMAILS the customer when `email` is passed — so the Tower route
 *      only emails on an explicit `sendEmail:true` opt-in, never on a plain pull.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const CLIENT = fs.readFileSync(path.resolve(__dirname, '..', 'services', 'LynxClient.ts'), 'utf8');
const ADMIN = fs.readFileSync(path.resolve(__dirname, '..', 'routes', 'admin-lynx.ts'), 'utf8');

describe('Lynx eReceipt (2026-07-10)', () => {
  it('generateEReceipt POSTs to the documented endpoint', () => {
    expect(CLIENT).toMatch(/export function generateEReceipt\(input: LynxEReceiptRequest\)/);
    expect(CLIENT).toMatch(/request\('POST', '\/operational\/v1\/ereceipt\/generate', body\)/);
    expect(CLIENT).toMatch(/generateEReceipt,/); // exported on LynxClient
  });

  it('sends BOTH the misspelled and correct transaction-id key spellings', () => {
    expect(CLIENT).toMatch(/TrasactionID: txId,/);     // documented (missing 'n')
    expect(CLIENT).toMatch(/TransactionID: txId,/);    // correct spelling
    expect(CLIENT).toMatch(/TrasactionSiteID: siteId,/);
    expect(CLIENT).toMatch(/TransactionSiteID: siteId,/);
  });

  it('only includes Email when explicitly provided (no accidental customer email)', () => {
    expect(CLIENT).toMatch(/\.\.\.\(input\.email \? \{ Email: input\.email \} : \{\}\)/);
  });

  it('Tower route requires the core fields and gates email behind sendEmail:true', () => {
    expect(ADMIN).toMatch(/router\.post\('\/ereceipt\/generate', \.\.\.requireSuperAdmin/);
    expect(ADMIN).toMatch(/req\.body\?\.sendEmail === true && typeof req\.body\?\.email === 'string'/);
    expect(ADMIN).toMatch(/ADMIN_LYNX_ERECEIPT_GENERATE/);
    expect(ADMIN).toMatch(/transactionId, transactionDateTime, siteId, machineId are required/);
  });
});

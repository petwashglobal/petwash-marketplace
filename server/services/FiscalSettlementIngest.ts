/**
 * Settlement source ingestion — the B and D layers (migration 0150).
 *
 * B  Nayax reimbursement statement (XML) — what Nayax says it collected/paid
 * D  Bank statement (CSV)               — whether the money actually arrived
 *
 * A bank API or automated feed would be better. Until one exists a controlled
 * import is the honest mechanism — but it must be an IMPORT WITH PROVENANCE,
 * not a number someone types into a report. Every row records the file it came
 * from, that file's sha256, who imported it and when.
 *
 * ── WHY D MATTERS MOST ──────────────────────────────────────────────────────
 * A, B and MoMa are all Nayax's own data. Comparing them is a real
 * internal-consistency check, but it cannot prove cash: if Nayax's figures were
 * wrong, all three would agree. The bank is the only source Nayax does not
 * control, which is why a month without D stays PENDING_BANK.
 *
 * ── RULES ───────────────────────────────────────────────────────────────────
 *   • Append-only. An imported row is evidence of what a source said, never
 *     edited to make a reconciliation agree. A corrected file is a new import
 *     and both stay visible.
 *   • Deduped on CONTENT, so re-importing a file, or importing two overlapping
 *     exports, cannot double-count — double-counting would make a shortfall
 *     look reconciled, which is the worst possible failure here.
 *   • Parses and stores. It classifies nothing it does not recognise and
 *     computes no accounting outcome.
 */

import { createHash } from 'node:crypto';
import { pool, isDatabaseAvailable } from '../db';
import { logger } from '../lib/logger';

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
const toMinor = (major: number) => Math.round(major * 100);

export interface ImportResult {
  inserted: number;
  duplicates: number;
  rejected: Array<{ line: number; reason: string }>;
  fileSha256: string;
}

// ── D: BANK CSV ─────────────────────────────────────────────────────────────

/** One parsed credit, before it is stored. */
interface ParsedCredit {
  valueDate: string;      // YYYY-MM-DD
  amountMinor: number;
  currency: string;
  narrative: string;
  bankReference?: string;
}

/**
 * Amount parsing for Israeli bank exports: thousands separators, a currency
 * symbol, a trailing or leading minus, and accounting parentheses.
 * A blank credit cell means "this row is not a credit" — different from zero.
 */
export function parseAmountMinor(cell: string | undefined): number | null {
  if (cell === undefined || cell === null) return null;
  let s = String(cell).replace(/[​-‏﻿]/g, '').trim();
  if (s === '' || s === '-' || s === '—') return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  s = s.replace(/[₪$€£]/g, '').replace(/,/g, '').replace(/\s/g, '');
  if (s.endsWith('-')) { neg = true; s = s.slice(0, -1); }
  if (s.startsWith('-')) { neg = true; s = s.slice(1); }
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return toMinor(neg ? -n : n);
}

/**
 * Date normalisation. An AMBIGUOUS date is REFUSED, never guessed: putting a
 * credit in the wrong month is exactly the error a reconciliation is supposed
 * to catch, so the importer must not create one.
 */
export function parseValueDate(cell: string | undefined): string | null {
  if (!cell) return null;
  const s = String(cell).replace(/[​-‏﻿]/g, '').trim();
  if (!s) return null;
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})/.exec(s);
  if (m) {
    const d = Number(m[1]); let mo = Number(m[2]); let y = Number(m[3]);
    if (y < 100) y += 2000;
    if (mo > 12) return null;           // not a readable DD/MM
    if (d > 31) return null;
    return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  return null;
}

const NARRATIVE_KEYS = ['תיאור', 'תאור', 'פירוט', 'description', 'details', 'narrative'];
const DATE_KEYS = ['תאריך ערך', 'value date', 'תאריך'];
const CREDIT_KEYS = ['זכות', 'credit', 'money in'];
const REF_KEYS = ['אסמכתא', 'אסמכתה', 'reference', 'ref'];

const norm = (s: string) => s.replace(/[​-‏﻿]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
const findCol = (headers: string[], keys: string[]) => {
  for (const k of keys) {
    const i = headers.findIndex((h) => norm(h) === norm(k));
    if (i >= 0) return i;
  }
  for (const k of keys) {
    const i = headers.findIndex((h) => norm(h).includes(norm(k)));
    if (i >= 0) return i;
  }
  return -1;
};

/** Minimal RFC4180 splitter — quoted fields, embedded commas and newlines. */
function splitCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = []; let cell = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += c;
      continue;
    }
    if (c === '"') { q = true; continue; }
    if (c === ',') { row.push(cell); cell = ''; continue; }
    if (c === '\r') continue;
    if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; continue; }
    cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

export function parseBankCsv(text: string): { credits: ParsedCredit[]; rejected: ImportResult['rejected'] } {
  const rows = splitCsv(text).filter((r) => r.some((c) => c.trim() !== ''));
  const rejected: ImportResult['rejected'] = [];

  // Banks prepend account/branch preamble, so find the real header row.
  let hi = -1; let headers: string[] = [];
  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    const h = rows[i].map((x) => x.trim());
    if (findCol(h, DATE_KEYS) >= 0 && findCol(h, CREDIT_KEYS) >= 0) { hi = i; headers = h; break; }
  }
  if (hi === -1) {
    return { credits: [], rejected: [{ line: 1, reason: 'no header row with a date column and a credit column' }] };
  }

  const iDate = findCol(headers, DATE_KEYS);
  const iCredit = findCol(headers, CREDIT_KEYS);
  const iNarr = findCol(headers, NARRATIVE_KEYS);
  const iRef = findCol(headers, REF_KEYS);

  const credits: ParsedCredit[] = [];
  for (let r = hi + 1; r < rows.length; r++) {
    const cell = (i: number) => (i >= 0 && i < rows[r].length ? String(rows[r][i] ?? '').trim() : '');
    const amount = parseAmountMinor(cell(iCredit));
    if (amount === null) continue;             // debit or blank — not a credit
    if (amount <= 0) continue;                  // money out
    const rawDate = cell(iDate);
    const date = parseValueDate(rawDate);
    if (!date) {
      // Distinguish STRUCTURALLY, not by looking for the word "total".
      //   • date cell EMPTY  → not a transaction row at all (footer, subtotal,
      //     spacer). Skip silently; flagging these trains the operator to
      //     ignore the rejected list, which is where real problems appear.
      //   • date cell PRESENT but unreadable → a row that IS a transaction and
      //     whose period we cannot establish. Never dropped: a credit landing
      //     in the wrong month is the error reconciliation exists to catch.
      if (rawDate !== '') {
        rejected.push({ line: r + 1, reason: `unreadable or ambiguous value date "${rawDate}" on a row carrying a credit` });
      }
      continue;
    }
    credits.push({
      valueDate: date, amountMinor: amount, currency: 'ILS',
      narrative: cell(iNarr), bankReference: cell(iRef) || undefined,
    });
  }
  return { credits, rejected };
}

/** Import bank credits. Idempotent: the same file twice inserts nothing new. */
export async function importBankStatement(args: {
  csv: string; fileName: string; importedBy: string;
}): Promise<ImportResult> {
  if (!isDatabaseAvailable) throw new Error('importBankStatement: no DATABASE_URL');
  const fileSha256 = sha256(args.csv);
  const { credits, rejected } = parseBankCsv(args.csv);

  let inserted = 0; let duplicates = 0;
  for (const c of credits) {
    // Content fingerprint — the same credit however many times it is imported.
    const contentHash = sha256([c.valueDate, c.amountMinor, c.currency, norm(c.narrative), c.bankReference ?? ''].join('|'));
    const res = await pool.query(
      `INSERT INTO fiscal_bank_credits
         (value_date, amount_minor, currency, narrative, bank_reference,
          source_file, source_sha256, imported_by, content_hash)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (content_hash) DO NOTHING
       RETURNING id`,
      [c.valueDate, c.amountMinor, c.currency, c.narrative, c.bankReference ?? null,
       args.fileName, fileSha256, args.importedBy, contentHash],
    );
    if (res.rowCount) inserted++; else duplicates++;
  }

  logger.info('[FiscalIngest] bank statement imported', {
    file: args.fileName, sha: fileSha256.slice(0, 12),
    parsed: credits.length, inserted, duplicates, rejected: rejected.length,
  });
  return { inserted, duplicates, rejected, fileSha256 };
}

// ── B: NAYAX STATEMENT XML ──────────────────────────────────────────────────

/**
 * Import a Nayax reimbursement statement. The typed-line classification lives
 * with the parser; anything it could not recognise is counted here, because a
 * statement carrying an unclassified line cannot close a month.
 */
export async function importNayaxStatement(args: {
  parsed: {
    periodMonth?: string; periodStart?: string; periodEnd?: string; payoutDate?: string;
    grossCollected: number; totalWithheld: number; total: number;
    fees: unknown[]; deductions: unknown[];
    unclassified: Array<{ label: string; amount: number; comment?: string }>;
  };
  fileName: string; fileText: string; importedBy: string;
}): Promise<{ period: string; unclassified: number; fileSha256: string; inserted: boolean }> {
  if (!isDatabaseAvailable) throw new Error('importNayaxStatement: no DATABASE_URL');
  const p = args.parsed;
  if (!p.periodMonth) throw new Error('importNayaxStatement: statement carries no period — refusing to store it under a guessed month');
  const fileSha256 = sha256(args.fileText);

  const res = await pool.query(
    `INSERT INTO fiscal_nayax_statements
       (period, period_start, period_end, payout_date,
        gross_collected_minor, withheld_minor, total_minor,
        lines, unclassified_count, source_file, source_sha256, imported_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12)
     ON CONFLICT (period, source_sha256) DO NOTHING
     RETURNING id`,
    [
      p.periodMonth, p.periodStart ?? null, p.periodEnd ?? null, p.payoutDate ?? null,
      toMinor(p.grossCollected), toMinor(p.totalWithheld), toMinor(p.total),
      JSON.stringify({ fees: p.fees, deductions: p.deductions, unclassified: p.unclassified }),
      p.unclassified.length, args.fileName, fileSha256, args.importedBy,
    ],
  );

  logger.info('[FiscalIngest] Nayax statement imported', {
    period: p.periodMonth, total: p.total, unclassified: p.unclassified.length,
    inserted: !!res.rowCount,
  });
  return { period: p.periodMonth, unclassified: p.unclassified.length, fileSha256, inserted: !!res.rowCount };
}

// ── B↔D: the only independent cash control ──────────────────────────────────

export type BankVerdict = 'MATCHED_EXACT' | 'MATCHED_SPLIT' | 'AMBIGUOUS' | 'NO_CREDIT' | 'NO_STATEMENT';

export interface BankMatch {
  verdict: BankVerdict;
  statementTotalMinor: number | null;
  matchedMinor: number;
  candidates: Array<{ date: string; amountMinor: number; narrative: string }>;
  detail: string;
}

const NAYAX_NARRATIVES = ['nayax', 'נייאקס', 'ניאקס'];

/**
 * Match a period's statement payout against imported bank credits.
 *
 * Built for how settlement really behaves, not for one row on the stated date:
 * a date window, an exact single credit, and a SPLIT payout summed across
 * credits. When neither fits it returns AMBIGUOUS with the candidates — it
 * never picks the nearest equal amount, because a credit combining several
 * periods looks exactly like a near miss, and "close enough" is how a shortfall
 * gets signed off.
 */
export async function matchBankForPeriod(period: string, windowDays = 7): Promise<BankMatch> {
  if (!isDatabaseAvailable) throw new Error('matchBankForPeriod: no DATABASE_URL');

  const { rows: stmts } = await pool.query(
    `SELECT total_minor, payout_date FROM fiscal_nayax_statements
      WHERE period = $1 ORDER BY imported_at DESC LIMIT 1`, [period]);
  if (!stmts.length) {
    return { verdict: 'NO_STATEMENT', statementTotalMinor: null, matchedMinor: 0, candidates: [],
      detail: `no Nayax statement imported for ${period} — nothing to match the bank against` };
  }
  const target = Number(stmts[0].total_minor);
  const payout: Date | null = stmts[0].payout_date;

  // A NEGATIVE statement total means Nayax charged rather than paid. There is
  // no incoming credit to find, and looking for one would be a false negative.
  if (target <= 0) {
    return { verdict: 'MATCHED_EXACT', statementTotalMinor: target, matchedMinor: 0, candidates: [],
      detail: `statement total is ${(target / 100).toFixed(2)} — Nayax CHARGED rather than paid, so no bank credit is expected` };
  }

  const { rows: credits } = await pool.query(
    `SELECT value_date, amount_minor, narrative FROM fiscal_bank_credits
      WHERE ($1::date IS NULL OR value_date BETWEEN $1::date - ($2 || ' days')::interval
                                              AND $1::date + ($2 || ' days')::interval)
      ORDER BY value_date`,
    [payout, String(windowDays)]);

  const cand = credits.map((c: { value_date: Date; amount_minor: string; narrative: string }) => ({
    date: new Date(c.value_date).toISOString().slice(0, 10),
    amountMinor: Number(c.amount_minor),
    narrative: c.narrative ?? '',
  }));
  const nayaxish = cand.filter((c) => NAYAX_NARRATIVES.some((n) => c.narrative.toLowerCase().includes(n)));
  const pool_ = nayaxish.length ? nayaxish : cand;

  if (!pool_.length) {
    return { verdict: 'NO_CREDIT', statementTotalMinor: target, matchedMinor: 0, candidates: [],
      detail: `Nayax states it paid ${(target / 100).toFixed(2)} but no bank credit appears within ±${windowDays} days of ${payout ? new Date(payout).toISOString().slice(0, 10) : 'the payout date'}` };
  }
  const exact = pool_.find((c) => c.amountMinor === target);
  if (exact) {
    return { verdict: 'MATCHED_EXACT', statementTotalMinor: target, matchedMinor: exact.amountMinor,
      candidates: [exact], detail: `single credit on ${exact.date} matches exactly` };
  }
  const sum = pool_.reduce((s, c) => s + c.amountMinor, 0);
  if (pool_.length > 1 && sum === target) {
    return { verdict: 'MATCHED_SPLIT', statementTotalMinor: target, matchedMinor: sum,
      candidates: pool_, detail: `${pool_.length} credits in the window sum to the stated payout (split settlement)` };
  }
  return {
    verdict: 'AMBIGUOUS', statementTotalMinor: target, matchedMinor: sum, candidates: pool_,
    detail: `no exact single or summed match for ${(target / 100).toFixed(2)}. `
      + `A credit combining several periods looks exactly like this — needs a human, not the nearest amount.`,
  };
}

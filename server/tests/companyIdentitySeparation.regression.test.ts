/**
 * Pet Wash Ltd's LEGAL company number vs SUMIT's INTERNAL workspace id.
 *
 * These are two unrelated numbers and confusing them would put a meaningless
 * platform routing value on a legal tax document as though it identified the
 * business:
 *
 *   517145033    ח.פ. — Pet Wash Ltd's Israeli company registration number.
 *                The identity of the ISSUING BUSINESS on every legal document.
 *   1455151432   SUMIT's internal id for the Pet Wash workspace. Tells SUMIT
 *                which account an API request belongs to. No legal meaning.
 *                Never printed, never shown to a customer.
 *
 * The SUMIT API key is likewise a platform credential, not a business identity.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  COMPANY_TAX_ID, COMPANY_NAME_HE, COMPANY_NAME_EN,
  SUMIT_INTERNAL_COMPANY_ID_NOT_A_TAX_ID,
} from '@shared/israel-compliance-config';

const SUMIT_WORKSPACE_ID = '1455151432';
const repo = (...p: string[]) => path.resolve(__dirname, '..', '..', ...p);

describe('company identity — legal number vs SUMIT workspace id', () => {
  it('pins the legal Israeli company number', () => {
    expect(COMPANY_TAX_ID).toBe('517145033');
    expect(COMPANY_NAME_HE).toBe('פט וואש בע"מ');
    expect(COMPANY_NAME_EN).toBe('PET WASH LTD');
  });

  it('never lets the SUMIT workspace id become the legal number', () => {
    expect(COMPANY_TAX_ID).not.toBe(SUMIT_WORKSPACE_ID);
    expect(SUMIT_INTERNAL_COMPANY_ID_NOT_A_TAX_ID).toBe(SUMIT_WORKSPACE_ID);
    expect(SUMIT_INTERNAL_COMPANY_ID_NOT_A_TAX_ID).not.toBe(COMPANY_TAX_ID);
  });

  // The workspace id is an API routing value. It has no business appearing in
  // anything that renders to a customer or onto a document.
  it('keeps the SUMIT workspace id out of document- and customer-facing code', () => {
    const roots = ['shared', 'client/src'];
    const offenders: string[] = [];
    const walk = (dir: string) => {
      let entries: fs.Dirent[];
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
      for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) { if (e.name !== 'node_modules') walk(full); continue; }
        if (!/\.(ts|tsx|js|jsx)$/.test(e.name)) continue;
        const src = fs.readFileSync(full, 'utf8');
        if (!src.includes(SUMIT_WORKSPACE_ID)) continue;
        // The one sanctioned mention is the guard constant that exists precisely
        // so this separation can be asserted.
        if (src.includes('SUMIT_INTERNAL_COMPANY_ID_NOT_A_TAX_ID')) continue;
        offenders.push(path.relative(repo(), full));
      }
    };
    roots.forEach((r) => walk(repo(r)));
    expect(offenders, `SUMIT workspace id leaked into: ${offenders.join(', ')}`).toEqual([]);
  });

  // Reading the workspace id from env is correct; hardcoding the LEGAL number as
  // a SUMIT credential, or vice versa, is not.
  it('never uses the legal company number as a SUMIT API credential', () => {
    const client = fs.readFileSync(repo('server/services/SumitClient.ts'), 'utf8');
    const credLines = client.split('\n')
      .filter((l) => /CompanyID|companyId/.test(l) && l.includes(COMPANY_TAX_ID));
    expect(credLines, `legal number used as SUMIT CompanyID: ${credLines.join(' | ')}`).toEqual([]);
  });
});

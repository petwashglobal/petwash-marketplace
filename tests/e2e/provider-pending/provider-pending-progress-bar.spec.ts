/**
 * Purely visual progress-bar coverage. Regression this file locks in:
 *
 *   The original code used `bg-white` for inactive dots + connectors on a
 *   white Card background — they were literally invisible. The fix swapped
 *   both to `bg-gray-200`. This spec asserts:
 *     - all 4 dots render (data-testid contract)
 *     - all 4 labels render
 *     - 3 connectors render (dots minus one)
 *     - inactive dot computed background differs from the Card background
 *       and clears a distinguishability threshold
 *
 * On WCAG: 3:1 is the AA bar for non-text UI components. gray-200 (#e5e7eb)
 * on white (#fff) computes to ~1.19:1, so a strict WCAG-AA assertion would
 * FAIL the current design — the fix intentionally chose a subtle grey.
 * We therefore assert the concrete regression ("not the same colour as the
 * card") + a floor above 1.15:1, which fails cleanly if anyone reverts to
 * bg-white (ratio 1.0) or picks a near-white shade.
 */

import { test, expect } from '@playwright/test';
import {
  BASE_URL,
  bridgeSitterDocumentsPending,
  installApiRoutes,
  installDevAuth,
  waitForPendingReady,
  parseRgb,
} from './_helpers';

test.describe.configure({ mode: 'parallel' });

test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
});

// Relative luminance per WCAG 2.x.
function luminance([r, g, b]: [number, number, number]): number {
  const chan = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b);
}

function contrastRatio(a: [number, number, number], b: [number, number, number]): number {
  const l1 = luminance(a);
  const l2 = luminance(b);
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

test.describe('/provider/pending — progress bar visual contract', () => {
  test('4 dots, 4 labels, 3 connectors — all in the DOM', async ({ page }) => {
    await installDevAuth(page);
    await installApiRoutes(page, bridgeSitterDocumentsPending());

    await page.goto(`${BASE_URL}/provider/pending`, { waitUntil: 'domcontentloaded' });
    await waitForPendingReady(page);

    const expectedStages = [
      'documents_pending',
      'documents_under_review',
      'background_check_pending',
      'approved',
    ] as const;

    // Exactly 4 dots — the old code accidentally rendered them twice (once
    // labelled, once with connectors). A DOM count regression would flag that
    // duplication returning.
    for (const stage of expectedStages) {
      await expect(page.getByTestId(`progress-dot-${stage}`)).toHaveCount(1);
    }

    // Text label per dot. English labels because the helper pins i18n to en.
    for (const label of ['Docs', 'Review', 'Background', 'Approved']) {
      await expect(page.getByText(label, { exact: true })).toBeVisible();
    }

    // Connectors: the dot component renders each dot as a flex row with a
    // trailing 0.5-tall bar between siblings. We count them via the same
    // ancestor scope so unrelated `h-0.5` bars elsewhere on the page do not
    // pollute the count.
    const firstDot = page.getByTestId(`progress-dot-${expectedStages[0]}`);
    const barContainer = firstDot.locator('xpath=ancestor::*[contains(@class,"py-1")][1]');
    const connectors = barContainer.locator('div.h-0\\.5');
    await expect(connectors).toHaveCount(3);
  });

  test('inactive dot is NOT the card background colour (bg-white regression guard)', async ({ page }) => {
    await installDevAuth(page);
    await installApiRoutes(page, bridgeSitterDocumentsPending());

    await page.goto(`${BASE_URL}/provider/pending`, { waitUntil: 'domcontentloaded' });
    await waitForPendingReady(page);

    // The last dot ("approved") is always inactive on a documents_pending
    // fixture — perfect probe for the "invisible on white" bug.
    const inactive = page.getByTestId('progress-dot-approved');
    const inactiveBg = await inactive.evaluate(
      (el) => getComputedStyle(el as Element).backgroundColor,
    );

    // The Card is bg-white; sample its computed colour so we compare like-for-like
    // even if the theme layer ever changes what "white" is.
    const cardBg = await page.evaluate(() => {
      const card = document.querySelector('[class*="bg-white"]');
      return card ? getComputedStyle(card).backgroundColor : 'rgb(255, 255, 255)';
    });

    const dotRgb = parseRgb(inactiveBg);
    const cardRgb = parseRgb(cardBg);

    // Concrete regression guard: dot must NOT be identical to the card fill
    // (that was the exact bug — bg-white on bg-white → invisible).
    expect(
      dotRgb.join(','),
      `inactive dot bg (${inactiveBg}) must differ from card bg (${cardBg})`,
    ).not.toBe(cardRgb.join(','));

    // Distinguishability floor. See file header for the WCAG discussion —
    // gray-200 on white is ~1.19:1. Threshold set below that but above the
    // bg-white bug (1.00:1) so a revert fails cleanly.
    const ratio = contrastRatio(dotRgb, cardRgb);
    expect(
      ratio,
      `inactive dot vs card contrast ratio was ${ratio.toFixed(3)}`,
    ).toBeGreaterThan(1.15);
  });

  test('active dot uses the amber fill (positive control)', async ({ page }) => {
    await installDevAuth(page);
    await installApiRoutes(page, bridgeSitterDocumentsPending());

    await page.goto(`${BASE_URL}/provider/pending`, { waitUntil: 'domcontentloaded' });
    await waitForPendingReady(page);

    const active = page.getByTestId('progress-dot-documents_pending');
    const bg = await active.evaluate(
      (el) => getComputedStyle(el as Element).backgroundColor,
    );

    // Tailwind's amber-500 is rgb(245, 158, 11). Small tolerance for browser
    // colour-management differences.
    const [r, g, b] = parseRgb(bg);
    expect(Math.abs(r - 245)).toBeLessThan(6);
    expect(Math.abs(g - 158)).toBeLessThan(6);
    expect(Math.abs(b - 11)).toBeLessThan(6);
  });
});

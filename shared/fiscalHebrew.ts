/**
 * Hebrew wording for Israeli fiscal documents — one source of truth.
 *
 * CEO, 2026-09-19: "hebrew wrong fix now legal hebrew not google vtranslate",
 * "invoices and cards not legal enough".
 *
 * The document templates themselves were written in correct, formal Hebrew
 * (חשבונית מס / קבלה, מוכר / נותן השירות, מחיר לפני מע"מ …). What was wrong was
 * the DATA poured into them: each call site passed its own free-text payment
 * method, in English, and the Hebrew tax document printed it verbatim:
 *
 *   אמצעי תשלום: Credit card            (academy, walk-my-pet)
 *   אמצעי תשלום: PetWash Wallet         (prestige-pass, academy wallet)
 *   אמצעי תשלום: Credit Card (SUMIT)    (guest e-gift)
 *   אמצעי תשלום: credit_card            (payments-sumit, shop)  ← a raw DB enum
 *
 * A tax document that mixes languages, or shows a column name with an
 * underscore, is not a document a bookkeeper or the ITA should ever receive.
 *
 * Normalising at the DOCUMENT layer rather than at each call site means every
 * existing value — and any new one a future call site invents — lands correct,
 * with no coordinated change across seven routes.
 *
 * BRAND RULE: product names stay English inside Hebrew text (PetWash, Nayax,
 * SUMIT, Bit). Only the ordinary noun around them is translated — so a wallet
 * payment reads "ארנק PetWash", never "פטוואש וולט".
 */

/** Everything the codebase has ever passed as a payment method, normalised. */
const PAYMENT_METHOD_HE: ReadonlyArray<{ match: RegExp; he: string }> = [
  // Wallet first: "PetWash Wallet" also contains "wallet", and the brand form wins.
  { match: /wallet|ארנק/i,                       he: 'ארנק PetWash' },
  { match: /bank[\s_-]?transfer|העברה/i,         he: 'העברה בנקאית' },
  { match: /cash|מזומן/i,                        he: 'מזומן' },
  { match: /\bbit\b/i,                           he: 'ביט' },
  { match: /apple[\s_-]?pay/i,                   he: 'Apple Pay' },
  { match: /google[\s_-]?pay/i,                  he: 'Google Pay' },
  { match: /nayax/i,                             he: 'Nayax' },
  // Card last — the broadest pattern, and the most common value.
  { match: /credit|card|כרטיס|אשראי/i,           he: 'כרטיס אשראי' },
];

/**
 * The Hebrew wording for a payment method, for a Hebrew fiscal document.
 *
 * Unknown values are returned unchanged rather than guessed at: inventing a
 * Hebrew name for a method we do not recognise would put a wrong statement on
 * a tax document, which is worse than an untranslated one.
 */
export function paymentMethodHe(raw: string | null | undefined): string {
  const value = (raw ?? '').trim();
  if (!value) return 'לא צוין';
  for (const { match, he } of PAYMENT_METHOD_HE) {
    if (match.test(value)) return he;
  }
  return value;
}

/** Every Hebrew wording this module can produce — for tests and review. */
export const PAYMENT_METHOD_HE_VALUES = [
  ...PAYMENT_METHOD_HE.map((e) => e.he),
  'לא צוין',
] as const;

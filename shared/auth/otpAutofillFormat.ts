/**
 * OtpAutofillFormat — CEO OTP brief §7 (task #183).
 *
 * Doctrine: "Configure SMS formatting correctly so iOS / Android
 * can recognise the OTP and offer the code above the keyboard.
 * The customer should normally be able to tap the suggested code
 * rather than manually copying it."
 *
 * Two mobile-OS autofill contracts:
 *
 *   iOS Password AutoFill (built into iOS 12+)
 *     Heuristic. Recognises 4-8 digit codes in the SMS body when
 *     the code appears NEAR the words "code" / "passcode" /
 *     equivalents in localised languages, and Safari has a paired
 *     input.mode="one-time-code" / autocomplete="one-time-code"
 *     field. Apple also supports a "domain-bound" format:
 *         @example.com #123456
 *     which appears at the END of the message and binds the code
 *     to the domain, but that is optional. Our template must at
 *     minimum keep the 6-digit code visible in the body.
 *
 *   Android SMS Retriever API
 *     Deterministic. The SMS body MUST end with a hash line:
 *         <#> Your Pet Wash code is 123456\n<11-char app hash>
 *     Google Play Services surfaces the code when it sees the
 *     leading "<#>" sigil AND the 11-char app hash matches the
 *     APK signature. Without both, no autofill.
 *
 * This file is a PURE evaluator over an already-rendered SMS body
 * (from otpMessageTemplateCatalog): it verdicts whether the body
 * meets each platform's contract and, if not, WHY. The runtime
 * sender chooses whether to append the Android sigil + app hash
 * based on the recipient's device — but the evaluator's job is to
 * check the shape.
 *
 * The evaluator NEVER mutates the body. Mutation lives in a
 * separate helper (formatForAndroidRetriever below) so the base
 * template stays iOS-safe by default and Android-specific tail is
 * additive.
 */

export interface AutofillCheckInput {
  smsBody: string;
  /**
   * The APK signing hash Google Play Services expects at the tail
   * of an Android SMS Retriever message. 11 characters, base64url.
   * When empty, only iOS compliance is checked.
   */
  androidAppHash?: string;
}

export type AutofillVerdict = {
  ios: { code: 'OK' } | { code: 'FAIL'; reasonCode:
    | 'NO_DIGIT_CODE_FOUND'
    | 'CODE_LENGTH_OUT_OF_RANGE'
  };
  android: { code: 'OK' } | { code: 'NOT_CHECKED' } | { code: 'FAIL'; reasonCode:
    | 'MISSING_RETRIEVER_SIGIL'
    | 'MISSING_APP_HASH_TAIL'
    | 'APP_HASH_TAIL_WRONG'
  };
};

/**
 * The Google Play Services SMS Retriever leading sigil. This
 * literal '<#>' string is a required marker (not a template).
 */
export const ANDROID_RETRIEVER_SIGIL = '<#>';

/** iOS AutoFill accepts 4–8 digit codes. */
const IOS_CODE_MIN = 4;
const IOS_CODE_MAX = 8;

/**
 * Extract the (first) digit run that looks like the OTP code.
 */
function findCode(body: string): string | undefined {
  const m = body.match(/\d{4,8}/);
  return m ? m[0] : undefined;
}

export function checkAutofillCompliance(input: AutofillCheckInput): AutofillVerdict {
  const { smsBody, androidAppHash } = input;

  // -- iOS check --
  const found = findCode(smsBody);
  const ios: AutofillVerdict['ios'] = (() => {
    if (!found) return { code: 'FAIL', reasonCode: 'NO_DIGIT_CODE_FOUND' };
    if (found.length < IOS_CODE_MIN || found.length > IOS_CODE_MAX) {
      return { code: 'FAIL', reasonCode: 'CODE_LENGTH_OUT_OF_RANGE' };
    }
    return { code: 'OK' };
  })();

  // -- Android check (only when caller supplies a hash) --
  const android: AutofillVerdict['android'] = (() => {
    if (!androidAppHash) return { code: 'NOT_CHECKED' };
    if (!smsBody.trimStart().startsWith(ANDROID_RETRIEVER_SIGIL)) {
      return { code: 'FAIL', reasonCode: 'MISSING_RETRIEVER_SIGIL' };
    }
    const trimmed = smsBody.trimEnd();
    if (!trimmed.endsWith(androidAppHash)) {
      // Look for any 11-char run at the tail — differentiate
      // "there is a hash but it's the wrong one" from "no hash at
      // all". That distinction helps the sender debug config drift.
      const tail = trimmed.slice(-11);
      if (/^[A-Za-z0-9+/=_-]{11}$/.test(tail)) {
        return { code: 'FAIL', reasonCode: 'APP_HASH_TAIL_WRONG' };
      }
      return { code: 'FAIL', reasonCode: 'MISSING_APP_HASH_TAIL' };
    }
    return { code: 'OK' };
  })();

  return { ios, android };
}

/**
 * Wrap an already-rendered iOS-safe SMS body with the Android
 * SMS Retriever sigil + app hash so it satisfies both platforms
 * in a single send.
 *
 * The output is:
 *   <#> {body}
 *   {hash}
 *
 * A trailing newline separates the hash line so Google Play
 * Services parses it reliably. The base body remains unchanged
 * so iOS AutoFill still finds the digit code inside.
 */
export function formatForAndroidRetriever(body: string, appHash: string): string {
  return `${ANDROID_RETRIEVER_SIGIL} ${body}\n${appHash}`;
}

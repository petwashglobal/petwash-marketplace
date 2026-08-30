/**
 * ProfileCompletenessService — CEO P0-MY-ACCOUNT step 2.
 *
 * Pure evaluator. Given a snapshot of the CANONICAL user row,
 * returns the doctrine's exact response shape:
 *   { profileState, requiredActions, missingFields }
 *
 * Client STOPS GUESSING. Attention items open the exact missing
 * section via requiredActions[i].deepLinkCode. When the field
 * becomes present, the attention disappears automatically because
 * the server response no longer names it.
 */

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

export interface RequiredAction {
  code:
    | 'COMPLETE_NAME'
    | 'ADD_EMAIL'
    | 'VERIFY_EMAIL'
    | 'ADD_MOBILE'
    | 'VERIFY_MOBILE'
    | 'ADD_DATE_OF_BIRTH'
    | 'CHOOSE_LANGUAGE'
    | 'ADD_ADDRESS'
    | 'ACCEPT_TERMS';
  deepLinkCode:
    | 'MY_ACCOUNT_PERSONAL'
    | 'MY_ACCOUNT_CONTACT_EMAIL'
    | 'MY_ACCOUNT_CONTACT_MOBILE'
    | 'MY_ACCOUNT_ADDRESS'
    | 'MY_ACCOUNT_PREFERENCES'
    | 'MY_ACCOUNT_TERMS';
}

export interface ProfileSnapshot {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  emailVerified?: boolean | null;
  phone?: string | null;
  phoneVerified?: boolean | null;
  dateOfBirth?: string | null;
  language?: string | null;
  address?: string | null;
  termsAcceptedVersion?: string | null;
  currentTermsVersion: string;
}

export interface CompletenessOutcome {
  profileState: ProfileState;
  missingFields: MissingField[];
  requiredActions: RequiredAction[];
}

const nonEmpty = (v?: string | null): boolean => typeof v === 'string' && v.trim().length > 0;

export function evaluateProfileCompleteness(snapshot: ProfileSnapshot): CompletenessOutcome {
  const missing: MissingField[] = [];
  const actions: RequiredAction[] = [];

  // Personal name — first + last are required together.
  if (!nonEmpty(snapshot.firstName) || !nonEmpty(snapshot.lastName)) {
    missing.push('firstName', 'lastName');
    actions.push({ code: 'COMPLETE_NAME', deepLinkCode: 'MY_ACCOUNT_PERSONAL' });
  }
  // Email — must exist AND be verified. §65 both-contacts discipline.
  if (!nonEmpty(snapshot.email)) {
    missing.push('email');
    actions.push({ code: 'ADD_EMAIL', deepLinkCode: 'MY_ACCOUNT_CONTACT_EMAIL' });
  } else if (!snapshot.emailVerified) {
    missing.push('emailVerification');
    actions.push({ code: 'VERIFY_EMAIL', deepLinkCode: 'MY_ACCOUNT_CONTACT_EMAIL' });
  }
  // Mobile — must exist AND be verified.
  if (!nonEmpty(snapshot.phone)) {
    missing.push('mobile');
    actions.push({ code: 'ADD_MOBILE', deepLinkCode: 'MY_ACCOUNT_CONTACT_MOBILE' });
  } else if (!snapshot.phoneVerified) {
    missing.push('mobileVerification');
    actions.push({ code: 'VERIFY_MOBILE', deepLinkCode: 'MY_ACCOUNT_CONTACT_MOBILE' });
  }
  if (!nonEmpty(snapshot.dateOfBirth)) {
    missing.push('dateOfBirth');
    actions.push({ code: 'ADD_DATE_OF_BIRTH', deepLinkCode: 'MY_ACCOUNT_PERSONAL' });
  }
  if (!nonEmpty(snapshot.language)) {
    missing.push('language');
    actions.push({ code: 'CHOOSE_LANGUAGE', deepLinkCode: 'MY_ACCOUNT_PREFERENCES' });
  }
  if (!nonEmpty(snapshot.address)) {
    missing.push('address');
    actions.push({ code: 'ADD_ADDRESS', deepLinkCode: 'MY_ACCOUNT_ADDRESS' });
  }
  if (snapshot.termsAcceptedVersion !== snapshot.currentTermsVersion) {
    missing.push('termsAcceptance');
    actions.push({ code: 'ACCEPT_TERMS', deepLinkCode: 'MY_ACCOUNT_TERMS' });
  }

  return {
    profileState: missing.length === 0 ? 'COMPLETE' : 'INCOMPLETE',
    missingFields: missing,
    requiredActions: actions,
  };
}

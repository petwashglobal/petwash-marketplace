import jwt from 'jsonwebtoken';
import admin from '../lib/firebase-admin';
import { logger } from '../lib/logger';

const APPLE_REVOKE_URL = 'https://appleid.apple.com/auth/revoke';
const APPLE_PROVIDER_ID = 'apple.com';

type AppleTokenTypeHint = 'refresh_token' | 'access_token';

type AppleSignInConfig =
  | {
      configured: true;
      clientId: string;
      teamId: string;
      keyId: string;
      privateKey: string;
    }
  | {
      configured: false;
      missingEnv: string[];
    };

export type AppleSignInRevocationResult = {
  provider: 'apple.com';
  status: 'revoked' | 'not_applicable' | 'no_token' | 'not_configured' | 'failed';
  tokenTypeHint?: AppleTokenTypeHint;
  manualRevocationRequired: boolean;
  missingEnv?: string[];
  httpStatus?: number;
  errorCode?: string;
};

type FirestoreLike = ReturnType<typeof admin.firestore>;
type FetchLike = typeof fetch;

function envValue(env: NodeJS.ProcessEnv, key: string, aliases: string[] = []): string | undefined {
  return [key, ...aliases]
    .map((candidate) => env[candidate])
    .find((value): value is string => typeof value === 'string' && value.trim().length > 0);
}

function normalizePrivateKey(value: string): string {
  return value.replace(/\\n/g, '\n');
}

export function getAppleSignInRevocationConfig(env: NodeJS.ProcessEnv = process.env): AppleSignInConfig {
  const clientId = envValue(env, 'APPLE_SIGN_IN_CLIENT_ID', ['APPLE_SIGNIN_CLIENT_ID']);
  const teamId = envValue(env, 'APPLE_SIGN_IN_TEAM_ID', ['APPLE_SIGNIN_TEAM_ID']);
  const keyId = envValue(env, 'APPLE_SIGN_IN_KEY_ID', ['APPLE_SIGNIN_KEY_ID']);
  const privateKey = envValue(env, 'APPLE_SIGN_IN_PRIVATE_KEY', ['APPLE_SIGNIN_PRIVATE_KEY']);

  const missingEnv = [
    ['APPLE_SIGN_IN_CLIENT_ID', clientId],
    ['APPLE_SIGN_IN_TEAM_ID', teamId],
    ['APPLE_SIGN_IN_KEY_ID', keyId],
    ['APPLE_SIGN_IN_PRIVATE_KEY', privateKey],
  ]
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missingEnv.length > 0) {
    return { configured: false, missingEnv };
  }

  return {
    configured: true,
    clientId: clientId!,
    teamId: teamId!,
    keyId: keyId!,
    privateKey: normalizePrivateKey(privateKey!),
  };
}

export function createAppleClientSecret(config: Extract<AppleSignInConfig, { configured: true }>, now = new Date()): string {
  const issuedAt = Math.floor(now.getTime() / 1000);
  const expiresAt = issuedAt + 5 * 60;

  return jwt.sign(
    {
      iss: config.teamId,
      iat: issuedAt,
      exp: expiresAt,
      aud: 'https://appleid.apple.com',
      sub: config.clientId,
    },
    config.privateKey,
    {
      algorithm: 'ES256',
      keyid: config.keyId,
    }
  );
}

export function selectAppleSignInToken(data: Record<string, unknown> | undefined | null): {
  token: string;
  tokenTypeHint: AppleTokenTypeHint;
} | null {
  if (!data) return null;

  const refreshToken =
    data.refreshToken ||
    data.refresh_token ||
    data.appleRefreshToken ||
    data.apple_refresh_token;

  if (typeof refreshToken === 'string' && refreshToken.length > 0) {
    return { token: refreshToken, tokenTypeHint: 'refresh_token' };
  }

  const accessToken =
    data.accessToken ||
    data.access_token ||
    data.appleAccessToken ||
    data.apple_access_token;

  if (typeof accessToken === 'string' && accessToken.length > 0) {
    return { token: accessToken, tokenTypeHint: 'access_token' };
  }

  return null;
}

async function findAppleCredentialDoc(uid: string, firestore: FirestoreLike) {
  const canonicalRef = firestore.collection('oauth_tokens').doc(uid).collection('providers').doc(APPLE_PROVIDER_ID);
  const canonicalSnap = await canonicalRef.get();
  if (canonicalSnap.exists) {
    return { ref: canonicalRef, data: canonicalSnap.data() || {} };
  }

  const legacyRef = firestore.collection('apple_signin_tokens').doc(uid);
  const legacySnap = await legacyRef.get();
  if (legacySnap.exists) {
    return { ref: legacyRef, data: legacySnap.data() || {} };
  }

  return null;
}

async function userHasAppleProvider(uid: string): Promise<boolean> {
  try {
    const userRecord = await admin.auth().getUser(uid);
    return userRecord.providerData.some((provider) => provider.providerId === APPLE_PROVIDER_ID);
  } catch (error: any) {
    logger.warn('[AppleSignIn] Could not inspect linked providers before deletion', {
      uid,
      error: error?.message || 'unknown_error',
    });
    return true;
  }
}

async function markAppleTokenRevoked(ref: any, tokenTypeHint: AppleTokenTypeHint) {
  const deleteField = admin.firestore.FieldValue.delete();

  await ref.set({
    providerId: APPLE_PROVIDER_ID,
    revocationStatus: 'revoked',
    revokedTokenType: tokenTypeHint,
    revokedAt: admin.firestore.FieldValue.serverTimestamp(),
    refreshToken: deleteField,
    refresh_token: deleteField,
    appleRefreshToken: deleteField,
    apple_refresh_token: deleteField,
    accessToken: deleteField,
    access_token: deleteField,
    appleAccessToken: deleteField,
    apple_access_token: deleteField,
  }, { merge: true });
}

function safeErrorCode(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const maybeCode = (body as { error?: unknown; error_description?: unknown }).error;
  return typeof maybeCode === 'string' ? maybeCode.slice(0, 80) : undefined;
}

export function summarizeAppleSignInRevocation(result: AppleSignInRevocationResult) {
  return {
    provider: result.provider,
    status: result.status,
    tokenTypeHint: result.tokenTypeHint,
    manualRevocationRequired: result.manualRevocationRequired,
    missingEnv: result.missingEnv,
    httpStatus: result.httpStatus,
    errorCode: result.errorCode,
  };
}

export async function revokeAppleSignInForAccountDeletion(
  uid: string,
  deps: {
    firestore?: FirestoreLike;
    fetchFn?: FetchLike;
    config?: AppleSignInConfig;
  } = {}
): Promise<AppleSignInRevocationResult> {
  const firestore = deps.firestore || admin.firestore();
  const credentialDoc = await findAppleCredentialDoc(uid, firestore);
  const selectedToken = selectAppleSignInToken(credentialDoc?.data);

  if (!selectedToken) {
    const appleLinked = await userHasAppleProvider(uid);
    return {
      provider: APPLE_PROVIDER_ID,
      status: appleLinked ? 'no_token' : 'not_applicable',
      manualRevocationRequired: appleLinked,
    };
  }

  const config = deps.config || getAppleSignInRevocationConfig();
  if (!config.configured) {
    return {
      provider: APPLE_PROVIDER_ID,
      status: 'not_configured',
      tokenTypeHint: selectedToken.tokenTypeHint,
      manualRevocationRequired: true,
      missingEnv: config.missingEnv,
    };
  }

  try {
    const clientSecret = createAppleClientSecret(config);
    const body = new URLSearchParams({
      client_id: config.clientId,
      client_secret: clientSecret,
      token: selectedToken.token,
      token_type_hint: selectedToken.tokenTypeHint,
    });

    const response = await (deps.fetchFn || fetch)(APPLE_REVOKE_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    });

    if (response.ok) {
      if (credentialDoc?.ref) {
        await markAppleTokenRevoked(credentialDoc.ref, selectedToken.tokenTypeHint);
      }

      logger.info('[AppleSignIn] Token revoked for account deletion', {
        uid,
        tokenTypeHint: selectedToken.tokenTypeHint,
      });

      return {
        provider: APPLE_PROVIDER_ID,
        status: 'revoked',
        tokenTypeHint: selectedToken.tokenTypeHint,
        manualRevocationRequired: false,
        httpStatus: response.status,
      };
    }

    let parsedBody: unknown;
    try {
      parsedBody = await response.json();
    } catch {
      parsedBody = undefined;
    }

    const errorCode = safeErrorCode(parsedBody) || 'apple_revoke_failed';
    logger.warn('[AppleSignIn] Token revocation failed during account deletion', {
      uid,
      tokenTypeHint: selectedToken.tokenTypeHint,
      httpStatus: response.status,
      errorCode,
    });

    return {
      provider: APPLE_PROVIDER_ID,
      status: 'failed',
      tokenTypeHint: selectedToken.tokenTypeHint,
      manualRevocationRequired: true,
      httpStatus: response.status,
      errorCode,
    };
  } catch (error: any) {
    logger.warn('[AppleSignIn] Token revocation error during account deletion', {
      uid,
      tokenTypeHint: selectedToken.tokenTypeHint,
      error: error?.message || 'unknown_error',
    });

    return {
      provider: APPLE_PROVIDER_ID,
      status: 'failed',
      tokenTypeHint: selectedToken.tokenTypeHint,
      manualRevocationRequired: true,
      errorCode: 'apple_revoke_exception',
    };
  }
}

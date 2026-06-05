type RankingAdminClaims = {
  uid?: string;
  email?: string;
  email_verified?: boolean;
  role?: unknown;
  roles?: unknown;
  claims?: {
    role?: unknown;
    roles?: unknown;
  };
  admin?: unknown;
  isSuperAdmin?: unknown;
};

const MARKETPLACE_RANKING_ADMIN_ROLES = new Set([
  'admin',
  'super_admin',
  'ops',
  'management',
  'ceo',
]);

function normalizeRoles(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((role): role is string => typeof role === 'string');
  return typeof value === 'string' ? [value] : [];
}

export function isMarketplaceRankingSuperAdminEmail(
  email: string | undefined,
  emailVerified: boolean | undefined,
  rawSuperAdminEmails = process.env.SUPER_ADMIN_EMAILS || '',
): boolean {
  if (!email || emailVerified !== true) return false;
  if (!rawSuperAdminEmails.trim()) return false;
  if (rawSuperAdminEmails.toUpperCase().includes('PLACEHOLDER')) return false;

  const superAdminEmails = rawSuperAdminEmails
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

  return superAdminEmails.includes(email.toLowerCase());
}

export function callerCanAdminMarketplaceRankings(decoded: RankingAdminClaims): boolean {
  const roles = [
    ...normalizeRoles(decoded.role),
    ...normalizeRoles(decoded.roles),
    ...normalizeRoles(decoded.claims?.role),
    ...normalizeRoles(decoded.claims?.roles),
  ];

  if (roles.some((role) => MARKETPLACE_RANKING_ADMIN_ROLES.has(role))) return true;
  if (decoded.admin === true || decoded.isSuperAdmin === true) return true;

  return isMarketplaceRankingSuperAdminEmail(decoded.email, decoded.email_verified);
}

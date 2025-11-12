import { execSync } from 'child_process';
import * as Sentry from '@sentry/node';

export interface ReleaseInfo {
  version: string;
  commit: string;
  timestamp: string;
  environment: string;
}

/**
 * Get current git commit SHA
 */
export function getCurrentCommit(): string {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
  } catch (error) {
    console.warn('[Sentry] Could not get git commit, using timestamp fallback');
    return `release-${Date.now()}`;
  }
}

/**
 * Get current git branch
 */
export function getCurrentBranch(): string {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
  } catch (error) {
    return 'unknown';
  }
}

/**
 * Create Sentry release with commit SHA
 */
export async function createSentryRelease(): Promise<ReleaseInfo | null> {
  const sentryDsn = process.env.SENTRY_DSN;
  
  if (!sentryDsn) {
    console.warn('[Sentry] DSN not configured, skipping release creation');
    return null;
  }

  const commit = getCurrentCommit();
  const branch = getCurrentBranch();
  const environment = process.env.SENTRY_ENV || process.env.NODE_ENV || 'development';
  const version = `${commit.substring(0, 7)}-${Date.now()}`;

  const releaseInfo: ReleaseInfo = {
    version,
    commit,
    timestamp: new Date().toISOString(),
    environment,
  };

  try {
    // Set release on Sentry SDK
    Sentry.getCurrentScope().setTag('release', version);
    Sentry.getCurrentScope().setTag('commit', commit);
    Sentry.getCurrentScope().setTag('branch', branch);

    console.log(`[Sentry] Release created: ${version}`);
    console.log(`[Sentry] Commit: ${commit}`);
    console.log(`[Sentry] Branch: ${branch}`);
    console.log(`[Sentry] Environment: ${environment}`);

    // Send deployment event to Sentry
    Sentry.captureMessage(`Deployment: ${version}`, {
      level: 'info',
      tags: {
        deployment: 'true',
        version,
        commit,
        branch,
        environment,
      },
    });

    return releaseInfo;
  } catch (error) {
    console.error('[Sentry] Failed to create release:', error);
    return null;
  }
}

/**
 * Associate errors with the current release
 */
export function configureRelease() {
  const commit = getCurrentCommit();
  const version = `${commit.substring(0, 7)}-${Date.now()}`;
  
  Sentry.setContext('release', {
    version,
    commit,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Upload sourcemaps to Sentry (requires sentry-cli)
 * This should be called during build process
 */
export function uploadSourcemaps(): void {
  const sentryDsn = process.env.SENTRY_DSN;
  const sentryOrg = process.env.SENTRY_ORG;
  const sentryProject = process.env.SENTRY_PROJECT;

  if (!sentryDsn || !sentryOrg || !sentryProject) {
    console.warn('[Sentry] Missing configuration for sourcemap upload');
    return;
  }

  const commit = getCurrentCommit();
  const version = `${commit.substring(0, 7)}-${Date.now()}`;

  try {
    // This requires sentry-cli to be installed
    // npm install -g @sentry/cli
    execSync(
      `sentry-cli releases new ${version} && ` +
      `sentry-cli releases files ${version} upload-sourcemaps ./dist && ` +
      `sentry-cli releases finalize ${version}`,
      { stdio: 'inherit' }
    );
    
    console.log(`[Sentry] Sourcemaps uploaded for release ${version}`);
  } catch (error) {
    console.error('[Sentry] Failed to upload sourcemaps:', error);
  }
}

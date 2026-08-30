/**
 * MultiRoleSwitchGuard — CEO PROGRAM 44 (Multi-Role Switch).
 *
 * Pure evaluator. Given the actor's declared capabilities and their
 * current workspace, decides whether a switch to the other workspace
 * is:
 *   • ALLOWED (do it now, no logout, no UID change),
 *   • BLOCKED_CAPABILITY (the target workspace requires a capability
 *     the actor does not have),
 *   • BLOCKED_INTAKE (the actor has provider.applicant only and
 *     must finish the intake before entering the workspace).
 *
 * Doctrine (§ Program 44): Persistent Switch button. No logout.
 * No UID change. No session recreation. Pet Parent is base
 * capability (every account has it).
 */

export type Workspace = 'PET_PARENT' | 'PROVIDER';

export interface ActorCapabilities {
  hasCustomerCapability: boolean;          // §42 — Pet Parent base
  hasProviderApplicant: boolean;
  hasProviderActive: boolean;
}

export type SwitchOutcome =
  | { code: 'ALLOWED'; targetWorkspace: Workspace }
  | { code: 'BLOCKED_CAPABILITY'; reasonCode: 'PROVIDER_CAPABILITY_MISSING' | 'CUSTOMER_CAPABILITY_MISSING' }
  | { code: 'BLOCKED_INTAKE'; reasonCode: 'FINISH_PROVIDER_INTAKE_FIRST'; resumeRoute: string };

export function canSwitchTo(target: Workspace, current: Workspace, caps: ActorCapabilities): SwitchOutcome {
  if (target === current) {
    // No-op — same workspace. Treat as ALLOWED so callers can be
    // idempotent, but distinguishing this from a real switch is a
    // client concern (they can compare current === target).
    return { code: 'ALLOWED', targetWorkspace: target };
  }

  if (target === 'PET_PARENT') {
    if (!caps.hasCustomerCapability) {
      // Pet Parent is the base capability — a signed-in account
      // without it is a data-integrity anomaly, not a normal state.
      return { code: 'BLOCKED_CAPABILITY', reasonCode: 'CUSTOMER_CAPABILITY_MISSING' };
    }
    return { code: 'ALLOWED', targetWorkspace: 'PET_PARENT' };
  }

  // target === 'PROVIDER'
  if (caps.hasProviderActive) return { code: 'ALLOWED', targetWorkspace: 'PROVIDER' };
  if (caps.hasProviderApplicant) {
    // Intake in progress → route them back to the wizard first.
    return {
      code: 'BLOCKED_INTAKE',
      reasonCode: 'FINISH_PROVIDER_INTAKE_FIRST',
      resumeRoute: '/become-provider',
    };
  }
  return { code: 'BLOCKED_CAPABILITY', reasonCode: 'PROVIDER_CAPABILITY_MISSING' };
}

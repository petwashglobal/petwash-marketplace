import { describe, it } from 'vitest';

/**
 * STUB — to be filled in by Provider Compliance Agent (Batch 2).
 *
 * Required scenarios:
 *   1. Provider apply with selfDeclarationNoRelevantConvictions=false → 400
 *   2. Provider apply with selfDeclarationNoRelevantConvictions=true → 200
 *   3. Selecting service in {home_access, overnight_sitting, key_holding,
 *      pet_transport} sets requiresEnhancedVerification=true server-side.
 *   4. Hebrew + English declaration text exists in
 *      shared/legal/providerDeclaration.ts.
 *   5. Admin approval is blocked when requiresEnhancedVerification=true
 *      AND policeCheckApproved=false.
 *   6. Admin approval is allowed when requiresEnhancedVerification=false
 *      AND selfDeclarationNoRelevantConvictions=true (police check
 *      no longer required by default).
 */
describe.skip('provider declaration (Israel-safe)', () => {
  it('rejects apply when self-declaration not ticked', () => {});
  it('accepts apply when self-declaration ticked', () => {});
  it('flags requiresEnhancedVerification for high-risk services', () => {});
  it('blocks admin approval when enhanced verification + no police check', () => {});
  it('allows admin approval for low-risk + self-declaration only', () => {});
});

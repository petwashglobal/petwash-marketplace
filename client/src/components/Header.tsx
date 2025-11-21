/**
 * LEGACY COMPATIBILITY SHIM
 * 
 * This file exists ONLY for backward compatibility with pages that still
 * import { Header } instead of using the Layout component.
 * 
 * ALL PAGES SHOULD MIGRATE TO:
 * - Using <Layout> component (recommended)
 * - Or importing PetWashHeader directly
 * 
 * This shim ensures luxury PetWashHeader renders everywhere.
 */

import { PetWashHeader } from './PetWashHeader';

// Re-export PetWashHeader as Header for compatibility
export { PetWashHeader as Header };

// Default export for compatibility
export default PetWashHeader;

// Tier upgrade detection and localStorage management

import { type LoyaltyTier } from './loyalty';
import { logger } from "./logger";

const STORAGE_KEY = 'petwash_last_tier_check';

interface TierCheckData {
  uid: string;
  washes: number;
  tier: LoyaltyTier;
  timestamp: number;
}

export function saveTierCheck(uid: string, washes: number, tier: LoyaltyTier) {
  const data: TierCheckData = {
    uid,
    washes,
    tier,
    timestamp: Date.now(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function getLastTierCheck(uid: string): TierCheckData | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    
    const data: TierCheckData = JSON.parse(stored);
    
    // Only return if it's for the same user
    if (data.uid !== uid) return null;
    
    return data;
  } catch (error) {
    logger.error('Error reading tier check data', error);
    return null;
  }
}

export function shouldShowTierUpgrade(
  uid: string,
  currentWashes: number,
  currentTier: LoyaltyTier
): boolean {
  const lastCheck = getLastTierCheck(uid);
  
  if (!lastCheck) {
    // First time - save current state but don't show upgrade
    saveTierCheck(uid, currentWashes, currentTier);
    return false;
  }
  
  // Check if tier has changed
  if (lastCheck.tier !== currentTier && lastCheck.washes < currentWashes) {
    // Tier upgraded!
    saveTierCheck(uid, currentWashes, currentTier);
    return true;
  }
  
  // Update if washes changed but tier didn't
  if (lastCheck.washes !== currentWashes) {
    saveTierCheck(uid, currentWashes, currentTier);
  }
  
  return false;
}

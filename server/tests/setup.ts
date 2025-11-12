import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { db } from '../db';
import { logger } from '../lib/logger';

beforeAll(async () => {
  logger.info('[Tests] Setting up test environment');
  process.env.NODE_ENV = 'test';
});

afterAll(async () => {
  logger.info('[Tests] Cleaning up test environment');
});

beforeEach(async () => {
});

afterEach(async () => {
});

export const createTestUser = async (overrides = {}) => {
  return {
    id: `test-user-${Date.now()}`,
    email: `test-${Date.now()}@example.com`,
    displayName: 'Test User',
    role: 'customer' as const,
    loyaltyPoints: 0,
    loyaltyTier: 'new' as const,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
};

export const createTestPurchase = async (overrides = {}) => {
  return {
    id: `test-purchase-${Date.now()}`,
    customerEmail: `test-${Date.now()}@example.com`,
    amount: 100,
    currency: 'ILS',
    paymentProvider: 'test',
    transactionId: `test-txn-${Date.now()}`,
    status: 'completed' as const,
    itemType: 'gift_card' as const,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
};

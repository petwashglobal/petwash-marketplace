import { describe, it, expect } from 'vitest';
import { authService } from '../services/AuthService';
import crypto from 'crypto';

describe('AuthService', () => {
  describe('Token Hashing', () => {
    it('should generate unique hashes for different tokens', () => {
      const token1 = 'eyJhbGciOiJSUzI1NiIsImtpZCI6ImE1NGRmYzFhYzI1';
      const token2 = 'eyJhbGciOiJSUzI1NiIsImtpZCI6ImI2NGRmYzFhYzI1';

      const hash1 = (authService as any).hashToken(token1);
      const hash2 = (authService as any).hashToken(token2);

      expect(hash1).not.toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/);
      expect(hash2).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should generate consistent hashes for same token', () => {
      const token = 'eyJhbGciOiJSUzI1NiIsImtpZCI6ImE1NGRmYzFhYzI1';

      const hash1 = (authService as any).hashToken(token);
      const hash2 = (authService as any).hashToken(token);

      expect(hash1).toBe(hash2);
    });

    it('should prevent collisions from tokens with same prefix', () => {
      const basePrefix = 'eyJhbGciOiJSUzI1NiIsImtpZCI6ImE1';
      const token1 = basePrefix + 'ABC123XYZ';
      const token2 = basePrefix + 'DEF456UVW';

      const hash1 = (authService as any).hashToken(token1);
      const hash2 = (authService as any).hashToken(token2);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('Cache Key Security', () => {
    it('should use SHA-256 for token hashing', () => {
      const token = 'test-token-12345';
      const expectedHash = crypto.createHash('sha256').update(token).digest('hex');

      const actualHash = (authService as any).hashToken(token);

      expect(actualHash).toBe(expectedHash);
      expect(actualHash.length).toBe(64);
    });
  });

  describe('User Deletion', () => {
    it('should throw error when deleting non-existent user', async () => {
      const nonExistentUserId = 'non-existent-user-id';

      await expect(authService.deleteUser(nonExistentUserId)).rejects.toThrow('User not found');
    });

    it('should clear all cache entries (ID and email) when deleting existing user', async () => {
      const testUserId = `test-user-${Date.now()}`;
      const testEmail = `test-${Date.now()}@example.com`;

      try {
        await authService.createUser({
          id: testUserId,
          email: testEmail,
          displayName: 'Test User',
        });

        const userById = await authService.getUserById(testUserId);
        expect(userById).toBeTruthy();
        expect(userById?.email).toBe(testEmail.toLowerCase());

        const userByEmail = await authService.getUserByEmail(testEmail);
        expect(userByEmail).toBeTruthy();
        expect(userByEmail?.id).toBe(testUserId);

        await authService.deleteUser(testUserId);

        const deletedById = await authService.getUserById(testUserId);
        expect(deletedById).toBeUndefined();

        const deletedByEmail = await authService.getUserByEmail(testEmail);
        expect(deletedByEmail).toBeUndefined();
      } catch (error) {
        console.error('Test error:', error);
        throw error;
      }
    });
  });
});

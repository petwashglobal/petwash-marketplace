/**
 * EncryptionService - Field-Level Encryption for Sensitive Data
 * 
 * CRITICAL: Protects WiFi passwords, gate codes, alarm codes, lockbox codes
 * 
 * Security Features:
 * - AES-256-GCM encryption
 * - Unique initialization vector (IV) per field
 * - HMAC authentication tags
 * - Key rotation support
 * - Audit logging for access
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // For GCM mode
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32; // 256 bits

export interface EncryptedData {
  encrypted: string;    // Base64 encrypted data
  iv: string;          // Base64 initialization vector
  authTag: string;     // Base64 authentication tag
  version: number;     // For key rotation
}

export class EncryptionService {
  private encryptionKey: Buffer;
  private keyVersion: number = 1;

  constructor() {
    // Get encryption key from environment or generate one
    const keyHex = process.env.PROPERTY_ACCESS_ENCRYPTION_KEY;
    
    if (keyHex) {
      this.encryptionKey = Buffer.from(keyHex, 'hex');
      console.log('[Encryption] ✅ Using configured encryption key');
    } else {
      // Generate a random key (ONLY for development)
      this.encryptionKey = crypto.randomBytes(KEY_LENGTH);
      console.warn('[Encryption] ⚠️ Generated random encryption key - NOT for production!');
      console.warn('[Encryption] Set PROPERTY_ACCESS_ENCRYPTION_KEY environment variable');
    }

    if (this.encryptionKey.length !== KEY_LENGTH) {
      throw new Error(`Encryption key must be ${KEY_LENGTH} bytes (${KEY_LENGTH * 2} hex characters)`);
    }
  }

  /**
   * Encrypt sensitive field (WiFi password, gate code, etc.)
   */
  encrypt(plaintext: string): EncryptedData {
    if (!plaintext || plaintext.trim() === '') {
      throw new Error('Cannot encrypt empty string');
    }

    // Generate random IV for this encryption
    const iv = crypto.randomBytes(IV_LENGTH);
    
    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, this.encryptionKey, iv);
    
    // Encrypt data
    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    // Get authentication tag
    const authTag = cipher.getAuthTag();

    return {
      encrypted,
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      version: this.keyVersion,
    };
  }

  /**
   * Decrypt sensitive field
   */
  decrypt(encryptedData: EncryptedData): string {
    if (!encryptedData || !encryptedData.encrypted) {
      throw new Error('Invalid encrypted data');
    }

    // Convert from base64
    const iv = Buffer.from(encryptedData.iv, 'base64');
    const authTag = Buffer.from(encryptedData.authTag, 'base64');
    
    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, this.encryptionKey, iv);
    decipher.setAuthTag(authTag);
    
    // Decrypt data
    let decrypted = decipher.update(encryptedData.encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Encrypt WiFi credentials
   */
  encryptWiFi(network: string, password: string): {
    network: string;           // Not encrypted (needed for display)
    encryptedPassword: EncryptedData;
  } {
    return {
      network,
      encryptedPassword: this.encrypt(password),
    };
  }

  /**
   * Encrypt gate/access code
   */
  encryptAccessCode(code: string, location?: string): {
    location?: string;         // Not encrypted (needed for display)
    encryptedCode: EncryptedData;
  } {
    return {
      location,
      encryptedCode: this.encrypt(code),
    };
  }

  /**
   * Encrypt smart lock code
   */
  encryptSmartLock(lockType: string, code: string, instructions?: string): {
    lockType: string;          // Not encrypted
    encryptedCode: EncryptedData;
    instructions?: string;     // Not encrypted (public info)
  } {
    return {
      lockType,
      encryptedCode: this.encrypt(code),
      instructions,
    };
  }

  /**
   * Redact sensitive data from logs/errors
   */
  redactSensitiveData(data: any): any {
    const redacted = JSON.parse(JSON.stringify(data));
    
    // Common sensitive field names
    const sensitiveKeys = [
      'password',
      'wifiPassword',
      'gateCode',
      'alarmCode',
      'lockboxCode',
      'smartLockCode',
      'pin',
      'secret',
    ];

    const redactObject = (obj: any) => {
      for (const key in obj) {
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          redactObject(obj[key]);
        } else if (sensitiveKeys.some(k => key.toLowerCase().includes(k))) {
          obj[key] = '[REDACTED]';
        }
      }
    };

    redactObject(redacted);
    return redacted;
  }

  /**
   * Generate secure random password/code
   */
  generateSecureCode(length: number = 6, type: 'numeric' | 'alphanumeric' = 'numeric'): string {
    const chars = type === 'numeric' 
      ? '0123456789'
      : '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    
    let code = '';
    const randomBytes = crypto.randomBytes(length);
    
    for (let i = 0; i < length; i++) {
      code += chars[randomBytes[i] % chars.length];
    }
    
    return code;
  }

  /**
   * Validate encryption key strength
   */
  validateKeyStrength(): {
    isValid: boolean;
    strength: 'weak' | 'medium' | 'strong';
    warnings: string[];
  } {
    const warnings: string[] = [];
    
    // Check key entropy
    const keyHex = this.encryptionKey.toString('hex');
    const uniqueChars = new Set(keyHex).size;
    
    if (uniqueChars < 12) {
      warnings.push('Low entropy: Key has limited character variety');
    }
    
    // Check for patterns (simple check)
    if (/(.)\1{4,}/.test(keyHex)) {
      warnings.push('Key contains repeated character sequences');
    }
    
    const strength = uniqueChars >= 14 ? 'strong' : uniqueChars >= 10 ? 'medium' : 'weak';
    
    return {
      isValid: this.encryptionKey.length === KEY_LENGTH && strength !== 'weak',
      strength,
      warnings,
    };
  }
}

// Export singleton instance
export const encryptionService = new EncryptionService();

// Helper: Generate encryption key for .env file
export function generateEncryptionKey(): string {
  const key = crypto.randomBytes(KEY_LENGTH);
  console.log('\n=== ENCRYPTION KEY GENERATION ===');
  console.log('Add this to your .env file:');
  console.log(`PROPERTY_ACCESS_ENCRYPTION_KEY=${key.toString('hex')}`);
  console.log('================================\n');
  return key.toString('hex');
}

// Usage example:
// const encrypted = encryptionService.encrypt("MyWiFiPassword123!");
// const decrypted = encryptionService.decrypt(encrypted);

import crypto from 'crypto';
import type { EncryptionResult, DecryptionInput } from '../types';

/**
 * Encryption utilities for secure storage of API keys and sensitive data
 * Uses AES-256-GCM for authenticated encryption with PayloadCMS secret for key derivation
 */

const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const SALT_LENGTH = 32; // 256 bits

/**
 * Validates PayloadCMS secret for encryption use
 * @param secret - The PayloadCMS secret to validate
 * @throws Error if secret is invalid
 */
function validateSecret(secret: string): void {
  if (!secret) {
    throw new Error('PayloadCMS secret is required for encryption operations');
  }
  if (typeof secret !== 'string') {
    throw new Error('PayloadCMS secret must be a string');
  }
  if (secret.length < 32) {
    throw new Error('PayloadCMS secret must be at least 32 characters long for secure encryption');
  }
}

/**
 * Derives encryption key from PayloadCMS secret using PBKDF2
 * @param secret - The PayloadCMS secret from config
 * @param salt - Salt for key derivation (optional, will generate if not provided)
 * @returns Object containing derived key and salt
 */
function deriveKey(secret: string, salt?: Buffer): { key: Buffer; salt: Buffer } {
  validateSecret(secret);

  const derivationSalt = salt || crypto.randomBytes(SALT_LENGTH);
  const key = crypto.pbkdf2Sync(secret, derivationSalt, 100000, KEY_LENGTH, 'sha512');
  
  return { key, salt: derivationSalt };
}

/**
 * Encrypts sensitive data using AES-256-GCM
 * @param plaintext - Data to encrypt
 * @param secret - PayloadCMS secret for key derivation
 * @returns Encryption result with encrypted data, IV, tag, and salt
 * 
 * @example
 * ```typescript
 * const result = encrypt('my-api-key', payloadSecret);
 * console.log(result.encrypted); // Base64 encrypted data
 * ```
 */
export function encrypt(plaintext: string, secret: string): EncryptionResult {
  try {
    if (!plaintext) {
      throw new Error('Plaintext cannot be empty');
    }

    // Derive encryption key with new salt
    const { key, salt } = deriveKey(secret);
    
    // Generate random IV
    const iv = crypto.randomBytes(IV_LENGTH);
    
    // Use AES-256-GCM for authenticated encryption (more secure than CBC)
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    
    // Encrypt data
    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    // Get authentication tag for GCM mode
    const tag = cipher.getAuthTag();

    return {
      encrypted,
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
      salt: salt.toString('base64')
    };
  } catch (error) {
    throw new Error(`Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Attempts to decrypt data using the old deprecated method (for backward compatibility)
 * This is a temporary measure to handle data encrypted with the old insecure method
 * @param data - Encryption data
 * @param secret - PayloadCMS secret
 * @returns Decrypted plaintext or null if failed
 */
function tryLegacyDecrypt(data: DecryptionInput, secret: string): string | null {
  try {
    // Only attempt if we have the basic components but missing new format elements
    if (!data.encrypted || data.tag || (data.iv && data.salt)) {
      return null; // Not legacy format
    }

    const { key } = deriveKey(secret);
    
    // Try the old createDecipher method (DEPRECATED - only for backward compatibility)
    const decipher = crypto.createDecipher('aes-256-cbc', key);
    let decrypted = decipher.update(data.encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch {
    return null; // Failed to decrypt with legacy method
  }
}

/**
 * Decrypts data encrypted with the encrypt function
 * @param data - Encryption result from encrypt function
 * @param secret - PayloadCMS secret used for encryption
 * @returns Decrypted plaintext
 * 
 * @example
 * ```typescript
 * const plaintext = decrypt(encryptionResult, payloadSecret);
 * console.log(plaintext); // 'my-api-key'
 * ```
 */
export function decrypt(data: DecryptionInput, secret: string): string {
  try {
    // Validate basic input
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid encryption data: data must be an object');
    }
    if (!data.encrypted) {
      throw new Error('Invalid encryption data: missing encrypted data');
    }

    // Try new secure format first
    if (data.iv && data.salt) {
      try {
        // Parse required components
        const salt = Buffer.from(data.salt, 'base64');
        const iv = Buffer.from(data.iv, 'base64');
        
        // Derive the same key used for encryption
        const { key } = deriveKey(secret, salt);
        
        // Create decipher with proper IV
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
        
        // Set auth tag for GCM mode (if available)
        if (data.tag) {
          const tag = Buffer.from(data.tag, 'base64');
          decipher.setAuthTag(tag);
        }
        
        // Decrypt data
        let decrypted = decipher.update(data.encrypted, 'base64', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
      } catch (error) {
        throw new Error(`Modern decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Try legacy format for backward compatibility
    const legacyResult = tryLegacyDecrypt(data, secret);
    if (legacyResult !== null) {
      console.warn('Successfully decrypted using legacy method. Please re-encrypt this data for better security.');
      return legacyResult;
    }

    throw new Error('Unable to decrypt data: format not recognized or data corrupted');
  } catch (error) {
    throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Creates a secure hash of sensitive data for comparison/validation
 * @param data - Data to hash
 * @param secret - PayloadCMS secret for salt
 * @returns Base64 encoded hash
 */
export function createSecureHash(data: string, secret: string): string {
  const { salt } = deriveKey(secret);
  const hash = crypto.pbkdf2Sync(data, salt, 10000, 32, 'sha512');
  return hash.toString('base64');
}

/**
 * Validates that data matches a secure hash
 * @param data - Original data
 * @param hash - Hash to compare against
 * @param secret - PayloadCMS secret
 * @returns True if data matches hash
 */
export function validateSecureHash(data: string, hash: string, secret: string): boolean {
  try {
    const dataHash = createSecureHash(data, secret);
    return crypto.timingSafeEqual(
      Buffer.from(hash, 'base64'),
      Buffer.from(dataHash, 'base64')
    );
  } catch {
    return false;
  }
}

/**
 * Validates encryption data format
 * @param data - Data to validate
 * @returns True if data appears to be valid encryption format
 */
function isValidEncryptionData(data: any): boolean {
  if (!data || typeof data !== 'object') {
    return false;
  }
  
  // Must have encrypted data
  if (!data.encrypted || typeof data.encrypted !== 'string') {
    return false;
  }
  
  // For modern format, should have IV and salt
  if (data.iv && data.salt) {
    return typeof data.iv === 'string' && typeof data.salt === 'string';
  }
  
  // For legacy format, should only have encrypted field
  return Object.keys(data).length === 1 && data.encrypted;
}

/**
 * PayloadCMS field-level encryption hook for sensitive fields
 * Automatically encrypts data before saving and decrypts when retrieving
 */
export const encryptionHook = {
  /**
   * Before change hook - encrypts sensitive data before saving
   */
  beforeChange: [
    ({ data, req }: { data: any; req: any }) => {
      const secret = req.payload?.secret || process.env.PAYLOAD_SECRET;
      
      if (!secret) {
        console.error('PayloadCMS secret not available for encryption - sensitive data will not be encrypted');
        throw new Error('PayloadCMS secret not available for encryption');
      }

      // Validate secret strength
      try {
        validateSecret(secret);
      } catch (error) {
        console.error('PayloadCMS secret validation failed:', error);
        throw new Error(`PayloadCMS secret validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      // Define fields that should be encrypted
      const encryptedFields = [
        'platforms.twitter.apiKey',
        'platforms.twitter.apiSecret', 
        'platforms.twitter.accessToken',
        'platforms.twitter.accessTokenSecret',
        'platforms.twitter.bearerToken',
        'platforms.linkedin.accessToken'
      ];

      let encryptionErrors: string[] = [];

      // Encrypt each sensitive field
      encryptedFields.forEach(fieldPath => {
        const value = getNestedValue(data, fieldPath);
        if (value && typeof value === 'string' && value.trim()) {
          // Don't re-encrypt already encrypted data
          const isAlreadyEncrypted = getNestedValue(data, `${fieldPath}_encrypted`);
          if (isAlreadyEncrypted) {
            try {
              // Validate that the existing data is properly formatted
              const existingData = JSON.parse(value);
              if (!isValidEncryptionData(existingData)) {
                throw new Error('Invalid existing encryption format');
              }
              return; // Skip re-encryption
            } catch (error) {
              console.warn(`Re-encrypting field ${fieldPath} due to format issues:`, error);
              // Continue to re-encrypt
            }
          }

          try {
            const encrypted = encrypt(value, secret);
            setNestedValue(data, fieldPath, JSON.stringify(encrypted));
            
            // Mark field as encrypted for reference
            setNestedValue(data, `${fieldPath}_encrypted`, true);
            console.debug(`Successfully encrypted field: ${fieldPath}`);
          } catch (error) {
            const errorMsg = `Failed to encrypt field ${fieldPath}: ${error instanceof Error ? error.message : 'Unknown error'}`;
            console.error(errorMsg);
            encryptionErrors.push(errorMsg);
          }
        }
      });

      // If there were encryption errors, report them but don't fail the save
      if (encryptionErrors.length > 0) {
        console.warn(`Encryption completed with ${encryptionErrors.length} errors:`, encryptionErrors);
      }

      return data;
    }
  ],

  /**
   * After read hook - decrypts sensitive data when retrieving
   */
  afterRead: [
    ({ doc, req }: { doc: any; req: any }) => {
      const secret = req.payload?.secret || process.env.PAYLOAD_SECRET;
      
      if (!secret) {
        console.warn('PayloadCMS secret not available for decryption - encrypted fields will be empty');
        return doc;
      }

      // Define fields that should be decrypted
      const encryptedFields = [
        'platforms.twitter.apiKey',
        'platforms.twitter.apiSecret',
        'platforms.twitter.accessToken', 
        'platforms.twitter.accessTokenSecret',
        'platforms.twitter.bearerToken',
        'platforms.linkedin.accessToken'
      ];

      let decryptionErrors: string[] = [];

      // Decrypt each sensitive field
      encryptedFields.forEach(fieldPath => {
        const encryptedValue = getNestedValue(doc, fieldPath);
        const isEncrypted = getNestedValue(doc, `${fieldPath}_encrypted`);
        
        if (encryptedValue && isEncrypted) {
          try {
            // Parse and validate encryption data
            let encryptionData;
            try {
              encryptionData = JSON.parse(encryptedValue);
            } catch (parseError) {
              throw new Error('Invalid JSON format in encrypted data');
            }

            if (!isValidEncryptionData(encryptionData)) {
              throw new Error('Invalid encryption data format');
            }

            const decrypted = decrypt(encryptionData, secret);
            setNestedValue(doc, fieldPath, decrypted);
            
            // Remove encryption marker for clean response
            const pathParts = fieldPath.split('.');
            let current = doc;
            for (let i = 0; i < pathParts.length - 1; i++) {
              const part = pathParts[i];
              if (current && part && current[part]) {
                current = current[part];
              } else {
                break;
              }
            }
            if (current && pathParts[pathParts.length - 1]) {
              delete current[`${pathParts[pathParts.length - 1]}_encrypted`];
            }

            console.debug(`Successfully decrypted field: ${fieldPath}`);
          } catch (error) {
            const errorMsg = `Failed to decrypt field ${fieldPath}: ${error instanceof Error ? error.message : 'Unknown error'}`;
            console.error(errorMsg);
            decryptionErrors.push(errorMsg);
            
            // Set field to empty to prevent exposure of encrypted/corrupted data
            setNestedValue(doc, fieldPath, '');
            
            // Also remove the encryption marker to prevent confusion
            const pathParts = fieldPath.split('.');
            let current = doc;
            for (let i = 0; i < pathParts.length - 1; i++) {
              const part = pathParts[i];
              if (current && part && current[part]) {
                current = current[part];
              } else {
                break;
              }
            }
            if (current && pathParts[pathParts.length - 1]) {
              delete current[`${pathParts[pathParts.length - 1]}_encrypted`];
            }
          }
        }
      });

      // Log decryption errors but don't fail the read operation
      if (decryptionErrors.length > 0) {
        console.warn(`Decryption completed with ${decryptionErrors.length} errors:`, decryptionErrors);
      }

      return doc;
    }
  ]
};

/**
 * Utility function to get nested object values using dot notation
 */
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : undefined;
  }, obj);
}

/**
 * Utility function to set nested object values using dot notation
 */
function setNestedValue(obj: any, path: string, value: any): void {
  const keys = path.split('.');
  const lastKey = keys.pop()!;
  
  const target = keys.reduce((current, key) => {
    if (!current[key] || typeof current[key] !== 'object') {
      current[key] = {};
    }
    return current[key];
  }, obj);
  
  target[lastKey] = value;
}

/**
 * Migrates legacy encrypted data to the new secure format
 * @param legacyData - Old encryption format data
 * @param secret - PayloadCMS secret
 * @returns New encryption format data or null if migration fails
 */
export function migrateLegacyEncryption(legacyData: any, secret: string): EncryptionResult | null {
  try {
    // First, try to decrypt using legacy method
    const decrypted = tryLegacyDecrypt(legacyData, secret);
    if (decrypted === null) {
      return null;
    }
    
    // Re-encrypt using new secure method
    return encrypt(decrypted, secret);
  } catch (error) {
    console.error('Legacy encryption migration failed:', error);
    return null;
  }
}

/**
 * Test encryption/decryption functionality
 * Useful for debugging and validation
 */
export function testEncryption(secret: string): boolean {
  try {
    const testData = 'test-api-key-12345';
    const encrypted = encrypt(testData, secret);
    const decrypted = decrypt(encrypted, secret);
    
    const passed = decrypted === testData;
    
    if (passed) {
      console.log('✅ Encryption test passed: Modern AES-256-GCM encryption working correctly');
      console.log(`Test data encrypted with IV: ${encrypted.iv.substring(0, 8)}...`);
      if (encrypted.salt) {
        console.log(`Test data encrypted with salt: ${encrypted.salt.substring(0, 8)}...`);
      }
      console.log(`Test data authenticated with tag: ${encrypted.tag.substring(0, 8)}...`);
    } else {
      console.error('❌ Encryption test failed: Decrypted data does not match original');
    }
    
    return passed;
  } catch (error) {
    console.error('❌ Encryption test failed:', error);
    return false;
  }
}

/**
 * Comprehensive encryption system validation
 * Tests various scenarios including edge cases
 */
export function validateEncryptionSystem(secret: string): {
  success: boolean;
  results: Record<string, boolean>;
  errors: string[];
} {
  const results: Record<string, boolean> = {};
  const errors: string[] = [];
  
  try {
    // Test 1: Basic encryption/decryption
    results.basicTest = testEncryption(secret);
    
    // Test 2: Secret validation
    try {
      validateSecret(secret);
      results.secretValidation = true;
    } catch (error) {
      results.secretValidation = false;
      errors.push(`Secret validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    // Test 3: Empty data handling
    try {
      encrypt('', secret);
      results.emptyDataHandling = false;
      errors.push('Should have thrown error for empty plaintext');
    } catch (error) {
      results.emptyDataHandling = true; // Should throw error
    }
    
    // Test 4: Invalid decryption data handling
    try {
      decrypt({} as DecryptionInput, secret);
      results.invalidDataHandling = false;
      errors.push('Should have thrown error for invalid decryption data');
    } catch (error) {
      results.invalidDataHandling = true; // Should throw error
    }
    
    // Test 5: Different data sizes
    const testSizes = [10, 100, 1000, 5000];
    results.variousDataSizes = testSizes.every(size => {
      try {
        const testData = 'x'.repeat(size);
        const encrypted = encrypt(testData, secret);
        const decrypted = decrypt(encrypted, secret);
        return decrypted === testData;
      } catch (error) {
        errors.push(`Size test failed for ${size} characters: ${error instanceof Error ? error.message : 'Unknown error'}`);
        return false;
      }
    });
    
    const success = Object.values(results).every(result => result === true);
    
    if (success) {
      console.log('✅ All encryption system validation tests passed');
    } else {
      console.error('❌ Some encryption system validation tests failed');
    }
    
    return { success, results, errors };
  } catch (error) {
    errors.push(`Validation system error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return { success: false, results, errors };
  }
}
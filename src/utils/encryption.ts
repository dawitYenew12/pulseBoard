import crypto from 'crypto';
import { promisify } from 'util';
import config from '../config/config';

const randomBytes = promisify(crypto.randomBytes);

export interface EncryptionResult {
  encryptedContent: string;
  iv: string;
  salt: string;
  authTag: string;
}

/**
 * Asynchronously encrypts content using AES-256-GCM.
 * @param content The content to encrypt.
 * @param userInformation User-specific information to bind with the master key.
 * @returns Object containing encrypted content and metadata (iv, salt, authTag).
 */
export async function aesEncryptContent(
  content: string,
  userInformation: string,
): Promise<EncryptionResult> {
  const algorithm = 'aes-256-gcm';
  const masterKey = config.encryption.masterKey;

  // Generate random salt and IV
  const salt = await randomBytes(16); // 16 bytes for salt
  const iv = await randomBytes(12); // 12 bytes for AES-GCM

  // Derive a key using user ID, salt, and the Master Key
  const combinedInput = userInformation + masterKey;
  const key = crypto.pbkdf2Sync(combinedInput, salt, 100000, 32, 'sha256');

  // Create cipher instance
  const cipher = crypto.createCipheriv(algorithm, key, iv);

  // Encrypt content
  const encryptedContent = Buffer.concat([
    cipher.update(content, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return {
    encryptedContent: encryptedContent.toString('hex'),
    iv: iv.toString('hex'),
    salt: salt.toString('hex'),
    authTag: authTag.toString('hex'),
  };
}

/**
 * Decrypts content using AES-256-GCM.
 * @param encryptedContent The encrypted hex string.
 * @param iv The initialization vector hex string.
 * @param salt The salt hex string.
 * @param authTag The auth tag hex string.
 * @param userInformation User-specific information used during encryption.
 * @returns The decrypted text content.
 */
export function aesDecryptContent(
  encryptedContent: string,
  iv: string,
  salt: string,
  authTag: string,
  userInformation: string,
): string {
  try {
    const algorithm = 'aes-256-gcm';
    const masterKey = config.encryption.masterKey;

    // Derive the key using user ID, salt, and the Master Key
    const combinedInput = userInformation + masterKey;
    const key = crypto.pbkdf2Sync(
      combinedInput,
      Buffer.from(salt, 'hex'),
      100000,
      32,
      'sha256',
    );

    // Create decipher instance
    const decipher = crypto.createDecipheriv(
      algorithm,
      key,
      Buffer.from(iv, 'hex'),
    );
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));

    // Decrypt content
    const decryptedContent = Buffer.concat([
      decipher.update(Buffer.from(encryptedContent, 'hex')),
      decipher.final(),
    ]);

    return decryptedContent.toString('utf8');
  } catch (error: any) {
    // Log the error for debugging
    console.error(`Decryption failed: ${error.message}`);
    throw new Error('Decryption failed. Invalid or corrupted data.');
  }
}

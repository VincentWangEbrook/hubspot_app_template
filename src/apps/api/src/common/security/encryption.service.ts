import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';

/**
 * Simple encryption service wrapping AES-256-GCM.
 * In production prefer using a KMS (HashiCorp Vault, AWS KMS, GCP KMS) to manage keys.
 *
 * This service will try to use KMS if configured (placeholder), otherwise it will use
 * an env key 'TOKEN_ENCRYPTION_KEY' -- make sure this key is provided securely.
 *
 * NOTE: For demo we use env fallback. Do NOT commit the key to source control.
 */

@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly key: Buffer;

  constructor(private readonly config: ConfigService) {
    const k = this.config.get<string>('TOKEN_ENCRYPTION_KEY');
    if (!k) {
      this.logger.warn('TOKEN_ENCRYPTION_KEY not set; using insecure default for demo only');
    }
    // Use 32-byte key (256 bits). If not provided, use zeros (insecure).
    const keySource = k ?? 'demo-key-please-replace-with-secure-key-32bytes!!';
    this.key = crypto.createHash('sha256').update(keySource).digest();
  }

  encrypt(plain: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    // store iv, tag, encrypted as base64 joined by :
    return `${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
  }

  decrypt(cipherText: string): string {
    const [ivB64, tagB64, encB64] = cipherText.split(':');
    if (!ivB64 || !tagB64 || !encB64) {
      throw new Error('Invalid cipher text format');
    }
    const iv = Buffer.from(ivB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');
    const encrypted = Buffer.from(encB64, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  }
}

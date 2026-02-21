import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Encryption Utils', () => {
  const VALID_KEY = 'a'.repeat(64); // 64-char hex = 32 bytes

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = VALID_KEY;
  });

  afterEach(() => {
    delete process.env.ENCRYPTION_KEY;
    vi.resetModules();
  });

  // Dynamic import to pick up env changes
  async function getModule() {
    return await import('./encryption');
  }

  describe('encrypt/decrypt round-trip', () => {
    it('should round-trip a simple string', async () => {
      const { encrypt, decrypt } = await getModule();
      const plaintext = 'my-secret-password';
      const encrypted = encrypt(plaintext);
      expect(decrypt(encrypted)).toBe(plaintext);
    });

    it('should round-trip an empty string', async () => {
      const { encrypt, decrypt } = await getModule();
      const encrypted = encrypt('');
      expect(decrypt(encrypted)).toBe('');
    });

    it('should round-trip unicode characters', async () => {
      const { encrypt, decrypt } = await getModule();
      const plaintext = 'heslo s českou diakritiku 🔐';
      const encrypted = encrypt(plaintext);
      expect(decrypt(encrypted)).toBe(plaintext);
    });

    it('should round-trip a long string', async () => {
      const { encrypt, decrypt } = await getModule();
      const plaintext = 'x'.repeat(10000);
      const encrypted = encrypt(plaintext);
      expect(decrypt(encrypted)).toBe(plaintext);
    });
  });

  describe('unique IVs', () => {
    it('should produce different ciphertexts for the same input', async () => {
      const { encrypt } = await getModule();
      const plaintext = 'same-password';
      const a = encrypt(plaintext);
      const b = encrypt(plaintext);
      expect(a).not.toBe(b);
    });
  });

  describe('tamper detection', () => {
    it('should throw on corrupted ciphertext', async () => {
      const { encrypt, decrypt } = await getModule();
      const encrypted = encrypt('secret');
      const parts = encrypted.split(':');
      // Flip a character in the ciphertext
      parts[2] = parts[2].slice(0, -1) + (parts[2].slice(-1) === '0' ? '1' : '0');
      expect(() => decrypt(parts.join(':'))).toThrow();
    });

    it('should throw on corrupted auth tag', async () => {
      const { encrypt, decrypt } = await getModule();
      const encrypted = encrypt('secret');
      const parts = encrypted.split(':');
      parts[1] = '0'.repeat(parts[1].length);
      expect(() => decrypt(parts.join(':'))).toThrow();
    });

    it('should throw on invalid format', async () => {
      const { decrypt } = await getModule();
      expect(() => decrypt('not-valid-format')).toThrow('Invalid encrypted data format');
    });
  });

  describe('key validation', () => {
    it('should throw if ENCRYPTION_KEY is not set', async () => {
      delete process.env.ENCRYPTION_KEY;
      const { encrypt } = await getModule();
      expect(() => encrypt('test')).toThrow('ENCRYPTION_KEY must be a 64-character hex string');
    });

    it('should throw if ENCRYPTION_KEY is too short', async () => {
      process.env.ENCRYPTION_KEY = 'abcdef';
      const { encrypt } = await getModule();
      expect(() => encrypt('test')).toThrow('ENCRYPTION_KEY must be a 64-character hex string');
    });

    it('should throw if ENCRYPTION_KEY contains non-hex characters', async () => {
      process.env.ENCRYPTION_KEY = 'g'.repeat(64);
      const { encrypt } = await getModule();
      expect(() => encrypt('test')).toThrow('ENCRYPTION_KEY must be a 64-character hex string');
    });
  });

  describe('validateEncryptionKey', () => {
    it('should not throw with valid key', async () => {
      const { validateEncryptionKey } = await getModule();
      expect(() => validateEncryptionKey()).not.toThrow();
    });

    it('should throw with invalid key', async () => {
      delete process.env.ENCRYPTION_KEY;
      const { validateEncryptionKey } = await getModule();
      expect(() => validateEncryptionKey()).toThrow();
    });
  });
});

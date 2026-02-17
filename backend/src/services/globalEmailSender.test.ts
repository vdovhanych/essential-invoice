import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock nodemailer
const mockSendMail = vi.fn().mockResolvedValue({ messageId: 'test-id' });
vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn(() => ({
      sendMail: mockSendMail,
    })),
  },
}));

import { isGlobalSmtpConfigured, sendWelcomeEmail, sendPasswordResetEmail } from './globalEmailSender.js';
import nodemailer from 'nodemailer';

describe('globalEmailSender', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('isGlobalSmtpConfigured', () => {
    it('should return false when GLOBAL_SMTP_HOST is not set', () => {
      delete process.env.GLOBAL_SMTP_HOST;
      expect(isGlobalSmtpConfigured()).toBe(false);
    });

    it('should return true when GLOBAL_SMTP_HOST is set', () => {
      process.env.GLOBAL_SMTP_HOST = 'smtp.example.com';
      expect(isGlobalSmtpConfigured()).toBe(true);
    });
  });

  describe('sendWelcomeEmail', () => {
    it('should skip sending when SMTP is not configured', async () => {
      delete process.env.GLOBAL_SMTP_HOST;
      await sendWelcomeEmail('test@example.com', 'Test User');
      expect(nodemailer.createTransport).not.toHaveBeenCalled();
    });

    it('should send welcome email when SMTP is configured', async () => {
      process.env.GLOBAL_SMTP_HOST = 'smtp.example.com';
      process.env.GLOBAL_SMTP_PORT = '587';
      process.env.GLOBAL_SMTP_USER = 'user';
      process.env.GLOBAL_SMTP_PASSWORD = 'pass';
      process.env.GLOBAL_SMTP_FROM_EMAIL = 'noreply@example.com';
      process.env.GLOBAL_SMTP_FROM_NAME = 'essentialInvoice';

      await sendWelcomeEmail('test@example.com', 'Test User');

      expect(nodemailer.createTransport).toHaveBeenCalledWith({
        host: 'smtp.example.com',
        port: 587,
        secure: false,
        auth: { user: 'user', pass: 'pass' },
      });

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'test@example.com',
          subject: 'Vítejte v essentialInvoice',
          from: '"essentialInvoice" <noreply@example.com>',
        })
      );
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('should throw when SMTP is not configured', async () => {
      delete process.env.GLOBAL_SMTP_HOST;
      await expect(
        sendPasswordResetEmail('test@example.com', 'Test User', 'token123')
      ).rejects.toThrow('Global SMTP not configured');
    });

    it('should send reset email with correct reset URL', async () => {
      process.env.GLOBAL_SMTP_HOST = 'smtp.example.com';
      process.env.GLOBAL_SMTP_PORT = '587';
      process.env.GLOBAL_SMTP_USER = 'user';
      process.env.GLOBAL_SMTP_PASSWORD = 'pass';
      process.env.GLOBAL_SMTP_FROM_EMAIL = 'noreply@example.com';
      process.env.GLOBAL_SMTP_FROM_NAME = 'essentialInvoice';
      process.env.FRONTEND_URL = 'https://app.example.com';

      await sendPasswordResetEmail('test@example.com', 'Test User', 'reset-token-abc');

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'test@example.com',
          subject: 'Obnovení hesla - essentialInvoice',
        })
      );

      const callArgs = mockSendMail.mock.calls[0][0];
      expect(callArgs.text).toContain('https://app.example.com/reset-password?token=reset-token-abc');
      expect(callArgs.html).toContain('https://app.example.com/reset-password?token=reset-token-abc');
    });

    it('should use default FRONTEND_URL when not set', async () => {
      process.env.GLOBAL_SMTP_HOST = 'smtp.example.com';
      process.env.GLOBAL_SMTP_FROM_EMAIL = 'noreply@example.com';
      delete process.env.FRONTEND_URL;

      await sendPasswordResetEmail('test@example.com', 'Test User', 'token123');

      const callArgs = mockSendMail.mock.calls[0][0];
      expect(callArgs.text).toContain('http://localhost:8080/reset-password?token=token123');
    });
  });
});

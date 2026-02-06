import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database query function
const mockQuery = vi.fn();
vi.mock('../db/init.js', () => ({
  query: (...args: unknown[]) => mockQuery(...args)
}));

// Import after mocking
import { settingsRouter } from './settings.js';
import express from 'express';
import request from 'supertest';

// Create test app
const app = express();
app.use(express.json());

// Mock auth middleware
app.use((req, _res, next) => {
  (req as any).userId = 'test-user-id';
  next();
});

app.use('/settings', settingsRouter);

describe('Settings Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('PUT /settings', () => {
    it('should update defaultVatRate to 0', async () => {
      // Mock successful update
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: '1', default_vat_rate: 0 }]
      });

      const response = await request(app)
        .put('/settings')
        .send({ defaultVatRate: 0 });

      expect(response.status).toBe(200);

      // Verify the query was called with 0 value
      expect(mockQuery).toHaveBeenCalledTimes(1);
      const [sql, values] = mockQuery.mock.calls[0];

      // Check that default_vat_rate is in the SQL
      expect(sql).toContain('default_vat_rate');

      // Check that 0 is in the values array
      expect(values).toContain(0);
    });

    it('should update multiple fields including defaultVatRate: 0', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: '1' }]
      });

      const response = await request(app)
        .put('/settings')
        .send({
          defaultVatRate: 0,
          defaultPaymentTerms: 30,
          invoiceNumberPrefix: 'INV'
        });

      expect(response.status).toBe(200);

      const [sql, values] = mockQuery.mock.calls[0];
      expect(sql).toContain('default_vat_rate');
      expect(sql).toContain('default_payment_terms');
      expect(sql).toContain('invoice_number_prefix');

      // Verify 0 is passed for defaultVatRate
      expect(values).toContain(0);
      expect(values).toContain(30);
      expect(values).toContain('INV');
    });

    it('should not include paušální daň fields in update', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: '1' }]
      });

      const response = await request(app)
        .put('/settings')
        .send({
          defaultVatRate: 21,
          pausalniDanEnabled: true,
          pausalniDanTier: 2,
          pausalniDanLimit: 1500000
        });

      expect(response.status).toBe(200);

      const [sql] = mockQuery.mock.calls[0];
      // Paušální daň fields should NOT be in the SQL (moved to users table)
      expect(sql).not.toContain('pausalni_dan_enabled');
      expect(sql).not.toContain('pausalni_dan_tier');
      expect(sql).not.toContain('pausalni_dan_limit');
    });
  });

  describe('GET /settings', () => {
    it('should return defaultVatRate: 0 when stored as 0', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{
          smtp_host: null,
          smtp_port: 587,
          smtp_user: null,
          smtp_password: null,
          smtp_secure: true,
          smtp_from_email: null,
          smtp_from_name: null,
          imap_host: null,
          imap_port: 993,
          imap_user: null,
          imap_password: null,
          imap_tls: true,
          bank_notification_email: null,
          email_polling_interval: 300,
          invoice_number_prefix: '',
          invoice_number_format: 'YYYYMM##',
          default_vat_rate: '0.00', // Stored as DECIMAL
          default_payment_terms: 14,
          email_template: null,
          calculator_enabled: false,
          perplexity_api_key: null
        }]
      });

      const response = await request(app).get('/settings');

      expect(response.status).toBe(200);
      expect(response.body.defaultVatRate).toBe(0);
    });

    it('should not return paušální daň fields', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{
          smtp_host: null,
          smtp_port: 587,
          smtp_user: null,
          smtp_password: null,
          smtp_secure: true,
          smtp_from_email: null,
          smtp_from_name: null,
          imap_host: null,
          imap_port: 993,
          imap_user: null,
          imap_password: null,
          imap_tls: true,
          bank_notification_email: null,
          email_polling_interval: 300,
          invoice_number_prefix: '',
          invoice_number_format: 'YYYYMM##',
          default_vat_rate: '21.00',
          default_payment_terms: 14,
          email_template: null,
          calculator_enabled: false,
          perplexity_api_key: null,
          // These may still exist in DB but should not be returned
          pausalni_dan_enabled: true,
          pausalni_dan_tier: 2,
          pausalni_dan_limit: 1500000
        }]
      });

      const response = await request(app).get('/settings');

      expect(response.status).toBe(200);
      // Paušální daň fields should NOT be in the response (moved to users/profile)
      expect(response.body.pausalniDanEnabled).toBeUndefined();
      expect(response.body.pausalniDanTier).toBeUndefined();
      expect(response.body.pausalniDanLimit).toBeUndefined();
    });

    it('should return default settings when no settings exist', async () => {
      // First query returns empty (no settings)
      mockQuery.mockResolvedValueOnce({ rows: [] });
      // Insert default settings
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const response = await request(app).get('/settings');

      expect(response.status).toBe(200);
      expect(response.body.defaultVatRate).toBe(21);
      // Should not include paušální daň fields even in defaults
      expect(response.body.pausalniDanEnabled).toBeUndefined();
      expect(response.body.pausalniDanTier).toBeUndefined();
      expect(response.body.pausalniDanLimit).toBeUndefined();
    });
  });
});

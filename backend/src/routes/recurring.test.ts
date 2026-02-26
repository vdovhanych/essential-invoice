import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database query function
const mockQuery = vi.fn();
vi.mock('../db/init.js', () => ({
  query: (...args: unknown[]) => mockQuery(...args)
}));

// Mock the recurring invoice generator
vi.mock('../services/recurringInvoiceGenerator.js', () => ({
  generateInvoiceFromRecurring: vi.fn()
}));

import { generateInvoiceFromRecurring } from '../services/recurringInvoiceGenerator';

// Import after mocking
import { recurringRouter } from './recurring';
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

app.use('/recurring-invoices', recurringRouter);

describe('Recurring Invoices Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /recurring-invoices', () => {
    it('should return list of recurring templates', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 'ri-1',
          client_id: 'client-1',
          client_name: 'Test Company',
          client_email: 'test@test.cz',
          currency: 'CZK',
          vat_rate: '21.00',
          day_of_month: 15,
          start_date: '2026-01-01',
          end_date: null,
          next_generation_date: '2026-03-15',
          payment_terms: 14,
          auto_send: false,
          active: true,
          subtotal: '10000.00',
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        }]
      });

      const response = await request(app).get('/recurring-invoices');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].clientName).toBe('Test Company');
      expect(response.body[0].dayOfMonth).toBe(15);
      expect(response.body[0].active).toBe(true);
      expect(response.body[0].subtotal).toBe(10000);
    });
  });

  describe('GET /recurring-invoices/:id', () => {
    it('should return template with items', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 'ri-1',
          client_id: 'client-1',
          client_name: 'Test Company',
          client_email: 'test@test.cz',
          currency: 'CZK',
          vat_rate: '21.00',
          notes: 'Monthly retainer',
          day_of_month: 1,
          start_date: '2026-01-01',
          end_date: null,
          next_generation_date: '2026-03-01',
          payment_terms: 14,
          auto_send: false,
          active: true,
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        }]
      });
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 'item-1',
          description: 'Consulting',
          quantity: '10.00',
          unit: 'hod',
          unit_price: '1000.00',
        }]
      });

      const response = await request(app).get('/recurring-invoices/ri-1');

      expect(response.status).toBe(200);
      expect(response.body.clientName).toBe('Test Company');
      expect(response.body.notes).toBe('Monthly retainer');
      expect(response.body.items).toHaveLength(1);
      expect(response.body.items[0].description).toBe('Consulting');
      expect(response.body.items[0].unitPrice).toBe(1000);
    });

    it('should return 404 for non-existent template', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const response = await request(app).get('/recurring-invoices/non-existent');

      expect(response.status).toBe(404);
    });
  });

  describe('POST /recurring-invoices', () => {
    it('should create a recurring template', async () => {
      // Mock client check
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 'client-1' }] });
      // Mock INSERT
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 'new-ri',
          next_generation_date: '2026-03-15',
          active: true,
        }]
      });
      // Mock item INSERT
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .post('/recurring-invoices')
        .send({
          clientId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
          dayOfMonth: 15,
          startDate: '2026-01-01',
          currency: 'CZK',
          vatRate: 21,
          paymentTerms: 14,
          items: [
            { description: 'Consulting', quantity: 10, unit: 'hod', unitPrice: 1000 }
          ],
        });

      expect(response.status).toBe(201);
      expect(response.body.id).toBe('new-ri');
      expect(response.body.active).toBe(true);
    });

    it('should reject missing clientId', async () => {
      const response = await request(app)
        .post('/recurring-invoices')
        .send({
          dayOfMonth: 15,
          startDate: '2026-01-01',
          items: [{ description: 'Test', quantity: 1, unitPrice: 100 }],
        });

      expect(response.status).toBe(400);
    });

    it('should reject invalid dayOfMonth (> 28)', async () => {
      const response = await request(app)
        .post('/recurring-invoices')
        .send({
          clientId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
          dayOfMonth: 31,
          startDate: '2026-01-01',
          items: [{ description: 'Test', quantity: 1, unitPrice: 100 }],
        });

      expect(response.status).toBe(400);
    });

    it('should reject empty items array', async () => {
      const response = await request(app)
        .post('/recurring-invoices')
        .send({
          clientId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
          dayOfMonth: 15,
          startDate: '2026-01-01',
          items: [],
        });

      expect(response.status).toBe(400);
    });

    it('should reject invalid client', async () => {
      // Client check returns no rows
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .post('/recurring-invoices')
        .send({
          clientId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
          dayOfMonth: 15,
          startDate: '2026-01-01',
          items: [{ description: 'Test', quantity: 1, unitPrice: 100 }],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid client');
    });

    it('should reject endDate before startDate', async () => {
      // Client check
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 'client-1' }] });

      const response = await request(app)
        .post('/recurring-invoices')
        .send({
          clientId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
          dayOfMonth: 15,
          startDate: '2026-06-01',
          endDate: '2026-01-01',
          items: [{ description: 'Test', quantity: 1, unitPrice: 100 }],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('End date');
    });
  });

  describe('DELETE /recurring-invoices/:id', () => {
    it('should delete a template', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 'ri-1' }] });

      const response = await request(app).delete('/recurring-invoices/ri-1');

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('deleted');
    });

    it('should return 404 for non-existent template', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const response = await request(app).delete('/recurring-invoices/non-existent');

      expect(response.status).toBe(404);
    });
  });

  describe('POST /recurring-invoices/:id/toggle', () => {
    it('should toggle active status', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ active: false }] });

      const response = await request(app).post('/recurring-invoices/ri-1/toggle');

      expect(response.status).toBe(200);
      expect(response.body.active).toBe(false);

      const [sql] = mockQuery.mock.calls[0];
      expect(sql).toContain('active = NOT active');
    });

    it('should return 404 for non-existent template', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const response = await request(app).post('/recurring-invoices/non-existent/toggle');

      expect(response.status).toBe(404);
    });
  });

  describe('POST /recurring-invoices/:id/generate-now', () => {
    it('should generate invoice from template', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 'ri-1',
          user_id: 'test-user-id',
          client_id: 'client-1',
          currency: 'CZK',
          vat_rate: '21.00',
          notes: null,
          day_of_month: 15,
          next_generation_date: '2026-03-15',
          payment_terms: 14,
          auto_send: false,
          active: true,
        }]
      });
      vi.mocked(generateInvoiceFromRecurring).mockResolvedValueOnce({
        success: true,
        invoiceId: 'new-inv-1',
      });

      const response = await request(app).post('/recurring-invoices/ri-1/generate-now');

      expect(response.status).toBe(200);
      expect(response.body.invoiceId).toBe('new-inv-1');
    });

    it('should return 404 for non-existent template', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const response = await request(app).post('/recurring-invoices/non-existent/generate-now');

      expect(response.status).toBe(404);
    });

    it('should return 500 when generation fails', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 'ri-1',
          user_id: 'test-user-id',
          client_id: 'client-1',
          currency: 'CZK',
          vat_rate: '21.00',
          notes: null,
          day_of_month: 15,
          next_generation_date: '2026-03-15',
          payment_terms: 14,
          auto_send: false,
          active: true,
        }]
      });
      vi.mocked(generateInvoiceFromRecurring).mockResolvedValueOnce({
        success: false,
        error: 'No items in recurring template',
      });

      const response = await request(app).post('/recurring-invoices/ri-1/generate-now');

      expect(response.status).toBe(500);
      expect(response.body.error).toContain('No items');
    });
  });

  describe('PUT /recurring-invoices/:id', () => {
    it('should update a template', async () => {
      // Mock existing check
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 'ri-1',
          day_of_month: 15,
          next_generation_date: '2026-03-15',
        }]
      });
      // Mock UPDATE
      mockQuery.mockResolvedValueOnce({ rows: [] });
      // Mock DELETE items
      mockQuery.mockResolvedValueOnce({ rows: [] });
      // Mock INSERT item
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .put('/recurring-invoices/ri-1')
        .send({
          notes: 'Updated notes',
          items: [
            { description: 'New item', quantity: 5, unit: 'ks', unitPrice: 500 }
          ],
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('updated');
    });

    it('should return 404 for non-existent template', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .put('/recurring-invoices/non-existent')
        .send({ notes: 'test' });

      expect(response.status).toBe(404);
    });
  });
});

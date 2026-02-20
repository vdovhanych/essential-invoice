import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express, { Express } from 'express';
import { paymentRouter } from './payments';
import * as db from '../db/init';

// Mock the database module
vi.mock('../db/init.js', () => ({
  query: vi.fn()
}));

// Mock the email poller
vi.mock('../services/emailPoller.js', () => ({
  triggerPoll: vi.fn()
}));

// Mock auth middleware
const mockAuthMiddleware = (req: any, _res: any, next: any) => {
  req.userId = 'test-user-id';
  next();
};

describe('Payment Routes', () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use(mockAuthMiddleware);
    app.use('/payments', paymentRouter);
    vi.clearAllMocks();
  });

  describe('DELETE /payments/:id', () => {
    it('should delete an unmatched payment successfully', async () => {
      const mockPaymentId = 'payment-123';

      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [{ id: mockPaymentId }],
        command: 'DELETE',
        rowCount: 1,
        oid: 0,
        fields: []
      });

      const response = await request(app)
        .delete(`/payments/${mockPaymentId}`)
        .expect(200);

      expect(response.body).toEqual({ message: 'Payment deleted successfully' });
      expect(db.query).toHaveBeenCalledWith(
        'DELETE FROM payments WHERE id = $1 AND user_id = $2 AND invoice_id IS NULL RETURNING id',
        [mockPaymentId, 'test-user-id']
      );
    });

    it('should return 404 if payment not found', async () => {
      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [],
        command: 'DELETE',
        rowCount: 0,
        oid: 0,
        fields: []
      });

      const response = await request(app)
        .delete('/payments/nonexistent-id')
        .expect(404);

      expect(response.body).toEqual({
        error: 'Payment not found or is matched to an invoice'
      });
    });

    it('should return 404 if payment is matched to an invoice', async () => {
      // The SQL query includes "AND invoice_id IS NULL", so matched payments won't be deleted
      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [],
        command: 'DELETE',
        rowCount: 0,
        oid: 0,
        fields: []
      });

      const response = await request(app)
        .delete('/payments/matched-payment-id')
        .expect(404);

      expect(response.body).toEqual({
        error: 'Payment not found or is matched to an invoice'
      });
    });

    it('should return 500 on database error', async () => {
      vi.mocked(db.query).mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .delete('/payments/payment-123')
        .expect(500);

      expect(response.body).toEqual({ error: 'Failed to delete payment' });
    });
  });

  describe('POST /payments/:id/unmatch', () => {
    it('should unmatch a payment and update invoice status', async () => {
      const mockPaymentId = 'payment-123';
      const mockInvoiceId = 'invoice-456';

      // Mock getting payment with invoice_id
      vi.mocked(db.query)
        .mockResolvedValueOnce({
          rows: [{ invoice_id: mockInvoiceId }],
          command: 'SELECT',
          rowCount: 1,
          oid: 0,
          fields: []
        })
        // Mock unmatch payment
        .mockResolvedValueOnce({
          rows: [],
          command: 'UPDATE',
          rowCount: 1,
          oid: 0,
          fields: []
        })
        // Mock update invoice status
        .mockResolvedValueOnce({
          rows: [],
          command: 'UPDATE',
          rowCount: 1,
          oid: 0,
          fields: []
        });

      const response = await request(app)
        .post(`/payments/${mockPaymentId}/unmatch`)
        .expect(200);

      expect(response.body).toEqual({ message: 'Payment unmatched successfully' });
      expect(db.query).toHaveBeenCalledTimes(3);
    });

    it('should return 404 if payment not found', async () => {
      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [],
        command: 'SELECT',
        rowCount: 0,
        oid: 0,
        fields: []
      });

      const response = await request(app)
        .post('/payments/nonexistent-id/unmatch')
        .expect(404);

      expect(response.body).toEqual({ error: 'Payment not found' });
    });

    it('should return 400 if payment is not matched', async () => {
      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [{ invoice_id: null }],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: []
      });

      const response = await request(app)
        .post('/payments/unmatched-payment/unmatch')
        .expect(400);

      expect(response.body).toEqual({
        error: 'Payment is not matched to any invoice'
      });
    });
  });
});

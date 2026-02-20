import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database query function
const mockQuery = vi.fn();
vi.mock('../db/init.js', () => ({
  query: (...args: unknown[]) => mockQuery(...args)
}));

// Import after mocking
import { dashboardRouter } from './dashboard';
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

app.use('/dashboard', dashboardRouter);

describe('Dashboard Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /dashboard', () => {
    it('should read paušální daň from users table, not settings', async () => {
      // Stats query
      mockQuery.mockResolvedValueOnce({
        rows: [{
          draft_count: '0', sent_count: '1', paid_count: '2',
          overdue_count: '0', cancelled_count: '0',
          outstanding_amount: '10000', paid_amount: '20000', paid_this_month: '5000'
        }]
      });
      // Recent invoices
      mockQuery.mockResolvedValueOnce({ rows: [] });
      // Monthly revenue
      mockQuery.mockResolvedValueOnce({ rows: [] });
      // Update overdue
      mockQuery.mockResolvedValueOnce({ rows: [] });
      // Unmatched payments
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '0' }] });
      // Paušální daň from users table
      mockQuery.mockResolvedValueOnce({
        rows: [{
          pausalni_dan_enabled: true,
          pausalni_dan_tier: 2,
          pausalni_dan_limit: 1500000
        }]
      });
      // Yearly invoiced
      mockQuery.mockResolvedValueOnce({
        rows: [{ total_invoiced: '500000' }]
      });

      const response = await request(app).get('/dashboard');

      expect(response.status).toBe(200);
      expect(response.body.pausalniDan).toBeDefined();
      expect(response.body.pausalniDan.enabled).toBe(true);
      expect(response.body.pausalniDan.tier).toBe(2);
      expect(response.body.pausalniDan.limit).toBe(1500000);
      expect(response.body.pausalniDan.invoicedThisYear).toBe(500000);
      expect(response.body.pausalniDan.remaining).toBe(1000000);

      // Verify the paušální daň query reads from users table, not settings
      const pausalniDanQuery = mockQuery.mock.calls[5][0];
      expect(pausalniDanQuery).toContain('FROM users');
      expect(pausalniDanQuery).not.toContain('FROM settings');
    });

    it('should handle user without paušální daň enabled', async () => {
      // Stats query
      mockQuery.mockResolvedValueOnce({
        rows: [{
          draft_count: '0', sent_count: '0', paid_count: '0',
          overdue_count: '0', cancelled_count: '0',
          outstanding_amount: '0', paid_amount: '0', paid_this_month: '0'
        }]
      });
      // Recent invoices
      mockQuery.mockResolvedValueOnce({ rows: [] });
      // Monthly revenue
      mockQuery.mockResolvedValueOnce({ rows: [] });
      // Update overdue
      mockQuery.mockResolvedValueOnce({ rows: [] });
      // Unmatched payments
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '0' }] });
      // Paušální daň - not enabled
      mockQuery.mockResolvedValueOnce({
        rows: [{
          pausalni_dan_enabled: false,
          pausalni_dan_tier: 1,
          pausalni_dan_limit: 1000000
        }]
      });
      // Yearly invoiced
      mockQuery.mockResolvedValueOnce({
        rows: [{ total_invoiced: '0' }]
      });

      const response = await request(app).get('/dashboard');

      expect(response.status).toBe(200);
      expect(response.body.pausalniDan.enabled).toBe(false);
      expect(response.body.pausalniDan.remaining).toBe(1000000);
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  callPerplexity, 
  extractResponseText, 
  categorizeInvoiceItems,
  matchPaymentToInvoice,
  getFinancialInsights,
  getCzechTaxAdvice,
  isPerplexityConfigured 
} from './perplexityAI';
import * as dbInit from '../db/init.js';

// Mock fetch
global.fetch = vi.fn();

// Mock database query
vi.mock('../db/init.js', () => ({
  query: vi.fn(),
}));

const mockQuery = vi.mocked(dbInit.query);

describe('Perplexity AI Service', () => {
  const testUserId = 'test-user-id';

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock API key query to return test key
    mockQuery.mockResolvedValue({
      rows: [{ perplexity_api_key: 'test-key' }],
      rowCount: 1,
      command: 'SELECT',
      oid: 0,
      fields: [],
    });
  });

  describe('isPerplexityConfigured', () => {
    it('should return true if API key is configured', async () => {
      const result = await isPerplexityConfigured(testUserId);
      expect(result).toBe(true);
      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT perplexity_api_key FROM settings WHERE user_id = $1',
        [testUserId]
      );
    });

    it('should return false if API key is not configured', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ perplexity_api_key: null }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });
      const result = await isPerplexityConfigured(testUserId);
      expect(result).toBe(false);
    });
  });

  describe('callPerplexity', () => {
    it('should throw error if API key is not configured', async () => {
      await expect(callPerplexity('', [{ role: 'user', content: 'test' }])).rejects.toThrow(
        'PERPLEXITY_API_KEY is not configured'
      );
    });

    it('should call Perplexity API with correct parameters', async () => {
      const mockResponse = {
        id: 'test-id',
        model: 'test-model',
        object: 'chat.completion',
        created: Date.now(),
        choices: [
          {
            index: 0,
            finish_reason: 'stop',
            message: {
              role: 'assistant',
              content: 'Test response',
            },
          },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const messages = [{ role: 'user' as const, content: 'Hello' }];
      const result = await callPerplexity('test-key', messages);

      expect(fetch).toHaveBeenCalledWith(
        'https://api.perplexity.ai/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-key',
          }),
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it('should throw error on API failure', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      });

      await expect(
        callPerplexity('test-key', [{ role: 'user', content: 'test' }])
      ).rejects.toThrow('Perplexity API error: 500');
    });
  });

  describe('extractResponseText', () => {
    it('should extract text from response', () => {
      const response = {
        id: 'test',
        model: 'test',
        object: 'test',
        created: 0,
        choices: [
          {
            index: 0,
            finish_reason: 'stop',
            message: {
              role: 'assistant',
              content: 'Extracted text',
            },
          },
        ],
      };

      expect(extractResponseText(response)).toBe('Extracted text');
    });

    it('should throw error if no choices', () => {
      const response = {
        id: 'test',
        model: 'test',
        object: 'test',
        created: 0,
        choices: [],
      };

      expect(() => extractResponseText(response)).toThrow('No response from Perplexity AI');
    });
  });

  describe('categorizeInvoiceItems', () => {
    it('should return categorized items', async () => {
      const mockResponse = {
        id: 'test',
        model: 'test',
        object: 'test',
        created: 0,
        choices: [
          {
            index: 0,
            finish_reason: 'stop',
            message: {
              role: 'assistant',
              content: JSON.stringify([
                { description: 'Web development', category: 'Web Development', confidence: 0.95 },
                { description: 'Logo design', category: 'Design', confidence: 0.9 },
              ]),
            },
          },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const items = [
        { description: 'Web development', total: 10000 },
        { description: 'Logo design', total: 5000 },
      ];

      const result = await categorizeInvoiceItems(testUserId, items);
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('category');
      expect(result[0]).toHaveProperty('confidence');
    });
  });

  describe('matchPaymentToInvoice', () => {
    it('should return matching invoice', async () => {
      const mockResponse = {
        id: 'test',
        model: 'test',
        object: 'test',
        created: 0,
        choices: [
          {
            index: 0,
            finish_reason: 'stop',
            message: {
              role: 'assistant',
              content: JSON.stringify({
                invoiceId: 'inv-123',
                confidence: 0.95,
                reason: 'Amount matches exactly',
              }),
            },
          },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const payment = {
        amount: 10000,
        senderName: 'Test Client',
        message: 'Payment for invoice',
        variableSymbol: '123456',
        transactionDate: new Date(),
      };

      const invoices = [
        {
          id: 'inv-123',
          invoiceNumber: '2024010001',
          clientName: 'Test Client',
          total: 10000,
          dueDate: new Date(),
          issueDate: new Date(),
        },
      ];

      const result = await matchPaymentToInvoice(testUserId, payment, invoices);
      expect(result).toHaveProperty('invoiceId', 'inv-123');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('reason');
    });

    it('should return null if no match', async () => {
      const mockResponse = {
        id: 'test',
        model: 'test',
        object: 'test',
        created: 0,
        choices: [
          {
            index: 0,
            finish_reason: 'stop',
            message: {
              role: 'assistant',
              content: 'null - no good match found',
            },
          },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await matchPaymentToInvoice(
        testUserId,
        { amount: 1000, transactionDate: new Date() },
        []
      );
      expect(result).toBeNull();
    });
  });

  describe('getFinancialInsights', () => {
    it('should return insights text', async () => {
      const mockResponse = {
        id: 'test',
        model: 'test',
        object: 'test',
        created: 0,
        choices: [
          {
            index: 0,
            finish_reason: 'stop',
            message: {
              role: 'assistant',
              content: 'Your revenue has increased by 20% this month.',
            },
          },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const data = {
        totalRevenue: 100000,
        currentMonth: 30000,
        previousMonth: 25000,
        topClients: [{ name: 'Client A', revenue: 50000 }],
        currency: 'CZK',
      };

      const result = await getFinancialInsights(testUserId, data);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('getCzechTaxAdvice', () => {
    it('should return tax advice', async () => {
      const mockResponse = {
        id: 'test',
        model: 'test',
        object: 'test',
        created: 0,
        choices: [
          {
            index: 0,
            finish_reason: 'stop',
            message: {
              role: 'assistant',
              content: 'VAT filing deadline is monthly for businesses over 10M CZK.',
            },
          },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await getCzechTaxAdvice(testUserId, 'When is VAT filing deadline?');
      expect(result).toHaveProperty('answer');
      expect(typeof result.answer).toBe('string');
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  callAI,
  extractResponseText,
  getCzechTaxAdvice,
  extractExpenseFromDocument,
  draftPaymentReminder,
  isAIConfigured,
} from './aiProvider';
import * as dbInit from '../db/init';

// Mock fetch
global.fetch = vi.fn();

// Mock database query
vi.mock('../db/init.js', () => ({
  query: vi.fn(),
}));

// Mock encryption module
vi.mock('../utils/encryption.js', () => ({
  encrypt: (value: string) => `encrypted:${value}`,
  decrypt: (value: string) => value.replace('encrypted:', ''),
}));

const mockQuery = vi.mocked(dbInit.query);

const testConfig = {
  apiKey: 'test-key',
  apiUrl: 'https://openrouter.ai/api/v1',
  model: 'openai/gpt-5.6-luna',
};

describe('AI Provider Service', () => {
  const testUserId = 'test-user-id';

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock config query to return test key with default URL/model
    mockQuery.mockResolvedValue({
      rows: [{ ai_api_key: 'test-key', ai_api_url: null, ai_model: null }],
      rowCount: 1,
      command: 'SELECT',
      oid: 0,
      fields: [],
    });
  });

  describe('isAIConfigured', () => {
    it('should return true if API key is configured', async () => {
      const result = await isAIConfigured(testUserId);
      expect(result).toBe(true);
      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT ai_api_key, ai_api_url, ai_model FROM settings WHERE user_id = $1',
        [testUserId]
      );
    });

    it('should return false if API key is not configured', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ ai_api_key: null, ai_api_url: null, ai_model: null }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });
      const result = await isAIConfigured(testUserId);
      expect(result).toBe(false);
    });
  });

  describe('callAI', () => {
    it('should throw error if API key is not configured', async () => {
      await expect(
        callAI({ ...testConfig, apiKey: '' }, [{ role: 'user', content: 'test' }])
      ).rejects.toThrow('AI API key is not configured');
    });

    it('should call the chat completions API with correct parameters', async () => {
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
      const result = await callAI(testConfig, messages);

      expect(fetch).toHaveBeenCalledWith(
        'https://openrouter.ai/api/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-key',
          }),
        })
      );
      const body = JSON.parse((global.fetch as any).mock.calls[0][1].body);
      expect(body.model).toBe('openai/gpt-5.6-luna');
      expect(result).toEqual(mockResponse);
    });

    it('should append :online suffix for web search on OpenRouter', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ choices: [] }),
      });

      await callAI(testConfig, [{ role: 'user', content: 'test' }], { webSearch: true });

      const body = JSON.parse((global.fetch as any).mock.calls[0][1].body);
      expect(body.model).toBe('openai/gpt-5.6-luna:online');
    });

    it('should not append :online suffix on non-OpenRouter endpoints', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ choices: [] }),
      });

      const customConfig = {
        apiKey: 'test-key',
        apiUrl: 'https://api.openai.com/v1',
        model: 'gpt-5.6-luna',
      };
      await callAI(customConfig, [{ role: 'user', content: 'test' }], { webSearch: true });

      expect(fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.anything()
      );
      const body = JSON.parse((global.fetch as any).mock.calls[0][1].body);
      expect(body.model).toBe('gpt-5.6-luna');
    });

    it('should throw error on API failure', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      });

      await expect(
        callAI(testConfig, [{ role: 'user', content: 'test' }])
      ).rejects.toThrow('AI API error: 500');
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

      expect(() => extractResponseText(response)).toThrow('No response from AI provider');
    });
  });

  describe('getCzechTaxAdvice', () => {
    it('should return tax advice using web search', async () => {
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

      // Tax advisor should request web search (:online on OpenRouter default)
      const body = JSON.parse((global.fetch as any).mock.calls[0][1].body);
      expect(body.model).toBe('openai/gpt-5.6-luna:online');
    });

    it('should personalize the system prompt with user tax context', async () => {
      // 1) AI config, 2) user tax fields, 3) revenue aggregates
      mockQuery
        .mockResolvedValueOnce({
          rows: [{ ai_api_key: 'test-key', ai_api_url: null, ai_model: null }],
          rowCount: 1, command: 'SELECT', oid: 0, fields: [],
        })
        .mockResolvedValueOnce({
          rows: [{ vat_payer: true, pausalni_dan_enabled: true, pausalni_dan_tier: 2, pausalni_dan_limit: 1500000 }],
          rowCount: 1, command: 'SELECT', oid: 0, fields: [],
        })
        .mockResolvedValueOnce({
          rows: [{ revenue_ytd: '850000.50', outstanding: '120000.00' }],
          rowCount: 1, command: 'SELECT', oid: 0, fields: [],
        });

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: 'answer' } }],
        }),
      });

      await getCzechTaxAdvice(testUserId, 'Kolik mi zbývá do limitu paušální daně?');

      const body = JSON.parse((global.fetch as any).mock.calls[0][1].body);
      const systemPrompt = body.messages[0].content;
      expect(systemPrompt).toContain('VAT payer (plátce DPH): yes');
      expect(systemPrompt).toContain('tier 2');
      expect(systemPrompt).toContain('1500000 CZK');
      expect(systemPrompt).toContain('Paid revenue this calendar year: 850001 CZK');
      expect(systemPrompt).toContain('Outstanding (sent/overdue) invoices: 120000 CZK');
    });

    it('should still answer when tax context cannot be loaded', async () => {
      // Config resolves, user lookup returns no rows
      mockQuery
        .mockResolvedValueOnce({
          rows: [{ ai_api_key: 'test-key', ai_api_url: null, ai_model: null }],
          rowCount: 1, command: 'SELECT', oid: 0, fields: [],
        })
        .mockResolvedValueOnce({
          rows: [], rowCount: 0, command: 'SELECT', oid: 0, fields: [],
        });

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: 'answer' } }],
        }),
      });

      const result = await getCzechTaxAdvice(testUserId, 'When is VAT filing deadline?');
      expect(result.answer).toBe('answer');
    });
  });

  describe('extractExpenseFromDocument', () => {
    const extractedJson = {
      supplierName: 'Alza.cz a.s.',
      supplierIco: '27082440',
      supplierInvoiceNumber: 'FV-2026-123',
      issueDate: '2026-08-01',
      dueDate: '2026-08-15',
      currency: 'CZK',
      amount: 1000,
      vatRate: 21,
      total: 1210,
      description: 'Office supplies',
    };

    it('should send images as image_url content parts and return parsed data', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: JSON.stringify(extractedJson) } }],
        }),
      });

      const result = await extractExpenseFromDocument(testUserId, 'aW1hZ2VkYXRh', 'image/png');

      expect(result).toEqual(extractedJson);
      const body = JSON.parse((global.fetch as any).mock.calls[0][1].body);
      const parts = body.messages[1].content;
      expect(parts[1].type).toBe('image_url');
      expect(parts[1].image_url.url).toBe('data:image/png;base64,aW1hZ2VkYXRh');
      // Extraction should not pay for web search
      expect(body.model).toBe('openai/gpt-5.6-luna');
    });

    it('should send PDFs as file content parts', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: JSON.stringify(extractedJson) } }],
        }),
      });

      await extractExpenseFromDocument(testUserId, 'cGRmZGF0YQ==', 'application/pdf', 'faktura.pdf');

      const body = JSON.parse((global.fetch as any).mock.calls[0][1].body);
      const parts = body.messages[1].content;
      expect(parts[1].type).toBe('file');
      expect(parts[1].file.filename).toBe('faktura.pdf');
      expect(parts[1].file.file_data).toBe('data:application/pdf;base64,cGRmZGF0YQ==');
    });

    it('should return null when the response contains no JSON', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: 'Sorry, I cannot read this document.' } }],
        }),
      });

      const result = await extractExpenseFromDocument(testUserId, 'aW1hZ2VkYXRh', 'image/jpeg');
      expect(result).toBeNull();
    });
  });

  describe('draftPaymentReminder', () => {
    const testInvoice = {
      invoiceNumber: '2026080001',
      clientName: 'Test Client s.r.o.',
      total: 25000,
      currency: 'CZK',
      dueDate: new Date('2026-07-15'),
      daysOverdue: 23,
    };

    it('should return subject and body from the AI draft', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            index: 0,
            finish_reason: 'stop',
            message: { role: 'assistant', content: JSON.stringify({ subject: 'Upomínka: faktura 2026080001', body: 'Dobrý den,\n...' }) },
          }],
        }),
      });

      const result = await draftPaymentReminder(testUserId, testInvoice, 'cs', 'Jan Novák');

      expect(result.subject).toBe('Upomínka: faktura 2026080001');
      expect(result.body).toContain('Dobrý den');

      const body = JSON.parse((global.fetch as any).mock.calls[0][1].body);
      expect(body.messages[1].content).toContain('2026080001');
      expect(body.messages[1].content).toContain('Days overdue: 23');
      expect(body.messages[1].content).toContain('Jan Novák');
      expect(body.messages[1].content).toContain('Czech');
    });

    it('should throw when the AI response is not a valid draft', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: 'here is your email' } }],
        }),
      });

      await expect(
        draftPaymentReminder(testUserId, testInvoice, 'en', null)
      ).rejects.toThrow('AI did not return a valid reminder draft');
    });
  });
});

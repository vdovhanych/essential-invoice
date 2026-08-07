import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  callAI,
  extractResponseText,
  getCzechTaxAdvice,
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
  });
});

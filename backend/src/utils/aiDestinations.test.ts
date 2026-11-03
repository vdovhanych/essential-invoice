import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createServer } from 'node:http';
import { allowedAIBaseUrls, resolveAIBaseUrl } from './aiDestinations';
import { callAI, getCzechTaxAdvice } from '../services/aiProvider';
vi.mock('../db/init', () => ({ query: vi.fn() }));
vi.mock('./encryption', () => ({ decrypt: (value: string) => value }));
import { query } from '../db/init';
beforeEach(() => { vi.stubEnv('AI_ALLOWED_BASE_URLS', ''); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
it.each(['https://api.openai.com/v1', 'https://openrouter.ai/api/v1/'])('allows built-in provider %s', url => {
  expect(resolveAIBaseUrl(url)).toBe(url.replace(/\/$/, ''));
});
it.each([
  'http://127.0.0.1:9999/v1', 'https://api.openai.com.example.invalid/v1',
  'https://api.openai.com@model.example.invalid/v1', 'https://api.openai.com:444/v1',
  'https://api.openai.com/v1?x=1', 'https://api.openai.com/v1#part',
  'https://api.openai.com/%76%31', 'https://api.openai.com/v1\\other',
  'http://api.openai.com/v1', 'https://api.openai.com/v1/other',
])('rejects unapproved or ambiguous URL %s before any fetch', async apiUrl => {
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
  await expect(callAI({ apiKey: 'synthetic', apiUrl, model: 'synthetic' }, [])).rejects.toThrow();
  expect(fetch).not.toHaveBeenCalled();
});
it('requires explicit operator opt-in even in development and allows only that exact base URL', () => {
  vi.stubEnv('NODE_ENV', 'development');
  expect(() => resolveAIBaseUrl('http://localhost:11434/v1')).toThrow();
  vi.stubEnv('AI_ALLOWED_BASE_URLS', 'http://localhost:11434/v1');
  expect(allowedAIBaseUrls()).toContain('http://localhost:11434/v1');
  expect(resolveAIBaseUrl('http://localhost:11434/v1')).toBe('http://localhost:11434/v1');
  expect(() => resolveAIBaseUrl('http://localhost:11435/v1')).toThrow();
});
it('blocks previously saved custom settings without falling back to another provider', async () => {
  vi.mocked(query).mockResolvedValue({ rows: [{ ai_api_key: 'synthetic', ai_api_url: 'https://old.example.invalid/v1' }] } as any);
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
  await expect(getCzechTaxAdvice('synthetic-user', 'synthetic question')).rejects.toThrow('not enabled');
  expect(fetch).not.toHaveBeenCalled();
});
it('does not follow redirects from an operator-approved local test provider', async () => {
  let redirectedRequests = 0;
  const server = createServer((req, res) => {
    if (req.url === '/v1/chat/completions') {
      res.writeHead(302, { Location: '/other' }); res.end();
    } else { redirectedRequests++; res.end('{}'); }
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Missing test address');
    const apiUrl = `http://127.0.0.1:${address.port}/v1`;
    vi.stubEnv('AI_ALLOWED_BASE_URLS', apiUrl);
    await expect(callAI({ apiKey: 'synthetic', apiUrl, model: 'synthetic' }, [])).rejects.toThrow();
    expect(redirectedRequests).toBe(0);
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
});

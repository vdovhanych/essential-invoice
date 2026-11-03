export const DEFAULT_AI_API_URL = 'https://openrouter.ai/api/v1';
const BUILTIN_URLS = [DEFAULT_AI_API_URL, 'https://api.openai.com/v1'];

function canonicalBase(value: string): string {
  // Reject ambiguous syntax before URL parsing can normalize it away.
  if (typeof value !== 'string' || /[\s\\%?#]/.test(value)) throw new Error('Invalid AI endpoint');
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
    throw new Error('Invalid AI endpoint');
  return url.href.replace(/\/+$/, '');
}

export function allowedAIBaseUrls(): string[] {
  const custom = (process.env.AI_ALLOWED_BASE_URLS || '').split(',').filter(Boolean).map(canonicalBase);
  return [...new Set([...BUILTIN_URLS, ...custom])];
}

export function resolveAIBaseUrl(value: string): string {
  const canonical = canonicalBase(value || DEFAULT_AI_API_URL);
  if (!allowedAIBaseUrls().includes(canonical)) throw new Error('AI endpoint is not enabled by the deployment operator');
  return canonical;
}

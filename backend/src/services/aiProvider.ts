import { query } from '../db/init';
import { decrypt } from '../utils/encryption';

// Default provider is OpenRouter, but any OpenAI-compatible chat completions
// API works (the base URL and model are user-configurable in Settings)
export const DEFAULT_AI_API_URL = 'https://openrouter.ai/api/v1';
export const DEFAULT_AI_MODEL = 'openai/gpt-5.6-luna';

export interface AIConfig {
  apiKey: string;
  apiUrl: string;
  model: string;
}

/**
 * Get the AI provider configuration for a user from settings
 * @param userId - User ID to get configuration for
 */
async function getUserAIConfig(userId: string): Promise<AIConfig | null> {
  try {
    const result = await query(
      'SELECT ai_api_key, ai_api_url, ai_model FROM settings WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0 || !result.rows[0].ai_api_key) {
      return null;
    }

    return {
      apiKey: decrypt(result.rows[0].ai_api_key),
      apiUrl: result.rows[0].ai_api_url || DEFAULT_AI_API_URL,
      model: result.rows[0].ai_model || DEFAULT_AI_MODEL,
    };
  } catch (error) {
    console.error('Error getting AI configuration:', error);
    return null;
  }
}

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIResponse {
  id: string;
  model: string;
  object: string;
  created: number;
  choices: Array<{
    index: number;
    finish_reason: string;
    message: {
      role: string;
      content: string;
    };
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Call an OpenAI-compatible chat completions API
 * @param config - AI provider configuration (API key, base URL, model)
 * @param messages - Array of messages for the conversation
 * @param options - temperature (default 0.2), webSearch (appends OpenRouter's
 *   `:online` suffix for live web search; only applied on OpenRouter)
 * @returns Chat completions API response
 */
export async function callAI(
  config: AIConfig,
  messages: AIMessage[],
  options: { temperature?: number; webSearch?: boolean } = {}
): Promise<AIResponse> {
  const { temperature = 0.2, webSearch = false } = options;

  if (!config.apiKey) {
    throw new Error('AI API key is not configured');
  }

  let model = config.model;
  if (webSearch && config.apiUrl.includes('openrouter.ai') && !model.endsWith(':online')) {
    model = `${model}:online`;
  }

  const response = await fetch(`${config.apiUrl.replace(/\/+$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
      // OpenRouter app attribution headers; ignored by other providers
      'X-Title': 'Essential Invoice',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI API error: ${response.status} - ${errorText}`);
  }

  return (await response.json()) as AIResponse;
}

/**
 * Extract the assistant's response text from an AI response
 */
export function extractResponseText(response: AIResponse): string {
  if (!response.choices || response.choices.length === 0) {
    throw new Error('No response from AI provider');
  }
  return response.choices[0].message.content;
}

/**
 * Czech tax and compliance advisor
 * Answers tax-related questions for Czech freelancers using web search
 * @param userId - User ID to get configuration for
 * @param question - Tax question to answer
 */
export async function getCzechTaxAdvice(
  userId: string,
  question: string
): Promise<{ answer: string; sources?: string[] }> {
  const config = await getUserAIConfig(userId);
  if (!config) {
    throw new Error('AI API key not configured. Please add your API key in Settings.');
  }

  const messages: AIMessage[] = [
    {
      role: 'system',
      content: 'You are a Czech tax and accounting advisor for freelancers (OSVČ). Answer questions about Czech tax law, VAT (DPH), health insurance, social security, and business regulations. Provide accurate, up-to-date information with sources. Answer in the language of the question.',
    },
    {
      role: 'user',
      content: question,
    },
  ];

  // Enable web search (OpenRouter :online) so answers reflect current tax rules
  const response = await callAI(config, messages, { temperature: 0.2, webSearch: true });
  const answer = extractResponseText(response);

  return { answer };
}

/**
 * Check if an AI provider is configured for a user
 * @param userId - User ID to check
 */
export async function isAIConfigured(userId: string): Promise<boolean> {
  const config = await getUserAIConfig(userId);
  return !!config;
}

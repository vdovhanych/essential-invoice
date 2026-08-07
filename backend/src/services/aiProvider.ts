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

export type AIContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }
  | { type: 'file'; file: { filename: string; file_data: string } };

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | AIContentPart[];
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
 * Build a context block about the user's tax situation so the advisor can
 * personalize answers (VAT payer status, paušální daň, revenue this year).
 * Returns null when the context cannot be loaded; advice still works without it.
 */
async function getUserTaxContext(userId: string): Promise<string | null> {
  try {
    const userResult = await query(
      'SELECT vat_payer, pausalni_dan_enabled, pausalni_dan_tier, pausalni_dan_limit FROM users WHERE id = $1',
      [userId]
    );
    if (userResult.rows.length === 0) {
      return null;
    }
    const user = userResult.rows[0];

    const revenueResult = await query(
      `SELECT
        COALESCE(SUM(CASE WHEN currency = 'CZK' THEN total ELSE COALESCE(total_czk, 0) END)
          FILTER (WHERE status = 'paid' AND paid_at >= date_trunc('year', CURRENT_DATE)), 0) as revenue_ytd,
        COALESCE(SUM(CASE WHEN currency = 'CZK' THEN total ELSE COALESCE(total_czk, 0) END)
          FILTER (WHERE status IN ('sent', 'overdue')), 0) as outstanding
      FROM invoices
      WHERE user_id = $1`,
      [userId]
    );
    const revenue = revenueResult.rows[0] ?? {};

    const pausalniDan = user.pausalni_dan_enabled
      ? `yes (tier ${user.pausalni_dan_tier ?? 'unknown'}, annual revenue limit ${user.pausalni_dan_limit ?? 'unknown'} CZK)`
      : 'no';

    return [
      "Context about this user's situation (already converted to CZK where needed; use it to personalize the answer, but do not repeat it back unless relevant):",
      `- VAT payer (plátce DPH): ${user.vat_payer ? 'yes' : 'no'}`,
      `- Paušální daň (flat tax regime): ${pausalniDan}`,
      `- Paid revenue this calendar year: ${Math.round(parseFloat(revenue.revenue_ytd ?? '0'))} CZK`,
      `- Outstanding (sent/overdue) invoices: ${Math.round(parseFloat(revenue.outstanding ?? '0'))} CZK`,
      `- Today's date: ${new Date().toISOString().split('T')[0]}`,
    ].join('\n');
  } catch (error) {
    console.error('Error building user tax context:', error);
    return null;
  }
}

/**
 * Czech tax and compliance advisor
 * Answers tax-related questions for Czech freelancers using web search,
 * personalized with the user's own tax situation and revenue
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

  const taxContext = await getUserTaxContext(userId);

  const messages: AIMessage[] = [
    {
      role: 'system',
      content: 'You are a Czech tax and accounting advisor for freelancers (OSVČ). Answer questions about Czech tax law, VAT (DPH), health insurance, social security, and business regulations. Provide accurate, up-to-date information with sources. Answer in the language of the question.'
        + (taxContext ? `\n\n${taxContext}` : ''),
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

export interface ExtractedExpense {
  supplierName: string | null;
  supplierIco: string | null;
  supplierInvoiceNumber: string | null;
  issueDate: string | null;
  dueDate: string | null;
  currency: string | null;
  amount: number | null;
  vatRate: number | null;
  total: number | null;
  description: string | null;
}

/**
 * Extract structured expense data from an uploaded document (received
 * invoice or receipt) using a vision-capable model
 * @param userId - User ID to get configuration for
 * @param fileBase64 - Document content as base64 (no data URI prefix)
 * @param mimeType - application/pdf, image/jpeg or image/png
 * @param fileName - Original file name (used for PDF file parts)
 */
export async function extractExpenseFromDocument(
  userId: string,
  fileBase64: string,
  mimeType: string,
  fileName?: string
): Promise<ExtractedExpense | null> {
  const config = await getUserAIConfig(userId);
  if (!config) {
    throw new Error('AI API key not configured. Please add your API key in Settings.');
  }

  const dataUri = `data:${mimeType};base64,${fileBase64}`;
  const filePart: AIContentPart = mimeType === 'application/pdf'
    ? { type: 'file', file: { filename: fileName || 'document.pdf', file_data: dataUri } }
    : { type: 'image_url', image_url: { url: dataUri } };

  const messages: AIMessage[] = [
    {
      role: 'system',
      content: 'You extract structured data from received invoices and receipts (mostly Czech) for an invoicing app. Read the attached document carefully. Return ONLY a JSON object, no other text.',
    },
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: 'Extract the following fields from the attached document and return ONLY a JSON object with these keys: supplierName (string; the issuer/seller of the document), supplierIco (string; 8-digit Czech IČO of the supplier), supplierInvoiceNumber (string; the document/invoice number), issueDate (string, YYYY-MM-DD), dueDate (string, YYYY-MM-DD), currency ("CZK" or "EUR"), amount (number; tax base WITHOUT VAT), vatRate (number; VAT percentage, 0 if no VAT shown), total (number; final amount INCLUDING VAT), description (string; short summary of what was purchased, max 100 chars, in the document\'s language). Use null for any field not present in the document.',
        },
        filePart,
      ],
    },
  ];

  const response = await callAI(config, messages, { temperature: 0 });
  const text = extractResponseText(response);

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return null;
  }

  return JSON.parse(jsonMatch[0]) as ExtractedExpense;
}

/**
 * Draft a polite payment reminder email for an overdue/sent invoice
 * @param userId - User ID to get configuration for
 * @param invoice - Invoice facts to include in the reminder
 * @param language - Language to write the email in ('cs' or 'en')
 * @param senderName - Name to sign the email with
 */
export async function draftPaymentReminder(
  userId: string,
  invoice: {
    invoiceNumber: string;
    clientName: string;
    total: number;
    currency: string;
    dueDate: Date;
    daysOverdue: number;
  },
  language: string,
  senderName: string | null
): Promise<{ subject: string; body: string }> {
  const config = await getUserAIConfig(userId);
  if (!config) {
    throw new Error('AI API key not configured. Please add your API key in Settings.');
  }

  const languageName = language === 'cs' ? 'Czech' : 'English';
  const invoiceFacts = [
    `- Invoice number: ${invoice.invoiceNumber}`,
    `- Client: ${invoice.clientName}`,
    `- Amount due: ${invoice.total} ${invoice.currency}`,
    `- Due date: ${invoice.dueDate.toISOString().split('T')[0]}`,
    `- Days overdue: ${invoice.daysOverdue}`,
    `- Sender (freelancer) name: ${senderName || 'not provided; sign generically'}`,
  ].join('\n');

  const messages: AIMessage[] = [
    {
      role: 'system',
      content: 'You draft short, polite payment reminder emails for Czech freelancers chasing unpaid invoices. Keep a friendly but professional tone appropriate to how overdue the invoice is (gentle if just due, firmer if long overdue). Plain text only, no markdown. Use ONLY the facts provided; never invent bank details or amounts (the invoice PDF will be attached to the email). Return ONLY a JSON object with keys: subject (string), body (string).',
    },
    {
      role: 'user',
      content: `Write the reminder email in ${languageName}.\n\nInvoice facts:\n${invoiceFacts}`,
    },
  ];

  const response = await callAI(config, messages, { temperature: 0.4 });
  const text = extractResponseText(response);

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('AI did not return a valid reminder draft');
  }

  const draft = JSON.parse(jsonMatch[0]);
  if (typeof draft.subject !== 'string' || typeof draft.body !== 'string') {
    throw new Error('AI did not return a valid reminder draft');
  }

  return { subject: draft.subject, body: draft.body };
}

/**
 * Check if an AI provider is configured for a user
 * @param userId - User ID to check
 */
export async function isAIConfigured(userId: string): Promise<boolean> {
  const config = await getUserAIConfig(userId);
  return !!config;
}

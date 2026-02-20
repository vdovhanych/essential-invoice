import { query } from '../db/init';

const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';

/**
 * Get the Perplexity API key for a user from settings
 * @param userId - User ID to get API key for
 */
async function getUserApiKey(userId: string): Promise<string | null> {
  try {
    const result = await query(
      'SELECT perplexity_api_key FROM settings WHERE user_id = $1',
      [userId]
    );
    
    if (result.rows.length === 0 || !result.rows[0].perplexity_api_key) {
      return null;
    }
    
    return result.rows[0].perplexity_api_key;
  } catch (error) {
    console.error('Error getting Perplexity API key:', error);
    return null;
  }
}

export interface PerplexityMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface PerplexityResponse {
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
 * Call Perplexity AI API with messages
 * @param apiKey - Perplexity API key
 * @param messages - Array of messages for the conversation
 * @param model - Model to use (default: sonar for general use)
 * @param temperature - Temperature for response randomness (default: 0.2 for more focused responses)
 * @returns Perplexity API response
 */
export async function callPerplexity(
  apiKey: string,
  messages: PerplexityMessage[],
  model: string = 'sonar',
  temperature: number = 0.2
): Promise<PerplexityResponse> {
  if (!apiKey) {
    throw new Error('PERPLEXITY_API_KEY is not configured');
  }

  const response = await fetch(PERPLEXITY_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
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
    throw new Error(`Perplexity API error: ${response.status} - ${errorText}`);
  }

  return (await response.json()) as PerplexityResponse;
}

/**
 * Extract the assistant's response text from Perplexity response
 */
export function extractResponseText(response: PerplexityResponse): string {
  if (!response.choices || response.choices.length === 0) {
    throw new Error('No response from Perplexity AI');
  }
  return response.choices[0].message.content;
}

/**
 * Match a payment to invoices using AI
 * Analyzes payment details and suggests the best matching invoice
 * @param userId - User ID to get API key for
 * @param payment - Payment details
 * @param invoices - List of potential matching invoices
 */
export async function matchPaymentToInvoice(
  userId: string,
  payment: { amount: number; senderName?: string; message?: string; variableSymbol?: string; transactionDate: Date },
  invoices: Array<{ id: string; invoiceNumber: string; clientName: string; total: number; dueDate: Date; issueDate: Date }>
): Promise<{ invoiceId: string; confidence: number; reason: string } | null> {
  const apiKey = await getUserApiKey(userId);
  if (!apiKey) {
    throw new Error('Perplexity API key not configured. Please add your API key in Settings.');
  }

  const invoicesList = invoices.map(inv => 
    `ID: ${inv.id}, Number: ${inv.invoiceNumber}, Client: ${inv.clientName}, Amount: ${inv.total} CZK, Due: ${inv.dueDate.toISOString().split('T')[0]}`
  ).join('\n');

  const paymentDetails = [
    `Amount: ${payment.amount} CZK`,
    payment.senderName && `Sender: ${payment.senderName}`,
    payment.message && `Message: ${payment.message}`,
    payment.variableSymbol && `Variable Symbol: ${payment.variableSymbol}`,
    `Date: ${payment.transactionDate.toISOString().split('T')[0]}`,
  ].filter(Boolean).join('\n');

  const messages: PerplexityMessage[] = [
    {
      role: 'system',
      content: 'You are an AI assistant helping match bank payments to invoices for Czech freelancers. Analyze payment details and find the best matching invoice. Return ONLY a JSON object with: invoiceId (string), confidence (0-1), reason (string). If no good match, return null.',
    },
    {
      role: 'user',
      content: `Match this payment to one of the invoices:\n\nPayment:\n${paymentDetails}\n\nInvoices:\n${invoicesList}\n\nReturn ONLY a JSON object or null, no other text.`,
    },
  ];

  const response = await callPerplexity(apiKey, messages, 'sonar', 0.1);
  const text = extractResponseText(response);
  
  // Handle null response
  if (text.toLowerCase().includes('null') || text.toLowerCase().includes('no match')) {
    return null;
  }

  // Extract JSON from response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return null;
  }
  
  return JSON.parse(jsonMatch[0]);
}

/**
 * Czech tax and compliance advisor
 * Answers tax-related questions for Czech freelancers using web search
 * @param userId - User ID to get API key for
 * @param question - Tax question to answer
 */
export async function getCzechTaxAdvice(
  userId: string,
  question: string
): Promise<{ answer: string; sources?: string[] }> {
  const apiKey = await getUserApiKey(userId);
  if (!apiKey) {
    throw new Error('Perplexity API key not configured. Please add your API key in Settings.');
  }

  const messages: PerplexityMessage[] = [
    {
      role: 'system',
      content: 'You are a Czech tax and accounting advisor for freelancers (OSVČ). Answer questions about Czech tax law, VAT (DPH), health insurance, social security, and business regulations. Provide accurate, up-to-date information with sources. Answer in the language of the question.',
    },
    {
      role: 'user',
      content: question,
    },
  ];

  // Use online model for web search capability
  const response = await callPerplexity(apiKey, messages, 'sonar', 0.2);
  const answer = extractResponseText(response);
  
  return { answer };
}

/**
 * Check if Perplexity API is configured for a user
 * @param userId - User ID to check
 */
export async function isPerplexityConfigured(userId: string): Promise<boolean> {
  const apiKey = await getUserApiKey(userId);
  return !!apiKey;
}

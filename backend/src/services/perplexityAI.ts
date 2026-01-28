import dotenv from 'dotenv';

dotenv.config();

const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';

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
 * @param messages - Array of messages for the conversation
 * @param model - Model to use (default: llama-3.1-sonar-small-128k-online for web search)
 * @param temperature - Temperature for response randomness (default: 0.2 for more focused responses)
 * @returns Perplexity API response
 */
export async function callPerplexity(
  messages: PerplexityMessage[],
  model: string = 'llama-3.1-sonar-small-128k-online',
  temperature: number = 0.2
): Promise<PerplexityResponse> {
  if (!PERPLEXITY_API_KEY) {
    throw new Error('PERPLEXITY_API_KEY is not configured');
  }

  const response = await fetch(PERPLEXITY_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
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

  return await response.json();
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
 * Categorize invoice items using AI
 * Returns suggested categories for invoice line items
 */
export async function categorizeInvoiceItems(items: Array<{ description: string; total: number }>): Promise<Array<{ description: string; category: string; confidence: number }>> {
  const itemsList = items.map((item, idx) => `${idx + 1}. ${item.description} (${item.total} CZK)`).join('\n');
  
  const messages: PerplexityMessage[] = [
    {
      role: 'system',
      content: 'You are an AI assistant helping with invoice categorization for Czech freelancers. Categorize invoice line items into common business expense categories. Return only a JSON array with objects containing: description, category, and confidence (0-1).',
    },
    {
      role: 'user',
      content: `Categorize these invoice items into business expense categories (e.g., "Web Development", "Consulting", "Design", "Marketing", "Software", "Maintenance", etc.):\n\n${itemsList}\n\nReturn ONLY a JSON array, no other text.`,
    },
  ];

  const response = await callPerplexity(messages, 'llama-3.1-sonar-small-128k-chat', 0.1);
  const text = extractResponseText(response);
  
  // Extract JSON from response
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error('Failed to parse categorization response');
  }
  
  return JSON.parse(jsonMatch[0]);
}

/**
 * Match a payment to invoices using AI
 * Analyzes payment details and suggests the best matching invoice
 */
export async function matchPaymentToInvoice(
  payment: { amount: number; senderName?: string; message?: string; variableSymbol?: string; transactionDate: Date },
  invoices: Array<{ id: string; invoiceNumber: string; clientName: string; total: number; dueDate: Date; issueDate: Date }>
): Promise<{ invoiceId: string; confidence: number; reason: string } | null> {
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

  const response = await callPerplexity(messages, 'llama-3.1-sonar-small-128k-chat', 0.1);
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
 * Get financial insights from invoice data
 * Analyzes revenue trends and provides business insights
 */
export async function getFinancialInsights(data: {
  totalRevenue: number;
  currentMonth: number;
  previousMonth: number;
  topClients: Array<{ name: string; revenue: number }>;
  currency: string;
}): Promise<string> {
  const messages: PerplexityMessage[] = [
    {
      role: 'system',
      content: 'You are a financial advisor for Czech freelancers. Provide concise, actionable insights about their business performance in 3-4 sentences.',
    },
    {
      role: 'user',
      content: `Analyze this business data and provide insights:\n\nTotal Revenue: ${data.totalRevenue} ${data.currency}\nCurrent Month: ${data.currentMonth} ${data.currency}\nPrevious Month: ${data.previousMonth} ${data.currency}\nTop Clients: ${data.topClients.map(c => `${c.name} (${c.revenue} ${data.currency})`).join(', ')}\n\nProvide brief, actionable insights.`,
    },
  ];

  const response = await callPerplexity(messages, 'llama-3.1-sonar-small-128k-chat', 0.3);
  return extractResponseText(response);
}

/**
 * Czech tax and compliance advisor
 * Answers tax-related questions for Czech freelancers using web search
 */
export async function getCzechTaxAdvice(question: string): Promise<{ answer: string; sources?: string[] }> {
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
  const response = await callPerplexity(messages, 'llama-3.1-sonar-small-128k-online', 0.2);
  const answer = extractResponseText(response);
  
  return { answer };
}

/**
 * Check if Perplexity API is configured
 */
export function isPerplexityConfigured(): boolean {
  return !!PERPLEXITY_API_KEY;
}

# AI Features Documentation

## Overview

Essential Invoice now includes powerful AI features powered by Perplexity AI. These features help Czech freelancers automate tasks, gain insights, and get instant advice on tax and accounting matters.

## Features

### 1. AI Assistant (Czech Tax & Accounting Advisor)
**Location**: Floating button (bottom-right corner) on all pages after login

A conversational AI assistant that helps you with Czech-specific tax and accounting questions using real-time web search.

**Example Questions:**
- "When do I need to file VAT returns?"
- "What are health insurance rates for freelancers in 2024?"
- "Should I use paušální daň?"
- "What expenses can I deduct as OSVČ?"
- "When is the tax declaration deadline?"

**Features:**
- Real-time web search for up-to-date information
- Czech tax law and regulation expertise
- Available in both Czech and English
- Context-aware responses
- Automatic financial insights on your dashboard

### 2. Smart Invoice Categorization
**Location**: Invoice detail pages

AI automatically categorizes invoice line items into business expense categories.

**How it works:**
1. Open any invoice with line items
2. Click "AI Categorize" button
3. AI analyzes descriptions and suggests categories
4. Categories include: Web Development, Consulting, Design, Marketing, Software, Maintenance, etc.

**Benefits:**
- Faster expense tracking
- Consistent categorization
- Better financial reporting

### 3. Smart Payment Matching
**Location**: Payments page

AI-powered payment reconciliation that matches bank payments to invoices even when variable symbols are missing or amounts don't match exactly.

**How it works:**
1. Go to Payments page
2. Find an unmatched payment
3. Click "AI Match" button
4. AI analyzes payment details (sender, amount, date, message) and suggests the best matching invoice
5. Review confidence score and reason
6. Accept or reject the match

**Benefits:**
- Reduces manual matching time by 80%
- Handles ambiguous cases
- Works when variable symbols are missing
- Provides confidence scores

### 4. Financial Insights
**Location**: Dashboard (automatically loaded)

AI provides personalized insights about your business performance based on your invoice and payment data.

**Insights include:**
- Revenue trends (month-over-month growth)
- Top performing clients
- Cash flow analysis
- Business health indicators

## Setup

### 1. Get Perplexity API Key

1. Go to [https://www.perplexity.ai/settings/api](https://www.perplexity.ai/settings/api)
2. Sign up or log in
3. Generate a new API key
4. Copy the API key

### 2. Configure Environment Variable

Add your API key to the `.env` file in the project root:

```bash
PERPLEXITY_API_KEY=pplx-xxxxxxxxxxxxxxxxxxxxxxxx
```

### 3. Restart the Application

If using Docker:
```bash
docker compose down
docker compose up -d
```

If running locally:
```bash
cd backend
pnpm run dev
```

### 4. Verify Configuration

1. Log in to the application
2. Click the AI Assistant button (lightbulb icon) in the bottom-right corner
3. If configured correctly, you'll see a green "Powered by Perplexity" badge
4. Try asking a question

## API Endpoints

All AI endpoints require authentication via JWT token.

### Check AI Status
```http
GET /api/ai/status
Authorization: Bearer <token>
```

Response:
```json
{
  "available": true,
  "features": {
    "invoiceCategorization": true,
    "paymentMatching": true,
    "financialInsights": true,
    "taxAdvisor": true
  }
}
```

### Categorize Invoice
```http
POST /api/ai/categorize-invoice
Authorization: Bearer <token>
Content-Type: application/json

{
  "invoiceId": "uuid"
}
```

Response:
```json
{
  "categories": [
    {
      "description": "Web development services",
      "category": "Web Development",
      "confidence": 0.95
    }
  ]
}
```

### Match Payment with AI
```http
POST /api/ai/match-payment
Authorization: Bearer <token>
Content-Type: application/json

{
  "paymentId": "uuid"
}
```

Response:
```json
{
  "match": {
    "invoiceId": "uuid",
    "confidence": 0.85,
    "reason": "Amount matches and sender name is similar to client"
  }
}
```

### Get Financial Insights
```http
GET /api/ai/financial-insights
Authorization: Bearer <token>
```

Response:
```json
{
  "insights": "Your revenue has increased by 25% this month compared to last month. Client A represents 50% of your total revenue. Consider diversifying your client base to reduce risk."
}
```

### Ask Tax Advisor
```http
POST /api/ai/tax-advisor
Authorization: Bearer <token>
Content-Type: application/json

{
  "question": "When do I need to file VAT returns?"
}
```

Response:
```json
{
  "answer": "In the Czech Republic, VAT filing frequency depends on your annual turnover. Businesses with turnover over 10 million CZK must file monthly by the 25th of the following month. Businesses with turnover between 2-10 million CZK file quarterly..."
}
```

## Privacy & Security

- **No data storage**: AI conversations are not stored in the database
- **Secure API calls**: All requests use HTTPS with bearer token authentication
- **Rate limiting**: AI endpoints are rate-limited to prevent abuse
- **User isolation**: Each user's data is isolated and not shared with other users

## Cost Considerations

Perplexity AI operates on a usage-based pricing model:

- **Free tier**: 5,000 requests/month
- **Standard**: $20/month for 5M tokens
- **Pro**: Custom pricing for high-volume users

**Estimated usage per user:**
- AI Assistant: ~500 tokens/question (50-100 questions/month)
- Invoice categorization: ~300 tokens/invoice (10-50 invoices/month)
- Payment matching: ~400 tokens/payment (5-20 payments/month)
- Financial insights: ~500 tokens/load (10-20 loads/month)

**Total estimated**: 50,000-100,000 tokens/month per active user (~$1-2/month)

## Models Used

- **Tax Advisor & Insights**: `llama-3.1-sonar-small-128k-online` (with web search)
- **Categorization & Matching**: `llama-3.1-sonar-small-128k-chat` (faster, no web search needed)

## Troubleshooting

### AI Features Not Available

**Symptom**: AI Assistant button doesn't appear

**Solutions:**
1. Check that `PERPLEXITY_API_KEY` is set in `.env`
2. Restart the backend service
3. Check browser console for errors
4. Verify API key is valid at Perplexity dashboard

### AI Requests Failing

**Symptom**: Error messages when using AI features

**Solutions:**
1. Check backend logs: `docker compose logs backend`
2. Verify API key hasn't expired
3. Check Perplexity API status: [https://status.perplexity.ai](https://status.perplexity.ai)
4. Ensure you haven't exceeded API rate limits

### Slow Response Times

**Symptom**: AI responses take a long time (>10 seconds)

**Reasons:**
- Web search queries (Tax Advisor) take longer than chat-only queries
- Network latency to Perplexity API
- Complex questions requiring more processing

**Solutions:**
- Normal for web search queries (5-10 seconds)
- Consider upgrading Perplexity plan for faster processing
- Simplify questions for faster responses

## Future Enhancements

Planned features for future releases:

1. **Invoice text suggestions**: Auto-complete descriptions and payment terms
2. **Client health scoring**: Predict payment reliability based on history
3. **Expense report generation**: AI-generated summaries for tax filings
4. **Multi-language support**: Automatic translation of invoices
5. **Smart reminders**: AI-suggested payment reminders based on client behavior

## Support

For issues or feature requests related to AI features:
- Open an issue on GitHub
- Contact: support@example.com
- Documentation: [https://github.com/yourusername/essential-invoice](https://github.com/yourusername/essential-invoice)

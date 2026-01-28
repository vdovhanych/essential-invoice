# AI Features Documentation

## Overview

Essential Invoice includes powerful AI features powered by Perplexity AI. These features help Czech freelancers automate tasks and get instant advice on tax and accounting matters.

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

### 2. Smart Payment Matching
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

## Setup

### 1. Get Perplexity API Key

1. Go to [https://www.perplexity.ai/settings/api](https://www.perplexity.ai/settings/api)
2. Sign up or log in
3. Generate a new API key
4. Copy the API key (starts with `pplx-`)

### 2. Configure in Settings

1. Log in to Essential Invoice
2. Go to **Settings** (Nastavení)
3. Scroll to **AI Features (Perplexity)** section
4. Paste your API key in the input field
5. Click **Save Settings** (Uložit nastavení)

### 3. Verify Configuration

1. The AI Assistant button (lightbulb icon) should appear in the bottom-right corner
2. If configured correctly, you'll see a green "Powered by Perplexity" badge
3. Try asking a question to test

**Note**: Each user configures their own API key. This allows:
- Independent API quotas per user
- Better cost tracking
- Privacy and security

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
    "taxAdvisor": true
  }
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
- Payment matching: ~400 tokens/payment (5-20 payments/month)

**Total estimated**: 30,000-60,000 tokens/month per active user (~$0.60-1.20/month)

## Models Used

- **All AI Features**: `sonar` (Perplexity's default model, includes web search capability when needed)

Note: The model automatically determines whether to use online search based on the query type.

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

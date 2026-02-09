# API Reference

Complete REST API documentation for Essential Invoice.

## Base URL

- Development: `http://localhost:3001/api`
- Production (Docker): `http://localhost/api`

## Authentication

All API endpoints (except authentication endpoints) require a valid JWT token in the `Authorization` header:

```
Authorization: Bearer <token>
```

### Authentication Endpoints

#### Register
```http
POST /api/auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123"
}

Response: 201 Created
{
  "id": 1,
  "name": "John Doe",
  "email": "john@example.com",
  "token": "eyJhbGc..."
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "password123"
}

Response: 200 OK
{
  "id": 1,
  "name": "John Doe",
  "email": "john@example.com",
  "token": "eyJhbGc..."
}
```

#### Get Current User
```http
GET /api/auth/me
Authorization: Bearer <token>

Response: 200 OK
{
  "id": 1,
  "name": "John Doe",
  "email": "john@example.com",
  "company_name": "My Company",
  "ico": "12345678",
  ...
}
```

#### Update Profile
```http
PUT /api/auth/me
Authorization: Bearer <token>
Content-Type: application/json

{
  "company_name": "Updated Company",
  "ico": "12345678",
  "vat_payer": true,
  ...
}

Response: 200 OK
{
  "message": "Profile updated successfully"
}
```

#### Change Password
```http
POST /api/auth/change-password
Authorization: Bearer <token>
Content-Type: application/json

{
  "currentPassword": "oldpass",
  "newPassword": "newpass"
}

Response: 200 OK
{
  "message": "Password changed successfully"
}
```

## Clients

### List Clients
```http
GET /api/clients
Authorization: Bearer <token>

Response: 200 OK
[
  {
    "id": 1,
    "name": "Client Name",
    "email": "client@example.com",
    "ico": "12345678",
    ...
  }
]
```

### Get Client Details
```http
GET /api/clients/:id
Authorization: Bearer <token>

Response: 200 OK
{
  "id": 1,
  "name": "Client Name",
  "email": "client@example.com",
  ...
}
```

### Get Client's Invoices
```http
GET /api/clients/:id/invoices
Authorization: Bearer <token>

Response: 200 OK
[
  {
    "id": 1,
    "invoice_number": "2024001",
    "total_amount": 10000,
    ...
  }
]
```

### Create Client
```http
POST /api/clients
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "New Client",
  "email": "newclient@example.com",
  "ico": "12345678",
  "address": "Client Address"
}

Response: 201 Created
{
  "id": 2,
  "name": "New Client",
  ...
}
```

### Update Client
```http
PUT /api/clients/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Updated Client",
  "email": "updated@example.com"
}

Response: 200 OK
{
  "message": "Client updated successfully"
}
```

### Delete Client
```http
DELETE /api/clients/:id
Authorization: Bearer <token>

Response: 200 OK
{
  "message": "Client deleted successfully"
}
```

## Invoices

### List Invoices
```http
GET /api/invoices?status=sent&clientId=1&from=2024-01-01&to=2024-12-31
Authorization: Bearer <token>

Query Parameters:
- status: draft|sent|paid|cancelled
- clientId: filter by client ID
- from: start date (ISO format)
- to: end date (ISO format)

Response: 200 OK
[
  {
    "id": 1,
    "invoice_number": "2024001",
    "client_name": "Client Name",
    "total_amount": 10000,
    "status": "sent",
    ...
  }
]
```

### Get Invoice Details
```http
GET /api/invoices/:id
Authorization: Bearer <token>

Response: 200 OK
{
  "id": 1,
  "invoice_number": "2024001",
  "items": [
    {
      "description": "Service",
      "quantity": 1,
      "unit_price": 10000
    }
  ],
  ...
}
```

### Download Invoice PDF
```http
GET /api/invoices/:id/pdf
Authorization: Bearer <token>

Response: 200 OK
Content-Type: application/pdf
```

### Create Invoice
```http
POST /api/invoices
Authorization: Bearer <token>
Content-Type: application/json

{
  "client_id": 1,
  "issue_date": "2024-01-15",
  "due_date": "2024-02-15",
  "currency": "CZK",
  "vat_rate": 21,
  "items": [
    {
      "description": "Web Development",
      "quantity": 10,
      "unit": "hours",
      "unit_price": 1000
    }
  ]
}

Response: 201 Created
{
  "id": 2,
  "invoice_number": "2024002",
  "status": "draft",
  ...
}
```

### Update Invoice
```http
PUT /api/invoices/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "due_date": "2024-03-01",
  "items": [...]
}

Response: 200 OK
{
  "message": "Invoice updated successfully"
}
```

### Delete Invoice
```http
DELETE /api/invoices/:id
Authorization: Bearer <token>

Response: 200 OK
{
  "message": "Invoice deleted successfully"
}

Note: Only draft invoices can be deleted
```

### Send Invoice via Email
```http
POST /api/invoices/:id/send
Authorization: Bearer <token>
Content-Type: application/json

{
  "send_to_secondary": true
}

Response: 200 OK
{
  "message": "Invoice sent successfully"
}
```

### Mark Invoice as Paid
```http
POST /api/invoices/:id/mark-paid
Authorization: Bearer <token>

Response: 200 OK
{
  "message": "Invoice marked as paid"
}
```

### Cancel Invoice
```http
POST /api/invoices/:id/cancel
Authorization: Bearer <token>

Response: 200 OK
{
  "message": "Invoice cancelled"
}
```

## Expenses

### List Expenses
```http
GET /api/expenses?status=paid&from=2024-01-01&to=2024-12-31
Authorization: Bearer <token>

Query Parameters:
- status: draft|paid|cancelled
- from: start date (ISO format)
- to: end date (ISO format)

Response: 200 OK
[
  {
    "id": 1,
    "expense_number": "E2024001",
    "description": "Office Supplies",
    "amount": 500,
    ...
  }
]
```

### Get Expense Details
```http
GET /api/expenses/:id
Authorization: Bearer <token>

Response: 200 OK
{
  "id": 1,
  "expense_number": "E2024001",
  "description": "Office Supplies",
  "amount": 500,
  "has_file": true,
  ...
}
```

### Download Expense File
```http
GET /api/expenses/:id/file
Authorization: Bearer <token>

Response: 200 OK
Content-Type: application/pdf (or other file type)
```

### Create Expense
```http
POST /api/expenses
Authorization: Bearer <token>
Content-Type: multipart/form-data

Form Data:
- description: "Office Supplies"
- amount: 500
- expense_date: "2024-01-15"
- category: "supplies"
- file: (optional file upload)

Response: 201 Created
{
  "id": 2,
  "expense_number": "E2024002",
  ...
}
```

### Update Expense
```http
PUT /api/expenses/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "description": "Updated description",
  "amount": 600
}

Response: 200 OK
{
  "message": "Expense updated successfully"
}
```

### Delete Expense
```http
DELETE /api/expenses/:id
Authorization: Bearer <token>

Response: 200 OK
{
  "message": "Expense deleted successfully"
}
```

### Mark Expense as Paid
```http
POST /api/expenses/:id/mark-paid
Authorization: Bearer <token>

Response: 200 OK
{
  "message": "Expense marked as paid"
}
```

### Cancel Expense
```http
POST /api/expenses/:id/cancel
Authorization: Bearer <token>

Response: 200 OK
{
  "message": "Expense cancelled"
}
```

## Payments

### List Payments
```http
GET /api/payments?matched=false
Authorization: Bearer <token>

Query Parameters:
- matched: true|false (filter by match status)

Response: 200 OK
[
  {
    "id": 1,
    "amount": 10000,
    "variable_symbol": "2024001",
    "matched_invoice_id": null,
    ...
  }
]
```

### List Unmatched Payments
```http
GET /api/payments/unmatched
Authorization: Bearer <token>

Response: 200 OK
[
  {
    "id": 1,
    "amount": 10000,
    "variable_symbol": "2024001",
    ...
  }
]
```

### Get Payment Matches
```http
GET /api/payments/:id/matches
Authorization: Bearer <token>

Response: 200 OK
[
  {
    "invoice_id": 1,
    "invoice_number": "2024001",
    "amount": 10000,
    "match_confidence": "high"
  }
]
```

### Match Payment to Invoice
```http
POST /api/payments/:id/match
Authorization: Bearer <token>
Content-Type: application/json

{
  "invoice_id": 1
}

Response: 200 OK
{
  "message": "Payment matched to invoice"
}
```

### Unmatch Payment
```http
POST /api/payments/:id/unmatch
Authorization: Bearer <token>

Response: 200 OK
{
  "message": "Payment unmatched"
}
```

### Delete Unmatched Payment
```http
DELETE /api/payments/:id
Authorization: Bearer <token>

Response: 200 OK
{
  "message": "Payment deleted"
}

Note: Only unmatched payments can be deleted
```

### Check for New Email Payments
```http
POST /api/payments/check-emails
Authorization: Bearer <token>

Response: 200 OK
{
  "message": "Checked for new payments",
  "new_payments": 2
}
```

## ARES (Czech Company Registry)

### Lookup Company by IČO
```http
GET /api/ares/lookup/:ico
Authorization: Bearer <token>

Response: 200 OK
{
  "ico": "12345678",
  "name": "Company Name s.r.o.",
  "address": "Street 123, City",
  "dic": "CZ12345678"
}
```

### Validate IČO
```http
GET /api/ares/validate/:ico
Authorization: Bearer <token>

Response: 200 OK
{
  "valid": true
}
```

## Dashboard

### Get Dashboard Statistics
```http
GET /api/dashboard
Authorization: Bearer <token>

Response: 200 OK
{
  "total_revenue": 100000,
  "outstanding_amount": 25000,
  "paid_invoices_count": 10,
  "unpaid_invoices_count": 3,
  "recent_invoices": [...],
  "pausalni_dan_progress": {
    "enabled": true,
    "tier": 1,
    "limit": 1000000,
    "current": 450000,
    "percentage": 45
  }
}
```

## Settings

### Get User Settings
```http
GET /api/settings
Authorization: Bearer <token>

Response: 200 OK
{
  "smtp_host": "smtp.gmail.com",
  "smtp_port": 587,
  "imap_host": "imap.gmail.com",
  ...
}
```

### Update Settings
```http
PUT /api/settings
Authorization: Bearer <token>
Content-Type: application/json

{
  "smtp_host": "smtp.gmail.com",
  "smtp_port": 587,
  "smtp_user": "user@gmail.com",
  ...
}

Response: 200 OK
{
  "message": "Settings updated successfully"
}
```

### Test SMTP Connection
```http
POST /api/settings/test-smtp
Authorization: Bearer <token>

Response: 200 OK
{
  "message": "SMTP connection successful"
}
```

### Test IMAP Connection
```http
POST /api/settings/test-imap
Authorization: Bearer <token>

Response: 200 OK
{
  "message": "IMAP connection successful"
}
```

## AI (Perplexity)

### Check AI Status
```http
GET /api/ai/status
Authorization: Bearer <token>

Response: 200 OK
{
  "available": true,
  "hasApiKey": true
}
```

### AI-Powered Payment Matching
```http
POST /api/ai/match-payment
Authorization: Bearer <token>
Content-Type: application/json

{
  "payment_id": 1,
  "invoices": [
    {
      "invoice_id": 1,
      "invoice_number": "2024001",
      "amount": 10000
    }
  ]
}

Response: 200 OK
{
  "match": {
    "invoice_id": 1,
    "confidence": "high",
    "reason": "Variable symbol matches invoice number"
  }
}
```

### Tax Advisor Chat
```http
POST /api/ai/tax-advisor
Authorization: Bearer <token>
Content-Type: application/json

{
  "message": "Can I deduct home office expenses?",
  "context": {
    "vat_payer": true,
    "pausalni_dan": false
  }
}

Response: 200 OK
{
  "response": "In Czech Republic, home office expenses can be deducted...",
  "sources": [...]
}
```

## Error Responses

All endpoints may return the following error responses:

### 400 Bad Request
```json
{
  "error": "Validation error message"
}
```

### 401 Unauthorized
```json
{
  "error": "No token provided" | "Invalid token"
}
```

### 403 Forbidden
```json
{
  "error": "Access denied"
}
```

### 404 Not Found
```json
{
  "error": "Resource not found"
}
```

### 429 Too Many Requests
```json
{
  "error": "Too many requests, please try again later"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error"
}
```

## Rate Limiting

API endpoints are rate limited to **100 requests per 15 minutes** per IP address. When the limit is exceeded, the API returns a 429 status code.

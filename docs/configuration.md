# Configuration

Detailed configuration guide for Essential Invoice.

## Environment Variables

Create a `.env` file in the project root directory (copy from `.env.example`):

```bash
cp .env.example .env
```

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `JWT_SECRET` | JWT signing secret (minimum 32 characters) | `your_secure_jwt_secret_here_min_32_chars` |
| `DB_PASSWORD` | PostgreSQL database password | `your_secure_database_password` |

### Optional Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_HOST` | `db` | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_NAME` | `essential_invoice` | Database name |
| `DB_USER` | `postgres` | Database user |
| `CORS_ORIGIN` | `http://localhost:5173` (dev)<br/>`http://localhost:8080` (Docker) | Allowed CORS origins (comma-separated) |
| `BACKEND_PORT` | `3001` | Backend API port |
| `FRONTEND_PORT` | `80` | Frontend web port |
| `EMAIL_POLLING_INTERVAL` | `300000` | Email check interval in milliseconds (5 minutes) |

### Example .env File

```bash
# Required: Set a secure JWT secret (min 32 characters)
JWT_SECRET=your_secure_jwt_secret_here_min_32_chars_long

# Required: Set database password
DB_PASSWORD=your_secure_database_password

# Database configuration (optional, defaults shown)
DB_HOST=db
DB_PORT=5432
DB_NAME=essential_invoice
DB_USER=postgres

# CORS configuration
CORS_ORIGIN=http://localhost:5173

# Port configuration
BACKEND_PORT=3001
FRONTEND_PORT=80

# Email polling interval (5 minutes)
EMAIL_POLLING_INTERVAL=300000
```

## In-App Configuration

Most settings are configured through the application's Settings page after logging in.

### SMTP Configuration

Configure email sending in **Settings > Email (SMTP)**:

1. **SMTP Host**: Your email provider's SMTP server
   - Gmail: `smtp.gmail.com`
   - Outlook: `smtp-mail.outlook.com`
   - Yahoo: `smtp.mail.yahoo.com`

2. **Port**:
   - `587` for TLS (recommended)
   - `465` for SSL
   - `25` for unencrypted (not recommended)

3. **Username**: Your email address

4. **Password**: 
   - For Gmail: Use an [App Password](https://support.google.com/accounts/answer/185833) (not your regular password)
   - For other providers: Your email password or app-specific password

5. **Sender Email**: The email address that will appear as the sender

6. **Sender Name**: The name that will appear as the sender

**Testing**: Use the "Test" button to verify your SMTP settings are correct.

### IMAP Configuration

Configure bank notification receiving in **Settings > Email (IMAP)**:

1. **IMAP Host**: Your email provider's IMAP server
   - Gmail: `imap.gmail.com`
   - Outlook: `outlook.office365.com`
   - Yahoo: `imap.mail.yahoo.com`

2. **Port**:
   - `993` for TLS (recommended)
   - `143` for unencrypted (not recommended)

3. **Username**: Your email address

4. **Password**: Same as SMTP (use App Password for Gmail)

5. **Bank Email Filter**: Email address of your bank's notification sender
   - Air Bank: `noreply@airbank.cz`
   - Add your bank's notification email

**Testing**: Use the "Test" button to verify your IMAP settings are correct.

**Note**: The application will check for new emails every 5 minutes (configurable via `EMAIL_POLLING_INTERVAL` environment variable).

### AI Features (Optional)

To enable AI-powered features:

1. Get an API key from [Perplexity AI](https://www.perplexity.ai/settings/api)
2. Log in to Essential Invoice
3. Go to **Settings (Nastavení)**
4. Find the "AI funkce (Perplexity)" section
5. Enter your API key and save

Once configured, you can use:
- AI-powered payment matching
- Tax advisor chatbot
- Financial insights

## Profile Configuration

Complete your profile in **Profile (Profil)** or during onboarding:

### Company Information

- **Company Name** (required): Your business name
- **IČO** (required): Czech company identification number (8 digits)
- **Address** (required): Your business address
- **VAT Payer Status**: Check "Jsem plátce DPH" if you are a VAT payer
- **DIČ** (required if VAT payer): VAT identification number

### Bank Information

- **Bank Account Number** (required): Your bank account number
- **Bank Code** (required): Czech bank code (e.g., 0300 for ČSOB)

This information is required for generating QR payment codes on invoices.

### Paušální Daň (Lump-Sum Tax)

If you use paušální daň:

1. Enable "Paušální daň"
2. Select your tier (1, 2, or 3)
3. Set your income limit

The dashboard will track your invoiced amounts against the limit.

### Logo

Upload your company logo (optional):
- Recommended size: 200x200 pixels
- Supported formats: PNG, JPG, JPEG
- Max file size: 2MB

The logo will appear on your invoices.

## CORS Configuration for Local Development

When running the frontend in development mode (on port 5173), you need to configure CORS:

1. Edit your `.env` file:
```bash
CORS_ORIGIN=http://localhost:5173
```

2. Restart the backend:
```bash
cd backend
pnpm run dev
```

For production deployment with Docker, the default `http://localhost:8080` should work.

## Production Configuration

For production deployments:

### HTTPS Configuration

Essential Invoice doesn't include HTTPS support out of the box. Use a reverse proxy:

**Nginx Example:**
```nginx
server {
    listen 443 ssl;
    server_name invoice.yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

**Caddy Example:**
```
invoice.yourdomain.com {
    reverse_proxy localhost:80
    reverse_proxy /api/* localhost:3001
}
```

### Security Considerations

1. **Use strong passwords**:
   - JWT_SECRET should be at least 32 random characters
   - DB_PASSWORD should be strong and unique

2. **Restrict database access**:
   - Don't expose PostgreSQL port publicly
   - Use Docker network isolation

3. **Enable HTTPS**:
   - Use a reverse proxy with SSL/TLS
   - Get free certificates from Let's Encrypt

4. **Regular backups**:
   - Set up automated database backups
   - Store backups securely off-site

5. **Keep dependencies updated**:
   - Regularly update npm packages
   - Monitor security advisories

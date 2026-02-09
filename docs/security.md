# Security

Security features and best practices for Essential Invoice.

## Security Features

### Authentication

**JWT (JSON Web Token) Based Authentication**
- Stateless authentication
- Token-based session management
- Automatic expiration (7 days default)
- Secure token generation using `jsonwebtoken` library

**Token Security:**
- Signed with `JWT_SECRET` (minimum 32 characters required)
- Stored in browser localStorage
- Transmitted in Authorization header
- Validated on every API request

### Password Security

**bcrypt Hashing**
- Passwords hashed with bcrypt
- 12 salt rounds (strong protection)
- Never stored in plain text
- Never logged or transmitted in responses

**Password Requirements:**
- Minimum length enforced in frontend
- Recommendations: 
  - At least 12 characters
  - Mix of uppercase, lowercase, numbers, symbols
  - Not common passwords

### Authorization

**User Data Isolation**
- All queries filtered by `user_id`
- Users can only access their own data
- Middleware injects authenticated user context
- No cross-user data leakage possible

**Protected Routes:**
```typescript
// All API endpoints require authentication except:
// - POST /api/auth/register
// - POST /api/auth/login
```

### Input Validation

**Server-Side Validation**
- All user inputs validated before processing
- Type checking with TypeScript
- Format validation (email, IČO, dates)
- SQL injection prevention (parameterized queries)
- XSS prevention (React auto-escaping + input sanitization)

**Czech-Specific Validation:**
- IČO checksum validation
- DIČ format validation
- Bank account format validation
- IBAN validation for international payments

### Rate Limiting

**API Rate Limiting**
- 100 requests per 15 minutes per IP address
- Prevents brute force attacks
- Prevents API abuse
- Returns 429 status when exceeded

**Configuration:**
```typescript
// In backend/src/index.ts
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
});
```

### CORS Protection

**Configured Origins Only**
- CORS restricted to specific origins
- No wildcard (*) origins in production
- Configurable via `CORS_ORIGIN` environment variable

**Example Configuration:**
```bash
# Single origin
CORS_ORIGIN=https://invoice.yourdomain.com

# Multiple origins
CORS_ORIGIN=https://invoice.yourdomain.com,https://app.yourdomain.com
```

### Database Security

**Connection Security**
- Credentials stored in environment variables
- Never committed to version control
- Connection pooling with automatic timeout

**Query Security**
- Parameterized queries (prevents SQL injection)
- No dynamic query construction from user input
- Proper escaping of special characters

**Example Safe Query:**
```typescript
// Safe - parameterized
await pool.query(
  'SELECT * FROM invoices WHERE user_id = $1 AND id = $2',
  [userId, invoiceId]
);

// Unsafe - never do this
await pool.query(
  `SELECT * FROM invoices WHERE user_id = ${userId}`
);
```

### File Upload Security

**Restrictions**
- File size limits (2MB for logos, 10MB for expense receipts)
- File type restrictions (images, PDFs)
- Unique filename generation (prevents overwriting)
- Stored outside web root
- Served through API with auth check

**Safe File Handling:**
```typescript
// Check file type
const allowedTypes = ['image/png', 'image/jpeg', 'application/pdf'];
if (!allowedTypes.includes(file.mimetype)) {
  throw new Error('Invalid file type');
}

// Generate unique filename
const filename = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${ext}`;
```

### API Key Security

**Perplexity API Keys**
- Stored per-user in database
- Never exposed in API responses
- Only used server-side
- Can be changed/revoked anytime

### Email Security

**SMTP/IMAP Credentials**
- Stored encrypted in database (in future version)
- Currently stored as plain text per-user
- Never exposed in API responses
- Configurable per user

**Email Validation:**
- Valid email format required
- No script injection in email content
- Attachment scanning (future enhancement)

## Security Best Practices

### For Administrators

#### 1. Strong Environment Variables

```bash
# Generate strong JWT secret
JWT_SECRET=$(openssl rand -base64 48)

# Strong database password
DB_PASSWORD=$(openssl rand -base64 32)
```

**Requirements:**
- JWT_SECRET: minimum 32 characters, random
- DB_PASSWORD: minimum 16 characters, random
- Never reuse passwords
- Never commit .env file

#### 2. HTTPS in Production

**Use a Reverse Proxy:**

**Nginx with Let's Encrypt:**
```nginx
server {
    listen 443 ssl http2;
    server_name invoice.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

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

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name invoice.yourdomain.com;
    return 301 https://$host$request_uri;
}
```

**Caddy (automatic HTTPS):**
```
invoice.yourdomain.com {
    reverse_proxy localhost:80
    reverse_proxy /api/* localhost:3001
}
```

#### 3. Database Security

**Restrict Access:**
```yaml
# In docker-compose.yml
services:
  db:
    ports:
      # Don't expose publicly
      - "127.0.0.1:5432:5432"  # Only localhost
      # NOT: - "5432:5432"      # Exposed to world
```

**Regular Backups:**
```bash
# Automated daily backups
0 2 * * * /path/to/backup.sh
```

**Strong Password:**
```bash
DB_PASSWORD=$(openssl rand -base64 32)
```

#### 4. Keep Software Updated

```bash
# Update Docker images regularly
docker compose pull
docker compose up -d

# Update dependencies
cd backend && pnpm update
cd frontend && pnpm update
```

**Subscribe to security advisories:**
- GitHub security alerts
- npm security advisories
- Docker security bulletins

#### 5. Monitoring and Logging

**Log Important Events:**
- Failed login attempts
- Password changes
- Data exports
- Admin actions

**Monitor for Suspicious Activity:**
- Multiple failed logins
- Unusual API usage patterns
- Large data exports
- Access from unusual locations

**Example Monitoring:**
```bash
# Watch for failed logins
docker compose logs backend | grep "Login failed"

# Monitor rate limiting
docker compose logs backend | grep "429"
```

#### 6. Firewall Configuration

**Allow only necessary ports:**
```bash
# UFW example (Ubuntu)
ufw allow 22/tcp     # SSH
ufw allow 80/tcp     # HTTP
ufw allow 443/tcp    # HTTPS
ufw deny 3001/tcp    # Block direct backend access
ufw deny 5432/tcp    # Block direct database access
ufw enable
```

### For Users

#### 1. Strong Passwords

**Requirements:**
- At least 12 characters
- Mix of uppercase and lowercase
- Include numbers
- Include special characters
- Don't reuse passwords from other sites

**Good Examples:**
- `MyInvoice2024!SecurePass`
- `Prague_Finance_$2024`
- `Fakturace.Bezpecna#99`

**Bad Examples:**
- `password123`
- `invoice2024`
- `12345678`

#### 2. Secure Email Configuration

**For Gmail:**
1. Enable 2-factor authentication
2. Generate App Password (don't use regular password)
3. Use App Password in Essential Invoice settings

**Don't:**
- Share email credentials
- Use email password for Essential Invoice login
- Disable security features to make it work

#### 3. Regular Password Changes

- Change password every 3-6 months
- Change immediately if suspicious activity detected
- Don't reuse old passwords

#### 4. Logout on Shared Computers

- Always log out when done
- Don't check "Remember me" on shared computers
- Clear browser cache on public computers

#### 5. Verify Invoice Recipients

- Double-check client email before sending
- Be careful with "Send to secondary email"
- Verify bank account details on invoices

### For Developers

#### 1. Secure Coding Practices

**Never Log Sensitive Data:**
```typescript
// Bad
console.log('User:', { email, password });

// Good
console.log('User:', { email });
```

**Validate All Inputs:**
```typescript
// Always validate
if (!email || !email.includes('@')) {
  return res.status(400).json({ error: 'Invalid email' });
}
```

**Use Parameterized Queries:**
```typescript
// Good
await pool.query('SELECT * FROM users WHERE email = $1', [email]);

// Never
await pool.query(`SELECT * FROM users WHERE email = '${email}'`);
```

#### 2. Dependency Security

**Audit Dependencies:**
```bash
pnpm audit
pnpm audit --fix  # Auto-fix when possible
```

**Keep Dependencies Updated:**
```bash
pnpm update
```

**Review Dependency Changes:**
- Check changelog before updating
- Test thoroughly after updates
- Monitor for security advisories

#### 3. Code Review

- Review all pull requests for security issues
- Check for credential leaks
- Verify input validation
- Test authorization logic

#### 4. Security Testing

**Run Tests:**
```bash
cd backend && pnpm test
cd frontend && pnpm test
```

**Test Security:**
- Try accessing other users' data
- Try SQL injection attacks
- Try XSS attacks
- Test rate limiting
- Test authorization

## Security Checklist

### Before Production Deployment

- [ ] Strong JWT_SECRET (32+ random characters)
- [ ] Strong DB_PASSWORD (16+ random characters)
- [ ] HTTPS enabled via reverse proxy
- [ ] CORS configured for production domain
- [ ] Database not publicly exposed
- [ ] Backend API not publicly exposed (behind reverse proxy)
- [ ] Firewall configured
- [ ] Automated backups configured
- [ ] Monitoring/logging enabled
- [ ] All dependencies updated
- [ ] Security audit completed
- [ ] .env file not in version control

### Regular Maintenance

- [ ] Update dependencies monthly
- [ ] Review logs weekly
- [ ] Test backups monthly
- [ ] Change DB_PASSWORD quarterly
- [ ] Review user accounts quarterly
- [ ] Check for security advisories weekly

## Reporting Security Issues

If you discover a security vulnerability:

1. **Do not** open a public GitHub issue
2. Email security concerns to: [security email]
3. Include:
   - Description of vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if known)

We will respond within 48 hours and work to fix critical issues within 7 days.

## Security Roadmap

### Planned Improvements

1. **Database Encryption**
   - Encrypt sensitive fields (email credentials, API keys)
   - Use AES-256 encryption
   - Key management via environment variables

2. **Two-Factor Authentication (2FA)**
   - TOTP-based 2FA
   - Optional per user
   - Recovery codes

3. **Audit Logging**
   - Log all data changes
   - Log authentication events
   - Queryable audit trail

4. **Session Management**
   - Configurable session timeout
   - Ability to revoke tokens
   - List active sessions

5. **IP Whitelisting**
   - Optional IP restrictions
   - Useful for companies with static IPs

6. **File Scanning**
   - Virus scanning for uploaded files
   - Malware detection

7. **Content Security Policy (CSP)**
   - Prevent XSS attacks
   - Restrict resource loading

8. **Rate Limiting by User**
   - Currently by IP only
   - Add per-user rate limits

## Security Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [React Security Best Practices](https://snyk.io/blog/10-react-security-best-practices/)
- [PostgreSQL Security](https://www.postgresql.org/docs/current/security.html)
- [Docker Security](https://docs.docker.com/engine/security/)

## Compliance

### GDPR Considerations

Essential Invoice stores personal data (names, emails, addresses). If you operate in the EU:

1. **Data Privacy Policy**: Create a privacy policy
2. **Data Retention**: Implement data retention policies
3. **Right to Delete**: Implement user data deletion
4. **Data Export**: Allow users to export their data
5. **Consent**: Obtain consent for data processing
6. **Data Breach**: Have a breach response plan

### Financial Data Security

For businesses handling financial data:

1. **Regular Backups**: Critical for financial records
2. **Access Logs**: Track who accessed what data
3. **Data Integrity**: Ensure invoices can't be altered after sending
4. **Audit Trail**: Maintain history of changes

## Disclaimer

Essential Invoice is provided "as is" without warranty. While we implement security best practices, no system is 100% secure. Users are responsible for:

- Choosing strong passwords
- Securing their deployment environment
- Regular backups
- Compliance with local laws and regulations
- Protecting sensitive credentials

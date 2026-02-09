# Troubleshooting

Common issues and their solutions.

## Installation Issues

### Docker Container Won't Start

**Problem**: Docker containers fail to start or crash immediately.

**Solutions**:

1. **Check if ports are already in use**:
   ```bash
   lsof -i :80      # Frontend
   lsof -i :3001    # Backend
   lsof -i :5432    # Database
   ```
   Kill conflicting processes or change ports in docker-compose.yml

2. **Check Docker logs**:
   ```bash
   docker compose logs backend
   docker compose logs frontend
   docker compose logs db
   ```

3. **Rebuild containers**:
   ```bash
   docker compose down
   docker compose build --no-cache
   docker compose up -d
   ```

4. **Check Docker disk space**:
   ```bash
   docker system df
   docker system prune -a  # Clean up if needed
   ```

### Database Connection Errors

**Problem**: Backend can't connect to PostgreSQL.

**Symptoms**:
- Error: "ECONNREFUSED" or "Connection refused"
- Backend logs show database errors
- Application shows "Server error"

**Solutions**:

1. **Wait for database to be ready**:
   ```bash
   docker compose logs db
   # Wait for "database system is ready to accept connections"
   ```

2. **Check environment variables**:
   - Verify DB_HOST, DB_PORT, DB_USER, DB_PASSWORD in `.env`
   - Ensure backend container can resolve `db` hostname

3. **Restart backend after database is ready**:
   ```bash
   docker compose restart backend
   ```

4. **Check database is running**:
   ```bash
   docker compose ps db
   # Should show "Up" status
   ```

### Migration Errors

**Problem**: Database migrations fail.

**Solutions**:

1. **Check database connectivity** (see above)

2. **Manual migration**:
   ```bash
   cd backend
   pnpm run migrate
   ```

3. **Reset database** (WARNING: Deletes all data):
   ```bash
   docker compose down
   docker volume rm essential-invoice_postgres_data
   docker compose up -d
   ```

## Email Issues

### SMTP Sending Fails

**Problem**: Invoices fail to send via email.

**Symptoms**:
- Error message when clicking "Send"
- "Could not send email" error
- SMTP test fails

**Solutions**:

1. **Verify SMTP settings**:
   - Correct host (e.g., smtp.gmail.com)
   - Correct port (587 for TLS, 465 for SSL)
   - Valid username and password

2. **For Gmail users**:
   - Enable 2-factor authentication
   - Create an [App Password](https://support.google.com/accounts/answer/185833)
   - Use app password instead of regular password
   - Enable "Less secure app access" if not using 2FA (not recommended)

3. **Check firewall**:
   - Ensure outbound SMTP ports are not blocked
   - Test: `telnet smtp.gmail.com 587`

4. **Test connection**:
   - Go to Settings > Email (SMTP)
   - Click "Test" button
   - Check error message for clues

### IMAP Polling Not Working

**Problem**: Bank payments not automatically detected.

**Symptoms**:
- Manual email check shows nothing
- No payments created from emails
- IMAP test fails

**Solutions**:

1. **Verify IMAP settings**:
   - Correct host (e.g., imap.gmail.com)
   - Correct port (993 for TLS)
   - Valid username and password
   - Correct bank email filter

2. **For Gmail users**:
   - Same as SMTP - use App Password
   - Enable IMAP in Gmail settings

3. **Check email format**:
   - Bank notification emails must match expected format
   - Currently only Air Bank format supported
   - Check backend logs for parsing errors

4. **Manually trigger check**:
   - Go to Payments page
   - Click "Check Emails" button
   - Monitor backend logs

5. **Check polling interval**:
   - Default: 5 minutes
   - Adjust `EMAIL_POLLING_INTERVAL` in `.env` (milliseconds)

## PDF Issues

### PDF Generation Fails

**Problem**: Can't download invoice PDFs or PDFs are corrupted.

**Solutions**:

1. **Check backend logs**:
   ```bash
   docker compose logs backend | grep -i pdf
   ```

2. **Verify user profile**:
   - Ensure company name, IČO, address are filled
   - Bank account and bank code required for QR code

3. **Check logo file**:
   - If logo uploaded, ensure it's valid image
   - Try removing logo temporarily

4. **Restart backend**:
   ```bash
   docker compose restart backend
   ```

### QR Code Not Appearing

**Problem**: SPAYD QR code missing from invoice PDF.

**Solutions**:

1. **Verify bank account details**:
   - Bank account number required
   - Bank code required
   - Go to Profile and fill in bank details

2. **Check invoice currency**:
   - QR codes only work for CZK
   - EUR invoices won't have QR codes

## Authentication Issues

### Can't Log In

**Problem**: Login fails with valid credentials.

**Solutions**:

1. **Check credentials**:
   - Email is case-sensitive
   - Password is case-sensitive
   - Try password reset (if implemented)

2. **Check JWT_SECRET**:
   - Ensure JWT_SECRET is set in `.env`
   - Must be at least 32 characters
   - Don't change JWT_SECRET after users are created

3. **Clear browser cache**:
   - Clear localStorage
   - Hard refresh (Ctrl+Shift+R)

4. **Check backend logs**:
   ```bash
   docker compose logs backend | grep -i auth
   ```

### Session Expires Too Quickly

**Problem**: Getting logged out frequently.

**Solution**:
- JWT tokens expire after 7 days by default
- This is configurable in backend code
- Increase token expiration in `backend/src/routes/auth.ts`

### Token Invalid Error

**Problem**: "Invalid token" or "No token provided" errors.

**Solutions**:

1. **Log out and log in again**:
   - Token may be corrupted
   - Fresh login creates new token

2. **Check browser console**:
   - Look for errors related to token
   - Token should be in localStorage

3. **CORS issues**:
   - Ensure CORS_ORIGIN is set correctly in `.env`
   - Should match frontend URL

## Performance Issues

### Application is Slow

**Problem**: Pages load slowly or actions take long time.

**Solutions**:

1. **Check Docker resources**:
   - Increase Docker memory/CPU allocation
   - Docker Desktop > Settings > Resources

2. **Database optimization**:
   ```bash
   docker compose exec db psql -U postgres essential_invoice
   ```
   ```sql
   VACUUM ANALYZE;  -- Clean up database
   ```

3. **Check disk space**:
   ```bash
   df -h
   docker system df
   ```

4. **Restart services**:
   ```bash
   docker compose restart
   ```

### High Memory Usage

**Problem**: Docker containers using too much memory.

**Solutions**:

1. **Check container stats**:
   ```bash
   docker stats
   ```

2. **Limit container resources** in docker-compose.yml:
   ```yaml
   services:
     backend:
       mem_limit: 512m
       cpus: 0.5
   ```

3. **Clean up unused resources**:
   ```bash
   docker system prune -a
   docker volume prune
   ```

## Network Issues

### CORS Errors

**Problem**: "CORS policy" errors in browser console.

**Solutions**:

1. **For local development**:
   - Set `CORS_ORIGIN=http://localhost:5173` in `.env`
   - Restart backend

2. **For production**:
   - Set CORS_ORIGIN to your actual frontend URL
   - Example: `CORS_ORIGIN=https://invoice.yourdomain.com`

3. **Multiple origins**:
   - Comma-separated: `CORS_ORIGIN=http://localhost:5173,http://localhost:3000`

### Can't Access Application

**Problem**: Application not accessible at http://localhost

**Solutions**:

1. **Check if containers are running**:
   ```bash
   docker compose ps
   # All should show "Up" status
   ```

2. **Check port bindings**:
   ```bash
   docker compose ps
   # Should show 0.0.0.0:80->80 for frontend
   ```

3. **Try specific ports**:
   - Frontend: http://localhost:80
   - Backend: http://localhost:3001
   - If these work, it's a browser/proxy issue

4. **Check firewall**:
   - Ensure ports 80 and 3001 are not blocked
   - Temporarily disable firewall to test

## Data Issues

### Invoice Numbers Not Auto-Incrementing

**Problem**: Invoice numbers not generating correctly.

**Solutions**:

1. **Check database**:
   ```bash
   docker compose exec db psql -U postgres essential_invoice
   ```
   ```sql
   SELECT invoice_number FROM invoices ORDER BY id DESC LIMIT 10;
   ```

2. **Look for gaps or duplicates**:
   - Invoice numbering is year-based (2024001, 2024002)
   - Should increment sequentially within year

3. **Manual fix if needed**:
   - Delete problematic invoice (if draft)
   - Create new invoice

### Missing or Corrupted Data

**Problem**: Data seems to be missing or incorrect.

**Solutions**:

1. **Check database directly**:
   ```bash
   docker compose exec db psql -U postgres essential_invoice
   ```
   ```sql
   SELECT * FROM users WHERE id = 1;
   SELECT * FROM invoices WHERE user_id = 1;
   ```

2. **Restore from backup** (if you have one):
   ```bash
   docker compose exec -T db psql -U postgres essential_invoice < backup.sql
   ```

3. **Check application logs**:
   ```bash
   docker compose logs backend | grep -i error
   ```

## Development Issues

### Hot Reload Not Working

**Problem**: Changes not reflecting during development.

**Solutions**:

1. **Backend (tsx watch)**:
   - Ensure using `pnpm run dev` not `pnpm run start`
   - Check for syntax errors preventing reload
   - Restart dev server

2. **Frontend (Vite HMR)**:
   - Ensure using `pnpm run dev`
   - Check browser console for HMR errors
   - Hard refresh browser (Ctrl+Shift+R)

### Tests Failing

**Problem**: `pnpm test` shows failing tests.

**Solutions**:

1. **Run tests individually**:
   ```bash
   pnpm vitest run src/utils/validation.test.ts
   ```

2. **Check for environment issues**:
   - Tests may require specific environment variables
   - Check test setup files

3. **Update test snapshots** (if using snapshots):
   ```bash
   pnpm vitest -u
   ```

## Getting Help

If you're still experiencing issues:

1. **Check logs**:
   ```bash
   docker compose logs -f
   ```

2. **Enable debug logging** (add to `.env`):
   ```bash
   DEBUG=*
   LOG_LEVEL=debug
   ```

3. **Search GitHub issues**:
   - [GitHub Issues](https://github.com/vdovhanych/essential-invoice/issues)
   - Someone may have had the same problem

4. **Create a new issue**:
   - Include error messages
   - Include relevant logs
   - Describe steps to reproduce
   - Mention your environment (OS, Docker version, etc.)

5. **Community support**:
   - Check project documentation
   - Ask in discussions

## Logs and Debugging

### Viewing Logs

**All services**:
```bash
docker compose logs -f
```

**Specific service**:
```bash
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f db
```

**Last N lines**:
```bash
docker compose logs --tail=100 backend
```

**Save logs to file**:
```bash
docker compose logs backend > backend-logs.txt
```

### Backend Debugging

**Add debug output** in code:
```typescript
console.log('Debug:', variableName);
console.error('Error:', error);
```

**Check specific routes**:
```bash
docker compose logs backend | grep -i "POST /api/invoices"
```

### Frontend Debugging

**Browser console**:
- Open DevTools (F12)
- Check Console tab for errors
- Check Network tab for failed requests

**React DevTools**:
- Install React Developer Tools browser extension
- Inspect component state and props

### Database Debugging

**Access database**:
```bash
docker compose exec db psql -U postgres essential_invoice
```

**Useful queries**:
```sql
-- Check table schemas
\d invoices

-- Check recent records
SELECT * FROM invoices ORDER BY created_at DESC LIMIT 10;

-- Check for errors in data
SELECT * FROM invoices WHERE total_amount < 0;

-- Query performance
EXPLAIN ANALYZE SELECT * FROM invoices WHERE user_id = 1;
```

**Exit psql**:
```sql
\q
```

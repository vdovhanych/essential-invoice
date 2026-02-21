# Troubleshooting

## Common Issues

**PDF generation fails:**
- Ensure Chromium is installed in the Docker container
- Check logs: `docker compose logs backend`

**Email sending fails:**
- Verify SMTP settings in Settings page
- Test connection with the "Test" button
- Check if 2FA requires app password (Gmail, etc.)

**Bank notifications not received:**
- Verify IMAP settings
- Check that bank notification email filter is correct
- Ensure email is marked as unread in inbox

**Database connection errors:**
- Wait for database to be healthy before backend starts
- Check `docker compose logs db`

## Viewing Logs

```bash
# All logs
docker compose logs

# Backend logs
docker compose logs backend

# Database logs
docker compose logs db
```

# Troubleshooting

## Common Issues

**PDF generation fails:**
- PDF generation uses pdfmake and does not require Chromium.
- Check logs: `docker compose logs backend`

**Invoice preview says the PDF could not be displayed, but Open PDF works:**
- Check the browser console and the response for `/assets/pdf.worker.*.mjs`. Module workers must be served with `Content-Type: application/javascript`, not `application/octet-stream` or HTML.
- Both the Docker frontend and Helm nginx configuration explicitly map `.mjs` to JavaScript. Rebuild the frontend image after updating the Docker configuration, or upgrade the Helm release after updating the chart.
- Missing worker assets must return 404 rather than the SPA's HTML fallback. The PWA precaches `.mjs` assets together with the application; accept the app's update prompt after deployment if an older version is still active.

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

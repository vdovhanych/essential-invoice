# Deployment

## Docker Compose (Recommended)

### Quick Start

1. Clone the repository:
```bash
git clone https://github.com/yourusername/essential-invoice.git
cd essential-invoice
```

2. Create environment file:
```bash
cp .env.example .env
```

3. Edit `.env` with your settings (required: `JWT_SECRET`, `DB_PASSWORD`, `ENCRYPTION_KEY`):
```bash
JWT_SECRET=your_secure_jwt_secret_here_min_32_chars
DB_PASSWORD=your_secure_database_password
ENCRYPTION_KEY=$(openssl rand -hex 32)
```

4. Start the application:
```bash
docker compose up -d
```

5. Access the application at `http://localhost:8080`

### Production

Use the production compose file:
```bash
docker compose -f docker-compose.production.yml up -d
```

The production compose file uses the same hardened database image as the Helm
chart (`dhi.io/postgres:18`), which requires registry authentication:

```bash
docker login dhi.io
```

### Frontend module assets

The frontend nginx configuration serves `.mjs` assets (including the PDF preview worker) as `application/javascript`, with missing modules returning 404 rather than the SPA fallback. Preserve this MIME mapping when using custom hosting. The PWA precache includes these module assets. After changing the frontend configuration, rebuild and recreate it with `docker compose up -d --build --no-deps frontend`.

## Kubernetes (Helm)

```bash
cd helm-chart
helm install essential-invoice . \
  --namespace essential-invoice \
  --create-namespace \
  --set jwtSecret=$(openssl rand -base64 32) \
  --set encryptionKey=$(openssl rand -hex 32) \
  --set postgresql.auth.password=$(openssl rand -base64 16)
```

See [helm-chart/README.md](../helm-chart/README.md) for full configuration reference.

## Backup

### Database Backup (Docker Compose)

```bash
# Create backup
docker compose exec db pg_dump -U postgres essential_invoice > backup.sql

# Restore backup
docker compose exec -T db psql -U postgres essential_invoice < backup.sql
```

### Database Backup (Kubernetes/Helm)

The PostgreSQL StatefulSet stores data on a PVC, but a PVC is not a backup —
it shares failure modes with the cluster. Dump the database regularly to a
machine (or object storage) outside the cluster.

Manual dump and restore, from any machine with `kubectl` access
(`-Fc` is pg_dump's compressed custom format, restorable with `pg_restore`):

```bash
# Create backup
kubectl -n <namespace> exec essential-invoice-postgresql-0 -- \
  pg_dump -U postgres -Fc essential_invoice > essential_invoice-$(date +%F).dump

# Restore backup
kubectl -n <namespace> exec -i essential-invoice-postgresql-0 -- \
  pg_restore -U postgres -d essential_invoice --clean --if-exists < essential_invoice-2026-08-04.dump
```

#### Periodic backups

Save this as `backup-essential-invoice.sh` on a machine that runs 24/7 and has
`kubectl` access:

```bash
#!/usr/bin/env bash
set -euo pipefail

NAMESPACE="essential-invoice"
BACKUP_DIR="$HOME/backups/essential-invoice"
RETENTION_DAYS=14

mkdir -p "$BACKUP_DIR"
FILE="$BACKUP_DIR/essential_invoice-$(date +%F-%H%M).dump"

kubectl -n "$NAMESPACE" exec essential-invoice-postgresql-0 -- \
  pg_dump -U postgres -Fc essential_invoice > "$FILE"

# Fail loudly on empty dumps
[ -s "$FILE" ] || { echo "backup is empty" >&2; rm -f "$FILE"; exit 1; }

# Optional: copy off-site to S3-compatible storage
# aws s3 cp "$FILE" s3://my-backup-bucket/essential-invoice/

find "$BACKUP_DIR" -name '*.dump' -type f -mtime +"$RETENTION_DAYS" -delete
```

Schedule it with cron (`crontab -e`), e.g. daily at 02:00:

```cron
0 2 * * * /path/to/backup-essential-invoice.sh >> $HOME/backups/essential-invoice/backup.log 2>&1
```

Periodically verify that a dump actually restores (e.g. into a throwaway
database) — an untested backup is a hope, not a backup.

### Docker Compose volume backup

```bash
# Stop containers
docker compose down

# Backup volume
docker run --rm -v essential-invoice_postgres_data:/data -v $(pwd):/backup alpine tar czf /backup/db-backup.tar.gz -C /data .

# Restore volume
docker run --rm -v essential-invoice_postgres_data:/data -v $(pwd):/backup alpine tar xzf /backup/db-backup.tar.gz -C /data
```

### Logo security update

Deploy frontend and backend together. Logo URLs no longer accept session tokens; clients must send the Authorization header. Existing PNG/JPEG logos are validated and normalized on read. Existing SVG or corrupt logos are retained in storage but are no longer served or embedded in PDFs; upload a PNG/JPEG replacement in Profile. PDF generation continues without rejected logos. If a proxy has cached old logo responses, purge that cache when deploying.
### Session revocation migration

Startup adds `users.session_version INTEGER NOT NULL DEFAULT 0` idempotently. Existing signed JWTs without a version are treated as version zero so deployment does not force a global logout. Every authenticated request checks the database, fails closed on database errors, and rejects deleted accounts. Password changes and successful resets atomically increment the version, immediately invalidating all previous JWTs, including legacy tokens. A password change also invalidates outstanding reset links and signs out the current browser. Users must sign in again with the new password. Deploy all backend instances together: old backend instances do not enforce revocation.
### AI provider destinations

By default only `https://openrouter.ai/api/v1` and `https://api.openai.com/v1` are allowed. All AI requests reject HTTP redirects. To enable a custom/local OpenAI-compatible model, the deployment operator must set `AI_ALLOWED_BASE_URLS` to its exact base URL (comma-separated for multiple destinations), for example `http://ollama:11434/v1`. For Helm use `backend.env.AI_ALLOWED_BASE_URLS`. The same explicit opt-in is required in development. Never add untrusted hosts: each listed destination is reachable from the backend and receives the user's API key and prompt. This is an exact endpoint allowlist, not a private-network blocker.

Existing custom settings are retained but cannot make requests until the operator allows that endpoint or the user selects a built-in provider. There is no automatic fallback that would send the old provider's key or documents to a different provider. Deploy frontend and backend together; Settings exposes only the operator-approved choices.

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

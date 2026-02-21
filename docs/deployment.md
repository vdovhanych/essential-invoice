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

### Database Backup

```bash
# Create backup
docker compose exec db pg_dump -U postgres essential_invoice > backup.sql

# Restore backup
docker compose exec -T db psql -U postgres essential_invoice < backup.sql
```

### Volume Backup

```bash
# Stop containers
docker compose down

# Backup volume
docker run --rm -v essential-invoice_postgres_data:/data -v $(pwd):/backup alpine tar czf /backup/db-backup.tar.gz -C /data .

# Restore volume
docker run --rm -v essential-invoice_postgres_data:/data -v $(pwd):/backup alpine tar xzf /backup/db-backup.tar.gz -C /data
```

# Backup and Restore

Guide for backing up and restoring your Essential Invoice data.

## Why Backup?

Regular backups protect you from:
- Hardware failures
- Accidental data deletion
- Software bugs
- Security incidents
- Migration to new server

## What to Backup

Essential Invoice stores data in two places:

1. **PostgreSQL Database**: 
   - User accounts
   - Clients
   - Invoices and items
   - Expenses
   - Payments
   - Settings

2. **File System**:
   - Uploaded logos
   - Expense receipt attachments
   - Located in `backend/uploads/`

## Backup Methods

### Method 1: Database Dump (Recommended)

#### Create Backup

```bash
# Create a timestamped backup
docker compose exec db pg_dump -U postgres essential_invoice > backup-$(date +%Y%m%d-%H%M%S).sql

# Or simpler filename
docker compose exec db pg_dump -U postgres essential_invoice > backup.sql
```

**What this does**:
- Exports entire database to SQL file
- Includes all tables, data, and structure
- File is human-readable SQL commands
- Can be version-controlled with git (if desired)

#### Restore Backup

```bash
# Restore from backup file
docker compose exec -T db psql -U postgres essential_invoice < backup.sql
```

**Notes**:
- This will not overwrite existing data unless there are conflicts
- To start fresh, drop the database first (see "Complete Database Reset" below)

### Method 2: Docker Volume Backup

#### Create Volume Backup

```bash
# Stop containers first
docker compose down

# Backup volume to tar.gz
docker run --rm \
  -v essential-invoice_postgres_data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/db-backup-$(date +%Y%m%d).tar.gz -C /data .

# Start containers
docker compose up -d
```

**What this does**:
- Creates compressed archive of entire PostgreSQL data directory
- Includes all databases and configuration
- Binary format (not human-readable)
- Faster for large databases

#### Restore Volume Backup

```bash
# Stop containers
docker compose down

# Remove existing volume
docker volume rm essential-invoice_postgres_data

# Restore from backup
docker run --rm \
  -v essential-invoice_postgres_data:/data \
  -v $(pwd):/backup \
  alpine tar xzf /backup/db-backup-YYYYMMDD.tar.gz -C /data

# Start containers
docker compose up -d
```

### Method 3: File System Backup

#### Backup Uploaded Files

```bash
# Copy uploads directory
cp -r backend/uploads uploads-backup-$(date +%Y%m%d)

# Or create tar archive
tar czf uploads-backup-$(date +%Y%m%d).tar.gz backend/uploads
```

#### Restore Uploaded Files

```bash
# From directory copy
rm -rf backend/uploads
cp -r uploads-backup-YYYYMMDD backend/uploads

# From tar archive
tar xzf uploads-backup-YYYYMMDD.tar.gz
```

## Complete Backup Strategy

### Full Backup (Database + Files)

Create a script `backup.sh`:

```bash
#!/bin/bash

# Configuration
BACKUP_DIR="./backups"
DATE=$(date +%Y%m%d-%H%M%S)

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup database
echo "Backing up database..."
docker compose exec db pg_dump -U postgres essential_invoice > $BACKUP_DIR/db-$DATE.sql

# Backup uploads
echo "Backing up uploaded files..."
tar czf $BACKUP_DIR/uploads-$DATE.tar.gz backend/uploads

# Remove backups older than 30 days
find $BACKUP_DIR -name "*.sql" -mtime +30 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete

echo "Backup completed: $BACKUP_DIR"
```

Make it executable:
```bash
chmod +x backup.sh
```

Run it:
```bash
./backup.sh
```

### Automated Backups

#### Using Cron (Linux/Mac)

```bash
# Edit crontab
crontab -e

# Add daily backup at 2 AM
0 2 * * * /path/to/essential-invoice/backup.sh

# Or weekly on Sunday at 2 AM
0 2 * * 0 /path/to/essential-invoice/backup.sh
```

#### Using Windows Task Scheduler

1. Create a batch file `backup.bat`:
   ```batch
   @echo off
   cd C:\path\to\essential-invoice
   docker compose exec db pg_dump -U postgres essential_invoice > backups\db-%date%.sql
   ```

2. Open Task Scheduler
3. Create Basic Task
4. Set trigger (daily, weekly, etc.)
5. Action: Start a program
6. Program: `C:\path\to\essential-invoice\backup.bat`

## Restore Procedures

### Restore Latest Backup

```bash
# Find latest backup
ls -lt backups/

# Restore database
docker compose exec -T db psql -U postgres essential_invoice < backups/db-YYYYMMDD-HHMMSS.sql

# Restore uploads
tar xzf backups/uploads-YYYYMMDD-HHMMSS.tar.gz
```

### Complete Database Reset

**WARNING**: This deletes ALL data!

```bash
# Stop containers
docker compose down

# Remove database volume
docker volume rm essential-invoice_postgres_data

# Start containers (database will be recreated)
docker compose up -d

# Wait for database to be ready
sleep 10

# Restore from backup
docker compose exec -T db psql -U postgres essential_invoice < backup.sql
```

### Selective Restore

If you only need to restore specific data:

```bash
# Access database
docker compose exec db psql -U postgres essential_invoice

# Delete specific records
DELETE FROM invoices WHERE id = 123;

# Or restore single table from backup
\! cat backup.sql | grep "COPY invoices" -A 1000 > temp.sql
\i temp.sql
```

## Migration to New Server

### Export from Old Server

```bash
# On old server
cd essential-invoice

# Create complete backup
docker compose exec db pg_dump -U postgres essential_invoice > db-export.sql
tar czf uploads-export.tar.gz backend/uploads
cp .env env-export

# Download these files:
# - db-export.sql
# - uploads-export.tar.gz  
# - env-export
```

### Import to New Server

```bash
# On new server
git clone https://github.com/vdovhanych/essential-invoice.git
cd essential-invoice

# Copy exported files here
# - db-export.sql
# - uploads-export.tar.gz
# - env-export

# Setup environment
cp env-export .env

# Start containers
docker compose up -d

# Wait for database
sleep 10

# Import data
docker compose exec -T db psql -U postgres essential_invoice < db-export.sql

# Restore uploads
tar xzf uploads-export.tar.gz

# Verify
docker compose logs backend
```

## Cloud Backup Solutions

### AWS S3

```bash
# Install AWS CLI
pip install awscli

# Configure credentials
aws configure

# Backup script with S3 upload
#!/bin/bash
DATE=$(date +%Y%m%d-%H%M%S)

docker compose exec db pg_dump -U postgres essential_invoice > db-$DATE.sql
tar czf uploads-$DATE.tar.gz backend/uploads

aws s3 cp db-$DATE.sql s3://your-bucket/essential-invoice/
aws s3 cp uploads-$DATE.tar.gz s3://your-bucket/essential-invoice/

rm db-$DATE.sql uploads-$DATE.tar.gz
```

### Restic (Encrypted Backups)

```bash
# Install restic
# Linux: apt install restic
# Mac: brew install restic

# Initialize repository
restic -r /path/to/backup init

# Backup
#!/bin/bash
docker compose exec db pg_dump -U postgres essential_invoice > /tmp/db-backup.sql
restic -r /path/to/backup backup \
  /tmp/db-backup.sql \
  backend/uploads
rm /tmp/db-backup.sql

# Restore
restic -r /path/to/backup restore latest --target /tmp/restore
docker compose exec -T db psql -U postgres essential_invoice < /tmp/restore/tmp/db-backup.sql
```

## Backup Best Practices

### Frequency

- **Development**: Daily or before major changes
- **Production**: 
  - Daily backups (keep 7 days)
  - Weekly backups (keep 4 weeks)
  - Monthly backups (keep 12 months)

### Storage

1. **Local**: Fast restore, but risk of hardware failure
2. **Off-site**: Cloud storage (S3, Google Drive, Dropbox)
3. **3-2-1 Rule**:
   - 3 copies of data
   - 2 different media types
   - 1 off-site copy

### Testing

**Test your backups regularly!**

```bash
# Monthly backup test procedure
# 1. Create fresh restore environment
mkdir test-restore
cd test-restore

# 2. Clone application
git clone https://github.com/vdovhanych/essential-invoice.git
cd essential-invoice

# 3. Start with latest backup
cp /path/to/latest/backup.sql .
docker compose up -d
sleep 10

# 4. Restore backup
docker compose exec -T db psql -U postgres essential_invoice < backup.sql

# 5. Verify data
# - Log in to application
# - Check invoices, clients, etc.
# - Generate test PDF
# - Send test email

# 6. Clean up
docker compose down
cd ../..
rm -rf test-restore
```

### Security

1. **Encrypt backups** for off-site storage:
   ```bash
   # Encrypt backup
   gpg --symmetric --cipher-algo AES256 backup.sql
   
   # Decrypt backup
   gpg backup.sql.gpg
   ```

2. **Restrict access** to backup files:
   ```bash
   chmod 600 backup.sql
   chmod 700 backups/
   ```

3. **Don't commit backups** to git:
   ```bash
   echo "backups/" >> .gitignore
   echo "*.sql" >> .gitignore
   ```

## Disaster Recovery

### Quick Recovery Checklist

1. **Assess the situation**:
   - What data is lost?
   - When was last backup?
   - Is server still accessible?

2. **Stop the application**:
   ```bash
   docker compose down
   ```

3. **Locate latest backup**:
   ```bash
   ls -lt backups/
   ```

4. **Restore data** (see methods above)

5. **Verify integrity**:
   - Log in as admin
   - Spot check recent invoices
   - Test key functions

6. **Document incident**:
   - What happened?
   - What was lost?
   - How was it recovered?
   - How to prevent in future?

### Recovery Time Objective (RTO)

With proper backups:
- Database restore: 5-10 minutes
- File restore: 1-5 minutes
- Application restart: 2-5 minutes
- **Total RTO: ~15-20 minutes**

### Data Loss Prevention

1. **Regular backups** (automated)
2. **Test restores** (monthly)
3. **Off-site storage** (daily sync)
4. **Version control** for code
5. **Monitoring** for early detection
6. **Documentation** of procedures

## Backup Verification

### Automated Verification Script

```bash
#!/bin/bash
# verify-backup.sh

BACKUP_FILE=$1

if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: ./verify-backup.sh backup.sql"
  exit 1
fi

# Check file exists
if [ ! -f "$BACKUP_FILE" ]; then
  echo "Error: Backup file not found"
  exit 1
fi

# Check file size (should be > 1KB)
SIZE=$(stat -f%z "$BACKUP_FILE" 2>/dev/null || stat -c%s "$BACKUP_FILE")
if [ $SIZE -lt 1024 ]; then
  echo "Warning: Backup file is very small ($SIZE bytes)"
  exit 1
fi

# Check file is valid SQL
if ! grep -q "PostgreSQL database dump" "$BACKUP_FILE"; then
  echo "Error: File doesn't appear to be a valid PostgreSQL dump"
  exit 1
fi

# Check for essential tables
TABLES=("users" "invoices" "clients" "payments")
for table in "${TABLES[@]}"; do
  if ! grep -q "CREATE TABLE.*$table" "$BACKUP_FILE"; then
    echo "Warning: Table '$table' not found in backup"
  fi
done

echo "Backup verification completed successfully"
echo "File size: $SIZE bytes"
```

Usage:
```bash
chmod +x verify-backup.sh
./verify-backup.sh backups/db-20240101.sql
```

## Additional Resources

- [PostgreSQL Backup Documentation](https://www.postgresql.org/docs/current/backup.html)
- [Docker Volume Backup Best Practices](https://docs.docker.com/storage/volumes/#backup-restore-or-migrate-data-volumes)
- [Restic Documentation](https://restic.readthedocs.io/)

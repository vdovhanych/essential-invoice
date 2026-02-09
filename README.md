# Essential Invoice

A lightweight, self-hosted invoicing web application designed for Czech freelancers and small businesses. Built with React, Express, and PostgreSQL.

## ✨ Key Features

- 📄 **Invoice Management** - Create, send, and track invoices with automatic numbering
- 💰 **Expense Tracking** - Monitor business expenses with receipt attachments  
- 👥 **Client Management** - ARES API integration for Czech companies
- 📧 **Email Integration** - Send invoices via SMTP, receive payment notifications via IMAP
- 🤖 **AI Assistant** - Smart payment matching and Czech tax advisor (Perplexity AI)
- 💳 **Payment Matching** - Automatic bank notification parsing (Air Bank supported)
- 🧾 **Professional PDFs** - Czech invoice templates with QR payment codes (SPAYD)
- 📊 **Dashboard** - Revenue overview and paušální daň tracking
- 🐳 **Docker Ready** - Deploy with a single command

## 🚀 Quick Start

### Prerequisites

- Docker and Docker Compose
- (Optional) SMTP/IMAP for email features

### Production Deployment

1. **Clone and setup**:
```bash
git clone https://github.com/vdovhanych/essential-invoice.git
cd essential-invoice
cp .env.example .env
```

2. **Configure environment** (edit `.env`):
```bash
JWT_SECRET=your_secure_jwt_secret_min_32_chars
DB_PASSWORD=your_secure_database_password
```

3. **Start application**:
```bash
docker compose up -d
```

4. **Access**: Open `http://localhost` and register your account

### Development Setup

1. **Start database**:
```bash
docker compose up -d db
```

2. **Backend** (in new terminal):
```bash
cd backend
pnpm install
pnpm run dev
```

3. **Frontend** (in new terminal):
```bash
cd frontend
pnpm install
pnpm run dev
```

4. **Access**: Open `http://localhost:5173`

> **Note**: Set `CORS_ORIGIN=http://localhost:5173` in `.env` for local development

## 📖 Documentation

Comprehensive documentation is available in the [`docs/`](docs/) folder:

- **[Usage Guide](docs/usage.md)** - Complete guide for using the application
- **[Configuration](docs/configuration.md)** - Environment variables, SMTP/IMAP, AI setup
- **[Development](docs/development.md)** - Local development setup and workflow
- **[API Reference](docs/api.md)** - Complete REST API documentation
- **[Architecture](docs/architecture.md)** - Technical design and architecture
- **[Testing](docs/testing.md)** - How to run and write tests
- **[Troubleshooting](docs/troubleshooting.md)** - Common issues and solutions
- **[Backup & Restore](docs/backup.md)** - Data backup procedures
- **[Bank Support](docs/bank-support.md)** - Supported banks and adding new ones
- **[Security](docs/security.md)** - Security features and best practices

## 🛠️ Technology Stack

- **Frontend**: React 18, TypeScript, Vite, TailwindCSS
- **Backend**: Express, Node.js, TypeScript
- **Database**: PostgreSQL
- **PDF Generation**: pdfmake
- **Email**: nodemailer (SMTP/IMAP)
- **Authentication**: JWT
- **AI**: Perplexity API (optional)
- **Testing**: Vitest
- **Deployment**: Docker Compose

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

1. **Fork** the repository
2. **Create** a feature branch
3. **Write/update** tests for your changes
4. **Update** documentation (see [Documentation Guidelines](#documentation-guidelines))
5. **Submit** a pull request

### Documentation Guidelines

When contributing code changes, **always update the documentation**:

- Added a feature? → Update [`docs/`](docs/) and feature list
- Changed API? → Update [`docs/api.md`](docs/api.md)
- Changed config? → Update [`docs/configuration.md`](docs/configuration.md)  
- Changed architecture? → Update [`docs/architecture.md`](docs/architecture.md)
- Added bank support? → Update [`docs/bank-support.md`](docs/bank-support.md)

**Documentation is part of your contribution.** PRs with outdated documentation may be rejected.

## 📝 License

MIT License - See [LICENSE](LICENSE) file for details.

## 🐛 Support

- **Issues**: [GitHub Issues](https://github.com/vdovhanych/essential-invoice/issues)
- **Documentation**: [`docs/`](docs/) folder
- **Discussions**: [GitHub Discussions](https://github.com/vdovhanych/essential-invoice/discussions)

## ⭐ Acknowledgments

Built with ❤️ for Czech freelancers and small businesses.

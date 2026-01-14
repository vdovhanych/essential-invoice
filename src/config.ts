import { Effect } from "effect";

export type BankType = "airbank";

export type AppConfig = {
  port: number;
  databaseUrl: string;
  jwtSecret: string;
  adminEmail: string;
  adminPassword: string;
  issuerName: string;
  issuerAddress: string;
  issuerIco: string;
  issuerDic: string;
  bankAccount: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPassword: string;
  imapHost: string;
  imapPort: number;
  imapUser: string;
  imapPassword: string;
  imapPollIntervalMinutes: number;
  bankEmailSenderPattern: string;
  bankType: BankType;
};

const readEnv = (key: string, fallback: string) => process.env[key] ?? fallback;

const readInt = (key: string, fallback: number) => {
  const raw = process.env[key];
  if (!raw) {
    return fallback;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const loadConfigSync = (): AppConfig => ({
  port: readInt("PORT", 3000),
  databaseUrl: readEnv("DATABASE_URL", "postgres://invoice:invoice@db:5432/invoice"),
  jwtSecret: readEnv("JWT_SECRET", "change-me"),
  adminEmail: readEnv("ADMIN_EMAIL", "admin@example.com"),
  adminPassword: readEnv("ADMIN_PASSWORD", "change-me"),
  issuerName: readEnv("ISSUER_NAME", ""),
  issuerAddress: readEnv("ISSUER_ADDRESS", ""),
  issuerIco: readEnv("ISSUER_ICO", ""),
  issuerDic: readEnv("ISSUER_DIC", ""),
  bankAccount: readEnv("BANK_ACCOUNT", ""),
  smtpHost: readEnv("SMTP_HOST", ""),
  smtpPort: readInt("SMTP_PORT", 587),
  smtpUser: readEnv("SMTP_USER", ""),
  smtpPassword: readEnv("SMTP_PASSWORD", ""),
  imapHost: readEnv("IMAP_HOST", ""),
  imapPort: readInt("IMAP_PORT", 993),
  imapUser: readEnv("IMAP_USER", ""),
  imapPassword: readEnv("IMAP_PASSWORD", ""),
  imapPollIntervalMinutes: readInt("IMAP_POLL_INTERVAL_MINUTES", 5),
  bankEmailSenderPattern: readEnv("BANK_EMAIL_SENDER_PATTERN", "noreply@airbank.cz"),
  bankType: "airbank"
});

export const loadConfig = Effect.sync(loadConfigSync);

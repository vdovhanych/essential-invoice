import { Config, Effect } from "effect";

export const appConfig = Config.all({
  port: Config.integer("PORT").pipe(Config.withDefault(3000)),
  databaseUrl: Config.string("DATABASE_URL").pipe(
    Config.withDefault("postgres://invoice:invoice@db:5432/invoice")
  ),
  jwtSecret: Config.string("JWT_SECRET").pipe(Config.withDefault("change-me")),
  adminEmail: Config.string("ADMIN_EMAIL").pipe(Config.withDefault("admin@example.com")),
  adminPassword: Config.string("ADMIN_PASSWORD").pipe(Config.withDefault("change-me")),
  issuerName: Config.string("ISSUER_NAME").pipe(Config.withDefault("")),
  issuerAddress: Config.string("ISSUER_ADDRESS").pipe(Config.withDefault("")),
  issuerIco: Config.string("ISSUER_ICO").pipe(Config.withDefault("")),
  issuerDic: Config.string("ISSUER_DIC").pipe(Config.withDefault("")),
  bankAccount: Config.string("BANK_ACCOUNT").pipe(Config.withDefault("")),
  smtpHost: Config.string("SMTP_HOST").pipe(Config.withDefault("")),
  smtpPort: Config.integer("SMTP_PORT").pipe(Config.withDefault(587)),
  smtpUser: Config.string("SMTP_USER").pipe(Config.withDefault("")),
  smtpPassword: Config.string("SMTP_PASSWORD").pipe(Config.withDefault("")),
  imapHost: Config.string("IMAP_HOST").pipe(Config.withDefault("")),
  imapPort: Config.integer("IMAP_PORT").pipe(Config.withDefault(993)),
  imapUser: Config.string("IMAP_USER").pipe(Config.withDefault("")),
  imapPassword: Config.string("IMAP_PASSWORD").pipe(Config.withDefault("")),
  imapPollIntervalMinutes: Config.integer("IMAP_POLL_INTERVAL_MINUTES").pipe(
    Config.withDefault(5)
  ),
  bankEmailSenderPattern: Config.string("BANK_EMAIL_SENDER_PATTERN").pipe(
    Config.withDefault("noreply@airbank.cz")
  ),
  bankType: Config.literal("airbank").pipe(Config.withDefault("airbank"))
});

export type AppConfig = Config.Config.Type<typeof appConfig>;

export const loadConfig = Effect.config(appConfig);

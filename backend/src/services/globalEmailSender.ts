import nodemailer from 'nodemailer';
import { t } from '../i18n/translations';

interface GlobalSmtpConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  secure: boolean;
  fromEmail: string;
  fromName: string;
}

function getGlobalSmtpConfig(): GlobalSmtpConfig | null {
  const host = process.env.GLOBAL_SMTP_HOST;
  if (!host) return null;

  return {
    host,
    port: parseInt(process.env.GLOBAL_SMTP_PORT || '587'),
    user: process.env.GLOBAL_SMTP_USER || '',
    password: process.env.GLOBAL_SMTP_PASSWORD || '',
    secure: process.env.GLOBAL_SMTP_SECURE === 'true',
    fromEmail: process.env.GLOBAL_SMTP_FROM_EMAIL || '',
    fromName: process.env.GLOBAL_SMTP_FROM_NAME || 'essentialInvoice',
  };
}

function createTransporter(config: GlobalSmtpConfig) {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.password,
    },
  });
}

export function isGlobalSmtpConfigured(): boolean {
  return getGlobalSmtpConfig() !== null;
}

export async function sendWelcomeEmail(toEmail: string, userName: string, language: string = 'cs'): Promise<void> {
  const config = getGlobalSmtpConfig();
  if (!config) {
    console.warn('Global SMTP not configured, skipping welcome email');
    return;
  }

  const tr = t(language).email;
  const transporter = createTransporter(config);
  const from = config.fromName
    ? `"${config.fromName}" <${config.fromEmail}>`
    : config.fromEmail;

  await transporter.sendMail({
    from,
    to: toEmail,
    subject: tr.welcomeSubject,
    text: tr.welcomeText(userName),
    html: tr.welcomeHtml(userName),
  });
}

export async function sendPasswordResetEmail(toEmail: string, userName: string, resetToken: string, language: string = 'cs'): Promise<void> {
  const config = getGlobalSmtpConfig();
  if (!config) {
    throw new Error('Global SMTP not configured');
  }

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
  const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;

  const tr = t(language).email;
  const transporter = createTransporter(config);
  const from = config.fromName
    ? `"${config.fromName}" <${config.fromEmail}>`
    : config.fromEmail;

  await transporter.sendMail({
    from,
    to: toEmail,
    subject: tr.resetSubject,
    text: tr.resetText(userName, resetUrl),
    html: tr.resetHtml(userName, resetUrl),
  });
}

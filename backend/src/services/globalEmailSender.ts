import nodemailer from 'nodemailer';

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

export async function sendWelcomeEmail(toEmail: string, userName: string): Promise<void> {
  const config = getGlobalSmtpConfig();
  if (!config) {
    console.warn('Global SMTP not configured, skipping welcome email');
    return;
  }

  const transporter = createTransporter(config);
  const from = config.fromName
    ? `"${config.fromName}" <${config.fromEmail}>`
    : config.fromEmail;

  await transporter.sendMail({
    from,
    to: toEmail,
    subject: 'Vítejte v essentialInvoice',
    text: `Dobrý den ${userName},\n\nvítejte v aplikaci essentialInvoice! Váš účet byl úspěšně vytvořen.\n\nNyní můžete začít vytvářet faktury, spravovat klienty a sledovat platby.\n\nS pozdravem,\nTým essentialInvoice`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Vítejte v essentialInvoice</h2>
        <p>Dobrý den ${userName},</p>
        <p>vítejte v aplikaci essentialInvoice! Váš účet byl úspěšně vytvořen.</p>
        <p>Nyní můžete začít vytvářet faktury, spravovat klienty a sledovat platby.</p>
        <br>
        <p>S pozdravem,<br>Tým essentialInvoice</p>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail(toEmail: string, userName: string, resetToken: string): Promise<void> {
  const config = getGlobalSmtpConfig();
  if (!config) {
    throw new Error('Global SMTP not configured');
  }

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
  const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;

  const transporter = createTransporter(config);
  const from = config.fromName
    ? `"${config.fromName}" <${config.fromEmail}>`
    : config.fromEmail;

  await transporter.sendMail({
    from,
    to: toEmail,
    subject: 'Obnovení hesla - essentialInvoice',
    text: `Dobrý den ${userName},\n\nobdrželi jsme žádost o obnovení hesla k vašemu účtu.\n\nPro nastavení nového hesla klikněte na následující odkaz:\n${resetUrl}\n\nOdkaz je platný 1 hodinu.\n\nPokud jste o obnovení hesla nežádali, tento email můžete ignorovat.\n\nS pozdravem,\nTým essentialInvoice`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Obnovení hesla</h2>
        <p>Dobrý den ${userName},</p>
        <p>obdrželi jsme žádost o obnovení hesla k vašemu účtu.</p>
        <p>Pro nastavení nového hesla klikněte na tlačítko níže:</p>
        <p style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Nastavit nové heslo</a>
        </p>
        <p style="color: #6b7280; font-size: 14px;">Odkaz je platný 1 hodinu.</p>
        <p style="color: #6b7280; font-size: 14px;">Pokud jste o obnovení hesla nežádali, tento email můžete ignorovat.</p>
        <br>
        <p>S pozdravem,<br>Tým essentialInvoice</p>
      </div>
    `,
  });
}

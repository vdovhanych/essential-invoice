import Imap from 'imap';
import { simpleParser, ParsedMail } from 'mailparser';
import { query } from '../db/init';
import { parsePaymentEmail } from './bankParsers/index';
import type { ParsedPayment } from './bankParsers/index';

let pollingInterval: NodeJS.Timeout | null = null;

interface UserSettings {
  userId: string;
  imapHost: string;
  imapPort: number;
  imapUser: string;
  imapPassword: string;
  imapTls: boolean;
  bankNotificationEmail: string | null;
}

async function getUserSettings(userId: string): Promise<UserSettings | null> {
  const result = await query(`
    SELECT
      user_id,
      imap_host,
      imap_port,
      imap_user,
      imap_password,
      imap_tls,
      bank_notification_email
    FROM settings
    WHERE user_id = $1
      AND imap_host IS NOT NULL
      AND imap_user IS NOT NULL
      AND imap_password IS NOT NULL
  `, [userId]);

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    userId: row.user_id,
    imapHost: row.imap_host,
    imapPort: row.imap_port,
    imapUser: row.imap_user,
    imapPassword: row.imap_password,
    imapTls: row.imap_tls,
    bankNotificationEmail: row.bank_notification_email
  };
}

async function getAllUserSettings(): Promise<UserSettings[]> {
  const result = await query(`
    SELECT
      user_id,
      imap_host,
      imap_port,
      imap_user,
      imap_password,
      imap_tls,
      bank_notification_email
    FROM settings
    WHERE imap_host IS NOT NULL AND imap_user IS NOT NULL AND imap_password IS NOT NULL
  `);

  return result.rows.map(row => ({
    userId: row.user_id,
    imapHost: row.imap_host,
    imapPort: row.imap_port,
    imapUser: row.imap_user,
    imapPassword: row.imap_password,
    imapTls: row.imap_tls,
    bankNotificationEmail: row.bank_notification_email
  }));
}

async function processEmail(userId: string, mail: ParsedMail): Promise<void> {
  const senderEmail = mail.from?.value[0]?.address || '';
  const emailBody = mail.text || '';
  const emailDate = mail.date || new Date();
  const subject = mail.subject || '';

  console.log(`  Processing email from ${senderEmail}`);
  console.log(`    Subject: ${subject}`);

  // Parse the email using bank parsers
  const { payment, bankType } = parsePaymentEmail(senderEmail, emailBody, emailDate);

  if (!payment) {
    // Not a recognized bank payment email or outgoing payment
    console.log(`    ⊘ Not a recognized bank payment notification (or outgoing payment)`);
    return;
  }

  console.log(`    ✓ Parsed ${bankType} payment: ${payment.amount} ${payment.currency}`);
  console.log(`      Variable Symbol: ${payment.variableSymbol || 'none'}`);
  console.log(`      Sender: ${payment.senderName || 'unknown'}`);

  // Check if payment already exists (by transaction code)
  if (payment.transactionCode) {
    const existing = await query(
      'SELECT id FROM payments WHERE transaction_code = $1 AND user_id = $2',
      [payment.transactionCode, userId]
    );

    if (existing.rows.length > 0) {
      console.log(`    ⊘ Payment ${payment.transactionCode} already exists, skipping`);
      return;
    }
  }

  // Try to match with an invoice
  let invoiceId: string | null = null;
  let matchMethod: string | null = null;

  // 1. Try exact variable symbol match
  if (payment.variableSymbol) {
    const invoiceResult = await query(
      `SELECT id FROM invoices
       WHERE user_id = $1 AND variable_symbol = $2 AND status IN ('sent', 'overdue')`,
      [userId, payment.variableSymbol]
    );

    if (invoiceResult.rows.length === 1) {
      invoiceId = invoiceResult.rows[0].id;
      matchMethod = 'variable_symbol';
      console.log(`    ✓ Matched to invoice by variable symbol: ${payment.variableSymbol}`);
    } else if (invoiceResult.rows.length > 1) {
      console.log(`    ! Multiple invoices match VS ${payment.variableSymbol}, manual matching required`);
    }
  }

  // 2. If no match, try by exact amount (only if there's exactly one match)
  if (!invoiceId && payment.amount > 0) {
    const invoiceResult = await query(
      `SELECT id, variable_symbol FROM invoices
       WHERE user_id = $1
         AND total = $2
         AND currency = $3
         AND status IN ('sent', 'overdue')`,
      [userId, payment.amount, payment.currency]
    );

    if (invoiceResult.rows.length === 1) {
      invoiceId = invoiceResult.rows[0].id;
      matchMethod = 'exact_amount';
      console.log(`    ✓ Matched to invoice by exact amount: ${payment.amount} ${payment.currency}`);
    } else if (invoiceResult.rows.length > 1) {
      console.log(`    ! Multiple invoices match amount ${payment.amount}, manual matching required`);
    }
  }

  // Save payment record
  const paymentResult = await query(
    `INSERT INTO payments (
      user_id, invoice_id, amount, currency, variable_symbol,
      sender_name, sender_account, message, transaction_code,
      transaction_date, bank_type, raw_email, matched_at, match_method
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    RETURNING id`,
    [
      userId,
      invoiceId,
      payment.amount,
      payment.currency,
      payment.variableSymbol,
      payment.senderName,
      payment.senderAccount,
      payment.message,
      payment.transactionCode,
      payment.transactionDate,
      bankType,
      payment.rawEmail,
      invoiceId ? new Date() : null,
      matchMethod
    ]
  );

  const createdPaymentId = paymentResult.rows[0].id;
  console.log(`    ✓ Created payment record: ${createdPaymentId}`);

  // If matched, update invoice status
  if (invoiceId) {
    await query(
      `UPDATE invoices
       SET status = 'paid', paid_at = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [payment.transactionDate || new Date(), invoiceId]
    );
    console.log(`    ✓ Marked invoice ${invoiceId} as paid`);
  } else {
    console.log(`    ! No matching invoice found - payment saved as unmatched`);
  }

  // Log the bank notification
  await query(
    `INSERT INTO email_logs (user_id, invoice_id, email_type, recipient_email, subject, status, sent_at)
     VALUES ($1, $2, 'bank_notification', $3, $4, 'sent', CURRENT_TIMESTAMP)`,
    [userId, invoiceId, senderEmail, `Payment: ${payment.amount} ${payment.currency}`]
  );
}

async function fetchEmails(settings: UserSettings): Promise<void> {
  return new Promise((resolve, reject) => {
    const imap = new Imap({
      user: settings.imapUser,
      password: settings.imapPassword,
      host: settings.imapHost,
      port: settings.imapPort,
      tls: settings.imapTls,
      tlsOptions: { rejectUnauthorized: false }
    });

    imap.once('ready', () => {
      imap.openBox('INBOX', false, (err, box) => {
        if (err) {
          imap.end();
          return reject(err);
        }

        // Search for unseen emails from bank notification sources
        const searchCriteria: any[] = ['UNSEEN'];

        // If specific bank notification email is configured, filter by it
        if (settings.bankNotificationEmail) {
          searchCriteria.push(['FROM', settings.bankNotificationEmail]);
        }

        imap.search(searchCriteria, (err, results) => {
          if (err) {
            imap.end();
            return reject(err);
          }

          if (results.length === 0) {
            console.log(`  ✓ No new unseen emails found for user ${settings.userId}`);
            imap.end();
            return resolve();
          }

          console.log(`  → Found ${results.length} new unseen email(s) for user ${settings.userId}`);

          const fetch = imap.fetch(results, {
            bodies: '',
            markSeen: true
          });

          const emailPromises: Promise<void>[] = [];

          fetch.on('message', (msg) => {
            const emailPromise = new Promise<void>((resolveEmail) => {
              msg.on('body', (stream) => {
                simpleParser(stream as any, async (err, mail) => {
                  if (err) {
                    console.error('Parse error:', err);
                    resolveEmail();
                    return;
                  }

                  try {
                    await processEmail(settings.userId, mail);
                  } catch (processError) {
                    console.error('Process error:', processError);
                  }
                  resolveEmail();
                });
              });
            });
            emailPromises.push(emailPromise);
          });

          fetch.once('error', (err) => {
            console.error('Fetch error:', err);
          });

          fetch.once('end', async () => {
            await Promise.all(emailPromises);
            imap.end();
            resolve();
          });
        });
      });
    });

    imap.once('error', (err: Error) => {
      console.error(`IMAP error for user ${settings.userId}:`, err.message);
      reject(err);
    });

    imap.once('end', () => {
      console.log(`IMAP connection ended for user ${settings.userId}`);
    });

    imap.connect();
  });
}

async function pollAllUsers(): Promise<void> {
  console.log('Starting email poll...');

  try {
    const allSettings = await getAllUserSettings();
    console.log(`Found ${allSettings.length} user(s) with IMAP configured`);

    if (allSettings.length === 0) {
      console.log('No users have IMAP configured, skipping poll');
      return;
    }

    for (const settings of allSettings) {
      console.log(`Polling emails for user ${settings.userId} (${settings.imapHost})`);
      try {
        await fetchEmails(settings);
      } catch (error) {
        console.error(`Failed to fetch emails for user ${settings.userId}:`, error);
      }
    }
  } catch (error) {
    console.error('Email polling error:', error);
  }

  console.log('Email poll complete');
}

export function startEmailPolling(): void {
  const intervalMs = parseInt(process.env.EMAIL_POLLING_INTERVAL || '300000'); // Default 5 minutes

  console.log(`Starting email polling with interval ${intervalMs}ms`);

  // Initial poll
  pollAllUsers();

  // Set up recurring poll
  pollingInterval = setInterval(pollAllUsers, intervalMs);
}

export function stopEmailPolling(): void {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
    console.log('Email polling stopped');
  }
}

// Manual poll trigger (for API endpoint)
export async function triggerPoll(userId: string): Promise<{ processed: number; error?: string }> {
  try {
    const settingsResult = await query(
      `SELECT user_id, imap_host, imap_port, imap_user, imap_password, imap_tls, bank_notification_email
       FROM settings WHERE user_id = $1`,
      [userId]
    );

    if (settingsResult.rows.length === 0 || !settingsResult.rows[0].imap_host) {
      return { processed: 0, error: 'IMAP not configured' };
    }

    const settings: UserSettings = {
      userId: settingsResult.rows[0].user_id,
      imapHost: settingsResult.rows[0].imap_host,
      imapPort: settingsResult.rows[0].imap_port,
      imapUser: settingsResult.rows[0].imap_user,
      imapPassword: settingsResult.rows[0].imap_password,
      imapTls: settingsResult.rows[0].imap_tls,
      bankNotificationEmail: settingsResult.rows[0].bank_notification_email
    };

    await fetchEmails(settings);
    return { processed: 1 };
  } catch (error: any) {
    return { processed: 0, error: error.message };
  }
}

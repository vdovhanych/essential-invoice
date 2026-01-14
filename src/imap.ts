import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import type { AppConfig } from "./config.js";
import type { Store } from "./store.js";
import { parseAirBankEmail } from "./bank.js";

const matchesSender = (sender: string | undefined, pattern: string) => {
  if (!sender) {
    return false;
  }
  try {
    const regex = new RegExp(pattern, "i");
    return regex.test(sender);
  } catch {
    return sender.toLowerCase().includes(pattern.toLowerCase());
  }
};

export const pollBankInbox = async (config: AppConfig, store: Store) => {
  if (!config.imapHost || !config.imapUser || !config.imapPassword) {
    return { processed: 0 };
  }

  const client = new ImapFlow({
    host: config.imapHost,
    port: config.imapPort,
    secure: config.imapPort === 993,
    auth: {
      user: config.imapUser,
      pass: config.imapPassword
    }
  });

  let processed = 0;

  await client.connect();
  try {
    await client.mailboxOpen("INBOX");
    const searchResult = await client.search({ seen: false });
    const messages = Array.isArray(searchResult) ? searchResult : [];
    for await (const message of client.fetch(messages, { envelope: true, source: true })) {
      const fromAddress = message.envelope?.from?.[0]?.address;
      if (!matchesSender(fromAddress, config.bankEmailSenderPattern)) {
        continue;
      }
      const parsed = await simpleParser(message.source ?? "");
      const text = parsed.text ?? "";
      const payment = parseAirBankEmail(text);
      if (!payment) {
        continue;
      }
      store.createPayment({
        amountCents: payment.amountCents,
        currency: payment.currency,
        variableSymbol: payment.variableSymbol,
        description: payment.description,
        receivedAt: payment.receivedAt,
        source: "imap"
      });
      await client.messageFlagsAdd(message.uid, ["\\Seen"]);
      processed += 1;
    }
  } finally {
    await client.logout();
  }

  return { processed };
};

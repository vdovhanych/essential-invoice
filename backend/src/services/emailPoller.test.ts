import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Controls how the mocked IMAP connection behaves per test:
// 'hang' - connect() never emits anything (simulates a swallowed node-imap exception)
// 'error' - emits an 'error' event shortly after connect
// 'no-emails' - connects successfully and finds no unseen emails
const imapState = vi.hoisted(() => ({ behavior: 'hang' as 'hang' | 'error' | 'no-emails' }));

vi.mock('imap', async () => {
  const { EventEmitter } = await import('events');

  class MockImap extends EventEmitter {
    destroyed = false;

    connect() {
      if (imapState.behavior === 'error') {
        process.nextTick(() => this.emit('error', new Error('connection refused')));
      } else if (imapState.behavior === 'no-emails') {
        process.nextTick(() => this.emit('ready'));
      }
      // 'hang': do nothing, promise must be settled by the watchdog
    }

    openBox(_name: string, _readOnly: boolean, cb: (err: Error | null, box: any) => void) {
      cb(null, {});
    }

    search(_criteria: any[], cb: (err: Error | null, results: number[]) => void) {
      cb(null, []);
    }

    end() {
      process.nextTick(() => {
        this.emit('end');
        this.emit('close', false);
      });
    }

    destroy() {
      this.destroyed = true;
    }
  }

  return { default: MockImap };
});

const dbMocks = vi.hoisted(() => ({
  query: vi.fn(),
  client: {
    query: vi.fn(),
    release: vi.fn()
  }
}));

vi.mock('../db/init', () => ({
  query: dbMocks.query,
  pool: {
    connect: vi.fn(async () => dbMocks.client)
  }
}));

vi.mock('../utils/encryption', () => ({
  decrypt: (value: string) => value
}));

vi.mock('../utils/logger', () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

const parserMocks = vi.hoisted(() => ({
  parsePaymentEmail: vi.fn()
}));

vi.mock('./bankParsers/index', () => ({
  parsePaymentEmail: parserMocks.parsePaymentEmail
}));

import { pollAllUsers, triggerPoll, processEmail } from './emailPoller';

const userSettingsRow = {
  user_id: 'user-1',
  imap_host: 'imap.example.com',
  imap_port: 993,
  imap_user: 'user@example.com',
  imap_password: 'secret',
  imap_tls: true,
  bank_notification_email: null
};

beforeEach(() => {
  vi.clearAllMocks();
  imapState.behavior = 'hang';
});

afterEach(() => {
  vi.useRealTimers();
});

describe('triggerPoll', () => {
  it('completes successfully when there are no unseen emails', async () => {
    imapState.behavior = 'no-emails';
    dbMocks.query.mockResolvedValue({ rows: [userSettingsRow] });

    const result = await triggerPoll('user-1');

    expect(result).toEqual({ processed: 1 });
  });

  it('returns an error when the IMAP connection errors', async () => {
    imapState.behavior = 'error';
    dbMocks.query.mockResolvedValue({ rows: [userSettingsRow] });

    const result = await triggerPoll('user-1');

    expect(result.processed).toBe(0);
    expect(result.error).toBe('connection refused');
  });

  it('times out instead of hanging when the IMAP connection never responds', async () => {
    vi.useFakeTimers();
    imapState.behavior = 'hang';
    dbMocks.query.mockResolvedValue({ rows: [userSettingsRow] });

    const pollPromise = triggerPoll('user-1');
    await vi.advanceTimersByTimeAsync(120_000);
    const result = await pollPromise;

    expect(result.processed).toBe(0);
    expect(result.error).toMatch(/timed out/);
  });
});

describe('processEmail invoice matching', () => {
  const mail = {
    from: { value: [{ address: 'info@airbank.cz' }] },
    text: 'payment notification',
    date: new Date('2026-07-01'),
    subject: 'Payment received'
  } as any;

  const basePayment = {
    amount: 1000,
    currency: 'CZK',
    variableSymbol: '2026001',
    senderName: 'Test Sender',
    senderAccount: '123/0300',
    message: null,
    transactionCode: 'TX-1',
    transactionDate: new Date('2026-07-01'),
    rawEmail: 'raw'
  };

  beforeEach(() => {
    parserMocks.parsePaymentEmail.mockReturnValue({ payment: basePayment, bankType: 'airbank' });
    // No existing payment with this transaction code
    dbMocks.query.mockImplementation(async (sql: string) => {
      if (String(sql).includes('FROM payments')) return { rows: [] };
      return { rows: [] };
    });
    dbMocks.client.query.mockResolvedValue({ rows: [{ id: 'payment-1' }] });
  });

  it('marks the invoice paid when VS, amount and currency all match', async () => {
    dbMocks.query.mockImplementation(async (sql: string) => {
      if (String(sql).includes('variable_symbol =')) {
        return { rows: [{ id: 'inv-1', total: '1000.00', currency: 'CZK' }] };
      }
      return { rows: [] };
    });

    await processEmail('user-1', mail);

    const insertCall = dbMocks.client.query.mock.calls.find(([sql]) =>
      String(sql).includes('INSERT INTO payments')
    );
    expect(insertCall![1][1]).toBe('inv-1'); // invoice_id param
    const updateCall = dbMocks.client.query.mock.calls.find(([sql]) =>
      String(sql).includes("SET status = 'paid'")
    );
    expect(updateCall).toBeTruthy();
    expect(dbMocks.client.query.mock.calls.map(([sql]) => String(sql))).toContain('COMMIT');
  });

  it('leaves the payment unmatched when VS matches but the amount differs', async () => {
    dbMocks.query.mockImplementation(async (sql: string) => {
      if (String(sql).includes('variable_symbol =')) {
        return { rows: [{ id: 'inv-1', total: '2000.00', currency: 'CZK' }] };
      }
      return { rows: [] };
    });

    await processEmail('user-1', mail);

    const insertCall = dbMocks.client.query.mock.calls.find(([sql]) =>
      String(sql).includes('INSERT INTO payments')
    );
    expect(insertCall![1][1]).toBeNull();
    const updateCall = dbMocks.client.query.mock.calls.find(([sql]) =>
      String(sql).includes("SET status = 'paid'")
    );
    expect(updateCall).toBeUndefined();
  });

  it('leaves the payment unmatched when VS matches but the currency differs', async () => {
    dbMocks.query.mockImplementation(async (sql: string) => {
      if (String(sql).includes('variable_symbol =')) {
        return { rows: [{ id: 'inv-1', total: '1000.00', currency: 'EUR' }] };
      }
      return { rows: [] };
    });

    await processEmail('user-1', mail);

    const insertCall = dbMocks.client.query.mock.calls.find(([sql]) =>
      String(sql).includes('INSERT INTO payments')
    );
    expect(insertCall![1][1]).toBeNull();
  });

  it('rolls back the transaction when a write fails', async () => {
    dbMocks.query.mockImplementation(async (sql: string) => {
      if (String(sql).includes('variable_symbol =')) {
        return { rows: [{ id: 'inv-1', total: '1000.00', currency: 'CZK' }] };
      }
      return { rows: [] };
    });
    dbMocks.client.query.mockImplementation(async (sql: string) => {
      if (String(sql).includes('INSERT INTO payments')) {
        throw new Error('insert failed');
      }
      return { rows: [{ id: 'payment-1' }] };
    });

    await expect(processEmail('user-1', mail)).rejects.toThrow('insert failed');

    expect(dbMocks.client.query.mock.calls.map(([sql]) => String(sql))).toContain('ROLLBACK');
    expect(dbMocks.client.release).toHaveBeenCalled();
  });
});

describe('pollAllUsers', () => {
  it('skips the poll without unlocking when another instance holds the lock', async () => {
    dbMocks.client.query.mockResolvedValue({ rows: [{ acquired: false }] });

    await pollAllUsers();

    const unlockCalls = dbMocks.client.query.mock.calls.filter(([sql]) =>
      String(sql).includes('pg_advisory_unlock')
    );
    expect(unlockCalls).toHaveLength(0);
    expect(dbMocks.client.release).toHaveBeenCalledWith();
  });

  it('releases the advisory lock even when fetching emails fails', async () => {
    imapState.behavior = 'error';
    dbMocks.client.query.mockImplementation(async (sql: string) => {
      if (String(sql).includes('pg_try_advisory_lock')) {
        return { rows: [{ acquired: true }] };
      }
      return { rows: [] };
    });
    dbMocks.query.mockResolvedValue({ rows: [userSettingsRow] });

    await pollAllUsers();

    const unlockCalls = dbMocks.client.query.mock.calls.filter(([sql]) =>
      String(sql).includes('pg_advisory_unlock')
    );
    expect(unlockCalls).toHaveLength(1);
    expect(dbMocks.client.release).toHaveBeenCalledWith();
  });

  it('releases the advisory lock even when a hung IMAP connection times out', async () => {
    vi.useFakeTimers();
    imapState.behavior = 'hang';
    dbMocks.client.query.mockImplementation(async (sql: string) => {
      if (String(sql).includes('pg_try_advisory_lock')) {
        return { rows: [{ acquired: true }] };
      }
      return { rows: [] };
    });
    dbMocks.query.mockResolvedValue({ rows: [userSettingsRow] });

    const pollPromise = pollAllUsers();
    await vi.advanceTimersByTimeAsync(120_000);
    await pollPromise;

    const unlockCalls = dbMocks.client.query.mock.calls.filter(([sql]) =>
      String(sql).includes('pg_advisory_unlock')
    );
    expect(unlockCalls).toHaveLength(1);
    expect(dbMocks.client.release).toHaveBeenCalledWith();
  });

  it('destroys the connection when releasing the lock fails, so Postgres frees the lock', async () => {
    imapState.behavior = 'no-emails';
    dbMocks.client.query.mockImplementation(async (sql: string) => {
      if (String(sql).includes('pg_try_advisory_lock')) {
        return { rows: [{ acquired: true }] };
      }
      if (String(sql).includes('pg_advisory_unlock')) {
        throw new Error('connection terminated');
      }
      return { rows: [] };
    });
    dbMocks.query.mockResolvedValue({ rows: [userSettingsRow] });

    await pollAllUsers();

    expect(dbMocks.client.release).toHaveBeenCalledTimes(1);
    expect(dbMocks.client.release).toHaveBeenCalledWith(true);
  });
});

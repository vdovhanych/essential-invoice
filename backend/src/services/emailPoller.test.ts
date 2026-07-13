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

import { pollAllUsers, triggerPoll } from './emailPoller';

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

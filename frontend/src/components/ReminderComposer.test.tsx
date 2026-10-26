import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import ReminderComposer from './ReminderComposer';
import { toast } from 'sonner';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const mockDraftReminder = vi.fn();
vi.mock('../context/AIContext', () => ({
  useAI: () => ({ draftReminder: (...args: unknown[]) => mockDraftReminder(...args) }),
}));

vi.mock('lucide-react', () => {
  const icon = (name: string) => () => <span data-testid={`${name}-icon`} />;
  return {
    Sparkles: icon('sparkles'),
    RefreshCw: icon('refresh'),
    X: icon('x'),
    Send: icon('send'),
  };
});

function renderComposer(overrides: Record<string, unknown> = {}) {
  const onClose = vi.fn();
  const onSend = vi.fn().mockResolvedValue(undefined);
  render(
    <ReminderComposer
      open
      onClose={onClose}
      invoiceId="inv-1"
      invoiceNumber="2026-039"
      overdueLabel="11 dní po splatnosti"
      onSend={onSend}
      {...overrides}
    />
  );
  return { onClose, onSend };
}

describe('ReminderComposer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDraftReminder.mockReset();
    mockDraftReminder.mockResolvedValue({ subject: 'Připomínka', body: 'Dobrý den…' });
  });

  it('drafts with a friendly tone on open and shows the overdue reason', async () => {
    renderComposer();
    await waitFor(() => expect(mockDraftReminder).toHaveBeenCalledWith('inv-1', 'friendly'));
    expect(screen.getByText('11 dní po splatnosti')).toBeInTheDocument();
    expect(await screen.findByDisplayValue('Připomínka')).toBeInTheDocument();
  });

  it('regenerates with the chosen tone', async () => {
    renderComposer();
    await screen.findByDisplayValue('Připomínka');

    mockDraftReminder.mockResolvedValue({ subject: 'Důrazně', body: 'Faktura je po splatnosti.' });
    fireEvent.click(screen.getByRole('button', { name: 'Důrazný' }));

    await waitFor(() => expect(mockDraftReminder).toHaveBeenCalledWith('inv-1', 'firm'));
    expect(await screen.findByDisplayValue('Důrazně')).toBeInTheDocument();
  });

  it('keeps the draft fully editable and sends what the user edited', async () => {
    const { onSend } = renderComposer();
    const subject = await screen.findByDisplayValue('Připomínka');

    fireEvent.change(subject, { target: { value: 'Moje verze' } });
    fireEvent.click(screen.getByRole('button', { name: /Odeslat připomínku/ }));

    await waitFor(() =>
      expect(onSend).toHaveBeenCalledWith('Moje verze', 'Dobrý den…')
    );
  });

  it('recovers from a draft failure without sending and disables duplicate sends until completion', async () => {
    mockDraftReminder.mockRejectedValueOnce(new Error('Draft unavailable'));
    let finishSend!: () => void;
    const onSend = vi.fn(() => new Promise<void>(resolve => { finishSend = resolve; }));
    const { onClose } = renderComposer({ onSend });
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Draft unavailable'));
    expect(screen.getByRole('button', { name: /Odeslat připomínku/ })).toBeDisabled();
    expect(onSend).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Vytvořit jiný návrh' }));
    const subject = await screen.findByDisplayValue('Připomínka');
    fireEvent.change(subject, { target: { value: '   ' } });
    expect(screen.getByRole('button', { name: /Odeslat připomínku/ })).toBeDisabled();
    fireEvent.change(subject, { target: { value: 'Opravený předmět' } });
    fireEvent.change(screen.getByDisplayValue('Dobrý den…'), { target: { value: 'Opravená zpráva' } });
    const send = screen.getByRole('button', { name: /Odeslat připomínku/ });
    fireEvent.click(send);
    expect(send).toBeDisabled();
    fireEvent.click(send);
    expect(onSend).toHaveBeenCalledExactlyOnceWith('Opravený předmět', 'Opravená zpráva');
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => finishSend());
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('never sends on its own — it only drafts', async () => {
    const { onSend } = renderComposer();
    await screen.findByDisplayValue('Připomínka');
    expect(onSend).not.toHaveBeenCalled();
    expect(screen.getByText('Nic se neodešle, dokud nestisknete odeslat.')).toBeInTheDocument();
  });
});

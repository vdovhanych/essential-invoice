import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import InvoiceDraftPreview from './InvoiceDraftPreview';
import { api } from '../utils/api';

vi.mock('./InvoicePdfViewer', () => ({ default: ({ base64 }: { base64: string }) => <div data-testid="pdf-page">{base64}</div> }));
vi.mock('../utils/api', () => ({ api: { post: vi.fn() } }));
vi.mock('../hooks/useObjectUrl', () => ({ PDF_PREVIEW_PARAMS: '#view=FitH', useObjectUrl: (pdf: string) => pdf ? `blob:${pdf}` : null }));
const props = { payload: '{"notes":"First"}', open: false, onOpen: vi.fn(), onClose: vi.fn(), isEdit: false };

describe('InvoiceDraftPreview', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() } as any);
    vi.mocked(api.post).mockResolvedValue({ pdfBase64: 'first' });
    HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
    HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
  const tick = () => act(async () => { await vi.advanceTimersByTimeAsync(650); });

  it('debounces typing and sends only the latest form data', async () => {
    const view = render(<InvoiceDraftPreview {...props} />);
    view.rerender(<InvoiceDraftPreview {...props} payload='{"notes":"Latest"}' />);
    expect(api.post).not.toHaveBeenCalled();
    await tick();
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(api.post).toHaveBeenCalledWith('/invoices/preview', { notes: 'Latest' }, expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(screen.getByTestId('pdf-page')).toHaveTextContent('first');
  });

  it('retains the last PDF on failure and supports retry', async () => {
    const view = render(<InvoiceDraftPreview {...props} />);
    await tick();
    vi.mocked(api.post).mockRejectedValueOnce(new Error('Unavailable'));
    view.rerender(<InvoiceDraftPreview {...props} payload='{"notes":"Changed"}' />);
    expect(screen.getByTestId('pdf-page')).toHaveTextContent('first');
    await tick();
    expect(screen.getByText(/Zobrazený dokument může být zastaralý/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Zkusit znovu' }));
    await tick();
    expect(api.post).toHaveBeenCalledTimes(3);
  });

  it('ignores an old response arriving after the newest PDF', async () => {
    let finishOld!: (value: unknown) => void;
    vi.mocked(api.post).mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve; }));
    const view = render(<InvoiceDraftPreview {...props} />);
    await tick();
    view.rerender(<InvoiceDraftPreview {...props} payload='{"notes":"New"}' />);
    vi.mocked(api.post).mockResolvedValueOnce({ pdfBase64: 'new' });
    await tick();
    await act(async () => finishOld({ pdfBase64: 'old' }));
    expect(screen.getByTestId('pdf-page')).toHaveTextContent('new');
    expect(vi.mocked(api.post).mock.calls[0][2]?.signal?.aborted).toBe(true);
  });

  it('requests on mobile only when expanded, with a close control and external PDF link', async () => {
    vi.mocked(window.matchMedia).mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() } as any);
    const view = render(<InvoiceDraftPreview {...props} />);
    await tick();
    expect(api.post).not.toHaveBeenCalled();
    view.rerender(<InvoiceDraftPreview {...props} open />);
    await tick();
    expect(screen.getByRole('dialog', { name: 'Náhled faktury' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Otevřít PDF' })[0]).toHaveAttribute('href', 'blob:first');
    fireEvent.click(screen.getByRole('button', { name: 'Zavřít' }));
    expect(props.onClose).toHaveBeenCalled();
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { bubbles: true }));
    expect(props.onClose).toHaveBeenCalledTimes(2);
  });
});

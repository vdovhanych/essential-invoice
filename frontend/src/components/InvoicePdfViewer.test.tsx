import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDocument } from 'pdfjs-dist';
import InvoicePdfViewer from './InvoicePdfViewer';

vi.mock('pdfjs-dist', () => ({ GlobalWorkerOptions: {}, getDocument: vi.fn() }));
const drawImage = vi.fn();

function documentFixture(numPages: number) {
  return { numPages, getPage: vi.fn(async (number: number) => ({
    getViewport: ({ scale }: { scale: number }) => ({ width: 600 * scale, height: 840 * scale }),
    render: () => ({ promise: Promise.resolve(), cancel: vi.fn() }),
    getTextContent: async () => ({ items: [{ str: `Invoice page ${number}` }] }),
  })) };
}

describe('InvoicePdfViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(500);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage } as any);
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it('navigates pages, exposes their text, and resets to an available page after shortening an invoice', async () => {
    const first = documentFixture(3);
    const destroy = vi.fn();
    vi.mocked(getDocument).mockReturnValueOnce({ promise: Promise.resolve(first), destroy } as any);
    const view = render(<InvoicePdfViewer base64={btoa('long')} expanded={false} />);
    expect(await screen.findByText('Invoice page 1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Předchozí stránka' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Další stránka' }));
    expect(await screen.findByText('Invoice page 2')).toBeInTheDocument();
    vi.mocked(getDocument).mockReturnValueOnce({ promise: Promise.resolve(documentFixture(1)), destroy: vi.fn() } as any);
    view.rerender(<InvoicePdfViewer base64={btoa('short')} expanded={false} />);
    expect(await screen.findByText('Invoice page 1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Další stránka' })).toBeDisabled();
    expect(destroy).toHaveBeenCalled();
  });

  it('keeps the rendered page while a new PDF loads and supports zoom and fit-to-width', async () => {
    vi.mocked(getDocument).mockReturnValueOnce({ promise: Promise.resolve(documentFixture(1)), destroy: vi.fn() } as any);
    const view = render(<InvoicePdfViewer base64={btoa('first')} expanded />);
    await waitFor(() => expect(drawImage).toHaveBeenCalled());
    const canvas = view.container.querySelector('canvas')!;
    expect(canvas.style.width).toBe('476px');
    fireEvent.click(screen.getByRole('button', { name: 'Přiblížit' }));
    await waitFor(() => expect(canvas.style.width).toBe('595px'));
    fireEvent.click(screen.getByRole('button', { name: '125%' }));
    await waitFor(() => expect(canvas.style.width).toBe('476px'));
    let resolve!: (value: unknown) => void;
    vi.mocked(getDocument).mockReturnValueOnce({ promise: new Promise(done => { resolve = done; }), destroy: vi.fn() } as any);
    const draws = drawImage.mock.calls.length;
    view.rerender(<InvoicePdfViewer base64={btoa('next')} expanded />);
    expect(canvas.style.width).toBe('476px');
    expect(drawImage).toHaveBeenCalledTimes(draws);
    await act(async () => resolve(documentFixture(2)));
    await waitFor(() => expect(drawImage).toHaveBeenCalledTimes(draws + 1));
  });
});

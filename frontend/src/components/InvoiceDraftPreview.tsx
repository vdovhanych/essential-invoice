import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../utils/api';
import { useObjectUrl } from '../hooks/useObjectUrl';

const InvoicePdfViewer = lazy(() => import('./InvoicePdfViewer'));

interface Props {
  /** Serialized so unrelated form renders do not regenerate the PDF. */
  payload: string;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  isEdit: boolean;
}

export default function InvoiceDraftPreview({ payload, open, onOpen, onClose, isEdit }: Props) {
  const { t } = useTranslation('invoices', { keyPrefix: 'create.livePreview' });
  const [wide, setWide] = useState(() => window.matchMedia('(min-width: 1536px)').matches);
  const [pdf, setPdf] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const url = useObjectUrl(pdf, 'application/pdf');
  const active = wide || open;

  useEffect(() => {
    const media = window.matchMedia('(min-width: 1536px)');
    const update = () => setWide(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    setUpdating(true);
    setFailed(false);
    const timer = window.setTimeout(async () => {
      try {
        const result = await api.post('/invoices/preview', JSON.parse(payload), { signal: controller.signal });
        if (!controller.signal.aborted) setPdf(result.pdfBase64);
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      } finally {
        if (!controller.signal.aborted) setUpdating(false);
      }
    }, 650);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [payload, active, retry]);

  useEffect(() => {
    if (!open || !dialog.current) return;
    const element = dialog.current;
    const previousFocus = document.activeElement as HTMLElement | null;
    element.showModal();
    element.querySelector<HTMLButtonElement>('[data-preview-close]')?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      element.close();
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [open]);

  const status = (
    <div className="text-xs text-text-muted" role="status" aria-live="polite">
      {failed ? <span className="text-danger">{t('error')} <button type="button" className="underline py-1" onClick={() => setRetry(value => value + 1)}>{t('retry')}</button></span>
        : updating ? t('updating') : t(isEdit ? 'editHint' : 'draftHint')}
    </div>
  );

  const renderDocument = (expanded: boolean) => pdf ? (
    <Suspense fallback={<div className="p-8 text-center text-sm text-text-muted">{t('loading')}</div>}>
      <InvoicePdfViewer base64={pdf} expanded={expanded} />
    </Suspense>
  ) : <div className="aspect-[210/297] flex items-center justify-center p-8 text-center text-sm text-text-muted">{failed ? t('unavailable') : t('loading')}</div>;

  return <>
    <aside className="hidden 2xl:block sticky top-20 self-start min-w-0 rounded-2xl border border-border bg-surface overflow-hidden" aria-label={t('title')}>
      <div className="p-4 border-b border-border space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-text">{t('title')}</h2>
          <div className="flex items-center gap-2">
            {url && <a href={url} target="_blank" rel="noreferrer" className="btn btn-ghost">{t('openPdf')}</a>}
            <button type="button" onClick={onOpen} className="btn btn-secondary">{t('expand')}</button>
          </div>
        </div>
        {status}
      </div>
      <div className="bg-canvas">
        {wide && !open && renderDocument(false)}
      </div>
    </aside>
    {open && createPortal(
      <dialog ref={dialog} onCancel={onClose} aria-labelledby="invoice-preview-title"
        className="m-auto w-full max-w-6xl h-[100dvh] sm:h-[92dvh] max-h-[100dvh] p-0 border border-border sm:rounded-2xl bg-surface text-text backdrop:bg-black/60">
        <div className="h-full flex flex-col">
          <div className="flex flex-wrap items-center gap-3 p-4 border-b border-border">
            <h2 id="invoice-preview-title" className="font-semibold mr-auto">{t('title')}</h2>
            {url && <a href={url} target="_blank" rel="noreferrer" className="btn btn-secondary">{t('openPdf')}</a>}
            <button type="button" data-preview-close onClick={onClose} className="btn btn-secondary">{t('close')}</button>
            <div className="w-full">{status}</div>
          </div>
          <div className="flex-1 min-h-0 overflow-auto bg-canvas">{renderDocument(true)}</div>
        </div>
      </dialog>, window.document.body,
    )}
  </>;
}

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy, type RenderTask } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = workerUrl;

/** Render the actual PDF, independently of the browser's installed PDF viewer. */
export default function InvoicePdfViewer({ base64, expanded }: { base64: string; expanded: boolean }) {
  const { t } = useTranslation('invoices', { keyPrefix: 'create.livePreview' });
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [width, setWidth] = useState(0);
  const [error, setError] = useState(false);
  const [pageText, setPageText] = useState('');
  const container = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const page = Math.min(pageNumber, pdf?.numPages || 1);

  useEffect(() => {
    let cancelled = false;
    setError(false);
    setPdf(null);
    const data = Uint8Array.from(atob(base64), char => char.charCodeAt(0));
    const task = getDocument({ data });
    task.promise.then(document => {
      if (!cancelled) {
        setPdf(document);
        setPageNumber(number => Math.min(number, document.numPages));
      }
    }).catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; void task.destroy(); };
  }, [base64]);

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setWidth(element.clientWidth));
    observer.observe(element);
    setWidth(element.clientWidth);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!pdf || !width) return;
    let cancelled = false;
    let task: RenderTask | undefined;
    async function render() {
      try {
        const documentPage = await pdf!.getPage(page);
        if (cancelled) return;
        const natural = documentPage.getViewport({ scale: 1 });
        const viewport = documentPage.getViewport({ scale: (width - 24) / natural.width * zoom });
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        // Draw offscreen first, keeping the last complete page visible during updates.
        const buffer = document.createElement('canvas');
        buffer.width = Math.ceil(viewport.width * pixelRatio);
        buffer.height = Math.ceil(viewport.height * pixelRatio);
        task = documentPage.render({ canvas: buffer, viewport,
          transform: pixelRatio === 1 ? undefined : [pixelRatio, 0, 0, pixelRatio, 0, 0] });
        await task.promise;
        if (cancelled || !canvas.current) return;
        const visible = canvas.current;
        visible.width = buffer.width;
        visible.height = buffer.height;
        visible.style.width = `${viewport.width}px`;
        visible.style.height = `${viewport.height}px`;
        visible.getContext('2d')!.drawImage(buffer, 0, 0);
        setError(false);
        const content = await documentPage.getTextContent();
        if (!cancelled) setPageText(content.items.map(item => 'str' in item ? item.str : '').join(' '));
      } catch {
        if (!cancelled) setError(true);
      }
    }
    void render();
    return () => { cancelled = true; task?.cancel(); };
  }, [pdf, page, width, zoom]);

  return <div className={expanded ? 'flex h-full flex-col min-h-0' : 'flex flex-col'}>
    <div className="flex flex-wrap justify-between items-center gap-2 px-3 py-2 border-b border-border bg-surface">
      <div className="flex items-center gap-1">
        <button type="button" className="btn btn-ghost min-w-9" disabled={!pdf || page <= 1} onClick={() => setPageNumber(page - 1)} aria-label={t('previousPage')}>‹</button>
        <span className="text-xs text-text-muted tabular-nums">{t('pageCount', { page, count: pdf?.numPages || 1 })}</span>
        <button type="button" className="btn btn-ghost min-w-9" disabled={!pdf || page >= pdf.numPages} onClick={() => setPageNumber(page + 1)} aria-label={t('nextPage')}>›</button>
      </div>
      <div className="flex items-center gap-1">
        <button type="button" className="btn btn-ghost min-w-9" disabled={zoom <= 1} onClick={() => setZoom(value => Math.max(1, value - .25))} aria-label={t('zoomOut')}>−</button>
        <button type="button" className="btn btn-ghost text-xs tabular-nums" onClick={() => setZoom(1)}>{zoom === 1 ? t('fitWidth') : `${Math.round(zoom * 100)}%`}</button>
        <button type="button" className="btn btn-ghost min-w-9" disabled={zoom >= 2.5} onClick={() => setZoom(value => Math.min(2.5, value + .25))} aria-label={t('zoomIn')}>+</button>
      </div>
    </div>
    {error && <p role="alert" className="p-3 text-sm text-danger">{t('renderError')}</p>}
    <div ref={container} className={expanded ? 'flex-1 min-h-0 overflow-auto bg-canvas' : 'overflow-auto max-h-[calc(100dvh-16rem)] bg-canvas'}>
      <div className="p-3 w-max min-w-full">
        <canvas ref={canvas} role="img" aria-label={t('pageCount', { page, count: pdf?.numPages || 1 })}
          className="block mx-auto bg-white shadow-sm" />
      </div>
      <p className="sr-only">{pageText}</p>
    </div>
  </div>;
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { frameClass, useFrameWidth, ZoomBar, ZOOMS } from './plan-viewer-frame';

/**
 * A floor-plan PDF drawn with pdf.js onto canvases, so it shows the same on
 * phones as on desktops: mobile browsers do not render a PDF inside an
 * <iframe> (Android Chrome shows nothing, iOS Safari only the first page).
 *
 * pdf.js loads only when a PDF plan is shown (dynamic import), its worker runs
 * off the main thread, and each page is drawn at the frame's width × zoom ×
 * device pixel ratio — capped so a canvas stays under iOS Safari's canvas
 * memory limit (about 16.7 million pixels).
 */

const MAX_CANVAS_PIXELS = 16_000_000;
/** Plans are a page or a few; a whole show catalogue is not drawn page by page. */
const MAX_PAGES = 12;

type PdfJs = typeof import('pdfjs-dist/legacy/build/pdf.mjs');
type PdfDocument = Awaited<ReturnType<PdfJs['getDocument']>['promise']>;

let pdfjsPromise: Promise<PdfJs> | null = null;

/** pdf.js, loaded once per page view. The legacy build is transpiled for older mobile browsers. */
function loadPdfJs() {
  pdfjsPromise ??= import('pdfjs-dist/legacy/build/pdf.mjs').then((pdfjs) => {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url).toString();
    return pdfjs;
  });
  return pdfjsPromise;
}

type State = { status: 'loading' } | { status: 'ready'; pages: number } | { status: 'error' };

export function PdfPlanViewer({ url, title }: { url: string; title: string }) {
  const { frameRef, width } = useFrameWidth();
  const pagesRef = useRef<HTMLDivElement>(null);
  const documentRef = useRef<PdfDocument | null>(null);
  const [state, setState] = useState<State>({ status: 'loading' });
  const [zoom, setZoom] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let destroy: (() => void) | null = null;
    setState({ status: 'loading' });
    loadPdfJs()
      .then((pdfjs) => {
        const task = pdfjs.getDocument({ url });
        destroy = () => void task.destroy();
        return task.promise;
      })
      .then((pdf) => {
        if (cancelled) return;
        documentRef.current = pdf;
        setState({ status: 'ready', pages: Math.min(pdf.numPages, MAX_PAGES) });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error' });
      });
    return () => {
      cancelled = true;
      documentRef.current = null;
      destroy?.();
    };
  }, [url]);

  // Draw every page at the frame width × zoom whenever the document, width or zoom changes.
  useEffect(() => {
    const pdf = documentRef.current;
    const container = pagesRef.current;
    if (state.status !== 'ready' || !pdf || !container || !width) return;
    let cancelled = false;
    const renders: { cancel: () => void }[] = [];

    (async () => {
      const canvases = Array.from(container.querySelectorAll('canvas'));
      for (let index = 0; index < state.pages && !cancelled; index++) {
        const page = await pdf.getPage(index + 1);
        const base = page.getViewport({ scale: 1 });
        const cssScale = ((width - 2) * ZOOMS[zoom]) / base.width;
        const ratio = window.devicePixelRatio || 1;
        const pixels = base.width * base.height * (cssScale * ratio) ** 2;
        // Keep the canvas under the mobile limit; it is then shown slightly softer, not blank.
        const outputScale = pixels > MAX_CANVAS_PIXELS ? ratio * Math.sqrt(MAX_CANVAS_PIXELS / pixels) : ratio;
        const viewport = page.getViewport({ scale: cssScale });
        const canvas = canvases[index];
        if (!canvas || cancelled) return;
        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;
        const render = page.render({
          canvas,
          viewport,
          transform: outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined,
        });
        renders.push(render);
        await render.promise.catch(() => undefined);
      }
    })().catch(() => {
      if (!cancelled) setState({ status: 'error' });
    });

    return () => {
      cancelled = true;
      renders.forEach((render) => render.cancel());
    };
  }, [state, width, zoom]);

  return (
    <div className="space-y-2">
      {state.status === 'ready' ? <ZoomBar zoom={zoom} onZoom={setZoom} /> : null}
      <div
        ref={frameRef}
        role="document"
        aria-label={title}
        // As tall as the plan (a landscape plan is short), scrolling inside beyond 70% of the screen.
        className={`${frameClass} ${state.status === 'ready' ? '' : 'h-[240px]'}`}
      >
        {state.status === 'loading' ? (
          <p className="flex h-full items-center justify-center gap-2 text-sm text-slate-500">
            <Loader2 className="size-4 animate-spin" />
            Loading the floor plan…
          </p>
        ) : null}
        {state.status === 'error' ? (
          <p className="flex h-full items-center justify-center px-6 text-center text-sm text-slate-500">
            This PDF can’t be shown here. Use “Open floor plan” to view it.
          </p>
        ) : null}
        {state.status === 'ready' ? (
          <div ref={pagesRef} className="w-max min-w-full">
            {Array.from({ length: state.pages }, (_, index) => (
              <canvas key={index} className="block border-b border-slate-100 last:border-b-0 dark:border-white/[0.06]" />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

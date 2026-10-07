'use client';

import { useEffect, useRef, useState } from 'react';
import { Minus, Plus } from 'lucide-react';

/**
 * The frame and zoom bar every floor plan is shown in — PDF (pdf.js), image
 * or embedded interactive plan — so all events get the same Floor Plan tab:
 * "−  Fit  +" above a bordered frame that scrolls inside itself, never the page.
 */

export const ZOOMS = [1, 1.5, 2, 3];

const buttonClass =
  'inline-flex size-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition-colors hover:border-indigo-300 hover:text-indigo-700 disabled:opacity-40 dark:border-white/[0.1] dark:bg-white/[0.04] dark:text-slate-200';

export const frameClass =
  'relative max-h-[70vh] w-full overflow-auto overscroll-contain rounded-2xl border border-slate-200/60 bg-white dark:border-white/[0.06]';

export function ZoomBar({ zoom, onZoom }: { zoom: number; onZoom: (zoom: number) => void }) {
  return (
    <div className="flex items-center justify-end gap-2">
      <button type="button" className={buttonClass} onClick={() => onZoom(Math.max(0, zoom - 1))} disabled={zoom === 0} aria-label="Zoom out">
        <Minus className="size-3.5" />
      </button>
      <span className="w-10 text-center text-xs font-semibold tabular-nums text-slate-500 dark:text-slate-400">
        {zoom === 0 ? 'Fit' : `${ZOOMS[zoom] * 100}%`}
      </span>
      <button
        type="button"
        className={buttonClass}
        onClick={() => onZoom(Math.min(ZOOMS.length - 1, zoom + 1))}
        disabled={zoom === ZOOMS.length - 1}
        aria-label="Zoom in"
      >
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}

/** The frame element's width, kept current through rotation and resizing. */
export function useFrameWidth() {
  const frameRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);
  return { frameRef, width };
}

/** A floor-plan image in the zoomable frame: fitted to the width, then 150–300%. */
export function ImagePlanViewer({ src, title }: { src: string; title: string }) {
  const { frameRef, width } = useFrameWidth();
  const [zoom, setZoom] = useState(0);
  const [failed, setFailed] = useState(false);
  return (
    <div className="space-y-2">
      {!failed ? <ZoomBar zoom={zoom} onZoom={setZoom} /> : null}
      <div ref={frameRef} role="document" aria-label={title} className={frameClass}>
        {failed ? (
          <p className="flex h-[240px] items-center justify-center px-6 text-center text-sm text-slate-500">
            This image can’t be shown here. Use “Open floor plan” to view it.
          </p>
        ) : (
          // An organizer image of any size, served from this origin: a plain <img>, not next/image's optimizer.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={title}
            onError={() => setFailed(true)}
            className="block max-w-none bg-white object-contain"
            style={{ width: zoom === 0 || !width ? '100%' : `${Math.round((width - 2) * ZOOMS[zoom])}px` }}
          />
        )}
      </div>
    </div>
  );
}

/**
 * An organizer's interactive plan (or plan page) embedded in the frame. Zoom
 * scales the embedded page; interactive plans also keep their own controls.
 */
export function FramePlanViewer({ src, title }: { src: string; title: string }) {
  const { frameRef, width } = useFrameWidth();
  const [zoom, setZoom] = useState(0);
  const scale = ZOOMS[zoom];
  const base = { width: Math.max(0, width - 2), height: 560 };
  return (
    <div className="space-y-2">
      <ZoomBar zoom={zoom} onZoom={setZoom} />
      <div ref={frameRef} role="document" aria-label={title} className={frameClass}>
        <div style={{ width: width ? base.width * scale : '100%', height: base.height * scale }}>
          <iframe
            src={src}
            title={title}
            className="block origin-top-left border-0"
            style={{ width: width ? base.width : '100%', height: base.height, transform: scale === 1 ? undefined : `scale(${scale})` }}
          />
        </div>
      </div>
    </div>
  );
}

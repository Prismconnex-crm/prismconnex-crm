'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, Check, Copy, Info, Loader2, ShieldAlert } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { officialViewMode } from '@/lib/find-shows/official-frame';

/** Which stored official page to show: a card's profile, or the event's official directory or its sign-in page. */
export type OfficialPageTarget = { kind: 'profile'; id: string } | { kind: 'directory' } | { kind: 'login' };

type FrameCheck = { url: string; frame: 'allowed' | 'blocked' | 'unknown'; reason: string | null };

/**
 * The frame's permissions: the official page may run its scripts and forms, but not open pop-ups or new tabs
 * (no allow-popups) and not navigate Prismconnex itself (no allow-top-navigation). Its own security is not
 * touched: the original address is loaded as it is, and the browser enforces whatever the site sends
 * (X-Frame-Options, CSP frame-ancestors, its bot protection).
 */
const SANDBOX = 'allow-scripts allow-same-origin allow-forms';

/** How long an unconfirmed official page may take to load in the frame before Prismconnex explains instead. */
const UNCONFIRMED_LOAD_MS = 20_000;

/**
 * An official exhibitor page inside Prismconnex, for any event and platform. The stored address is checked
 * first (/api/find-shows/exhibitors/official-frame):
 *  - allowed: the site confirms it may be framed — shown in the sandboxed frame;
 *  - blocked: the site refuses framing, keeps the page behind its own sign-in, or no longer has it — explained
 *    in-app with the address to copy;
 *  - unknown: the check was inconclusive (bot protection, timeout, server error). That says nothing about
 *    whether the browser may show it, so the original address is tried in the same frame — see UnconfirmedFrame.
 * Nothing here opens a tab or a window, or navigates away from Prismconnex.
 */
export function OfficialPageView({ slug, target, title, onBack }: { slug: string; target: OfficialPageTarget; title: string; onBack?: () => void }) {
  const [check, setCheck] = useState<FrameCheck | null | 'error'>(null);
  const [copied, setCopied] = useState(false);
  const query = `slug=${encodeURIComponent(slug)}&kind=${target.kind}${target.kind === 'profile' ? `&id=${encodeURIComponent(target.id)}` : ''}`;

  useEffect(() => {
    const controller = new AbortController();
    setCheck(null);
    fetch(`/api/find-shows/exhibitors/official-frame?${query}`, { signal: controller.signal })
      .then((response) => (response.ok ? (response.json() as Promise<FrameCheck>) : Promise.reject(new Error(`HTTP ${response.status}`))))
      .then(setCheck)
      .catch((error: Error) => {
        if (error.name !== 'AbortError') setCheck('error');
      });
    return () => controller.abort();
  }, [query]);

  const copy = (url: string) => {
    navigator.clipboard?.writeText(url).then(
      () => setCopied(true),
      () => setCopied(false)
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex min-w-0 items-center gap-2 border-b border-slate-200/70 py-3 pl-3 pr-14 dark:border-white/[0.08] sm:pl-4">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/[0.06]"
          >
            <ArrowLeft className="size-4" /> Back
          </button>
        ) : null}
        <div className="min-w-0">
          <DialogTitle className="truncate text-sm font-bold text-slate-900 dark:text-white">{title}</DialogTitle>
          <DialogDescription className="truncate text-[11px] text-slate-500 dark:text-slate-400">
            {check && check !== 'error' ? new URL(check.url).host : 'Official page'} · shown inside Prismconnex
          </DialogDescription>
        </div>
      </div>

      <div className="relative min-h-0 flex-1 bg-slate-50 dark:bg-[#0b1120]">
        {check === null ? (
          <p className="flex h-full items-center justify-center gap-2 p-6 text-sm text-slate-500 dark:text-slate-400">
            <Loader2 className="size-4 animate-spin" /> Opening the official page…
          </p>
        ) : check === 'error' ? (
          <Fallback reason="The official page could not be found for this exhibitor." url={null} copied={false} onCopy={copy} />
        ) : officialViewMode(check.frame) === 'frame' ? (
          <iframe
            key={check.url}
            src={check.url}
            title={title}
            sandbox={SANDBOX}
            referrerPolicy="no-referrer"
            loading="lazy"
            className="h-full w-full border-0 bg-white"
          />
        ) : officialViewMode(check.frame) === 'try-frame' ? (
          <UnconfirmedFrame key={check.url} url={check.url} title={title} copied={copied} onCopy={copy} />
        ) : (
          // Confirmed blocked: never an empty frame — the reason and the address.
          <Fallback reason={check.reason} url={check.url} copied={copied} onCopy={copy} />
        )}
      </div>
    </div>
  );
}

/**
 * An official page whose framing could not be confirmed in advance, tried in the frame as it is.
 *
 * A browser does not tell the embedding page whether it refused to show a cross-origin page: a frame the site
 * blocks fires the same load event, and hides the same details, as one that is shown. So Prismconnex cannot
 * detect that refusal itself. Instead the visitor is told, beside the frame, that the site could not be
 * checked, with the address to copy and a way to the standard explanation should the frame stay empty. What
 * Prismconnex can detect — the page never loading at all — switches to that explanation by itself.
 */
function UnconfirmedFrame({ url, title, copied, onCopy }: { url: string; title: string; copied: boolean; onCopy: (url: string) => void }) {
  const [state, setState] = useState<'loading' | 'loaded' | 'no-load' | 'gave-up'>('loading');

  useEffect(() => {
    const timer = window.setTimeout(() => setState((current) => (current === 'loading' ? 'no-load' : current)), UNCONFIRMED_LOAD_MS);
    return () => window.clearTimeout(timer);
  }, []);

  if (state === 'no-load') {
    return <Fallback reason="The official site did not load inside Prismconnex." url={url} copied={copied} onCopy={onCopy} />;
  }
  if (state === 'gave-up') {
    return (
      <Fallback
        reason="The official site may not allow its pages to be shown inside other websites, and Prismconnex could not check it in advance."
        url={url}
        copied={copied}
        onCopy={onCopy}
      />
    );
  }
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-amber-200/70 bg-amber-50 px-3 py-2 text-[11px] leading-snug text-amber-900 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-200 sm:px-4">
        <span className="flex min-w-0 flex-1 basis-56 items-start gap-1.5">
          <Info className="mt-px size-3.5 shrink-0" />
          <span>Prismconnex could not check this official site in advance. If its page does not appear below, the site does not allow being shown here.</span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => onCopy(url)}
            className="inline-flex items-center gap-1 rounded-md border border-amber-300/70 px-2 py-1 font-semibold transition-colors hover:bg-amber-100 dark:border-amber-400/30 dark:hover:bg-amber-500/15"
          >
            {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
            {copied ? 'Copied' : 'Copy link'}
          </button>
          <button
            type="button"
            onClick={() => setState('gave-up')}
            className="rounded-md px-2 py-1 font-semibold underline-offset-2 transition-colors hover:underline"
          >
            Show link instead
          </button>
        </span>
      </div>
      <div className="relative min-h-0 flex-1">
        {state === 'loading' ? (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 p-6 text-sm text-slate-500 dark:text-slate-400">
            <Loader2 className="size-4 animate-spin" /> Loading the official page…
          </p>
        ) : null}
        <iframe
          src={url}
          title={title}
          sandbox={SANDBOX}
          referrerPolicy="no-referrer"
          onLoad={() => setState((current) => (current === 'loading' ? 'loaded' : current))}
          className={`relative h-full w-full border-0 ${state === 'loaded' ? 'bg-white' : 'bg-transparent'}`}
        />
      </div>
    </div>
  );
}

function Fallback({ reason, url, copied, onCopy }: { reason: string | null; url: string | null; copied: boolean; onCopy: (url: string) => void }) {
  return (
    <div className="flex h-full items-center justify-center overflow-y-auto p-6">
      <div className="w-full max-w-md space-y-3 text-center">
        <span className="mx-auto flex size-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">
          <ShieldAlert className="size-5" />
        </span>
        <p className="text-sm font-bold text-slate-900 dark:text-white">Official profile cannot be displayed inside Prismconnex.</p>
        {reason ? <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">{reason}</p> : null}
        {url ? (
          <div className="space-y-2">
            <p className="break-all rounded-lg border border-slate-200 bg-white px-3 py-2 text-left font-mono text-[11px] text-slate-600 dark:border-white/[0.08] dark:bg-[#0c1322] dark:text-slate-300">
              {url}
            </p>
            <button
              type="button"
              onClick={() => onCopy(url)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 dark:border-white/[0.1] dark:text-slate-300 dark:hover:bg-white/[0.04]"
            >
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              {copied ? 'Copied' : 'Copy link'}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** The official page in its own Prismconnex dialog, for the panel's directory and sign-in links. */
export function OfficialPageDialog({ slug, target, title, onClose }: { slug: string; target: OfficialPageTarget | null; title: string; onClose: () => void }) {
  return (
    <Dialog open={Boolean(target)} onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className={OFFICIAL_DIALOG_CLASS}>{target ? <OfficialPageView slug={slug} target={target} title={title} /> : null}</DialogContent>
    </Dialog>
  );
}

/** A dialog sized for a framed page: nearly the whole screen, on any device. */
export const OFFICIAL_DIALOG_CLASS =
  'flex h-[calc(100dvh-24px)] w-[calc(100%-24px)] max-w-[1100px] flex-col overflow-hidden border-slate-200/60 bg-white p-0 dark:border-white/[0.08] dark:bg-[#0c1322] sm:max-w-[1100px]';

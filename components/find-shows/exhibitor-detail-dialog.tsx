'use client';

import { useEffect, useRef, useState } from 'react';
import { Globe, Info, MapPin, Search } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { OFFICIAL_DIALOG_CLASS, OfficialPageView } from './official-page-view';
import { officialProfileLink, type ExhibitorCard, type ExhibitorSource } from '@/lib/find-shows/exhibitors';

// Built from a string: the project targets ES5, where `u`-flag regex literals are not allowed.
const NOT_LETTER_OR_DIGIT = new RegExp('[^\\p{L}\\p{N} ]', 'gu');

function initials(name: string) {
  const words = name.replace(NOT_LETTER_OR_DIGIT, ' ').split(/\s+/).filter(Boolean);
  return (words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? '?').slice(0, 2)).toUpperCase();
}

/** The exhibitor's logo on a white tile (logos are drawn for light backgrounds), or its initials when there is none or it fails to load. */
export function ExhibitorLogo({ card, size = 'card' }: { card: ExhibitorCard; size?: 'card' | 'detail' }) {
  const [failed, setFailed] = useState(false);
  return (
    <div
      className={`flex w-full items-center justify-center overflow-hidden rounded-xl border border-slate-100 bg-white p-2 dark:border-white/[0.06] ${
        size === 'detail' ? 'h-28' : 'h-16'
      }`}
    >
      {card.logoUrl && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element -- logos come from each platform's own CDN.
        <img
          src={card.logoUrl}
          alt={`${card.name} logo`}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="max-h-full max-w-full object-contain"
        />
      ) : (
        <span className={`font-black tracking-tight text-indigo-500/80 ${size === 'detail' ? 'text-3xl' : 'text-lg'}`}>{initials(card.name)}</span>
      )}
    </div>
  );
}

/**
 * An exhibitor's details inside Prismconnex, for a card from any platform: what the official directory
 * published for it (logo, name, booths, description) and the edition's directory it comes from. Nothing is
 * added. Its official-profile button shows the official page inside the same dialog (OfficialPageView): nothing
 * here opens a tab or a window, or leaves Prismconnex. Closing returns to the list exactly as it was: the list
 * stays mounted behind the dialog.
 */
export function ExhibitorDetailDialog({ slug, card, source, onClose }: { slug: string; card: ExhibitorCard | null; source: ExhibitorSource | null; onClose: () => void }) {
  const link = card ? officialProfileLink(card, source) : null;
  const body = useRef<HTMLDivElement>(null);
  const openedAt = useRef(0);
  const [view, setView] = useState<'details' | 'official'>('details');
  useEffect(() => {
    if (card) openedAt.current = Date.now();
    setView('details');
  }, [card]);
  return (
    <Dialog open={Boolean(card)} onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent
        // Focus starts on the details, never on the official-profile link: a key press or a touch's late click
        // must not take the visitor out of Prismconnex on the way in.
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          body.current?.focus();
        }}
        className={
          view === 'official'
            ? OFFICIAL_DIALOG_CLASS
            : 'flex max-h-[calc(100dvh-32px)] w-[calc(100%-32px)] flex-col overflow-hidden border-slate-200/60 bg-white p-0 dark:border-white/[0.08] dark:bg-[#0c1322] sm:max-w-[520px]'
        }
      >
        {card && link && view === 'official' ? (
          <OfficialPageView slug={slug} target={{ kind: 'profile', id: card.id }} title={card.name} onBack={() => setView('details')} />
        ) : card && link ? (
          <>
            <div ref={body} tabIndex={-1} className="min-h-0 flex-1 space-y-5 overflow-y-auto overflow-x-hidden p-5 pr-14 outline-none sm:p-6 sm:pr-14">
              <ExhibitorLogo key={card.id} card={card} size="detail" />
              <DialogHeader className="mb-0 space-y-1">
                <DialogTitle className="break-words text-lg font-black leading-snug tracking-tight text-slate-900 dark:text-white">{card.name}</DialogTitle>
                <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
                  {source ? `Exhibitor at ${source.editionLabel}` : 'Exhibitor'}
                </DialogDescription>
              </DialogHeader>

              {card.booths.length ? (
                <section aria-label="Booth" className="space-y-1.5">
                  <h3 className="text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">{card.booths.length > 1 ? 'Booths' : 'Booth'}</h3>
                  <ul className="space-y-1">
                    {card.booths.map((booth) => (
                      <li key={booth} className="flex items-start gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
                        <MapPin className="mt-0.5 size-4 shrink-0 text-indigo-500" />
                        <span className="min-w-0 break-words">{booth}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {card.description ? (
                <section aria-label="About" className="space-y-1.5">
                  <h3 className="text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">About</h3>
                  <p className="whitespace-pre-line break-words text-sm leading-relaxed text-slate-600 dark:text-slate-300">{card.description}</p>
                </section>
              ) : null}

              {source ? (
                <p className="flex items-start gap-1.5 break-words text-[11px] text-slate-400 dark:text-slate-500">
                  <Info className="mt-px size-3.5 shrink-0" />
                  <span className="min-w-0">
                    From the {source.editionLabel} official exhibitor directory ({source.platformLabel}).
                  </span>
                </p>
              ) : null}
            </div>

            <div className="space-y-2 border-t border-slate-200/70 p-4 dark:border-white/[0.08] sm:px-6">
              {link.note ? <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">{link.note}</p> : null}
              <div className="flex flex-col gap-2 sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={() => {
                    // The click that opened the details can land here as the dialog appears under it: not a choice.
                    if (Date.now() - openedAt.current >= 600) setView('official');
                  }}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-indigo-500"
                >
                  {card.profileKind === 'catalogue-search' ? <Search className="size-4" /> : <Globe className="size-4" />}
                  {link.label}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex flex-1 items-center justify-center rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 dark:border-white/[0.1] dark:text-slate-300 dark:hover:bg-white/[0.04]"
                >
                  Back to exhibitors
                </button>
              </div>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

import { Fragment } from 'react';
import { highlightSegments } from '@/lib/find-shows/search-events';

/**
 * Renders `text`, wrapping the parts that match the active search query in a
 * <mark>. Segment splitting lives in lib/find-shows/search-events.ts so it can
 * be unit-tested without a DOM.
 */
export function HighlightText({ text, query }: { text: string; query: string }) {
  const segments = highlightSegments(text, query);

  return (
    <>
      {segments.map((segment, index) => (
        <Fragment key={`${index}-${segment.text}`}>
          {segment.match ? (
            <mark className="rounded-[3px] bg-indigo-500/18 px-0.5 text-inherit dark:bg-indigo-400/25">
              {segment.text}
            </mark>
          ) : (
            segment.text
          )}
        </Fragment>
      ))}
    </>
  );
}

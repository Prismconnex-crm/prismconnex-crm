import { parseResultsState, resultsSearch, type FindShowsResultsState } from '@/lib/find-shows/results-state';

/**
 * Which Find Shows actions become browser history entries, so one Back click is one previous results state:
 *
 *   commit  — a filter action (region, country, category, date range, clear): a new entry.
 *   type    — search typing: the first keystroke opens one entry, the rest of that typing burst replaces it,
 *             so Back undoes the whole search rather than a letter at a time.
 *   update  — not a navigation ("Load more", re-running the same search): rewrites the current entry.
 *   read    — the state in the address, on mount and on Back/Forward (popstate); also ends a typing burst.
 *
 * An update that would not change the address writes nothing, so re-renders and repeated clicks never add
 * duplicate entries. It uses the native history methods, which Next 14.1+ syncs into the App Router without
 * a server round trip; router.push would re-request the page's whole catalog payload on every filter click.
 */
export type HistoryLike = {
  readonly state: unknown;
  pushState(data: unknown, unused: string, url: string): void;
  replaceState(data: unknown, unused: string, url: string): void;
};

export type LocationLike = { readonly pathname: string; readonly search: string; readonly hash: string };

export function createResultsHistory(win: { history: HistoryLike; location: LocationLike }) {
  let typing = false;

  const write = (state: FindShowsResultsState, mode: 'push' | 'replace') => {
    const { pathname, search, hash } = win.location;
    const nextSearch = resultsSearch(state, search);
    if (nextSearch === search) return false;
    const url = `${pathname}${nextSearch}${hash}`;
    if (mode === 'push') win.history.pushState(null, '', url);
    else win.history.replaceState(win.history.state, '', url);
    return true;
  };

  return {
    commit(state: FindShowsResultsState) {
      typing = false;
      return write(state, 'push');
    },
    type(state: FindShowsResultsState) {
      const wrote = write(state, typing ? 'replace' : 'push');
      if (wrote) typing = true;
      return wrote;
    },
    update(state: FindShowsResultsState) {
      return write(state, 'replace');
    },
    /** Ends a typing burst, so the next keystroke starts a new entry (search submitted). */
    endTyping() {
      typing = false;
    },
    read() {
      typing = false;
      return parseResultsState(win.location.search);
    },
  };
}

export type ResultsHistory = ReturnType<typeof createResultsHistory>;

import type { ExhibitorDirectory } from './exhibitors';

export type ExhibitorsLoadState = { status: 'loading' } | { status: 'ready'; directory: ExhibitorDirectory } | { status: 'error' };

/**
 * What the Exhibitors tab's content area shows. `empty` is only for an answer that confirms there are
 * no exhibitors (it shows EMPTY_EXHIBITORS_MESSAGE); a request that failed is `failed`, never `empty`.
 */
export type ExhibitorsPanelBody = 'loading' | 'list' | 'failed' | 'login' | 'link' | 'empty';

export const EMPTY_EXHIBITORS_MESSAGE = 'Official exhibitor information is not available yet.';

/**
 * The Exhibitors tab's view of a load state. `count` is the number the "Exhibiting Companies"
 * summary shows, or null to show none — never a placeholder like "TBA". While loading it is null
 * (the skeleton is the only signal); once settled it is the directory's count, else the catalog's.
 */
export function exhibitorsPanelView(state: ExhibitorsLoadState, fallbackCount: number | null): { count: number | null; body: ExhibitorsPanelBody } {
  if (state.status === 'loading') return { count: null, body: 'loading' };
  const fallback = fallbackCount && fallbackCount > 0 ? fallbackCount : null;
  if (state.status === 'error') return { count: fallback, body: 'failed' };

  const { directory } = state;
  switch (directory.status) {
    case 'VERIFIED_LIST':
      return directory.exhibitors.length
        ? { count: directory.total ?? directory.exhibitors.length, body: 'list' }
        : { count: fallback, body: 'empty' };
    case 'DISCOVERY_INCOMPLETE':
      return { count: fallback, body: 'failed' };
    case 'LOGIN_REQUIRED_DIRECTORY':
      return { count: fallback, body: directory.source ? 'login' : 'empty' };
    case 'OFFICIAL_DIRECTORY_LINK':
      return { count: fallback, body: directory.source ? 'link' : 'empty' };
    default:
      // NO_VERIFIED_DIRECTORY, VERIFIED_EMPTY_DIRECTORY: the server confirmed there are no exhibitors to show.
      return { count: fallback, body: 'empty' };
  }
}

import { usesInAppWebsiteViewer } from './website-viewer';

/**
 * How an event's CRM Exhibitors tab renders (components/events/exhibitors-panel.tsx). Every event uses BETT's
 * paginated card grid over its own EventExhibitor rows:
 *
 *  - grid `bett`: a card opens BETT's own Companies-page profile (BETT's exhibitors were imported as companies);
 *  - grid `event`: a card opens the tab's details drawer — every other event;
 *  - inAppViewer: the exhibitor's page opens inside Prismconnex instead of a new tab (AAPEX for now).
 */
export type ExhibitorTabLayout = { grid: 'bett' | 'event'; inAppViewer: boolean };

/** Events, by name, with BETT's Companies-page profile. */
const BETT_GRID_EVENTS = new Set(['BETT SHOW']);

export function exhibitorTabLayout(event: { name: string; slug: string }): ExhibitorTabLayout {
  if (BETT_GRID_EVENTS.has(event.name)) return { grid: 'bett', inAppViewer: false };
  return { grid: 'event', inAppViewer: usesInAppWebsiteViewer(event.slug) };
}

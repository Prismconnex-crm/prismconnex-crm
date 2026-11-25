import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { NearbyHotelsView } from '@/components/find-shows/how-to-reach-panel';
import type { TravelInfo } from '@/types/venue-travel';

/**
 * The Nearby Hotels tab renders from the same TravelInfo as How to Reach. When
 * it has no hotels, it must say WHY (the lookup's notices) and offer Try again
 * when a retry could fill it — a temporarily unavailable hotel search must not
 * read as "this location has no hotels".
 */

const base: TravelInfo = {
  venue: { name: 'Goodwood Park Hotel Singapore', coordinates: { lat: 1.3087, lng: 103.835 } },
  reference: 'venue',
  airports: [],
  buses: [],
  publicTransport: [],
  hotels: [],
  notices: [],
  attribution: [],
};

const noop = () => {};

describe('NearbyHotelsView', () => {
  it('shows the lookup notice and Try again when the hotel search was temporarily unavailable', () => {
    const html = renderToStaticMarkup(
      <NearbyHotelsView
        info={{
          ...base,
          notices: ['The nearby bus, rail, taxi and hotel search is temporarily unavailable. Please try again shortly.'],
          retryable: true,
        }}
        onRetry={noop}
      />
    );
    expect(html).toContain('temporarily unavailable');
    expect(html).toContain('Try again');
    expect(html).not.toContain('Information unavailable for this location.');
  });

  it('explains a venue that could not be pinned, without a retry button', () => {
    const html = renderToStaticMarkup(
      <NearbyHotelsView
        info={{
          ...base,
          reference: 'city-centre',
          notices: ['The venue could not be pinned on the map, so only airports are shown, measured from the Hong Kong city centre.'],
        }}
        onRetry={noop}
      />
    );
    expect(html).toContain('could not be pinned');
    expect(html).not.toContain('Try again');
  });

  it('keeps the plain unavailable state when the search ran and found nothing', () => {
    const html = renderToStaticMarkup(<NearbyHotelsView info={base} onRetry={noop} />);
    expect(html).toContain('Information unavailable for this location.');
    expect(html).not.toContain('Try again');
  });

  it('lists hotels and no notices or retry when hotels were found', () => {
    const html = renderToStaticMarkup(
      <NearbyHotelsView
        info={{
          ...base,
          notices: ["Distances are measured from the venue's street address."],
          retryable: true,
          hotels: [
            {
              place: { name: 'Novotel Living Singapore Orchard', address: '8 Claymore Hill, 229572 Singapore', coordinates: { lat: 1.3077, lng: 103.8318 } },
              stars: 4,
              distance: '360 m straight-line',
              sources: [{ label: 'OpenStreetMap', url: 'https://www.openstreetmap.org/node/1' }],
            },
          ],
        }}
        onRetry={noop}
      />
    );
    expect(html).toContain('Novotel Living Singapore Orchard');
    expect(html).toContain('4 Star');
    expect(html).not.toContain('Try again');
    expect(html).not.toContain('street address');
  });
});

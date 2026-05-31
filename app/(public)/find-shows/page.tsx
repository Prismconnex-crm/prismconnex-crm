import type { Metadata } from 'next';
import { FindShowsPage } from '@/components/find-shows/find-shows-page';
import {
  findShowCategoryOptions,
  findShowCountryOptions,
  findShowEvents,
  findShowStats,
} from '@/lib/find-shows/catalog';

export const metadata: Metadata = {
  title: 'Find Trade Shows | Prism Connex',
  description:
    'Browse worldwide trade shows, filter by category or month, and view live Eventseye media with resilient fallbacks.',
};

export default function FindShowsRoute() {
  return (
    <FindShowsPage
      events={findShowEvents}
      categories={findShowCategoryOptions}
      stats={{
        totalEvents: findShowStats.totalEvents,
        countries: findShowCountryOptions.length,
        years: findShowStats.years,
      }}
    />
  );
}

import { computePeopleStats, loadPeople } from '@/lib/people/data';
import {
  applyPeopleFilters,
  computePeopleFacets,
  paramsToFilters,
} from '@/lib/people/filters';
import { rankLookalikes } from '@/lib/people/lookalikes';
import { BadRequestError } from '@/lib/http/errors';
import { jsonError, jsonOk } from '@/lib/http/response';

/**
 * The People discovery dataset.
 *
 * Deliberately NOT tenant-scoped, exactly like /api/companies: this is a shared
 * discovery dataset, not workspace data. `stats` is dataset-wide (it drives the
 * header badge and the data-source strip) while `total` is the filtered count,
 * so no number on the page is hardcoded.
 */

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const params = url.searchParams;

    const page = Number(params.get('page') ?? '1');
    if (!Number.isInteger(page) || page < 1) {
      throw new BadRequestError('page must be an integer of 1 or more');
    }

    const requestedSize = Number(params.get('pageSize') ?? String(DEFAULT_PAGE_SIZE));
    const pageSize = Number.isFinite(requestedSize)
      ? Math.min(MAX_PAGE_SIZE, Math.max(1, Math.trunc(requestedSize)))
      : DEFAULT_PAGE_SIZE;

    const filters = paramsToFilters(params);
    const everyone = loadPeople();

    const matched = applyPeopleFilters(everyone, filters);
    // Lookalike ranking replaces the default ordering, applied after the other
    // constraints so "similar to X, in Germany" narrows before it ranks.
    const ordered = filters.lookalikeSeedId
      ? rankLookalikes(matched, filters.lookalikeSeedId, matched.length)
      : matched;

    const start = (page - 1) * pageSize;

    return jsonOk({
      results: ordered.slice(start, start + pageSize),
      total: ordered.length,
      totalPages: Math.ceil(ordered.length / pageSize),
      page,
      pageSize,
      facets: computePeopleFacets(everyone, filters),
      stats: computePeopleStats(everyone),
    });
  } catch (error) {
    return jsonError(error);
  }
}

import { validateBody } from '@/lib/http/validate';
import { jsonError, jsonOk } from '@/lib/http/response';
import { askQuerySchema } from '@/models/event-query';
import {
  askAboutCompaniesOrEvents,
  describeAssistantFailure,
  isConfigured,
} from '@/services/event-query.service';

export const dynamic = 'force-dynamic';

/**
 * Natural-language search behind the Companies box. Claude only classifies the
 * query and extracts filters; matching runs locally in the service, so a result
 * can never be an invented company or event.
 *
 * Failure policy — the search box must keep working when the assistant does not:
 * - No key, or a key the API rejects (401/403): 503 `intent: 'unavailable'`. The
 *   UI surfaces this, because someone has to fix the configuration.
 * - Anything else (rate limit, overload, network, unusable answer): 200 with the
 *   raw query handed back as a company prefix search and `degraded: true`. A
 *   transient upstream problem should degrade, not fail the request.
 */
export async function POST(request: Request) {
  try {
    const { q } = validateBody(askQuerySchema, await request.json());

    if (!isConfigured()) {
      return jsonOk({ intent: 'unavailable', reason: 'missing_api_key' }, 503);
    }

    try {
      return jsonOk(await askAboutCompaniesOrEvents(q));
    } catch (error) {
      // Logged rather than swallowed: a degraded response looks like a normal
      // prefix search from the client, so this is the only trace of the cause.
      console.error('[companies/ask] assistant failed:', error);

      const failure = describeAssistantFailure(error);
      if (failure.kind === 'unavailable') {
        return jsonOk({ intent: 'unavailable', reason: failure.reason }, 503);
      }

      return jsonOk({
        intent: 'companies',
        name: q,
        degraded: true,
        reason: failure.reason,
      });
    }
  } catch (error) {
    // Validation and malformed JSON only — assistant failures are handled above.
    return jsonError(error);
  }
}

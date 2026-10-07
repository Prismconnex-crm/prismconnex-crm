/**
 * Messe Düsseldorf's exhibitor index ("VIS": MEDICA, COMPAMED, drupa,
 * interpack, K, boot, ProWein, EuroShop…). The public index page
 * (`/vis/v1/<lang>/directory/<letter>`) loads its letters from
 * `/vis-api/vis/v1/<lang>/directory/<letter>`, sending the site's own host as
 * `x-vis-domain`; the same API's config names the edition (`medica2026`) and
 * its dates. Co-located shows share one index, so only records of this
 * edition's show id are kept.
 */
import { judgeEdition, type ExhibitorCard, type ExhibitorSource } from '../exhibitors';
import { Unreachable, readJson, rejected, type ExhibitorAdapter } from './types';

export type VisLead = { host: string; lang: 'en' | 'de' };

type VisConfig = { event?: { from?: string; until?: string; shortIdCurrentDomain?: string } };
type VisRecord = { exh?: string; exhSeoId?: string; name?: string; exhName?: string; logo?: string; location?: string; type?: string };

/** "medica2026" → "MEDICA 2026". */
export const visLabel = (shortId: string) => shortId.replace(/(\D)(\d{4})$/, '$1 $2').toUpperCase();

/** Cards from one letter of the index, for one show id only. */
export function visCards(records: unknown, lead: VisLead, showId: string, useSeoId = true): ExhibitorCard[] | null {
  if (!Array.isArray(records)) return null;
  const cards: ExhibitorCard[] = [];
  for (const record of records as VisRecord[]) {
    if (record.type && record.type !== 'profile') continue;
    const exh = record.exh ?? '';
    if (!exh.toLowerCase().startsWith(`${showId.toLowerCase()}.`)) continue;
    const name = (record.exhName ?? record.name ?? '').trim();
    const id = useSeoId && record.exhSeoId ? record.exhSeoId : exh;
    if (!name || !id) continue;
    cards.push({
      id: exh,
      name,
      logoUrl: record.logo?.trim() || null,
      booths: record.location ? record.location.split(/\s*;\s*/).filter(Boolean) : [],
      description: null,
      profileUrl: `https://${lead.host}/vis/v1/${lead.lang}/exhprofiles/${encodeURIComponent(id)}`,
      access: 'public',
    });
  }
  return cards;
}

export const messeDuesseldorfAdapter: ExhibitorAdapter = {
  id: 'messe-duesseldorf',
  detect(page) {
    const leads = new Map<string, VisLead>();
    for (const match of Array.from(page.html.matchAll(/(?:https?:\/\/([a-z0-9.-]+))?\/vis(?:-api)?\/v1\/(en|de)\//gi))) {
      const host = (match[1] ?? new URL(page.url).host).toLowerCase();
      // The index serves every language; cards link to its English profiles.
      leads.set(host, { host, lang: 'en' });
    }
    return Array.from(leads.values()).map((lead) => ({ adapter: 'messe-duesseldorf' as const, key: `vis:${lead.host}`, foundOn: page.url, data: lead }));
  },

  async resolve(raw, { target, fetcher }) {
    const lead = raw.data as VisLead;
    const api = `https://${lead.host}/vis-api/vis/v1/${lead.lang}`;
    const headers = { 'x-vis-domain': lead.host, Referer: `https://${lead.host}/vis/v1/${lead.lang}/directory/a` };
    const config = (await readJson(fetcher, `${api}/components/config`, headers)) as VisConfig & { useExhSeoId?: boolean };
    const showId = config.event?.shortIdCurrentDomain;
    if (!showId) throw new Unreachable(`${lead.host} did not name its current edition`);
    const label = visLabel(showId);
    const verdict = judgeEdition(target, { label, year: Number(showId.match(/(\d{4})$/)?.[1] ?? NaN) || null, startDate: config.event?.from ?? null });
    const directoryUrl = `https://${lead.host}/vis/v1/${lead.lang}/directory/a`;
    if (!verdict.ok) return rejected('messe-duesseldorf', label, directoryUrl, verdict.reason);

    const meta = (await readJson(fetcher, `${api}/directory/meta`, headers)) as { links?: { link: string; isFilled?: boolean }[] };
    const letters = (meta.links ?? []).filter((item) => item.isFilled !== false).map((item) => item.link);
    const cards = new Map<string, ExhibitorCard>();
    for (const letter of letters) {
      const records = await readJson(fetcher, `${api}/directory/${encodeURIComponent(letter)}`, headers);
      const letterCards = visCards(records, lead, showId, config.useExhSeoId !== false);
      if (!letterCards) throw new Unreachable(`${lead.host} returned an unexpected exhibitor index`);
      for (const card of letterCards) if (!cards.has(card.id)) cards.set(card.id, card);
    }
    const source: ExhibitorSource = {
      platform: 'messe-duesseldorf',
      platformLabel: 'Official exhibitor index',
      editionLabel: label,
      directoryUrl,
      loginUrl: null,
      foundOn: raw.foundOn,
    };
    return cards.size ? { kind: 'list', source, exhibitors: Array.from(cards.values()) } : { kind: 'empty', source };
  },
};

/**
 * Grupa MTP's exhibitor catalogue (Poznań and Lublin: POLAGRA, BUDMA, Meble
 * Polska, Modernlog …). Every MTP show site links the shared catalogue with
 * its edition code: `katalog.grupamtp.pl/en/?ec=TL12601`. The catalogue's
 * public endpoints, as its own page calls them:
 *
 *  - `GET /umbraco/mtpapi/mtpcatalogueapi/geteventsbycodes?editionCode=TL12601`:
 *    the edition's names (`short_name: "POLAGRA 2026"`) and opening days
 *    (`entrance_day: "2026-09-23T00:00:00"`);
 *  - `POST /umbraco/surface/mtpcatalogue/getexhibitors?lang=en&node_id=…&take=…&skip=…`
 *    with `{"ec": ["TL12601"]}`: HTML rows, one per exhibitor, each linking
 *    the exhibitor's profile (`/en?oid=2085916&ec=TL12601`) and naming its
 *    edition in a pill ("POLAGRA 2026").
 *
 * Stands are printed only on the profile pages ("Pavilion: 7 Stand: 12"), so
 * those are read a few at a time. One edition code can stand for a show the
 * catalog splits in two (POLAGRA = POLAGRA-FOOD + POLAGRA-TECH): the code's
 * names must name every distinctive word of the catalog event.
 */
import { judgeOwnName, yearIn, type EditionTarget, type ExhibitorCard, type ExhibitorSource } from '../exhibitors';
import { decodeHtml } from '../html-tree';
import { Unreachable, isOk, readHtml, readJson, rejected, type Candidate, type ExhibitorAdapter } from './types';
import type { Fetcher } from '../floor-plan-discovery';
import type { Poster } from './http';

const CATALOGUE = /https?:\/\/katalog\.grupamtp\.pl\/([a-z]{2})\/?\?(?:[^"'<>\s]*&(?:amp;)?)?ec=([A-Z0-9]+)/gi;
const ORIGIN = 'https://katalog.grupamtp.pl';
const TAKE = 1000;
const MAX_EXHIBITORS = 5000;
const MAX_PROFILES = 400;
const PROFILE_CONCURRENCY = 4;

export type MtpEdition = { code: string; language: string };
type NameItem = { language?: string; name?: string; short_name?: string };
type EventInfo = { names_items?: NameItem[]; entry_hours_items?: { entrance_day?: string }[] };

/** The catalogue editions a page links. */
export function mtpEditions(html: string): MtpEdition[] {
  const found = new Map<string, MtpEdition>();
  for (const match of Array.from(html.matchAll(CATALOGUE))) {
    const code = match[2].toUpperCase();
    if (!found.has(code)) found.set(code, { code, language: match[1].toLowerCase() });
  }
  return Array.from(found.values());
}

/** The edition's names (English first) and its first opening day. */
export function mtpEditionInfo(json: unknown): { label: string; names: string[]; startDate: string | null } | null {
  const event = Array.isArray(json) ? (json[0] as EventInfo | undefined) : undefined;
  if (!event) return null;
  const items = (event.names_items ?? []).slice().sort((a, b) => Number(b.language === 'en') - Number(a.language === 'en'));
  const label = items.map((item) => item.short_name?.trim()).find(Boolean) ?? '';
  const names = items.flatMap((item) => [item.short_name, item.name]).map((name) => (name ?? '').trim()).filter(Boolean);
  const days = (event.entry_hours_items ?? []).map((item) => (item.entrance_day ?? '').slice(0, 10)).filter((day) => /^\d{4}-\d{2}-\d{2}$/.test(day)).sort();
  return label ? { label, names, startDate: days[0] ?? null } : null;
}

/** Exhibitor rows from the catalogue's HTML: id, name, logo, edition pill. */
export function mtpRows(html: string, code: string, language: string) {
  const rows: { card: ExhibitorCard; edition: string }[] = [];
  const blocks = html.split(/<div class="row">\s*<div class="col-md-3/).slice(1);
  for (const block of blocks) {
    const link = block.match(/<a[^>]*href="([^"]*\?oid=(\d+)[^"]*)"[^>]*>\s*<h1>([\s\S]*?)<\/h1>/i);
    if (!link) continue;
    const name = decodeHtml(link[3].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
    if (!name) continue;
    const logo = block.match(/<img[^>]*src="([^"]+)"/i)?.[1];
    const edition = decodeHtml(block.match(/c-company-pill[^>]*>([^<]*)</i)?.[1] ?? '').trim();
    rows.push({
      edition,
      card: {
        id: link[2],
        name,
        logoUrl: logo ? new URL(decodeHtml(logo), 'https://static.mtp.pl/').toString().replace(/^http:/, 'https:') : null,
        booths: [],
        description: null,
        profileUrl: `${ORIGIN}/${language}?oid=${link[2]}&ec=${code}`,
        access: 'public',
      },
    });
  }
  return rows;
}

/** "Pavilion: 7 Stand: 12" on a profile page, once per stand. */
export function mtpStands(html: string): string[] {
  const text = decodeHtml(html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ');
  const stands = Array.from(text.matchAll(/(?:Pavilion|Pawilon):\s*([^\s:]+)\s+(?:Stand|Stoisko):\s*([^\s:]+)/gi)).map((match) => `Pavilion ${match[1]}, stand ${match[2]}`);
  return Array.from(new Set(stands));
}

async function resolveEdition(edition: MtpEdition, foundOn: string, target: EditionTarget, fetcher: Fetcher, post: Poster): Promise<Candidate> {
  const catalogueUrl = `${ORIGIN}/${edition.language}/?ec=${edition.code}`;
  const info = mtpEditionInfo(await readJson(fetcher, `${ORIGIN}/umbraco/mtpapi/mtpcatalogueapi/geteventsbycodes?editionCode=${encodeURIComponent(edition.code)}`));
  if (!info) return rejected('mtp', edition.code, catalogueUrl, 'the catalogue does not describe this edition code');
  const verdict = judgeOwnName(
    target,
    { label: info.label, names: info.names, year: yearIn(info.label) ?? (info.startDate ? Number(info.startDate.slice(0, 4)) : null), startDate: info.startDate },
    { allWords: true }
  );
  if (!verdict.ok) return rejected('mtp', info.label, catalogueUrl, verdict.reason);

  // The catalogue page sets the node its list endpoint needs (`var node_id = 3423;`).
  const page = await readHtml(fetcher, catalogueUrl);
  if (!isOk(page.status)) throw new Unreachable(`HTTP ${page.status} from katalog.grupamtp.pl`);
  const nodeId = page.html.match(/var\s+node_id\s*=\s*(\d+)/)?.[1];
  if (!nodeId) throw new Unreachable('the MTP catalogue page did not load its list');

  const source: ExhibitorSource = { platform: 'mtp', platformLabel: 'Official exhibitor catalogue', editionLabel: info.label, directoryUrl: catalogueUrl, loginUrl: null, foundOn };
  const rows: ReturnType<typeof mtpRows> = [];
  for (let skip = 0; skip < MAX_EXHIBITORS; skip += TAKE) {
    const url = `${ORIGIN}/umbraco/surface/mtpcatalogue/getexhibitors?lang=${edition.language}&node_id=${nodeId}&take=${TAKE}&skip=${skip}&sort=A-Z`;
    const answer = await post(url, {}, { json: { ec: [edition.code] }, referer: catalogueUrl, timeoutMs: 60_000 });
    if (!isOk(answer.status)) throw new Unreachable(`HTTP ${answer.status} from katalog.grupamtp.pl`);
    const pageRows = mtpRows(answer.body, edition.code, edition.language);
    rows.push(...pageRows);
    if (pageRows.length < TAKE) break;
  }
  // Only this edition's exhibitors (every row names its edition).
  const own = rows.filter((row) => !row.edition || row.edition.toLowerCase() === info.label.toLowerCase());
  const cards = Array.from(new Map(own.map((row) => [row.card.id, row.card])).values());
  if (!cards.length) return { kind: 'empty', source };

  // Stands from the profile pages, a few at a time; a page that cannot be read leaves that card without one.
  let next = 0;
  const wanted = cards.slice(0, MAX_PROFILES);
  await Promise.all(
    Array.from({ length: PROFILE_CONCURRENCY }, async () => {
      while (next < wanted.length) {
        const card = wanted[next++];
        try {
          const profile = await readHtml(fetcher, card.profileUrl);
          if (isOk(profile.status)) card.booths = mtpStands(profile.html);
        } catch {
          // The stand is optional; the list is complete without it.
        }
      }
    })
  );
  return { kind: 'list', source, exhibitors: cards };
}

export const mtpAdapter: ExhibitorAdapter = {
  id: 'mtp',
  detect(page) {
    return mtpEditions(page.html).map((edition) => ({ adapter: 'mtp' as const, key: `mtp:${edition.code}`, foundOn: page.url, data: edition }));
  },
  resolve(lead, { target, fetcher, post }) {
    return resolveEdition(lead.data as MtpEdition, lead.foundOn, target, fetcher, post);
  },
};

/**
 * "Espositore" brand-card catalogues (EICMA's `catalogo.<site>/Espositore`,
 * and any other show on the same catalogue software): an ASP.NET catalogue
 * whose exhibitor page renders every entry server-side as a card —
 *
 *   <div class="… divOpenPopupBrand" data-aziendaId="13253" data-catalogoId="53381" data-brandType="1">
 *     <img src="/img/loghi/13253.jpg"> <p class="… padiglione">3D BETA</p>
 *     <h5 class="… rappresentato">Pad. 6 - Stand I39</h5> <p class="… brand">ITALY - IT</p>
 *
 * `brandType` 1 is an exhibitor; 2 and 3 are companies and brands the
 * catalogue lists as "represented by" an exhibitor — not exhibitors, so not
 * shown. The page names its edition in its heading ("eicma 2026 exhibitors").
 * Details open in a popup (`Espositore/GetBrandDetail`) with no address of
 * their own; the catalogue page takes its search box as a query
 * (`Espositore?Nominativo=3D%20BETA` lists that exhibitor alone), so a card
 * opens the official catalogue filtered to the exhibitor — "Find on official
 * catalogue", never presented as a profile of its own.
 */
import { siteKey } from '../floor-plan';
import { judgeEdition, yearIn, type ExhibitorCard, type ExhibitorSource } from '../exhibitors';
import { descendants, parseHtml, textOf, type HtmlNode } from '../html-tree';
import { Unreachable, isOk, readHtml, rejected, type ExhibitorAdapter } from './types';

/** The catalogue software's own markers, present on its exhibitor page. */
const MARKERS = /divOpenPopupBrand[\s\S]{0,400}data-aziendaId=/i;
/** A catalogue exhibitor page address: `…/Espositore` on the official site. */
const CATALOGUE_PAGE = /^https?:\/\/[^/]+\/Espositore\/?(?:[?#].*)?$/i;
const EXHIBITOR = '1';

const hasClass = (node: HtmlNode, name: string) => (node.attrs.class ?? '').split(/\s+/).includes(name);

/** The edition the catalogue heading names: "eicma 2026 exhibitors" / "espositori eicma 2026". */
export function catalogueEdition(html: string): { label: string; year: number } | null {
  // Read one text node at a time (a heading), so neighbouring page text never joins the show's name.
  for (const node of descendants(parseHtml(html.slice(0, 600_000)))) {
    if (node.tag === 'title') continue;
    for (const raw of node.text) {
      const text = raw.replace(/\s+/g, ' ').trim();
      const match =
        text.match(/^([a-z][\w&.' -]{1,40}?)\s+(20\d{2})\s+(?:exhibitors|espositori|aussteller|exposants|expositores)$/i) ??
        text.match(/^(?:exhibitors|espositori|aussteller|exposants|expositores)\s+([a-z][\w&.' -]{1,40}?)\s+(20\d{2})$/i);
      if (match) return { label: `${match[1].trim()} ${match[2]}`, year: Number(match[2]) };
    }
  }
  return null;
}

/** The official catalogue filtered to one exhibitor: what its search box submits, as an address. */
export function catalogueSearchUrl(pageUrl: string, name: string) {
  const url = new URL(pageUrl);
  url.search = '';
  url.hash = '';
  url.searchParams.set('Nominativo', name);
  return url.toString();
}

/**
 * The catalogue's stand line as one booth entry, stand numbers first since the card writes "Booth" before
 * it: "Pad. 6 - Stand I39" → "I39 · Hall 6", "Pad. 24,11 - Stand E66,O07" → "E66, O07 · Halls 24, 11" (the
 * catalogue does not pair halls with stands, so neither does this). An empty line ("Pad. - Stand") is no
 * booth. Anything else stays as printed.
 */
export function catalogueStand(raw: string): string | null {
  const text = raw.replace(/\s+/g, ' ').trim();
  const match = text.match(/^Pad\.?\s*([^-]*?)\s*-\s*Stand\s*(.*)$/i);
  if (!match) return text || null;
  const list = (value: string) => value.split(/\s*,\s*/).filter(Boolean);
  const halls = list(match[1]);
  const stands = list(match[2]);
  const hall = halls.length ? `${halls.length > 1 ? 'Halls' : 'Hall'} ${halls.join(', ')}` : '';
  return [stands.join(', '), hall].filter(Boolean).join(' · ') || null;
}

/**
 * A card as the catalogue's cards are shown now, also for lists stored before (their profile link was
 * the bare catalogue page and their stand the raw line): idempotent.
 */
export function catalogueCardForDisplay(card: ExhibitorCard, catalogueUrl: string): ExhibitorCard {
  const booths = card.booths.map(catalogueStand).filter((booth): booth is string => Boolean(booth));
  return { ...card, booths, profileUrl: catalogueSearchUrl(catalogueUrl, card.name), profileKind: 'catalogue-search' };
}

/** Direct exhibitors' cards (brandType 1), once each. */
export function catalogueCards(html: string, pageUrl: string): ExhibitorCard[] {
  const cards: ExhibitorCard[] = [];
  const seen = new Set<string>();
  for (const node of descendants(parseHtml(html))) {
    if (!hasClass(node, 'divOpenPopupBrand') || node.attrs['data-brandtype'] !== EXHIBITOR) continue;
    const id = node.attrs['data-aziendaid'];
    const inside = descendants(node);
    const name = textOf(inside.find((child) => hasClass(child, 'padiglione')) ?? node).replace(/\s+/g, ' ').trim();
    if (!id || !name || seen.has(id)) continue;
    seen.add(id);
    const stand = inside.find((child) => hasClass(child, 'rappresentato'));
    const image = inside.find((child) => child.tag === 'img' && (child.attrs['data-src'] || child.attrs.src));
    let logoUrl: string | null = null;
    try {
      const src = image?.attrs['data-src'] || image?.attrs.src;
      logoUrl = src && !/logo_[a-z]+_nero|placeholder/i.test(src) ? new URL(src, pageUrl).toString() : null;
    } catch {
      logoUrl = null;
    }
    const booth = stand ? catalogueStand(textOf(stand)) : null;
    cards.push({
      id,
      name,
      logoUrl,
      booths: booth ? [booth] : [],
      description: null,
      profileUrl: catalogueSearchUrl(pageUrl, name),
      profileKind: 'catalogue-search',
      access: 'public',
    });
  }
  return cards;
}

export const brandCardCatalogueAdapter: ExhibitorAdapter = {
  id: 'brand-card-catalogue',
  detect(page, { site }) {
    const urls = new Set<string>();
    if (MARKERS.test(page.html)) urls.add(page.url);
    for (const match of Array.from(page.html.matchAll(/href\s*=\s*["']([^"']*\/Espositore\/?(?:\?[^"']*)?)["']/gi))) {
      try {
        const url = new URL(match[1].replace(/&amp;/g, '&'), page.url);
        url.hash = '';
        url.search = '';
        if (CATALOGUE_PAGE.test(url.toString()) && siteKey(url.toString()) === site) urls.add(url.toString());
      } catch {
        // Not a URL.
      }
    }
    return Array.from(urls).map((url) => ({ adapter: 'brand-card-catalogue' as const, key: `bcc:${url.toLowerCase()}`, foundOn: page.url, data: url }));
  },

  async resolve(raw, { target, fetcher }) {
    const listUrl = raw.data as string;
    const page = await readHtml(fetcher, listUrl);
    if (!isOk(page.status)) {
      if (page.status >= 500 || page.status === 429) throw new Unreachable(`HTTP ${page.status} from ${new URL(listUrl).host}`);
      return rejected('brand-card-catalogue', listUrl, listUrl, `the catalogue answered HTTP ${page.status}`);
    }
    if (!MARKERS.test(page.html)) return rejected('brand-card-catalogue', listUrl, page.url, 'the page is not an exhibitor catalogue of this kind');
    const edition = catalogueEdition(page.html);
    if (!edition) return rejected('brand-card-catalogue', listUrl, page.url, 'the catalogue does not say which edition it lists');
    const verdict = judgeEdition(target, { label: edition.label, year: yearIn(edition.label) ?? edition.year });
    if (!verdict.ok) return rejected('brand-card-catalogue', edition.label, page.url, verdict.reason);
    const source: ExhibitorSource = {
      platform: 'brand-card-catalogue',
      platformLabel: 'Official exhibitor catalogue',
      // "eicma 2026" is written in the catalog's own casing when the catalog names the show that way ("EICMA 2026").
      editionLabel: target.name.includes(edition.label.replace(/\s+20\d{2}$/, '').toUpperCase())
        ? edition.label.toUpperCase()
        : edition.label.replace(/^[a-z]/, (c) => c.toUpperCase()),
      directoryUrl: page.url,
      loginUrl: null,
      foundOn: raw.foundOn,
    };
    const cards = catalogueCards(page.html, page.url);
    if (!cards.length) return { kind: 'empty', source };
    // The catalogue prints a logo path for every card, served only once the exhibitor uploads one (the
    // official page falls back to its own placeholder). If a sample serves none, logos are not published yet.
    const sample = cards.filter((card) => card.logoUrl).slice(0, 5);
    const served = await Promise.all(
      sample.map(async (card) => {
        try {
          const answer = await fetcher(card.logoUrl!, { accept: 'image/*', timeoutMs: 10_000, maxBytes: 200_000 });
          return isOk(answer.status) && /^image\//.test(answer.contentType);
        } catch {
          return true; // Unknown: keep the logos rather than guess.
        }
      })
    );
    const logos = !sample.length || served.some(Boolean);
    return { kind: 'list', source, exhibitors: logos ? cards : cards.map((card) => ({ ...card, logoUrl: null })) };
  },
};

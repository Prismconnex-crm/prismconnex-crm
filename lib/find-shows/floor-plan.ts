/**
 * Floor plans for the event detail page's "Floor Plan" tab: the rules that
 * decide what counts as a floor plan and whether it belongs to the exact event
 * edition. Crawling lives in floor-plan-discovery.ts, caching in
 * floor-plan-resolver.ts; everything here is pure.
 *
 * A candidate is judged on three layers of evidence about the event edition —
 * the year, the printed dates, the city, the venue and the event's name:
 *
 *  - content: what the plan itself says (a PDF's text or metadata title, a
 *    page's title/headline);
 *  - link: its URL, file name, link text, image alt text and the words next to
 *    the link;
 *  - page: the official page it was linked from (its URL and headline, and the
 *    edition's dates printed on it).
 *
 * A plan is shown only if the combined evidence names this edition's year (or
 * its dates) and identifies this event (city, venue, dates — or its name, when
 * no other city's edition shares the site), and nothing contradicts it: a plan
 * whose own text or link is for another year, or another city, is rejected.
 * Evidence from the source page alone is accepted only when that page is
 * itself about this edition (it prints the edition's dates, or names the year
 * and city) and the file is not years older than the edition.
 */
import { inflateSync } from 'zlib';

export type FloorPlanKind = 'pdf' | 'image' | 'interactive' | 'page';

export type FindShowFloorPlan = {
  kind: FloorPlanKind;
  /** The plan itself, on the organizer's site or file host. */
  url: string;
  /** Same-origin copy for PDFs and images (set by the API route), so the browser can show it inline. */
  viewUrl?: string;
  /** Whether an interactive plan or page may be shown in a frame. */
  embeddable?: boolean;
  /** Dates as printed on the plan, e.g. "1 - 2 August 2026". */
  edition?: string;
  /** Set when the plan is inside a larger document, e.g. an exhibitor manual. */
  note?: string;
  /** Strongest layer that confirmed the edition. */
  verification: 'plan-content' | 'official-link' | 'official-page';
  /** Human-readable proof, e.g. "plan text names 2026", "link names Melbourne". */
  evidence: string[];
  /** Where it comes from — shown under it. */
  source: { label: string; url: string };
};

/** What the rules need to know about an event edition. */
export type FloorPlanEvent = {
  name: string;
  startDate: string;
  endDate?: string;
  city: string;
  country?: string;
  venue?: string;
  organizer?: string;
  /** Cities of other catalog editions on the same official site (or by the same organizer). */
  otherCities?: string[];
  /** Every catalog city (normalized), to spot a plan naming some other city. */
  knownCities?: ReadonlySet<string>;
  /** "annual", "every 2 years", … */
  frequency?: string;
  /** Other catalog editions on the same site in the same city and year (phases, seasons): year + city cannot tell them apart. */
  sameCityYearEditions?: number;
};

// --- Text helpers -------------------------------------------------------------

/** Lower-case, accents stripped, anything but letters/digits (any script) to single spaces. */
export function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/[łŁ]/g, 'l')
    .replace(/ß/g, 'ss')
    // Recompose what NFD split beyond Latin accents (プ, Hangul syllables).
    .normalize('NFC')
    .toLowerCase()
    .replace(NON_WORD, ' ')
    .trim();
}
// Built from a string: the project targets ES5, where `u`-flag regex literals are not allowed.
const NON_WORD = new RegExp('[^\\p{L}\\p{N}\\p{M}]+', 'gu');

const hasWord = (text: string, word: string) => word.length > 0 && ` ${text} `.includes(` ${word} `);
/** CJK and Thai scripts have no spaces between words: match by substring. */
const isUnspaced = (word: string) => /[฀-๿぀-ヿ㐀-鿿가-힯]/.test(word);
const hasTerm = (text: string, term: string) => (isUnspaced(term) ? text.includes(term) : hasWord(text, term));

const decodeEntities = (value: string) =>
  value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&apos;|&rsquo;|&lsquo;/g, "'")
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&ndash;|&#8211;/g, '–')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)));

/** A URL as words: decoded path and query, separators to spaces, camelCase split. */
export function urlWords(url: string) {
  try {
    const parsed = new URL(url);
    let path = `${withoutUploadFolder(parsed.pathname)} ${parsed.search}`;
    try {
      path = decodeURIComponent(path);
    } catch {
      // Keep the raw path.
    }
    return path.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[-_/.+=&?%]+/g, ' ');
  } catch {
    return url;
  }
}

// --- Vocabulary (every catalog language, no event-specific words) ------------

/** Terms naming a floor plan, as normalized text. */
const FLOOR_PLAN_PATTERN = new RegExp(
  [
    // English
    'floor ?plans?', 'floor ?maps?', 'floor ?layouts?', 'hall ?(?:plans?|maps?|layouts?)',
    '(?:exhibition|exhibitor|expo|show|event|trade ?show|fair) ?(?:floor ?)?(?:plans?|maps?|layouts?)',
    'venue ?(?:plans?|layouts?|floor)', 'stand ?(?:plans?|maps?|layouts?)', 'booth ?(?:plans?|maps?|layouts?)',
    'site ?plans?', 'layout ?plans?', 'plan of (?:the )?(?:exhibition|halls?|show)',
    // German
    // Nouns only ("Hallenplan", "Hallenpläne"), never the verb or "-planung" ("Messe planen", "Standplanung");
    // umlauts also as ae/oe/ue ("Gelaendeplan").
    '(?:hallen|gel(?:a|ae)nde|stand|ausstellungs|messe|lage) ?plane?s?', '(?:hallen|gel(?:a|ae)nde|stand) ?(?:u|ue)bersichte?n?',
    'hallen ?belegung(?:splan)?e?s?',
    // French
    'plans? (?:du|de l|des|de la) ?(?:salon|exposition|halls?|stands?|evenement|foire|manifestation)',
    'plan interactif', 'plan d implantation', 'plan des exposants', 'plans? (?:du |des )?niveaux?',
    // Spanish / Portuguese
    'planos? (?:de la|del|de los|de|da|do|dos) ?(?:feria|exposicion|recinto|evento|stands?|pabellon\\p{L}*|expositores|salon|feira|exposicao|pavilh\\p{L}*)',
    'planta (?:da|do|de) ?(?:feira|evento|exposicao|stands?)', 'mapa (?:da|do|de la|del|de) ?(?:feira|feria|recinto|evento|expositores|exposicao|exposicion)',
    'distribucion de (?:stands|expositores)',
    // Italian
    'planimetri\\p{L}*', 'pianta (?:del|della|dei) ?(?:fiera|padiglion\\p{L}*|manifestazione|salone|quartiere)',
    'mappa (?:della|degli|dei) ?(?:fiera|espositori|padiglioni|salone)',
    // Dutch, Nordic, Finnish
    '\\p{L}*plattegrond\\p{L}*', 'standplattegrond', 'planritning', 'utstallarkarta', 'utstillerkart\\p{L}*', 'hallkarta',
    'plantegning\\p{L}*', 'standkort', 'messekort', 'pohjapiirro\\p{L}*', 'hallikartta', 'messukartta', 'osastokartta',
    // Polish, Czech, Slovak, Hungarian, Romanian, Baltic
    'plan (?:targow|hal|hali|stoisk|ekspozycji|wystawy|terenu)', 'rozmieszczenie stoisk',
    'plan (?:vystaviste|arealu|expozice|haly|hal|stanku|vystavy)', 'plan vystaviska',
    'alaprajz\\p{L}*', 'stand ?terkep\\p{L}*', 'kiallitoi terkep\\p{L}*', 'helyszinrajz\\p{L}*',
    'planul (?:expozitiei|standurilor|targului|pavilionului)', 'stendu plans', 'ekspozicijos planas',
    // Turkish, Greek
    '(?:salon|fuar|kat|stant|yerlesim) plani', 'κατοψη\\p{L}*',
    // Russian / Ukrainian
    '(?:план|схема) (?:выставки|павильон\\p{L}*|экспозиции|застройки|зала|стендов|виставки)', 'план схема',
    // Indonesian / Malay / Vietnamese
    'denah (?:pameran|booth|stand|lokasi|ruang)', 'pelan (?:lantai|dewan|pameran)', 'so do (?:gian hang|trien lam|mat bang)', 'mat bang',
    // Arabic
    'مخطط (?:المعرض|القاعة|الاجنحة)', 'خريطة المعرض',
  ].join('|'),
  'u'
);
/** Unspaced-script terms, matched as substrings. */
const FLOOR_PLAN_UNSPACED = [
  '会場図', '会場マップ', 'フロアマップ', 'フロアプラン', '小間割', '小間配置', 'レイアウト図', '会場レイアウト', '配置図', '出展者配置',
  '展位图', '展位圖', '平面图', '平面圖', '展馆图', '展館圖', '展区图', '展區圖', '场馆图', '展位分布', '展馆平面', '展位平面',
  '부스배치도', '배치도', '도면', '플로어맵', '부스 배치', 'แผนผัง', 'ผังงาน', 'ผังบูธ',
];
/** Joined words ("floorplan2026", "Hallenplan_A4") in file names. */
const FLOOR_PLAN_COMPACT = /(floorplan|floormap|hallplan|hallenplan|standplan|boothmap|exhibitionplan|expomap|showmap|plattegrond|planimetri|venuemap|siteplan|eventmap)(?!ung|en|ning)/;

/** Pages worth opening to look for a plan: exhibitor information, documents, the edition. */
const EXHIBITOR_PATTERN = new RegExp(
  [
    'exhibit\\p{L}*', 'stand (?:booking|bookings|sales|space|builders?)', 'booth (?:sales|space|booking)', 'book (?:a |your )?(?:stand|booth|space)',
    'space (?:booking|sales|available)', 'participat\\p{L}*', 'show guide', 'event guide', 'visitor guide', 'visitor information', 'plan your visit',
    'downloads?', 'documents?', 'resources', 'prospectus', 'sales brochure', 'why exhibit', 'venue', 'practical information', 'event info\\p{L}*',
    'aussteller\\p{L}*', 'ausstellen', 'teilnahme\\p{L}*', 'standbuchung', 'besucher\\p{L}*', 'messegelande',
    'exposant\\p{L}*', 'exposer', 'participer', 'dossier exposant', 'infos? pratiques?', 'telechargements?', 'visiteurs?',
    'expositor\\p{L}*', 'exponer', 'expor', 'participar', 'descargas', 'visitantes', 'informacion practica',
    'espositor\\p{L}*', 'esporre', 'partecipare', 'visitatori',
    'standhouder\\p{L}*', 'exposanten', 'deelnemen', 'deelname', 'bezoekers',
    'wystawc\\p{L}*', 'vystavovatel\\p{L}*', 'kiallito\\p{L}*', 'expozant\\p{L}*', 'katilimci\\p{L}*', 'utstallare', 'utstillere', 'naytteilleasettaj\\p{L}*',
    'участник\\p{L}*', 'экспонент\\p{L}*', 'учасник\\p{L}*', 'peserta', 'exhibitors?',
  ].join('|'),
  'u'
);
const EXHIBITOR_UNSPACED = ['出展', '出展者', '小間', '参展', '展商', '展位', '下载', '참가', '참가안내', '전시업체', '부스'];

/** Documents that often carry the floor plan inside. */
const MANUAL_PATTERN = new RegExp(
  [
    'exhibitor ?(?:manual|kit|handbook|guide|pack|brochure|information|info|prospectus)', 'event manual', 'show guide', 'event guide', 'visitor guide',
    'prospectus', 'sales brochure', 'show catalog\\p{L}*', 'ausstellerhandbuch', 'ausstellerunterlagen', 'ausstellerinformation\\p{L}*',
    'guide (?:de l )?exposant', 'manuel (?:de l )?exposant', 'dossier exposant', 'manual del expositor', 'manual do expositor',
    'manuale (?:dell )?espositore', 'standhoudershandboek', 'standhoudersinformatie', 'poradnik wystawcy', 'katalog',
  ].join('|'),
  'u'
);
const MANUAL_UNSPACED = ['出展者マニュアル', '出展マニュアル', '参展手册', '展商手册', '参展指南', '참가업체 매뉴얼', '참가안내서'];

const bounded = (pattern: RegExp) => new RegExp(`(?:^| )(?:${pattern.source})(?= |$)`, 'u');
const EXHIBITOR_BOUNDED = bounded(EXHIBITOR_PATTERN);
const MANUAL_BOUNDED = bounded(MANUAL_PATTERN);
const FLOOR_PLAN_BOUNDED = bounded(FLOOR_PLAN_PATTERN);

const matchesVocabulary = (text: string, pattern: RegExp, unspaced: string[]) => {
  const normalized = normalize(text);
  return pattern.test(normalized) || unspaced.some((term) => normalized.includes(term));
};

/** Whether text (link text, file name, title) names a floor plan. "Sitemap" does not. */
export function namesFloorPlan(text: string) {
  const normalized = normalize(text);
  if (FLOOR_PLAN_UNSPACED.some((term) => normalized.includes(term))) return true;
  // "Sitemap" and "plan your visit/trip" are not floor plans ("trade fair plan your visit" is not a "fair plan").
  const withoutSitemap = normalized
    .replace(/\bsite ?maps?\b/g, ' ')
    .replace(/\bplan (?:your|a|my|ihren|ihre|votre|su|tu|la tua) \S+/g, ' ');
  if (FLOOR_PLAN_BOUNDED.test(withoutSitemap)) return true;
  return FLOOR_PLAN_COMPACT.test(withoutSitemap.replace(/ /g, '').replace(/sitemap(?!plan)/g, ''));
}

/** How many times a long text (a PDF's text) names a floor plan. */
export function floorPlanMentions(text: string) {
  const normalized = normalize(text).replace(/\bsite ?maps?\b/g, ' ');
  const spaced = normalized.match(new RegExp(`(?:^| )(?:${FLOOR_PLAN_PATTERN.source})(?= |$)`, 'gu'))?.length ?? 0;
  return spaced + FLOOR_PLAN_UNSPACED.reduce((sum, term) => sum + (normalized.split(term).length - 1), 0);
}

/** Documents that are never the plan itself, whatever page links them. */
const NOT_PLAN_PATTERN = bounded(
  /post ?show ?report|show ?report|final ?report|press ?release|regulations?|regulamin|terms|conditions|agb|price ?list|cennik|preisliste|application ?form|anmeldung|formular\w*|contract|avtal|invoice|rechnung|order ?form|bestellformular|newsletter|programme|program|agenda|timetable|menu|ticket\w*|visitor ?survey|statistics?|statistik|brochure ?form|sponsorship|media ?kit|rate ?card|request|enquir\w*|inquir\w*|coming soon|reserve ?booths?|reservebooth|booth ?reservation|book ?(?:a ?)?(?:booth|stand)|checkout|datenschutz\w*|privacy|impressum|imprint|cookies?|disclaimer|legal|merkblatt\w*|richtlinie\w*|guidelines?|hausordnung|house rules/
);
export const namesNotPlan = (text: string) => NOT_PLAN_PATTERN.test(normalize(text));

/** Link text that says nothing about what it links to ("Download", "PDF", "here"). */
export const isGenericLinkText = (text: string) =>
  normalize(text).length === 0 ||
  /^(?:download\w*|pdf|here|click here|view|open|see|more|herunterladen|telecharger|descargar|scarica|baixar|pobierz|stahnout|indir|ladda ner|last ned|ダウンロード|下载|下載|다운로드|\d+ ?[km]b|pdf \d+ ?[km]b)(?: pdf)?$/.test(normalize(text));

/**
 * Whether a page says its plan is not out yet ("Floor plan coming soon", "Plan
 * targów będzie udostępniony wkrótce", "Hallenplan folgt in Kürze") — the
 * organizer's own word that nothing is published.
 */
const COMING_SOON = new RegExp(
  [
    'coming soon', 'available soon', 'will be (?:available|published|released|online|uploaded|announced|shared|posted)', 'to be (?:announced|published|released|confirmed)',
    'not (?:yet )?(?:available|published)', 'stay tuned',
    'in kurze', 'demnachst', 'bald verfugbar', 'folgt (?:in kurze|bald|demnachst)', 'wird (?:in kurze|bald|demnachst) (?:veroffentlicht|verfugbar)',
    'prochainement', 'bientot disponible', 'sera (?:disponible|publie|mis en ligne)', 'proximamente', 'estara disponible', 'em breve', 'estara disponivel',
    'a breve', 'sara disponibile', 'disponibile a breve', 'binnenkort', 'wkrotce', 'bedzie (?:udostepniony|dostepny|opublikowany)', 'brzy k dispozici', 'pripravujeme',
    'yakinda', 'скоро', 'будет опубликован\\p{L}*', 'segera',
  ].join('|'),
  'u'
);
const COMING_SOON_UNSPACED = ['近日公開', '準備中', '即将', '敬请期待', '敬請期待', '곧 공개', '준비중'];
export const saysComingSoon = (text: string) => {
  const normalized = normalize(text);
  return COMING_SOON.test(normalized) || COMING_SOON_UNSPACED.some((term) => normalized.includes(term));
};

/** Whether a page's text says the floor plan itself is coming (not, say, registration): on the plan's line or right under it. */
export function saysPlanComingSoon(pageText: string) {
  const lines = pageText.split('\n').map((line) => line.trim()).filter(Boolean);
  return lines.some((line, index) => saysComingSoon(line) && (namesFloorPlan(line) || namesFloorPlan(lines[index - 1] ?? '')));
}

export const namesExhibitorInfo = (text: string) => matchesVocabulary(text, EXHIBITOR_BOUNDED, EXHIBITOR_UNSPACED);
export const namesManual = (text: string) => matchesVocabulary(text, MANUAL_BOUNDED, MANUAL_UNSPACED);

// --- Sites and URLs -----------------------------------------------------------

/** "franchisingexpo.com.au" from "http://www.franchisingexpo.com.au/x"; null for none or eventseye. */
export function websiteDomain(website: string | null | undefined) {
  if (!website) return null;
  try {
    const host = new URL(/^https?:\/\//i.test(website) ? website : `http://${website}`).hostname.toLowerCase();
    const domain = host.replace(/^www\./, '');
    return domain.endsWith('eventseye.com') ? null : domain;
  } catch {
    return null;
  }
}

const SECOND_LEVEL = /^(?:co|com|net|org|gov|edu|ac|or|ne|go|gob|gouv|nic|mil|ltd|plc|biz|info|in|asn|id|nom|web)$/;

/** Registrable domain ("messe-muenchen.de" for "www.bauma.messe-muenchen.de"), so a site's subdomains count as the site. */
export function siteKey(urlOrHost: string) {
  let host = urlOrHost;
  try {
    host = new URL(/^https?:\/\//i.test(urlOrHost) ? urlOrHost : `http://${urlOrHost}`).hostname;
  } catch {
    // Already a host.
  }
  const labels = host.toLowerCase().replace(/^www\d?\./, '').split('.');
  if (labels.length > 2 && labels[labels.length - 1].length === 2 && SECOND_LEVEL.test(labels[labels.length - 2])) {
    return labels.slice(-3).join('.');
  }
  return labels.slice(-2).join('.');
}

/** The brand in a site's domain ("franchisingexpo"), when distinctive enough to recognize a file host named after it. */
export function siteBrand(site: string) {
  const brand = site.split('.')[0].replace(/[^a-z0-9]/g, '');
  return brand.length >= 6 ? brand : null;
}

/** Cloud file hosts where an organizer's files sit in a bucket/folder named after it. */
const FILE_HOST =
  /(?:^|\.)(?:amazonaws\.com|cloudfront\.net|blob\.core\.windows\.net|azureedge\.net|storage\.googleapis\.com|digitaloceanspaces\.com|r2\.dev|b-cdn\.net|cloudinary\.com|imgix\.net|ctfassets\.net|hubspotusercontent[\w-]*\.net|wixstatic\.com|squarespace-cdn\.com|website-files\.com|sanity\.io|prismic\.io)$/;

/**
 * Whether a file sits on a host named after the official site: its own host
 * ("franchisingexpo-assets.com"), or a cloud bucket/folder named after it
 * ("s3…amazonaws.com/franchising-expo-production/…"). A file name mentioning
 * the brand on someone else's site does not count.
 */
export function carriesBrand(url: string, brand: string) {
  try {
    const { hostname, pathname } = new URL(url);
    const compact = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (compact(hostname).includes(brand)) return true;
    return FILE_HOST.test(hostname) && compact(pathname.split('/')[1] ?? '').includes(brand);
  } catch {
    return false;
  }
}

/** PDF, image, interactive plan or web page, from the URL and (when known) the response's content type. */
export function floorPlanKind(url: string, contentType?: string | null): FloorPlanKind {
  const type = (contentType ?? '').toLowerCase();
  if (type.includes('pdf') || (!type && /\.pdf($|[?#])/i.test(url))) return 'pdf';
  if (type.startsWith('image/') || (!type && /\.(png|jpe?g|gif|webp|svg|avif)($|[?#])/i.test(url))) return 'image';
  if (isInteractivePlanUrl(url)) return 'interactive';
  return 'page';
}

/** Hosted interactive floor plans (ExpoFP, Map Your Show, a2z, ExpoCad, Map Dynamics, …). */
export function isInteractivePlanUrl(url: string) {
  try {
    const { hostname, pathname } = new URL(url);
    const host = hostname.toLowerCase();
    // Booking flows on plan platforms ("/reservebooth", "/checkout") are not the plan view.
    if (/reserve|booking|checkout|register|cart/i.test(pathname)) return false;
    if (/(^|\.)expofp\.com$|(^|\.)expocad(web)?\.com$|(^|\.)mapdynamics\.com$|(^|\.)floorplan\.live$|(^|\.)ungerboeck\.com$|(^|\.)expo-genie\.com$|(^|\.)floorplan\.expo/.test(host)) return true;
    if (/(^|\.)mapyourshow\.com$/.test(host)) return /floorplan|floor-plan|exhibitor-map|8_0\/floorplan/i.test(pathname) || /floorplan/.test(host);
    if (/(^|\.)a2zinc\.net$/.test(host)) return /eventmap|floorplan/i.test(pathname);
    if (/(^|\.)(expoplatform|smallworldlabs|swapcard|cvent|eventscribe|n200)\.(com|net|io)$/.test(host)) return /floor[-_ ]?plan|floorplan|exhibit(or)?[-_ ]?map|hall[-_ ]?plan/i.test(pathname);
    return false;
  } catch {
    return false;
  }
}

// --- Links, embeds and page text -------------------------------------------

export type PageLink = {
  url: string;
  /** Link text (for frames, their title). */
  text: string;
  /** Alt/title text of the image (or of an image inside the link): often SEO copy, so weaker than link text. */
  alt: string;
  /** Words just before and after the link on the page (e.g. "Melbourne 2026 — Download"). */
  near: string;
  /** Page the link was found on. */
  pageUrl: string;
  /**
   * a: anchor, img: <img>, bg: an image shown as a CSS background/preload/lazy attribute,
   * frame: iframe/embed/object, raw: a document URL in scripts or attributes.
   */
  tag: 'a' | 'img' | 'bg' | 'frame' | 'raw';
};

const SKIP_URL =
  /^(?:mailto|tel|javascript|data|whatsapp|sms):|(?:^|[./])(?:facebook|twitter|x|instagram|linkedin|youtube|youtu|tiktok|pinterest|flickr|vimeo|wa|t|weibo|wechat|xing|vk|google|goo|apple|bing|addtoany|sharethis)\.(?:com|be|me|gl|cn)\b|\/(?:wp-login|wp-admin|login|signin|sign-in|cart|checkout|my-account|account|feed|xmlrpc|cdn-cgi)\b|[?&](?:replytocom|share|print|add-to-cart)=|\.(?:zip|rar|exe|dmg|mp4|mp3|mov|ics|vcf|docx?|xlsx?|pptx?|css|js|woff2?|ttf|ico)(?:$|[?#])/i;

const stripTags = (html: string) =>
  decodeEntities(
    html
      .replace(/<(script|style|noscript|svg|template)\b[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<br\s*\/?>|<\/(?:p|div|li|h\d|td|tr|section|article)>/gi, ' \n ')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/[ \t\r\f\v]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();

/** The visible text of a page, capped. */
export function pageText(html: string, limit = 200_000) {
  return stripTags(html.slice(0, 3_000_000)).slice(0, limit);
}

function resolveUrl(href: string, base: string) {
  try {
    const url = new URL(decodeEntities(href).trim(), base);
    if (!/^https?:$/.test(url.protocol)) return null;
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

const attr = (tag: string, name: string) =>
  tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'))?.slice(1).find((value) => value !== undefined) ?? null;

/**
 * Every link on a page — anchors, embedded images, frames/embeds, and document
 * URLs sitting in scripts or data attributes (sites that render with JavaScript
 * still carry them) — resolved against `pageUrl`, each with the words around it.
 */
export function extractLinks(html: string, pageUrl: string): PageLink[] {
  const links: PageLink[] = [];
  const seen = new Set<string>();
  const source = html.slice(0, 3_000_000);
  // Relative links resolve against <base href> when the page sets one.
  const baseHref = attr(source.match(/<base\b[^>]*>/i)?.[0] ?? '', 'href');
  const base = (baseHref && resolveUrl(baseHref, pageUrl)) || pageUrl;
  const add = (href: string | null, text: string, index: number, tag: PageLink['tag'], alt = '') => {
    if (!href) return;
    const url = resolveUrl(href, base);
    if (!url || SKIP_URL.test(url)) return;
    const key = `${tag}|${url}|${text}`;
    if (seen.has(key)) return;
    seen.add(key);
    const near = stripTags(source.slice(Math.max(0, index - 400), index + 600)).replace(/\s+/g, ' ').slice(0, 500);
    links.push({ url, text: text.replace(/\s+/g, ' ').trim().slice(0, 300), alt: alt.replace(/\s+/g, ' ').trim().slice(0, 300), near, pageUrl, tag });
  };

  for (const match of Array.from(source.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi))) {
    const href = attr(match[1], 'href');
    const inner = match[2];
    const innerAlt = (inner.match(/<img\b[^>]*>/gi) ?? []).map((img) => `${attr(img, 'alt') ?? ''} ${attr(img, 'title') ?? ''}`).join(' ');
    const text = `${stripTags(inner)} ${attr(match[1], 'title') ?? ''} ${attr(match[1], 'aria-label') ?? ''}`;
    add(href, text, match.index ?? 0, 'a', innerAlt);
  }
  for (const match of Array.from(source.matchAll(/<area\b[^>]*>/gi))) {
    add(attr(match[0], 'href'), attr(match[0], 'title') ?? '', match.index ?? 0, 'a', attr(match[0], 'alt') ?? '');
  }
  for (const match of Array.from(source.matchAll(/<img\b[^>]*>/gi))) {
    const tag = match[0];
    const src = attr(tag, 'data-src') ?? attr(tag, 'data-lazy-src') ?? attr(tag, 'src');
    const srcset = attr(tag, 'srcset') ?? attr(tag, 'data-srcset');
    // The largest srcset entry is the readable one.
    const largest = srcset
      ?.split(',')
      .map((entry) => entry.trim().split(/\s+/))
      .sort((a, b) => parseInt(b[1] ?? '0') - parseInt(a[1] ?? '0'))[0]?.[0];
    add(largest ?? src, '', match.index ?? 0, 'img', `${attr(tag, 'alt') ?? ''} ${attr(tag, 'title') ?? ''}`);
  }
  // Navigation carried as JSON props (Vue/React/TYPO3 menus): {"title":"Site Plan","link":"\/fair\/en\/site-plan\/"}.
  const json = decodeEntities(source);
  for (const match of Array.from(json.matchAll(/"(?:link|url|href|path|to|uri)"\s*:\s*"((?:https?:)?\\?\/[^"\s]{0,300})"/gi))) {
    const index = match.index ?? 0;
    const titles = Array.from(json.slice(Math.max(0, index - 300), index).matchAll(/"(?:title|label|text|name|headline)"\s*:\s*"([^"]{1,120})"/gi));
    const title = titles.length ? titles[titles.length - 1][1] : '';
    const href = match[1].replace(/\\\//g, '/');
    if (href.startsWith('//') || /\.(?:css|js|json|ico|svg|woff2?)(?:$|\?)/i.test(href)) continue;
    add(href, title.replace(/\\u([0-9a-f]{4})/gi, (_, code: string) => String.fromCharCode(parseInt(code, 16))), index, 'a');
  }
  // Images a page shows without an <img>: preloads, CSS backgrounds, lazy-load attributes.
  for (const match of Array.from(source.matchAll(/<link\b[^>]*\bas\s*=\s*["']?image[^>]*>/gi))) {
    add(attr(match[0], 'href'), '', match.index ?? 0, 'bg');
  }
  for (const match of Array.from(source.matchAll(/background(?:-image)?\s*:\s*url\(\s*["']?([^"')]+)["']?\s*\)/gi))) {
    add(match[1], '', match.index ?? 0, 'bg');
  }
  for (const match of Array.from(source.matchAll(/\bdata-(?:bg|background|background-image|image|full|large_image|zoom-image)\s*=\s*["']([^"']+)["']/gi))) {
    add(match[1], '', match.index ?? 0, 'bg');
  }
  for (const match of Array.from(source.matchAll(/<(iframe|embed|object)\b[^>]*>/gi))) {
    add(attr(match[0], 'src') ?? attr(match[0], 'data') ?? attr(match[0], 'data-src'), attr(match[0], 'title') ?? '', match.index ?? 0, 'frame');
  }
  for (const match of Array.from(source.matchAll(/https?:(?:\\?\/){2}(?:[^"'\s<>()\\]|\\\/)+?\.(?:pdf|png|jpe?g|webp)(?=["'\s<>)?\\])/gi))) {
    const url = match[0].replace(/\\\//g, '/');
    add(url, '', match.index ?? 0, 'raw');
  }
  return links;
}

/**
 * What an HTML page says it is: its <title>, og:title and <h1>s. A page's body
 * may list every city's plan (an index page); its headline is about the page.
 */
export function pageHeadline(html: string): string | null {
  const parts = [
    html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1],
    html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["']/i)?.[1],
    ...Array.from(html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)).map((match) => match[1]),
  ];
  const text = decodeEntities(parts.filter(Boolean).join(' | ').replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
  return text || null;
}

/** Whether a response forbids being shown in another site's frame. */
export function blocksFraming(headers: Record<string, string>) {
  const frameOptions = (headers['x-frame-options'] ?? '').toLowerCase();
  if (frameOptions.includes('deny') || frameOptions.includes('sameorigin')) return true;
  const ancestors = (headers['content-security-policy'] ?? '').match(/frame-ancestors([^;]*)/i)?.[1]?.trim();
  return ancestors !== undefined && !/(^|\s)\*(\s|$)/.test(ancestors);
}

// --- Images ---------------------------------------------------------------------

/** Width and height from a PNG, GIF, JPEG or WebP file's first bytes; null when unknown. */
export function imageSize(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.length >= 24 && buffer.readUInt32BE(0) === 0x89504e47) return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  if (buffer.length >= 10 && buffer.toString('latin1', 0, 3) === 'GIF') return { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
  if (buffer.length >= 30 && buffer.toString('latin1', 0, 4) === 'RIFF' && buffer.toString('latin1', 8, 12) === 'WEBP') {
    const chunk = buffer.toString('latin1', 12, 16);
    if (chunk === 'VP8X') return { width: 1 + buffer.readUIntLE(24, 3), height: 1 + buffer.readUIntLE(27, 3) };
    if (chunk === 'VP8 ') return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
    if (chunk === 'VP8L') {
      const bits = buffer.readUInt32LE(21);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
  }
  if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) return null;
      const marker = buffer[offset + 1];
      const length = buffer.readUInt16BE(offset + 2);
      // SOF0–SOF15, except DHT (C4), JPG (C8) and DAC (CC).
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
      }
      offset += 2 + length;
    }
  }
  return null;
}

/**
 * Why an image cannot be a readable floor plan (an icon, a thumbnail, a banner
 * strip); null if it can. An image nothing names as a plan must be large, as a
 * plan shown as the page's content is — not a sponsor logo beside it.
 */
export function unlikelyPlanImage(size: { width: number; height: number } | null, unnamed = false) {
  if (!size) return null;
  const { width, height } = size;
  if (unnamed && (width < 800 || height < 500)) return `unnamed image is ${width}×${height} px — too small to be the page's floor plan`;
  if (width < 500 || height < 300) return `image is ${width}×${height} px — too small to be a readable floor plan`;
  const ratio = width / height;
  if (ratio > 3 || ratio < 0.3) return `image is ${width}×${height} px — a banner/strip shape, not a floor plan`;
  return null;
}

/**
 * Whether an image looks like a photo rather than a drawn plan, from how well
 * it compresses: plans are flat colour and thin lines (JPEG ≈ 0.05–0.2 bytes
 * per pixel), photos and promo graphics are not (≈ 0.3–0.6). Used only for
 * images nothing names as a plan.
 */
export function looksLikePhoto(bytes: number, size: { width: number; height: number } | null, contentType: string) {
  if (!size || !bytes) return false;
  const perPixel = bytes / (size.width * size.height);
  if (/png/.test(contentType)) return perPixel > 0.6;
  if (/jpe?g|webp/.test(contentType)) return perPixel > 0.25;
  return false;
}

/** Theme and decoration files ("…/themes/…", "floor-bg-layer.svg"), never plans. */
export const decorationFile = (url: string) => {
  const { pathname } = new URL(url);
  const file = pathname.split('/').pop() ?? '';
  return /\/(?:themes?|skins?|assets\/(?:images|img|icons)|_assets|companies|company|exhibitors?|brands?|logos?|avatars?|profiles?|sponsors?|partners?|speakers?)\//i.test(pathname) || /(?:^|[-_ .])(bg|layer|background|pattern|texture|decor|shape|overlay|mask)(?:[-_ .]|$)/i.test(file);
};

/** File names cameras and galleries give photos ("img03.jpg", "DSC_1234", "IMG_5521"). */
export const photoFileName = (url: string) =>
  /(?:^|\/)(?:img|image|dsc|dscn|dscf|imgp|photo|pic|picture|p|_mg|mg|gopr|pxl)[-_ ]?\d+[^/]*$/i.test(new URL(url).pathname);

/** The full-size original of a WordPress/CMS resized variant ("plan-724x1024.png", "plan-scaled.jpg" → "plan.png"). */
export function originalImageUrl(url: string) {
  return url.replace(/-(?:\d{2,5}x\d{2,5}|scaled)(\.(?:png|jpe?g|gif|webp))(?=$|[?#])/i, '$1');
}

// --- Sitemaps, WordPress, search results ------------------------------------

/** <loc> entries of a sitemap or sitemap index. */
export function sitemapLocations(xml: string) {
  return Array.from(xml.matchAll(/<loc>\s*(?:<!\[CDATA\[)?([^<\]]+?)(?:\]\]>)?\s*<\/loc>/gi)).map((match) => decodeEntities(match[1].trim()));
}

export const robotsSitemaps = (robots: string) =>
  Array.from(robots.matchAll(/^\s*sitemap:\s*(\S+)/gim)).map((match) => match[1]);

export type WordPressMedia = { url: string; title: string; date: string | null; page: string | null };

/** Items of a WordPress /wp-json/wp/v2/media response. */
export function wordPressMedia(json: unknown): WordPressMedia[] {
  if (!Array.isArray(json)) return [];
  return json.flatMap((item) => {
    const record = item as { source_url?: string; title?: { rendered?: string } | string; date?: string; link?: string };
    if (!record?.source_url) return [];
    const title = typeof record.title === 'string' ? record.title : record.title?.rendered ?? '';
    return [{ url: record.source_url, title: decodeEntities(title.replace(/<[^>]+>/g, ' ')), date: record.date ?? null, page: record.link ?? null }];
  });
}

export type SearchResult = { url: string; title: string; snippet: string };

/** Results of a DuckDuckGo HTML results page. */
export function duckDuckGoResults(html: string): SearchResult[] {
  const results: SearchResult[] = [];
  const blocks = html.split(/<div[^>]+class="[^"]*\bresult\b/).slice(1);
  for (const block of blocks) {
    const anchor = block.match(/<a[^>]+class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
    if (!anchor) continue;
    let url = decodeEntities(anchor[1]);
    const redirect = url.match(/[?&]uddg=([^&]+)/);
    if (redirect) url = decodeURIComponent(redirect[1]);
    if (url.startsWith('//')) url = `https:${url}`;
    if (!/^https?:/i.test(url) || /duckduckgo\.com\/y\.js/.test(url)) continue;
    const snippet = block.match(/class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/)?.[1] ?? '';
    results.push({ url, title: stripTags(anchor[2]), snippet: stripTags(snippet) });
  }
  return results;
}

// --- The event edition ------------------------------------------------------

const CITY_ALIASES: string[][] = [
  ['munich', 'munchen', 'muenchen'], ['cologne', 'koln', 'koeln'], ['nuremberg', 'nurnberg', 'nuernberg'], ['dusseldorf', 'duesseldorf'],
  ['frankfurt', 'frankfurt am main'], ['hanover', 'hannover'], ['vienna', 'wien'], ['zurich', 'zuerich'], ['geneva', 'geneve', 'genf'], ['basel', 'bale'],
  ['milan', 'milano'], ['rome', 'roma'], ['turin', 'torino'], ['florence', 'firenze'], ['naples', 'napoli'], ['venice', 'venezia'], ['genoa', 'genova'], ['padua', 'padova'],
  ['brussels', 'bruxelles', 'brussel'], ['antwerp', 'antwerpen', 'anvers'], ['ghent', 'gent'], ['the hague', 'den haag'], ['lisbon', 'lisboa'], ['porto', 'oporto'],
  ['seville', 'sevilla'], ['saragossa', 'zaragoza'], ['warsaw', 'warszawa'], ['krakow', 'cracow'], ['poznan'], ['gdansk'], ['wroclaw'], ['lodz'],
  ['prague', 'praha', 'prag'], ['brno'], ['bratislava'], ['budapest'], ['bucharest', 'bucuresti'], ['belgrade', 'beograd'], ['sofia'],
  ['athens', 'athina'], ['thessaloniki', 'salonica'], ['copenhagen', 'kobenhavn'], ['gothenburg', 'goteborg'], ['stockholm'], ['helsinki', 'helsingfors'],
  ['moscow', 'moskva', 'москва'], ['saint petersburg', 'st petersburg', 'санкт петербург'], ['kyiv', 'kiev', 'київ', 'киев'], ['istanbul'],
  ['mumbai', 'bombay'], ['bengaluru', 'bangalore'], ['chennai', 'madras'], ['kolkata', 'calcutta'], ['new delhi', 'delhi'], ['greater noida', 'noida'],
  ['ho chi minh city', 'ho chi minh', 'hcmc', 'saigon'], ['hanoi', 'ha noi'], ['beijing', 'peking', '北京'], ['shanghai', '上海'], ['guangzhou', 'canton', '广州'],
  ['shenzhen', '深圳'], ['hong kong', '香港'], ['taipei', '台北'], ['tokyo', '東京'], ['osaka', '大阪'], ['nagoya', '名古屋'], ['yokohama', '横浜'], ['chiba', '幕張', 'makuhari'],
  ['seoul', '서울'], ['busan', '부산'], ['goyang', '고양'], ['bangkok', 'กรุงเทพ'], ['kuala lumpur', 'kl'], ['jakarta'], ['singapore'],
  ['mexico city', 'ciudad de mexico', 'cdmx'], ['sao paulo'], ['rio de janeiro'], ['new york', 'nyc'], ['las vegas'], ['washington', 'washington dc'],
  ['dubai'], ['abu dhabi'], ['riyadh'], ['doha'], ['cairo'], ['tehran'], ['johannesburg', 'joburg'], ['cape town'],
];

/** Words too generic to identify an event by its name. */
const NAME_STOPWORDS = new Set(
  (
    'the of and for in on at to a an de du des la le les el los las der die das und et y e di del della dei van het en il i ' +
    'international internationale internacional internazionale int intl annual global world expo expos exhibition exhibitions exhibit ' +
    'fair fairs trade trades show shows conference conferences congress summit forum salon salao feria feira messe fiera festival week ' +
    'event events edition meeting convention symposium days day exposition mostra targi veletrh vasar beurs mässa messen fuari ' +
    'b2b b2c industry industries business new national regional'
  ).split(' ')
);
const VENUE_STOPWORDS = new Set(
  (
    'the of and de du des la le el der die das et y e di del centre center centro zentrum exhibition exhibitions convention conventions ' +
    'congress congres congresso conference hall halls fairground fairgrounds exhibition ground grounds expo messe fiera feria fira park complex ' +
    'international internationale internacional arena palais palace palazzo palacio pavilion pavilhao venue building auditorium stadium ' +
    'hotel resort city trade and events event square plaza'
  ).split(' ')
);

export type EditionProfile = {
  year: string;
  start: { year: number; month: number; day: number };
  /** Last day's year and month (the start's when the catalog has no end date). */
  end: { year: number; month: number };
  /** Normalized spellings of the event's city. */
  cityTerms: string[];
  venueTokens: string[];
  /** Short forms that name the venue on their own: "MCEC", "SNIEC", "ICC". */
  venueAcronyms: string[];
  nameTokens: string[];
  /** Whether the name identifies the edition: false when another city's edition shares the site. */
  nameIdentifies: boolean;
  /** Cities of the site's other editions. */
  otherCities: string[];
  knownCities: ReadonlySet<string> | null;
  /** Words that are part of the event's or venue's own name, so never "another city". */
  ownWords: Set<string>;
  /** Months between editions. */
  intervalMonths: number;
  sameCityYearEditions: number;
};

/** "Las Vegas" from "Las Vegas, NV" or "Frankfurt (Germany)": the part of the catalog city a plan would print. */
export function cityName(city: string) {
  return normalize(city.split(/[,(]/)[0]);
}

/** Normalized spellings of a catalog city: its name plus known aliases ("Hannover" / "Hanover"). */
export function cityTermsFor(city: string) {
  const name = cityName(city);
  if (!name) return [];
  const group = CITY_ALIASES.find((aliases) => aliases.some((alias) => normalize(alias) === name));
  return Array.from(new Set([name, ...(group ?? []).map(normalize)]));
}

const acronymOf = (tokens: string[]) => (tokens.length >= 2 ? tokens.map((token) => token[0]).join('') : null);

export function editionProfile(event: FloorPlanEvent): EditionProfile {
  const [year, month, day] = event.startDate.split('-').map(Number);
  const cityTerms = cityTermsFor(event.city);
  const nameTokens = normalize(event.name)
    .split(' ')
    .filter((token) => token.length >= 3 && !NAME_STOPWORDS.has(token) && !/^\d+(st|nd|rd|th|e|er|eme|a|o)?$/.test(token) && !cityTerms.includes(token));
  const venue = event.venue && event.venue !== '?' ? normalize(event.venue) : '';
  const venueAll = venue.split(' ').filter(Boolean);
  const venueTokens = venueAll.filter((token) => token.length >= 3 && !VENUE_STOPWORDS.has(token) && !cityTerms.includes(token));
  // "MCEC" for Melbourne Convention and Exhibition Centre (initials of the name before any " - SNIEC"/"(…)" suffix),
  // and any all-caps word the catalog writes itself: "SNIEC", "ICC", "NEC", "ADNEC", "DWTC".
  const venueAcronyms = (() => {
    const raw = event.venue && event.venue !== '?' ? event.venue : '';
    const initials = [raw, raw.split(/\s[-–(]\s?|\(/)[0]].map((part) =>
      acronymOf(normalize(part).split(' ').filter((token) => token && !['and', 'of', 'the', 'de', 'et', 'y'].includes(token)))
    );
    const written = (raw.match(/\b[A-Z]{3,6}\b/g) ?? []).map((word) => word.toLowerCase());
    return Array.from(new Set([...initials, ...written])).filter(
      (acronym): acronym is string => Boolean(acronym && acronym.length >= 3 && acronym.length <= 6)
    );
  })();
  const ownCity = new Set(cityTerms);
  const otherCities = Array.from(
    new Set((event.otherCities ?? []).flatMap(cityTermsFor).filter((term) => term && !ownCity.has(term)))
  );
  const ownWords = new Set([...normalize(event.name).split(' '), ...venueAll]);
  return {
    year: String(year),
    start: { year, month, day },
    end: (() => {
      const [endYear, endMonth] = (event.endDate || event.startDate).split('-').map(Number);
      return { year: endYear, month: endMonth };
    })(),
    cityTerms,
    venueTokens,
    venueAcronyms,
    nameTokens,
    nameIdentifies: nameTokens.length > 0 && otherCities.length === 0,
    otherCities,
    knownCities: event.knownCities ?? null,
    ownWords,
    intervalMonths: editionIntervalMonths(event.frequency),
    sameCityYearEditions: event.sameCityYearEditions ?? 0,
  };
}

// --- Evidence ---------------------------------------------------------------

export type Evidence = {
  /** Names the edition's year. */
  year: boolean;
  /** Prints the edition's start date. */
  dates: boolean;
  city: boolean;
  venue: boolean;
  name: boolean;
  /** Edition years named that are not this edition's. */
  otherYears: string[];
  /** Short texts: months named together with this edition's year that are 2+ months from the edition ("June 2026" for August). */
  otherMonths: string[];
  /** Short texts: this edition's month named with its year ("August 2026"). */
  month?: boolean;
  /** Other cities named (and not this one's). */
  otherCities: string[];
  /** Long texts: how often each year is printed. */
  yearCounts?: Record<string, number>;
};

const MONTH_NAMES: string[][] = [
  ['january', 'jan', 'januar', 'janvier', 'enero', 'gennaio', 'janeiro', 'januari', 'stycznia', 'leden', 'ledna', 'ianuarie', 'ocak', 'январь', 'января'],
  ['february', 'feb', 'februar', 'fevrier', 'febrero', 'febbraio', 'fevereiro', 'februari', 'lutego', 'unor', 'unora', 'februarie', 'subat', 'февраль', 'февраля'],
  ['march', 'mar', 'marz', 'maerz', 'mars', 'marzo', 'marco', 'maart', 'marca', 'brezen', 'brezna', 'martie', 'mart', 'март', 'марта'],
  ['april', 'apr', 'avril', 'abril', 'aprile', 'kwietnia', 'duben', 'dubna', 'aprilie', 'nisan', 'апрель', 'апреля'],
  ['may', 'mai', 'mayo', 'maggio', 'maio', 'mei', 'maja', 'kveten', 'kvetna', 'mayis', 'май', 'мая'],
  ['june', 'jun', 'juni', 'juin', 'junio', 'giugno', 'junho', 'czerwca', 'cerven', 'cervna', 'iunie', 'haziran', 'июнь', 'июня'],
  ['july', 'jul', 'juli', 'juillet', 'julio', 'luglio', 'julho', 'lipca', 'cervenec', 'cervence', 'iulie', 'temmuz', 'июль', 'июля'],
  ['august', 'aug', 'aout', 'agosto', 'augustus', 'sierpnia', 'srpen', 'srpna', 'august', 'agustos', 'август', 'августа'],
  ['september', 'sep', 'sept', 'septembre', 'septiembre', 'settembre', 'setembro', 'wrzesnia', 'zari', 'septembrie', 'eylul', 'сентябрь', 'сентября'],
  ['october', 'oct', 'oktober', 'octobre', 'octubre', 'ottobre', 'outubro', 'pazdziernika', 'rijen', 'rijna', 'octombrie', 'ekim', 'октябрь', 'октября'],
  ['november', 'nov', 'novembre', 'noviembre', 'novembro', 'listopadu', 'listopada', 'listopad', 'noiembrie', 'kasim', 'ноябрь', 'ноября'],
  ['december', 'dec', 'dezember', 'decembre', 'diciembre', 'dicembre', 'dezembro', 'grudnia', 'prosinec', 'prosince', 'decembrie', 'aralik', 'декабрь', 'декабря'],
];
const MONTH_WORD = new Map<string, number>(MONTH_NAMES.flatMap((names, index) => names.map((name) => [name, index + 1] as [string, number])));

const YEAR_PATTERN = /(?<!\d)(20[1-3]\d)(?!\d)/g;

/**
 * Years a text names as edition years. In short texts (URLs, titles, link
 * text) every year counts; in long ones (a plan's text is full of stand numbers
 * like "2026"), only years printed next to a month, a date, or the event name.
 */
function editionYears(normalized: string, raw: string, profile: EditionProfile, long: boolean) {
  const years = new Set<string>();
  if (!long) {
    for (const match of Array.from(normalized.matchAll(YEAR_PATTERN))) years.add(match[1]);
    return Array.from(years);
  }
  const tokens = normalized.split(' ');
  tokens.forEach((token, index) => {
    const year = token.match(/^(20[1-3]\d)(?:年)?$/)?.[1];
    if (!year) return;
    const window = tokens.slice(Math.max(0, index - 5), index + 3);
    const nearMonth = window.some((word) => MONTH_WORD.has(word) || /^\d{1,2}月$/.test(word));
    const nearName = tokens.slice(Math.max(0, index - 6), index + 4).some((word) => profile.nameTokens.includes(word));
    if (nearMonth || nearName) years.add(year);
  });
  for (const match of Array.from(raw.matchAll(/(?<!\d)\d{1,2}[./-]\d{1,2}[./-](20[1-3]\d)(?!\d)|(?<!\d)(20[1-3]\d)[./-]\d{1,2}[./-]\d{1,2}(?!\d)|(20[1-3]\d)\s*年/g))) {
    years.add(match[1] ?? match[2] ?? match[3]);
  }
  return Array.from(years);
}

/** Whether a text prints the edition's start date (day and month, with the year nearby). */
export function namesEditionDates(text: string, profile: EditionProfile) {
  const { year, month, day } = profile.start;
  const tokens = normalize(text).split(' ');
  for (let index = 0; index < tokens.length; index++) {
    const monthNumber = MONTH_WORD.get(tokens[index]);
    if (monthNumber !== month) continue;
    const before = tokens.slice(Math.max(0, index - 4), index);
    const after = tokens.slice(index + 1, index + 4);
    const dayNear = [...before, ...after].some((token) => token.replace(/(st|nd|rd|th|er|e)$/, '') === String(day));
    const yearNear = tokens.slice(index + 1, index + 8).includes(String(year)) || tokens.slice(Math.max(0, index - 8), index).includes(String(year));
    if (dayNear && yearNear) return true;
  }
  const dd = String(day).padStart(2, '0');
  const mm = String(month).padStart(2, '0');
  const numeric = [
    `(?<!\\d)0?${day}[./]0?${month}[./](?:${year}|${String(year).slice(2)})(?!\\d)`,
    `(?<!\\d)${year}[-./]${mm}[-./]${dd}(?!\\d)`,
    `(?<!\\d)0?${month}/0?${day}/${year}(?!\\d)`,
    `${year}\\s*年\\s*0?${month}\\s*月\\s*0?${day}\\s*日`,
    `(?<!\\d)0?${month}\\s*月\\s*0?${day}\\s*日`,
    `${year}\\s*년\\s*0?${month}\\s*월\\s*0?${day}\\s*일`,
  ];
  return numeric.some((pattern) => new RegExp(pattern).test(text));
}

function namesCity(normalized: string, profile: EditionProfile) {
  return profile.cityTerms.some((term) => hasTerm(normalized, term));
}

function namesVenue(normalized: string, profile: EditionProfile) {
  if (profile.venueAcronyms.some((acronym) => hasWord(normalized, acronym))) return true;
  const { venueTokens } = profile;
  if (!venueTokens.length) return false;
  const found = venueTokens.filter((token) => hasWord(normalized, token)).length;
  return venueTokens.length <= 2 ? found === venueTokens.length && venueTokens.some((token) => token.length >= 4) : found / venueTokens.length >= 0.6;
}

function namesEvent(normalized: string, profile: EditionProfile) {
  const { nameTokens } = profile;
  if (!nameTokens.length) return false;
  const compact = normalized.replace(/ /g, '');
  const found = nameTokens.filter((token) => hasWord(normalized, token) || (token.length >= 5 && compact.includes(token))).length;
  return nameTokens.length <= 2 ? found === nameTokens.length : found / nameTokens.length >= 0.6;
}

function otherCitiesNamed(normalized: string, profile: EditionProfile, short: boolean) {
  const named = new Set<string>();
  const own = new Set(profile.cityTerms);
  for (const city of profile.otherCities) {
    if (!own.has(city) && !profile.ownWords.has(city) && hasTerm(normalized, city)) named.add(city);
  }
  // Any catalog city, but only in short texts (a URL, a title) where a city word is deliberate.
  if (short && profile.knownCities) {
    const tokens = normalized.split(' ');
    for (let size = 1; size <= 3; size++) {
      for (let index = 0; index + size <= tokens.length; index++) {
        const phrase = tokens.slice(index, index + size).join(' ');
        if (phrase.length < 4 || own.has(phrase) || COMMON_WORDS.has(phrase)) continue;
        if (phrase.split(' ').some((word) => profile.ownWords.has(word))) continue;
        if (profile.knownCities.has(phrase)) named.add(phrase);
      }
    }
  }
  // "Frankfurt" inside "Frankfurt am Main" is still this city.
  return Array.from(named).filter((city) => !profile.cityTerms.some((term) => term.includes(city) || city.includes(term)));
}

/** City names that are also everyday words in link text and file names. */
const COMMON_WORDS = new Set(
  (
    'plan plans floor hall halls expo show fair home page open download pdf file view more news main north south east west central ' +
    'city center centre park port bath mobile split nice reading march may august victoria orange marion union liberty ' +
    'lincoln jackson franklin clinton salem florence alexandria hamilton independence columbia sale best early late welcome ' +
    'image images media upload uploads content files assets static site guide manual kit summer winter spring autumn fall ' +
    'gallery booking stand stands booth exhibitor exhibitors visitor visitors venue program programme info general'
  ).split(' ')
);

/** File-name year codes like "HHFL26" or "26CO_Hallenplan": this edition's two-digit year glued to letters. */
function namesYearCode(normalized: string, profile: EditionProfile) {
  return yearCodes(normalized, profile).includes(profile.year);
}

/** Edition years written as file-name codes ("ATA26", "26CO"), within four years of this edition. */
function yearCodes(normalized: string, profile: EditionProfile) {
  const years = new Set<string>();
  const base = Number(profile.year);
  for (const token of normalized.split(' ')) {
    const yy = token.match(/^[a-z]{2,8}(\d{2})$/)?.[1] ?? token.match(/^(\d{2})[a-z]{2,8}$/)?.[1];
    if (!yy) continue;
    const year = 2000 + Number(yy);
    if (Math.abs(year - base) <= 4) years.add(String(year));
  }
  return Array.from(years);
}

const MONTH_TITLES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "June 2026" in a file name for an August 2026 edition: another edition in the same year (phases, seasons). */
function otherMonthsNamed(normalized: string, profile: EditionProfile) {
  const tokens = normalized.split(' ');
  const found = new Set<string>();
  tokens.forEach((token, index) => {
    const month = MONTH_WORD.get(token);
    if (!month || token.length < 3) return;
    const near = tokens.slice(Math.max(0, index - 3), index + 4);
    // With this year ("June 2026") or as a date ("27 feb", "feb 27"): a day number right beside the month.
    const day = [tokens[index - 1], tokens[index + 1]].find((word) => word && /^(?:0?[1-9]|[12]\d|3[01])(?:st|nd|rd|th|er)?$/.test(word));
    if (!near.includes(profile.year) && !day) return;
    const first = profile.start.month;
    const last = profile.end.year > profile.start.year ? profile.end.month + 12 : profile.end.month;
    const distance = month < first ? first - month : month > last ? month - last : 0;
    if (distance >= 2) found.add(near.includes(profile.year) ? `${MONTH_TITLES[month - 1]} ${profile.year}` : `${parseInt(day!, 10)} ${MONTH_TITLES[month - 1]}`);
  });
  return Array.from(found);
}

/** "August 2026" (or the month the edition ends in) in a short text. */
function namesEditionMonth(normalized: string, profile: EditionProfile) {
  const tokens = normalized.split(' ');
  return tokens.some((token, index) => {
    const month = MONTH_WORD.get(token);
    if (!month || token.length < 3 || (month !== profile.start.month && month !== profile.end.month)) return false;
    return tokens.slice(Math.max(0, index - 3), index + 4).includes(profile.year);
  });
}

export function readEvidence(text: string, profile: EditionProfile, options: { long?: boolean } = {}): Evidence {
  const normalized = normalize(text);
  const years = editionYears(normalized, text, profile, Boolean(options.long));
  const counts: Record<string, number> = {};
  if (options.long) {
    for (const match of Array.from(normalized.matchAll(YEAR_PATTERN))) counts[match[1]] = (counts[match[1]] ?? 0) + 1;
  }
  return {
    yearCounts: counts,
    year: years.includes(profile.year) || (!options.long && namesYearCode(normalized, profile)),
    dates: namesEditionDates(text, profile),
    city: namesCity(normalized, profile),
    venue: namesVenue(normalized, profile),
    name: namesEvent(normalized, profile),
    otherYears: Array.from(new Set([...years, ...(options.long ? [] : yearCodes(normalized, profile))])).filter((year) => year !== profile.year),
    otherCities: otherCitiesNamed(normalized, profile, !options.long),
    otherMonths: options.long ? [] : otherMonthsNamed(normalized, profile),
    month: !options.long && namesEditionMonth(normalized, profile),
  };
}

// --- The verdict ------------------------------------------------------------

export type CandidateEvidence = {
  kind: FloorPlanKind;
  /** 'plan': linked as a floor plan; 'document': a manual/guide that must itself contain the plan. */
  role: 'plan' | 'document';
  /** URL and link text. */
  link: string;
  /** Alt text and the words around the link: supporting evidence only, never overriding the link itself. */
  near?: string;
  /** What the plan says in its title/metadata/headline (short), and its body text (long), when readable. */
  contentTitle?: string | null;
  contentBody?: string | null;
  /** The source page's URL and headline. */
  page: string;
  /** The source page's visible text, read only for this edition's printed dates. */
  pageBody?: string | null;
  /** When the file was made (PDF metadata, Last-Modified, upload folder). */
  fileDate?: string | null;
  /** The upload folder's month ("/uploads/2026/09/"), from the URL: when the organizer put it online. */
  uploadDate?: string | null;
  /** A this-year URL made from another edition's plan location. */
  lead?: boolean;
};

/** Whether a file made in `fileDate` predates this edition's previous edition (so is that edition's). */
export function predatesPreviousEdition(fileDate: string | null | undefined, profile: EditionProfile) {
  if (!fileDate) return false;
  const months = monthsBefore(fileDate, profile);
  return months !== null && months >= profile.intervalMonths - 1;
}

/** Months between editions, from the catalog's frequency ("annual", "every 2 years", "twice a year"). */
export function editionIntervalMonths(frequency: string | undefined) {
  const text = normalize(frequency ?? '');
  if (/twice a year|semi annual|biannual|2 times a year|every 6 months/.test(text)) return 6;
  if (/every 2 years|biennial|every two years|2 yearly/.test(text)) return 24;
  if (/every 3 years|triennial|every three years/.test(text)) return 36;
  if (/every 4 years|quadrennial/.test(text)) return 48;
  if (/quarterly|4 times a year/.test(text)) return 3;
  return 12;
}

export type Verdict = {
  accept: boolean;
  reason: string;
  evidence: string[];
  strength: 'content' | 'link' | 'page' | null;
};

const list = (items: string[]) => items.map((item) => item.replace(/\b\w/g, (letter) => letter.toUpperCase())).join(', ');

function describe(layer: string, evidence: Evidence, profile: EditionProfile) {
  const found: string[] = [];
  if (evidence.dates) found.push(`${layer} prints the edition dates`);
  if (evidence.year) found.push(`${layer} names ${profile.year}`);
  if (evidence.city) found.push(`${layer} names ${list([profile.cityTerms[0]])}`);
  if (evidence.venue) found.push(`${layer} names the venue`);
  if (evidence.name) found.push(`${layer} names the event`);
  return found;
}

/** Months between a file's date and the edition's start. */
function monthsBefore(fileDate: string, profile: EditionProfile) {
  const match = fileDate.match(/(20\d{2})-?(\d{2})/);
  if (!match) return null;
  return (profile.start.year - Number(match[1])) * 12 + (profile.start.month - Number(match[2]));
}

/**
 * Whether a candidate is this edition's floor plan, and why. Contradictions
 * reject outright; otherwise the combined layers must name the year (or the
 * dates) and identify the event.
 */
export function judgeCandidate(candidate: CandidateEvidence, profile: EditionProfile): Verdict {
  const content = [candidate.contentTitle, candidate.contentBody].some((text) => text && text.trim());
  const contentTitle = readEvidence(candidate.contentTitle ?? '', profile);
  const contentBody = readEvidence(candidate.contentBody ?? '', profile, { long: true });
  // A document printing several of the organizer's cities (a tour schedule, a list of shows) names this city
  // without being about it.
  if (contentBody.otherCities.length >= 2) {
    contentBody.city = false;
    contentBody.venue = false;
  }
  const contentEv: Evidence = {
    year: contentTitle.year || contentBody.year,
    dates: contentTitle.dates || contentBody.dates,
    city: contentTitle.city || contentBody.city,
    venue: contentTitle.venue || contentBody.venue,
    name: contentTitle.name || contentBody.name,
    otherYears: Array.from(new Set([...contentTitle.otherYears, ...contentBody.otherYears])),
    otherCities: Array.from(new Set([...contentTitle.otherCities, ...contentBody.otherCities])),
    otherMonths: contentTitle.otherMonths,
  };
  const ownLinkEv = readEvidence(candidate.link, profile);
  // Words around the link help only when they name no other edition (an index of every city's plans does),
  // and never outweigh what the link itself says.
  const nearEv = candidate.near ? readEvidence(candidate.near, profile) : null;
  const usableNear = nearEv && !nearEv.otherYears.length && !nearEv.otherCities.length ? nearEv : null;
  const linkEv: Evidence = usableNear
    ? {
        ...ownLinkEv,
        year: ownLinkEv.year || (!ownLinkEv.otherYears.length && usableNear.year),
        dates: ownLinkEv.dates || usableNear.dates,
        city: ownLinkEv.city || (!ownLinkEv.otherCities.length && usableNear.city),
        venue: ownLinkEv.venue || usableNear.venue,
        name: ownLinkEv.name || usableNear.name,
      }
    : ownLinkEv;
  const pageEv = readEvidence(candidate.page, profile);
  const pageDates = candidate.pageBody ? namesEditionDates(candidate.pageBody, profile) : false;

  if (candidate.role === 'document') {
    const mentions = floorPlanMentions(`${candidate.contentTitle ?? ''} ${candidate.contentBody ?? ''}`);
    if (!candidate.contentBody) return { accept: false, reason: 'document text unreadable, cannot tell whether it contains a floor plan', evidence: [], strength: null };
    if (mentions < 2) return { accept: false, reason: 'document does not contain a floor plan', evidence: [], strength: null };
  }

  // Contradictions: the plan (or its link) is for another edition or another city.
  const identifies = (evidence: Evidence) => evidence.city || evidence.venue || evidence.dates;
  // Uploaded after this edition ended: a later edition's (or another city's later show's) plan.
  if (candidate.uploadDate) {
    const [uploadYear, uploadMonth] = candidate.uploadDate.split('-').map(Number);
    if (uploadYear * 12 + uploadMonth > profile.end.year * 12 + profile.end.month) {
      return { accept: false, reason: `file was uploaded in ${candidate.uploadDate}, after this edition took place`, evidence: [], strength: null };
    }
  }
  const otherMonths = [...ownLinkEv.otherMonths, ...contentEv.otherMonths];
  if (otherMonths.length && !contentEv.dates && !ownLinkEv.dates) {
    return {
      accept: false,
      reason: `names ${otherMonths[0]}, but this edition is in ${MONTH_TITLES[profile.start.month - 1]} ${profile.year} (another edition that year)`,
      evidence: [],
      strength: null,
    };
  }
  if (content && contentEv.otherYears.length && !contentEv.year && !contentEv.dates) {
    return { accept: false, reason: `plan's own text is for ${contentEv.otherYears.join('/')}, not ${profile.year}`, evidence: [], strength: null };
  }
  // A plan printing several edition years ("2026 … see you in 2027") is the edition its title names, or the one it prints most.
  if (content && contentEv.otherYears.length && !contentTitle.year) {
    const counts = contentBody.yearCounts ?? {};
    const ours = counts[profile.year] ?? 0;
    const dominant = contentEv.otherYears.find((year) => (counts[year] ?? 0) > ours);
    if (dominant && !contentEv.dates) {
      return { accept: false, reason: `plan's own text is mainly about ${dominant} (${counts[dominant]}× vs ${ours}× ${profile.year})`, evidence: [], strength: null };
    }
  }
  if (content && contentEv.otherCities.length && !identifies(contentEv)) {
    return { accept: false, reason: `plan's own text is for ${list(contentEv.otherCities)}`, evidence: [], strength: null };
  }
  // A link naming only another year is that edition's file, even if it announces this one's dates.
  if (!candidate.lead && linkEv.otherYears.length && !linkEv.year) {
    const counts = contentBody.yearCounts ?? {};
    const contentOnlyOurs = (contentEv.year || contentEv.dates) && linkEv.otherYears.every((year) => !contentEv.otherYears.includes(year) && !counts[year]);
    if (!contentOnlyOurs) return { accept: false, reason: `link is for the ${linkEv.otherYears.join('/')} edition`, evidence: [], strength: null };
  }
  if (linkEv.otherCities.length && !identifies(linkEv) && !identifies(contentEv)) {
    return { accept: false, reason: `link is for ${list(linkEv.otherCities)}`, evidence: [], strength: null };
  }
  if (pageEv.otherCities.length && !identifies(pageEv) && !identifies(linkEv) && !identifies(contentEv)) {
    return { accept: false, reason: `found on a page for ${list(pageEv.otherCities)}`, evidence: [], strength: null };
  }

  const isIdentity = (evidence: Evidence) => evidence.city || evidence.venue || evidence.dates || (profile.nameIdentifies && evidence.name);
  const isYear = (evidence: Evidence) => evidence.year || evidence.dates;
  const evidence = [...describe('plan', contentEv, profile), ...describe('link', linkEv, profile)];

  // The organizer runs other editions in this city this year (the catalog lists them): only this edition's
  // dates or month can say which one a plan is for.
  if (profile.sameCityYearEditions > 0) {
    const pinned = contentEv.dates || linkEv.dates || pageDates || ownLinkEv.month || contentTitle.month || pageEv.month;
    if (!pinned) {
      return {
        accept: false,
        reason: `cannot verify edition: ${profile.sameCityYearEditions + 1} editions in ${profile.cityTerms[0] ?? 'this city'} in ${profile.year} and nothing names this one's dates or month`,
        evidence,
        strength: null,
      };
    }
  }

  // Strong: the plan and its link together name the year and identify the event.
  const yearNear = isYear(contentEv) || isYear(linkEv);
  const identityNear = isIdentity(contentEv) || isIdentity(linkEv);
  if (yearNear && identityNear) {
    const strength = isYear(contentEv) && isIdentity(contentEv) ? 'content' : content && (isYear(contentEv) || isIdentity(contentEv)) ? 'content' : 'link';
    return { accept: true, reason: 'plan names this edition', evidence, strength };
  }

  // Page-supported: the plan says nothing either way; the official page it hangs off is this edition's.
  const pageYear = pageDates || isYear(pageEv);
  const pageIdentity = pageDates || isIdentity(pageEv) || (profile.nameIdentifies && pageEv.name);
  const pageAboutEdition = pageDates || (pageEv.year && (pageEv.city || pageEv.venue || (profile.nameIdentifies && pageEv.name)));
  if (!pageAboutEdition || !(yearNear || pageYear) || !(identityNear || pageIdentity)) {
    const missing = !(yearNear || pageYear) ? `nothing names ${profile.year} or the edition dates` : !(identityNear || pageIdentity) ? 'nothing identifies this city/venue' : 'source page is not about this edition';
    return { accept: false, reason: `cannot verify edition: ${missing}`, evidence, strength: null };
  }
  if (profile.otherCities.length && !(pageEv.city || pageEv.venue || pageDates) && !identityNear) {
    return { accept: false, reason: 'the site runs several cities and neither the plan nor its page names this one', evidence, strength: null };
  }
  // With nothing on the plan itself, a file made before the previous edition took place is that edition's.
  if (candidate.fileDate) {
    const months = monthsBefore(candidate.fileDate, profile);
    if (months !== null && months >= profile.intervalMonths - 1) {
      return { accept: false, reason: `file dates from ${candidate.fileDate.slice(0, 7)}, before the previous edition — likely its plan`, evidence, strength: null };
    }
  }
  const pageEvidence = [...describe('source page', pageEv, profile), ...(pageDates ? ['source page prints the edition dates'] : [])];
  return { accept: true, reason: 'linked as the floor plan from this edition’s official page', evidence: [...evidence, ...pageEvidence], strength: 'page' };
}

/**
 * The same file location for this edition's year: every other-year number in
 * the path swapped — except upload folders ("/uploads/2025/11/"), which date
 * the upload, not the edition.
 */
export function sameLocationForYear(url: string, fromYear: string, toYear: string) {
  const parsed = new URL(url);
  const path = parsed.pathname
    .split(/(\/uploads\/(?:sites\/\d+\/)?20\d{2}\/\d{2}\/)/)
    .map((part) => (/^\/uploads\//.test(part) ? part : part.replace(new RegExp(`(?<!\\d)${fromYear}(?!\\d)`, 'g'), toYear)))
    .join('');
  if (path === parsed.pathname) return null;
  parsed.pathname = path;
  return parsed.toString();
}

/** "/uploads/2025/11/" is when a file was uploaded: a file date, not an edition year. */
export function uploadFolderDate(url: string) {
  const match = url.match(/\/uploads\/(?:sites\/\d+\/)?(20\d{2})\/(\d{2})\//);
  if (match) return `${match[1]}-${match[2]}`;
  // CMSs that name uploads by their Unix time ("static/file/1730254163203111.pdf" → 2024-10).
  const epoch = url.match(/\/(1[4-9]\d{8})\d{0,6}\.(?:pdf|png|jpe?g|gif|webp)(?:$|[?#])/i);
  return epoch ? new Date(Number(epoch[1]) * 1000).toISOString().slice(0, 7) : null;
}

export const withoutUploadFolder = (url: string) => url.replace(/\/(?:19|20)\d{2}\/\d{2}\//g, '/');

// --- What a PDF says --------------------------------------------------------

function unescapePdfString(value: string) {
  return value.replace(/\\(\d{1,3})/g, (_, octal: string) => String.fromCharCode(parseInt(octal, 8))).replace(/\\(.)/g, '$1');
}

function hexString(value: string) {
  const hex = value.replace(/[^0-9a-f]/gi, '');
  // Two-byte (UTF-16/CID) strings are readable only if they look like UTF-16BE text.
  if (hex.length % 4 === 0 && /^(?:00[0-9a-f]{2})+$/i.test(hex)) {
    return hex.match(/.{4}/g)!.map((code) => String.fromCharCode(parseInt(code, 16))).join('');
  }
  return hex.match(/.{2}/g)?.map((code) => String.fromCharCode(parseInt(code, 16))).join('') ?? '';
}

/** The decoded streams of a PDF (Flate-compressed ones inflated). */
function* pdfStreams(buffer: Buffer): Generator<string> {
  const raw = buffer.toString('latin1');
  const streamStart = /stream\r?\n/g;
  let match: RegExpExecArray | null;
  while ((match = streamStart.exec(raw))) {
    const start = match.index + match[0].length;
    const end = raw.indexOf('endstream', start);
    if (end === -1) break;
    try {
      yield inflateSync(buffer.subarray(start, end)).toString('latin1');
    } catch {
      const plain = raw.slice(start, end);
      // Only a stream that is itself text, never image or font bytes that happen to contain "BT…ET".
      if (printableShare(plain) > 0.95) yield plain;
    }
    streamStart.lastIndex = end;
  }
}

/**
 * The text drawn on a PDF's pages: Flate-compressed content streams inflated
 * with Node's zlib, then the strings of each text object joined. Returns null
 * when no readable text comes out (scanned or outlined plans, custom-encoded
 * fonts) — "cannot tell", not "does not match".
 */
export function pdfText(buffer: Buffer): string | null {
  const pieces: string[] = [];
  let total = 0;
  for (const content of Array.from(pdfStreams(buffer))) {
    for (const block of content.match(/BT[\s\S]*?ET/g) ?? []) {
      let line = '';
      for (const token of block.match(/\((?:\\.|[^\\)])*\)|<[0-9a-fA-F\s]+>|TJ|Tj|T\*|Td|TD|'|"/g) ?? []) {
        if (token.startsWith('(')) line += unescapePdfString(token.slice(1, -1));
        else if (token.startsWith('<')) line += hexString(token.slice(1, -1));
        else line += ' ';
      }
      // Custom-encoded fonts yield glyph codes, not letters: drop such fragments.
      if (line.trim() && printableShare(line) > 0.9) {
        pieces.push(line);
        total += line.length;
      }
    }
    if (total > 400_000) break;
  }
  const text = pieces.join(' ').replace(/\s+/g, ' ').trim();
  return isReadable(text) ? text : null;
}

export type PdfMetadata = { title: string | null; created: string | null };

/** The document title and creation/modification date from a PDF's Info dictionary or XMP metadata. */
export function pdfMetadata(buffer: Buffer): PdfMetadata {
  const raw = buffer.toString('latin1');
  const sources = [raw.slice(0, 200_000), raw.slice(-200_000)];
  for (const stream of Array.from(pdfStreams(buffer)).slice(-40)) if (/\/Title|dc:title|CreateDate/.test(stream)) sources.push(stream);
  let title: string | null = null;
  let created: string | null = null;
  for (const text of sources) {
    const infoTitle = text.match(/\/Title\s*(\((?:\\.|[^\\)])*\)|<[0-9a-fA-F\s]+>)/);
    const xmpTitle = text.match(/<dc:title>[\s\S]*?<rdf:li[^>]*>([^<]+)<\/rdf:li>/);
    if (!title && infoTitle) {
      const value = infoTitle[1].startsWith('(') ? unescapePdfString(infoTitle[1].slice(1, -1)) : hexString(infoTitle[1].slice(1, -1));
      const clean = value.replace(/^﻿|^þÿ/, '').replace(/\u0000/g, '').trim();
      if (clean && printableShare(clean) > 0.9) title = clean;
    }
    if (!title && xmpTitle) title = decodeEntities(xmpTitle[1]).trim() || null;
    const modified = text.match(/\/ModDate\s*\(D:(\d{4})(\d{2})/) ?? text.match(/\/CreationDate\s*\(D:(\d{4})(\d{2})/);
    const xmpDate = text.match(/<xmp:(?:ModifyDate|CreateDate)>(\d{4})-(\d{2})/);
    if (!created && (modified || xmpDate)) {
      const found = (modified ?? xmpDate)!;
      created = `${found[1]}-${found[2]}`;
    }
  }
  return { title, created };
}

/** Share of a string that is ordinary printable text. */
function printableShare(text: string) {
  return text.length ? text.replace(/[^\x20-\x7eÀ-ɏͰ-ϿЀ-ӿ\s]/g, '').length / text.length : 0;
}

/** Mostly letters, digits and punctuation, with some real words — not binary noise. */
function isReadable(text: string) {
  if (text.length < 40) return false;
  const words = text.match(/\b[a-z]{3,}\b/gi)?.length ?? 0;
  return printableShare(text) > 0.9 && words >= 5;
}

const MONTHS = 'January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec';

/** Dates as printed on the plan for this year ("1 - 2 August 2026", "May 29-30, 2027"), if any. */
export function editionDates(text: string, year: string) {
  const day = '\\d{1,2}(?:st|nd|rd|th)?';
  const patterns = [
    new RegExp(`${day}(?:\\s*(?:-|–|to)\\s*${day})?\\s+(?:${MONTHS})\\.?(?:\\s*(?:-|–)\\s*${day}\\s+(?:${MONTHS})\\.?)?,?\\s+${year}`, 'i'),
    new RegExp(`(?:${MONTHS})\\.?\\s+${day}(?:\\s*(?:-|–)\\s*${day})?,?\\s+${year}`, 'i'),
  ];
  for (const pattern of patterns) {
    const found = text.match(pattern);
    if (found) return found[0].replace(/\s+/g, ' ').trim();
  }
  return undefined;
}

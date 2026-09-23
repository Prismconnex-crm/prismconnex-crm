/**
 * Country name → ISO 3166-1 alpha-2 → flag emoji.
 *
 * The seed data spells countries as free text ("UAE - United Arab Emirates",
 * "Congo-Kinshasa", "Burma)"), so lookups go through a normalizing key rather
 * than exact strings. A flag emoji is just the country's two ISO letters as
 * regional indicator symbols, which is why the map stores codes and not the
 * emoji themselves — no per-country emoji literals to keep in sync.
 */

/** ISO 3166-1 alpha-2 codes for every country the catalog produces. */
export const COUNTRY_ISO_CODES: Record<string, string> = {
  albania: 'AL',
  algeria: 'DZ',
  angola: 'AO',
  argentina: 'AR',
  armenia: 'AM',
  australia: 'AU',
  austria: 'AT',
  azerbaijan: 'AZ',
  bahamas: 'BS',
  bahrain: 'BH',
  bangladesh: 'BD',
  belarus: 'BY',
  belgium: 'BE',
  benin: 'BJ',
  bhutan: 'BT',
  bolivia: 'BO',
  botswana: 'BW',
  brazil: 'BR',
  bulgaria: 'BG',
  'burkina faso': 'BF',
  burma: 'MM',
  myanmar: 'MM',
  cambodia: 'KH',
  cameroon: 'CM',
  canada: 'CA',
  chile: 'CL',
  china: 'CN',
  colombia: 'CO',
  'congo kinshasa': 'CD',
  'dr congo': 'CD',
  'democratic republic of the congo': 'CD',
  'costa rica': 'CR',
  croatia: 'HR',
  cuba: 'CU',
  'czech republic': 'CZ',
  czechia: 'CZ',
  denmark: 'DK',
  'dominican republic': 'DO',
  ecuador: 'EC',
  egypt: 'EG',
  'el salvador': 'SV',
  salvador: 'SV',
  estonia: 'EE',
  ethiopia: 'ET',
  fiji: 'FJ',
  finland: 'FI',
  france: 'FR',
  georgia: 'GE',
  germany: 'DE',
  ghana: 'GH',
  greece: 'GR',
  guatemala: 'GT',
  'hong kong': 'HK',
  hungary: 'HU',
  iceland: 'IS',
  india: 'IN',
  indonesia: 'ID',
  iran: 'IR',
  iraq: 'IQ',
  ireland: 'IE',
  israel: 'IL',
  italy: 'IT',
  'ivory coast': 'CI',
  'cote d ivoire': 'CI',
  jamaica: 'JM',
  japan: 'JP',
  jordan: 'JO',
  kazakhstan: 'KZ',
  kenya: 'KE',
  kuwait: 'KW',
  kyrgyzstan: 'KG',
  latvia: 'LV',
  lebanon: 'LB',
  libya: 'LY',
  lithuania: 'LT',
  luxembourg: 'LU',
  macao: 'MO',
  macau: 'MO',
  madagascar: 'MG',
  malaysia: 'MY',
  maldives: 'MV',
  mali: 'ML',
  malta: 'MT',
  mauritius: 'MU',
  mexico: 'MX',
  moldova: 'MD',
  monaco: 'MC',
  mongolia: 'MN',
  montenegro: 'ME',
  morocco: 'MA',
  mozambique: 'MZ',
  namibia: 'NA',
  nepal: 'NP',
  netherlands: 'NL',
  'new zealand': 'NZ',
  nigeria: 'NG',
  norway: 'NO',
  oman: 'OM',
  pakistan: 'PK',
  panama: 'PA',
  'papua new guinea': 'PG',
  paraguay: 'PY',
  peru: 'PE',
  philippines: 'PH',
  poland: 'PL',
  portugal: 'PT',
  'puerto rico': 'PR',
  qatar: 'QA',
  romania: 'RO',
  russia: 'RU',
  rwanda: 'RW',
  'saudi arabia': 'SA',
  senegal: 'SN',
  serbia: 'RS',
  seychelles: 'SC',
  singapore: 'SG',
  slovakia: 'SK',
  slovenia: 'SI',
  'south africa': 'ZA',
  'south korea': 'KR',
  'korea south': 'KR',
  'south sudan': 'SS',
  spain: 'ES',
  'sri lanka': 'LK',
  sweden: 'SE',
  switzerland: 'CH',
  syria: 'SY',
  taiwan: 'TW',
  tajikistan: 'TJ',
  tanzania: 'TZ',
  thailand: 'TH',
  togo: 'TG',
  tunisia: 'TN',
  turkey: 'TR',
  turkmenistan: 'TM',
  uganda: 'UG',
  ukraine: 'UA',
  'united arab emirates': 'AE',
  uae: 'AE',
  'united kingdom': 'GB',
  uk: 'GB',
  'great britain': 'GB',
  'united states': 'US',
  usa: 'US',
  uruguay: 'UY',
  uzbekistan: 'UZ',
  venezuela: 'VE',
  vietnam: 'VN',
  zambia: 'ZM',
  zimbabwe: 'ZW',
};

/**
 * Folds a seed country string down to a lookup key: accents stripped, an
 * "XX - Name" prefix dropped ("UAE - United Arab Emirates"), and every other
 * separator flattened to a single space ("Congo-Kinshasa", "Burma)").
 */
export function normalizeCountryKey(country: string): string {
  return country
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/^[a-z.]{2,4}\s+-\s+/, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/** ISO 3166-1 alpha-2 code for a country name, or null when unmapped. */
export function getCountryIsoCode(country: string): string | null {
  const key = normalizeCountryKey(country);
  if (!key) {
    return null;
  }

  // Already an alpha-2 code ("US", "ca") — no country name is two letters.
  if (/^[a-z]{2}$/.test(key)) {
    return key.toUpperCase();
  }

  return COUNTRY_ISO_CODES[key] ?? null;
}

/**
 * Regional indicator pair for an alpha-2 code: 'US' → 🇺🇸. Returns null for
 * anything that is not two ASCII letters.
 */
export function isoCodeToFlagEmoji(isoCode: string): string | null {
  const code = isoCode.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) {
    return null;
  }

  const REGIONAL_INDICATOR_A = 0x1f1e6;
  const LETTER_A = 'A'.charCodeAt(0);

  return String.fromCodePoint(
    REGIONAL_INDICATOR_A + (code.charCodeAt(0) - LETTER_A),
    REGIONAL_INDICATOR_A + (code.charCodeAt(1) - LETTER_A)
  );
}

/**
 * Flag emoji for a country name, or null when there is no ISO code to build
 * one from — "Unknown" from an unparsed venue, or a territory such as Kosovo
 * that has no ISO 3166-1 entry.
 *
 * NOTE: do not render this in the UI. Windows ships no country glyphs in
 * Segoe UI Emoji, so Chrome and Edge there draw 🇺🇸 as the letters "US".
 * Use `getCountryFlagImageUrl` for anything a user sees; this stays for
 * non-visual use (labels, tests, copy-to-clipboard).
 */
export function getCountryFlag(country: string): string | null {
  const isoCode = getCountryIsoCode(country);
  return isoCode ? isoCodeToFlagEmoji(isoCode) : null;
}

/**
 * Flag image for a country, as a PNG keyed by its ISO code — the only way to
 * show a real flag on every platform, since emoji flags do not render on
 * Windows. Returns null when there is no ISO code; callers fall back to the
 * globe icon, as they must anyway when the image itself fails to load.
 *
 * `width` is the CDN's fixed rendition width; 40px covers the 22px slot at 2x.
 */
export function getCountryFlagImageUrl(country: string, width: 20 | 40 | 80 = 40): string | null {
  const isoCode = getCountryIsoCode(country);
  return isoCode ? `https://flagcdn.com/w${width}/${isoCode.toLowerCase()}.png` : null;
}

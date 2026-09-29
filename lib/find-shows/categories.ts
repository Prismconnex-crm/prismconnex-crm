/**
 * The Find Shows industry taxonomy and the classifier that tags each event.
 *
 * Why this exists: data/find-shows-seed.json only stores 13 combined buckets
 * ("Technology & Electronics", ...) produced by plain substring matching when
 * the seed was built — "gas" hit "Las Vegas", "oil" hit "olive oil", "tea" hit
 * "steam". Eventseye's own industry tags were never scraped (see
 * scripts/build-find-shows-seed.mjs), so the stored buckets carry nothing the
 * name and description don't. This module re-derives categories from those two
 * fields with whole-word patterns, so the seed never needs regenerating.
 *
 * Kept pure and dependency-free so the node test environment can exercise it.
 *
 * Patterns are strings compiled with `new RegExp` rather than regex literals:
 * several use lookbehind, which TypeScript rejects in literals under this
 * repo's ES5 target even though every runtime we ship to supports it.
 */

export const FIND_SHOW_CATEGORIES = [
  'Agriculture',
  'Automotive',
  'Beverage',
  'Building',
  'Cloud Computing',
  'Construction',
  'Cybersecurity',
  'Electronics',
  'Energy',
  'Engineering',
  'Environment',
  'Fashion',
  'Food',
  'General',
  'Healthcare',
  'Information Technology',
  'Manufacturing',
  'Medical',
  'Packaging',
  'Plastics',
  'Rubber',
  'Safety',
  'Security',
  'Technology',
  'Textiles',
] as const;

export type FindShowCategoryName = (typeof FIND_SHOW_CATEGORIES)[number];

/** The catch-all for an event no rule recognises. */
export const FALLBACK_CATEGORY: FindShowCategoryName = 'General';

type CategoryRule = {
  category: Exclude<FindShowCategoryName, 'General'>;
  /**
   * Written lower-case and matched against the lower-cased, accent-stripped
   * name + description.
   */
  patterns: string[];
  /**
   * Case-sensitive, for acronyms whose lowercase form is an ordinary word
   * ("IT" vs "it", "AI", "LED" vs "led").
   */
  acronyms?: string[];
  /**
   * Lower-case, matched against the name only. For words that are a clear
   * signal in a show's title but mostly prose in a description ("innovation").
   */
  namePatterns?: string[];
};

const W = '\\b';

const CATEGORY_RULES: CategoryRule[] = [
  {
    category: 'Agriculture',
    patterns: [
      'agricultur\\w*',
      'agri(?:business|tech|food)?',
      'agro\\w*',
      '(?<!(?:wind|solar|server|content|troll|link|click) )farm(?:s|ing|ers?)?',
      'horticultur\\w*',
      'arboricultur\\w*',
      'livestock',
      'poultry',
      'cattle',
      'swine',
      'crops?',
      'seeds?(?! (?:funding|stage|round|capital|investors?|investment))',
      'tractors?',
      'irrigation',
      'fertili[sz]ers?',
      'animal (?:husbandry|production|feed)',
      'aquaculture',
      'fisher(?:y|ies)',
      'forestry',
      'greenhouses?',
      '(?<!(?:square|beer|covent) )garden(?:ing|s)?',
      'grains?',
      'apiculture',
      'beekeeping',
    ],
  },
  {
    category: 'Automotive',
    patterns: [
      'automotive',
      'automobiles?',
      'auto(?: show| expo| parts| salon)',
      'automechanika',
      '(?<!sidecar |cable |tram )cars?',
      'motor ?shows?',
      'vehicles?',
      'motorcycles?',
      'motorbikes?',
      '(?<!food )trucks?',
      'trucking',
      'tyres?',
      'tires?',
      'aftermarket',
      'electric vehicles?',
      'e-?mobility',
      'caravans?',
      'motorhomes?',
      '4 ?[x×] ?4',
      'off-?road',
    ],
    acronyms: ['EVs?', 'RVs?'],
  },
  {
    category: 'Beverage',
    patterns: [
      'beverages?',
      '(?<!food and |food & )drinks?',
      'wines?',
      'winer(?:y|ies)',
      'viticultur\\w*',
      'vino\\w*',
      'beers?',
      'brew(?:ery|eries|ing|ers?)',
      'spirits',
      'whisk(?:e)?y',
      'vodka',
      'liquors?',
      'cider',
      'coffee',
      'cafe',
      'tea',
      'juices?',
      'bottled water',
      'mineral water',
      'soft drinks?',
      'cocktails?',
      'bartend\\w*',
      'bottling',
    ],
  },
  {
    category: 'Building',
    patterns: [
      '(?<!(?:team|brand|body|boat|ship|capacity|community|relationship|nation|peace|model|wealth|audience|skill|character|business|career|network|confidence|trust|leadership|muscle|bridge) )buildings?',
      'building (?:materials?|technolog\\w*|products?|services)',
      'architect(?:s|ure|ural)?',
      '(?<!(?:it|cloud|digital|data|network|charging|payment|energy|market) )infrastructure',
      'hvac',
      'heating',
      'ventilation',
      'air[- ]conditioning',
      'plumbing',
      'sanitary',
      'insulation',
      'roofing',
      'flooring',
      'floor coverings?',
      'tiles?',
      'windows? and doors?',
      'doors? and windows?',
      'interior(?:s| design)',
      'home (?:show|improvement|building)',
      'renovation',
      'kitchens? (?:and|&) bath\\w*',
      'bathrooms?',
      'smart (?:building|home)s?',
      'building automation',
    ],
  },
  {
    category: 'Cloud Computing',
    patterns: [
      '(?<!(?:point|word|tag) )clouds?',
      'cloud computing',
      'saas',
      'paas',
      'iaas',
      'serverless',
      'kubernetes',
      'multi-?cloud',
    ],
  },
  {
    category: 'Construction',
    patterns: [
      'construction',
      'contractors?',
      'civil engineering',
      'concrete',
      'cement',
      'earthmoving',
      'excavat\\w*',
      'cranes?',
      'scaffold\\w*',
      'asphalt',
      'road ?building',
      'tunnel(?:l)?ing',
      'demolition',
      'quarr(?:y|ies|ying)',
      'bauma',
    ],
  },
  {
    category: 'Cybersecurity',
    patterns: [
      'cyber\\w*',
      'information security',
      'it security',
      'infosec',
      'data protection',
      'e-?crime',
      'ransomware',
      'hack(?:er|ers|ing)',
      'identity and access management',
      'zero trust',
    ],
  },
  {
    category: 'Electronics',
    patterns: [
      'electronics?',
      'micro-?electronics?',
      'opto-?electronics?',
      'semiconductors?',
      'printed circuit',
      'embedded (?:systems?|world|technolog\\w*)',
      'electronic components?',
      'photonics',
      'laser (?:technolog\\w*|world|systems|processing)',
      'hi-?fi',
      'home (?:theat(?:re|er)|cinema)',
      'sensors?',
      'display (?:technolog\\w*|week)',
      'consumer electronics',
      'productronica',
    ],
    acronyms: ['PCBs?', 'LEDs?', 'SMT'],
  },
  {
    category: 'Energy',
    patterns: [
      'energ(?:y|ies)',
      'power (?:generation|plants?|stations?|industry)',
      '(?:electric|wind|solar|hydro|nuclear) power',
      'hydropower',
      'powergen',
      'solar',
      'photovoltaics?',
      'wind (?:energy|farms?|turbines?|industry)',
      'offshore wind',
      'renewables?',
      '(?<!(?:olive|essential|palm|cooking|edible|vegetable|coconut|sunflower|castor|hair|massage|seed|argan|fish) )oil(?! paint)',
      'oil (?:and|&) gas',
      '(?<!(?:tear|greenhouse|laughing) )gas',
      'petroleum',
      'petrochemicals?',
      'refin(?:ing|ery|eries)',
      'hydrogen',
      'nuclear(?! medicine)',
      'electricity',
      'utilit(?:y|ies)',
      'batter(?:y|ies)',
      'energy storage',
      'coal',
      'geothermal',
      'bio(?:gas|mass|energy|fuels?)',
      'fuel cells?',
      'fuels?',
      'smart grids?',
      'power equipment',
      'generators?',
      'gen-?sets?',
    ],
    acronyms: ['LNG', 'LPG', 'PV'],
  },
  {
    category: 'Engineering',
    patterns: [
      'engineering',
      'engineers?',
      'mechanical',
      'hydraulics?',
      'pneumatics?',
      'fluid power',
      'power transmission',
      'motion control',
      'aerospace',
      'pumps?',
      'valves?',
      'compressors?',
      'instrumentation',
      'metrology',
      'test (?:and|&) measurement',
      'measurement',
    ],
    acronyms: ['CAD'],
  },
  {
    category: 'Environment',
    patterns: [
      'environmental',
      'environment (?:technolog\\w*|protection|industry|management|expo|show)',
      'enviro(?!nment)\\w*',
      'water (?:treatment|technolog\\w*|management|industry|expo|week|supply|and wastewater)',
      'waste ?water',
      'drinking water',
      'wastes?',
      'recycl\\w*',
      'pollution',
      'climate (?:change|action|tech\\w*|week|summit|finance|neutral\\w*)',
      'emissions?',
      'carbon (?:capture|neutral\\w*|management|markets?)',
      'circular economy',
      'air quality',
      'clean ?tech\\w*',
      'ecolog\\w*',
    ],
    namePatterns: ['sustainab\\w*', 'green'],
  },
  {
    category: 'Fashion',
    patterns: [
      'fashion',
      'apparel',
      'clothing',
      'clothes',
      '(?:sports|swim|work|kids|mens|womens|eye|foot|under|out|night|children|active|beach|street|bridal)wear',
      'lingerie',
      'shoes?',
      'jewel(?:le)?ry',
      'jewels?',
      'gems?(?:tones?)?',
      'bridal',
      'couture',
      'pret-a-porter',
      'leather(?: goods)?',
      'handbags?',
    ],
    namePatterns: ['mode'],
  },
  {
    category: 'Food',
    patterns: [
      'foods?',
      'foodservice',
      'catering',
      'bak(?:ery|eries|ing)',
      'confectioner(?:y|ies)',
      'chocolates?',
      'meat',
      'seafood',
      'dairy',
      'gastronom\\w*',
      'culinary',
      'cuisine',
      'restaurants?',
      'horeca',
      'hospitality',
      'snacks?',
      'sweets',
      'halal',
      'kosher',
      'grocer(?:y|ies)',
      'pasta',
      'fruits?',
      'vegetables?',
      'olive oil',
      'organic products',
      'gelato',
      'ice cream',
      'pizza',
    ],
    namePatterns: ['hotels?'],
  },
  {
    category: 'Healthcare',
    patterns: [
      'health(?:care)?(?! (?:and|&) safety)',
      'wellness',
      'well-?being',
      'nursing',
      '(?:elderly|aged|senior|home|long-term) care',
      'care homes?',
      'rehab(?:ilitation)?',
      'homecare',
      'nutraceuticals?',
      'patients?',
    ],
  },
  {
    category: 'Information Technology',
    patterns: [
      'information technology',
      'software',
      'devops',
      'artificial intelligence',
      'machine learning',
      'big data',
      'data (?:science|analytics|centers?|centres?|management|storage)',
      'computers?',
      'computing',
      'internet',
      'internet of things',
      'digital (?:transformation|infrastructure|technolog\\w*|economy|workplace)',
      'enterprise (?:tech\\w*|software|it)',
      'blockchain',
      'cryptocurrenc(?:y|ies)',
      'web3',
      'fintech',
      'telecom\\w*',
      'broadband',
      '(?:software|app|web|game|mobile) developers?',
      'developer (?:conference|days?|summit|week)',
      '(?:computer|software) programming',
      'programming languages?',
      'remote sensing',
      'technology solutions',
      'open source',
      'databases?',
      'information (?:systems|and communication)',
      'geospatial',
      'spatial information',
      'it (?:services|solutions|infrastructure|professionals|leaders|management|expo|conference|summit|week|forum)',
    ],
    // Names are stored upper-case, so "IT"/"AI" are only trusted as acronyms
    // when they stand alone; "IT'S" is excluded by the lookahead.
    acronyms: ["IT(?!')", 'ICT', 'AI', 'IoT', 'IOT', 'ERP', 'CRM', 'GIS', '5G'],
  },
  {
    category: 'Manufacturing',
    patterns: [
      // Not "manufacturers": nearly every expo blurb "brings together manufacturers".
      'manufactur(?:ing|e)',
      'industrial',
      'machine ?tools?',
      'machinery',
      'metal ?working',
      '(?<!heavy )metals?',
      'sheet metal',
      'steel',
      'alumin(?:i)?um',
      'foundr(?:y|ies)',
      'die[- ]casting',
      'castings?',
      'forging',
      'welding',
      'mou?ld(?:s|ing|makers?)?',
      'tooling',
      '(?<!(?:marketing|sales|home|building|office|document|workflow|process) )automation',
      'robot(?:s|ics)?',
      'cnc',
      'subcontracting',
      'fasteners?',
      '3d printing',
      'additive manufacturing',
      'production (?:technolog\\w*|equipment|lines?|systems)',
      'factor(?:y|ies)',
      'surface (?:treatment|technolog\\w*|finishing)',
      'coatings?',
      'industry 4\\.0',
      'wood ?(?:working|processing)',
      'process (?:engineering|technolog\\w*|industry)',
    ],
    namePatterns: ['tools?'],
  },
  {
    category: 'Medical',
    patterns: [
      'medical',
      'medic(?:ine|ines|a)',
      'pharma\\w*',
      'surg(?:ery|ical|eons?)',
      'dental',
      'dentist\\w*',
      'orthodont\\w*',
      'hospitals?',
      'clinical',
      'clinics?',
      '(?<!(?:vehicle|automotive|car) )diagnostics?',
      'radiolog\\w*',
      'oncolog\\w*',
      'cardiolog\\w*',
      'orthop(?:a)?edic\\w*',
      'ophthalmolog\\w*',
      'veterinar\\w*',
      'physiotherap\\w*',
      'biotech\\w*',
      'life sciences?',
      'laboratory medicine',
    ],
  },
  {
    category: 'Packaging',
    patterns: [
      'packag(?:ing|es)',
      'packing',
      '(?<!(?:record|private) )labels?',
      'label(?:l)?ing',
      'corrugated',
      'cartons?',
      'converting',
      'bottling',
    ],
  },
  {
    category: 'Plastics',
    patterns: [
      'plastics?',
      'composites?',
      'polymers?',
      'resins?',
      'injection mou?lding',
      'polyurethanes?',
    ],
    acronyms: ['PVC'],
  },
  {
    category: 'Rubber',
    patterns: ['rubber', 'elastomers?', 'latex', 'tyres?', 'tires?'],
  },
  {
    category: 'Safety',
    patterns: [
      '(?<!food )safety',
      'fire(?:fight\\w*| protection| and rescue| & rescue| safety| services)?',
      'fire-?fight\\w*',
      'rescue',
      'emergenc(?:y|ies)',
      'occupational (?:health|safety)',
      'health (?:and|&) safety',
      'protective (?:equipment|clothing|wear)',
      'workwear',
      'risk management',
      'disaster (?:management|response|relief)',
      'flood (?:prep\\w*|protection|management|recovery|defen[cs]e|expo)',
    ],
    acronyms: ['PPE', 'OHS', 'HSE'],
  },
  {
    category: 'Security',
    patterns: [
      '(?<!(?:cyber|it|information|data|computer|internet|application|food|social|job|energy|supply|financial|network|cloud|digital) )security(?! (?:printing|documents?|inks?|features|paper))',
      // Gun shows advertise "self-defense weapons"; that is not the defence industry.
      '(?<!(?:self-|self |personal ))defen[cs]e',
      'military',
      'homeland',
      'polic(?:e|ing)',
      'law enforcement',
      'surveillance',
      'access control',
      'counter[- ]terror\\w*',
      'border (?:security|control)',
      'safe cit(?:y|ies)',
    ],
    acronyms: ['CCTV'],
  },
  {
    category: 'Technology',
    patterns: ['deep ?tech', 'emerging technolog\\w*', 'consumer technolog\\w*', 'start-?ups?'],
    // "hi-tech gadgets" turns up in gun-show and gift-fair prose.
    namePatterns: ['tech', 'hi-?tech', 'high-?tech', 'innovation'],
  },
  {
    category: 'Textiles',
    patterns: [
      'textiles?',
      'fabrics?',
      'yarns?',
      'fib(?:re|er)s?(?! optic)',
      'garments?',
      'non-?wovens?',
      'sewing',
      'embroider\\w*',
      'knitting',
      'denim',
      'apparel (?:manufacturing|sourcing|production)',
      'home textiles?',
      'spinning',
      'weaving',
    ],
  },
];

/**
 * An event tagged with the category on the left is always also tagged with the
 * ones on the right, so the umbrella filter never misses a specialist show:
 * selecting "Information Technology" includes every cybersecurity and cloud
 * event, and "Technology" includes all of IT and electronics.
 */
const CATEGORY_IMPLICATIONS: Partial<Record<FindShowCategoryName, FindShowCategoryName[]>> = {
  'Cloud Computing': ['Information Technology'],
  Cybersecurity: ['Information Technology'],
  Electronics: ['Technology'],
  'Information Technology': ['Technology'],
  Medical: ['Healthcare'],
};

type CompiledRule = {
  category: CategoryRule['category'];
  /** Matched against the accent-stripped, original-case text. */
  anyCase: RegExp;
  acronyms: RegExp | null;
  nameOnly: RegExp | null;
};

function alternation(sources: string[]) {
  return `${W}(?:${sources.join('|')})${W}`;
}

// A global flag is needed so `exec` can report the earliest match position,
// which decides the primary category; `lastIndex` is reset before every use.
const COMPILED_RULES: CompiledRule[] = CATEGORY_RULES.map((rule) => ({
  category: rule.category,
  anyCase: new RegExp(alternation(rule.patterns), 'g'),
  acronyms: rule.acronyms?.length ? new RegExp(alternation(rule.acronyms), 'g') : null,
  nameOnly: rule.namePatterns?.length ? new RegExp(alternation(rule.namePatterns), 'g') : null,
}));

/**
 * Fairs whose descriptions are inventories rather than an industry statement,
 * so only their names are classified. Education and career fairs list every
 * field they recruit for ("medicine, engineering, IT..."); gun, antique and
 * fan-convention blurbs list merchandise ("safety", "self-defense", "hi-tech
 * gadgets", "architectural salvage"). Their descriptions would otherwise tag
 * them with half the taxonomy.
 */
const NAME_ONLY_FAIR = new RegExp(
  `${W}(?:education\\w*|students?|etudiants?|studyrama|study|studies|etudes|careers?|jobs?|recruit\\w*|mba|universit\\w*|graduates?|absolventen\\w*|formations?|schools?|colleges?|guns?|knife|knives|antiques?|vintage|flea|collectibles?|comic-?cons?)${W}`,
  'i'
);

function stripAccents(value: string) {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Earliest match index of `pattern` in `text`, or -1. */
function firstMatchIndex(pattern: RegExp | null, text: string) {
  if (!pattern || !text) return -1;
  pattern.lastIndex = 0;
  const match = pattern.exec(text);
  return match ? match.index : -1;
}

type Hit = { category: FindShowCategoryName; inName: boolean; position: number };

/**
 * Tags an event from its name and description.
 *
 * Returns every matching category, primary first. The primary is the category
 * whose keyword appears earliest in the name — a show's title names its
 * industry most reliably — falling back to the earliest in the description.
 * Umbrella categories added through CATEGORY_IMPLICATIONS follow the direct
 * hits, and an event nothing recognises is tagged "General" alone.
 */
export function classifyFindShowEvent(
  name: string,
  description = ''
): FindShowCategoryName[] {
  const cleanName = stripAccents(name);
  // One scan per pattern over "name \n description": the earliest match lands
  // inside the name exactly when the name has one, so name hits still win. The
  // catalog classifies ~11k events on module load — in the browser too, where
  // client components import it — so this halves the regex work.
  const text = NAME_ONLY_FAIR.test(cleanName)
    ? cleanName
    : `${cleanName}\n${stripAccents(description)}`;
  // Lower-cased once so the word patterns run without the `i` flag, which is
  // markedly slower in V8 across alternations this size.
  const lowerText = text.toLowerCase();
  const lowerName = lowerText.slice(0, cleanName.length);
  const hits: Hit[] = [];

  for (const rule of COMPILED_RULES) {
    const positions = [
      firstMatchIndex(rule.anyCase, lowerText),
      firstMatchIndex(rule.acronyms, text),
    ].filter((position) => position >= 0);
    let position = positions.length ? Math.min(...positions) : -1;

    if (position < 0 || position >= cleanName.length) {
      const namePosition = firstMatchIndex(rule.nameOnly, lowerName);
      if (namePosition >= 0) position = namePosition;
    }

    if (position >= 0) {
      hits.push({ category: rule.category, inName: position < cleanName.length, position });
    }
  }

  if (!hits.length) {
    return [FALLBACK_CATEGORY];
  }

  hits.sort(
    (left, right) =>
      Number(right.inName) - Number(left.inName) ||
      left.position - right.position ||
      left.category.localeCompare(right.category)
  );

  const categories: FindShowCategoryName[] = hits.map((hit) => hit.category);

  // Walk implications transitively (Cybersecurity → IT → Technology).
  for (let index = 0; index < categories.length; index += 1) {
    for (const implied of CATEGORY_IMPLICATIONS[categories[index]] ?? []) {
      if (!categories.includes(implied)) {
        categories.push(implied);
      }
    }
  }

  return categories;
}

/**
 * The text that triggered each direct category hit, for auditing the rules
 * against the catalog ("why is this gun show tagged Electronics?").
 */
export function explainFindShowCategories(name: string, description = '') {
  const cleanName = stripAccents(name);
  const text = NAME_ONLY_FAIR.test(cleanName)
    ? cleanName
    : `${cleanName} || ${stripAccents(description)}`;
  const reasons: Partial<Record<FindShowCategoryName, string>> = {};

  for (const rule of COMPILED_RULES) {
    for (const pattern of [rule.anyCase, rule.acronyms, rule.nameOnly]) {
      if (!pattern) continue;
      pattern.lastIndex = 0;
      const subject =
        pattern === rule.acronyms
          ? text
          : (pattern === rule.nameOnly ? cleanName : text).toLowerCase();
      const match = pattern.exec(subject);
      if (match) {
        reasons[rule.category] = match[0];
        break;
      }
    }
  }

  return reasons;
}

/**
 * Whether a category-dropdown query matches a category label. Matches a
 * case-insensitive prefix of any word ("comp" → Cloud Computing, "tech" →
 * Information Technology and Technology) or of the label's initials ("it" →
 * Information Technology), so short queries don't fuzzy-match unrelated labels
 * the way a subsequence search would ("it" hitting Agriculture).
 */
export function matchesCategorySearch(label: string, query: string): boolean {
  const needle = stripAccents(query).trim().toLowerCase();
  if (!needle) return true;

  const haystack = stripAccents(label).toLowerCase();
  if (haystack.startsWith(needle)) return true;

  const words = haystack.split(/[^a-z0-9]+/).filter(Boolean);
  if (words.some((word) => word.startsWith(needle))) return true;

  const initials = words.map((word) => word[0]).join('');
  return words.length > 1 && needle.length > 1 && initials.startsWith(needle);
}

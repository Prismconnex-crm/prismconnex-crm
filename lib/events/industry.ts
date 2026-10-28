/**
 * Industry classification for trade-show exhibitors.
 *
 * Every assignment is evidence-backed: a rule only fires on a specific phrase
 * found in the company's OWN copy — its website and its name — and the phrases
 * that fired are recorded with the result, so any row can be audited later
 * without re-running anything.
 *
 * Deliberately conservative. A company whose own words give no clear winner, or
 * a near-tie between two sectors, is returned unclassified rather than guessed
 * at. A wrong sector is worse than a blank one here: the field exists so an
 * organiser or exhibitor can decide who is worth meeting, and they would act on
 * it.
 *
 * The vocabulary is scoped to what actually exhibits at an education show, so
 * "Information Technology & Services" means an IT supplier rather than
 * swallowing every company that happens to mention software.
 */

/**
 * The published vocabulary. Sectors past the education-supplier core exist
 * because real exhibitors needed them: a national trade agency, a children's
 * charity, a school group exhibiting as an operator rather than a supplier.
 * Forcing those into "Education Technology" would have been a tidier list and
 * a less true one.
 */
export const INDUSTRIES = [
  'Artificial Intelligence',
  'Arts, Music & Creative',
  'Assessment & Examinations',
  'Audio Visual & Display',
  'Charity & Non-profit',
  'Connectivity & Networking',
  'Consulting & Professional Services',
  'Cybersecurity',
  'Design & Creative Software',
  'Education Technology',
  'Facilities & Building Management',
  'Furniture & Learning Spaces',
  'Government & Trade Bodies',
  'Health & Medical',
  'IT Hardware & Devices',
  'Information Technology & Services',
  'Language Learning',
  'Office Supplies & Stationery',
  'Printing & Imaging',
  'Publishing & Learning Content',
  'STEM & Robotics',
  'Safeguarding & Student Wellbeing',
  'School Data & Analytics',
  'School Management Software',
  'Schools & Education Providers',
  'Special Educational Needs',
  'Sports & Physical Education',
  'Student Transport',
  'Teacher Training & Development',
] as const;

export type Industry = (typeof INDUSTRIES)[number];

type Rule = {
  industry: Industry;
  /** Phrases specific enough that one is close to decisive on its own. */
  strong?: string[];
  /** Phrases consistent with the sector but common across several of them. */
  weak?: string[];
};

/**
 * Phrases are matched on word boundaries, so "ai" cannot fire inside
 * "available" and "mis" cannot fire inside "dismiss".
 *
 * A term belongs in `weak` when vendors in other sectors routinely say it too.
 * "lesson plans" and "textbooks" started out strong and made a robotics-kit
 * maker outrank its own category, because kits ship with teaching material —
 * supporting vocabulary, not identifying vocabulary.
 */
const RULES: Rule[] = [
  {
    industry: 'STEM & Robotics',
    strong: [
      'robotics kit', 'robot kit', 'steam kit', 'stem kit', 'coding robot', 'educational robot',
      'microcontroller', 'esp32', 'arduino', '3d printer', '3d printing', 'makerspace', 'maker space',
      'stem education', 'steam education', 'electronics kit', 'robotics education',
    ],
    weak: ['robotics', 'coding club', 'learn to code', 'drone', 'laser cutter', 'stem', 'steam'],
  },
  {
    industry: 'Assessment & Examinations',
    strong: [
      'exam board', 'examination board', 'assessment platform', 'online exams', 'online examination',
      'marking and moderation', 'question bank', 'qualifications and assessment', 'exam software',
      'proctoring', 'remote invigilation', 'invigilation',
    ],
    weak: ['assessment', 'examinations', 'marking', 'grading', 'standardised test', 'mock exams'],
  },
  {
    industry: 'School Data & Analytics',
    strong: [
      'school analytics', 'student data analytics', 'school improvement data', 'pupil progress tracking',
      'data dashboards for schools', 'school performance data', 'results analysis',
    ],
    weak: ['analytics', 'multi academy trust', 'school data', 'progress tracking', 'benchmarking', 'data insights'],
  },
  {
    industry: 'School Management Software',
    strong: [
      'management information system', 'school management system', 'student information system',
      'timetabling software', 'school admin software', 'attendance management', 'school mis',
      'admissions software', 'cashless catering',
    ],
    weak: [
      'school management', 'timetabling', 'parent communication', 'school administration', 'parent app',
      'management software', 'admissions', 'school office',
    ],
  },
  {
    industry: 'Audio Visual & Display',
    strong: [
      'interactive whiteboard', 'interactive display', 'interactive flat panel', 'interactive floor',
      'visualiser', 'digital signage', 'audio visual', 'classroom audio', 'lecture capture',
    ],
    weak: ['touchscreen', 'display solutions', 'sound system', 'projection', 'microphone', 'projector'],
  },
  {
    industry: 'IT Hardware & Devices',
    strong: [
      'chromebook', 'chromebooks', 'laptops and tablets', 'device manufacturer', 'rugged tablet',
      'charging trolley', 'charging cart', 'laptop trolley',
    ],
    weak: ['laptops', 'desktops', 'monitors', 'tablets', 'notebooks', 'accessories', 'headphones', 'keyboards'],
  },
  {
    industry: 'Furniture & Learning Spaces',
    strong: [
      'classroom furniture', 'school furniture', 'learning spaces', 'educational furniture',
      'library furniture', 'flexible seating',
    ],
    weak: ['furniture', 'seating', 'lockers', 'workspace design', 'storage solutions'],
  },
  {
    industry: 'Safeguarding & Student Wellbeing',
    strong: [
      'safeguarding', 'lockdown and emergency', 'student wellbeing', 'pupil wellbeing', 'anti-bullying',
      'mental health support', 'incident reporting',
    ],
    weak: [
      'wellbeing', 'emergency response', 'student welfare', 'mental health', 'duty of care', 'lockdown',
      'visitor management', 'access control',
    ],
  },
  {
    industry: 'Cybersecurity',
    strong: [
      'cyber security', 'cybersecurity', 'web filtering', 'content filtering', 'endpoint protection',
      'threat detection', 'cyber essentials', 'penetration testing',
    ],
    weak: ['online safety', 'firewall', 'data protection compliance', 'gdpr compliance'],
  },
  {
    industry: 'Connectivity & Networking',
    strong: [
      'network infrastructure', 'wi-fi for schools', 'wifi solutions', 'broadband for schools',
      'structured cabling', 'wireless networks', 'managed network',
    ],
    weak: ['connectivity', 'networking', 'broadband', 'wireless network', 'leased line'],
  },
  {
    industry: 'Language Learning',
    strong: [
      'language learning', 'english language teaching', 'learn a language', 'translator device',
      'language courses', 'language school', 'language teaching', 'sprachen', 'sprachschule',
      'idiomas', 'langues', 'language lab',
    ],
    weak: ['bilingual', 'esl', 'efl', 'tefl', 'modern foreign languages', 'vocabulary', 'multilingual'],
  },
  {
    industry: 'Special Educational Needs',
    strong: [
      'special educational needs', 'send provision', 'assistive technology', 'dyslexia',
      'inclusive education technology', 'speech and language therapy', 'sensory room',
    ],
    weak: ['accessibility', 'additional needs', 'inclusion', 'neurodiversity', 'adhd', 'autism'],
  },
  {
    industry: 'Publishing & Learning Content',
    strong: [
      'publisher', 'publishing house', 'reading scheme', 'curriculum resources', 'schemes of work',
      'educational publisher', 'phonics', 'reading programme',
    ],
    weak: [
      'books', 'learning resources', 'curriculum content', 'worksheets', 'teaching resources',
      'lesson plans', 'textbooks', 'curriculum',
    ],
  },
  {
    industry: 'Teacher Training & Development',
    strong: [
      'continuing professional development', 'teacher training', 'cpd for teachers',
      'professional development for educators', 'teacher recruitment', 'initial teacher training',
    ],
    weak: ['cpd', 'staff training', 'teacher development', 'coaching', 'accredited training', 'professional development'],
  },
  {
    industry: 'Sports & Physical Education',
    strong: ['school sport', 'pe equipment', 'sports coaching', 'playground equipment'],
    weak: ['fitness', 'active play', 'sports', 'physical education'],
  },
  {
    industry: 'Arts, Music & Creative',
    strong: [
      'music education', 'musical instruments', 'art supplies', 'creative arts education',
      'drama education', 'music lessons', 'music technology',
    ],
    weak: ['creative learning', 'arts', 'design technology'],
  },
  {
    industry: 'Printing & Imaging',
    strong: ['managed print', 'print management', 'photocopier', 'laminator', 'printing solutions', 'label printer'],
    weak: ['printers', 'scanning solutions', 'printing'],
  },
  {
    industry: 'Artificial Intelligence',
    strong: [
      'ai agent', 'ai agents', 'generative ai', 'large language model', 'ai governance',
      'machine learning platform', 'ai tutor', 'ai tutoring', 'ai-powered learning', 'ai assistant',
    ],
    weak: ['artificial intelligence', 'machine learning', 'ai-powered', 'ai platform'],
  },
  {
    industry: 'Information Technology & Services',
    strong: [
      'it support', 'managed it services', 'it services for schools', 'apple premium reseller',
      'authorised reseller', 'it procurement', 'technology reseller',
      'managed service provider', 'it partner', 'it services',
    ],
    weak: [
      'it solutions', 'hardware supplier', 'technical support', 'cloud services', 'it consultancy',
      'device management',
    ],
  },
  {
    industry: 'Government & Trade Bodies',
    strong: [
      'government department', 'trade association', 'trade mission', 'department for education',
      'embassy', 'ministry of education', 'national agency', 'membership body',
    ],
    weak: ['government agency', 'public body', 'non-profit', 'charity'],
  },
  {
    industry: 'Consulting & Professional Services',
    strong: ['education consultancy', 'consultancy services', 'advisory services', 'strategic consulting'],
    weak: ['consulting', 'consultancy', 'advisory'],
  },
  {
    industry: 'Education Technology',
    strong: [
      'learning platform', 'learning management system', 'virtual learning environment',
      'classroom software', 'edtech platform', 'digital learning platform', 'education software',
      'homework platform', 'learning app',
    ],
    weak: ['edtech', 'digital learning', 'online learning', 'e-learning', 'classroom technology', 'blended learning'],
  },
];

const STRONG_WEIGHT = 3;
const WEAK_WEIGHT = 1;
/**
 * A hit in the company's NAME counts for more than one in page copy.
 * "abc Virtual Reality Language Learning" says what it does in four words,
 * while its homepage is titled "Home" and carries no description at all.
 */
const NAME_MULTIPLIER = 2;
/** Below this, the text said nothing specific enough to act on. */
const MIN_SCORE = 3;
/** A winner must beat the runner-up by this much, or it is a coin flip. */
const MIN_MARGIN = 2;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Word-boundary match, so a short phrase cannot fire inside a longer word. */
function mentions(haystack: string, phrase: string): boolean {
  return new RegExp(`(^|[^a-z0-9])${escapeRegExp(phrase)}([^a-z0-9]|$)`, 'i').test(haystack);
}

function normalize(value: string | null | undefined): string {
  return (value ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
}

export type Classification = {
  industry: Industry | null;
  /** The phrases that decided it — what makes a row checkable after the fact. */
  evidence: string[];
  score: number;
  runnerUp: { industry: Industry; score: number } | null;
  /** Why nothing was assigned, when industry is null. */
  reason: 'ok' | 'no-signal' | 'too-close' | 'no-text';
};

export function classifyIndustry(text: string, companyName?: string): Classification {
  const body = normalize(text);
  const name = normalize(companyName);
  if (body.length < 20 && name.length < 3) {
    return { industry: null, evidence: [], score: 0, runnerUp: null, reason: 'no-text' };
  }

  const scored = RULES.map((rule) => {
    const hits: string[] = [];
    let score = 0;
    let nameScore = 0;

    const add = (phrase: string, weight: number) => {
      const inName = name ? mentions(name, phrase) : false;
      const inBody = body ? mentions(body, phrase) : false;
      if (!inName && !inBody) return;
      // A sector word in the company's own name is identifying even when the
      // same word is merely suggestive in page copy: "Booster Robotics
      // Technology Co." is a robotics company, while a page that mentions
      // robotics once may just be listing a product it stocks. So a name hit
      // never scores below a strong hit.
      const earned = inName ? Math.max(weight, STRONG_WEIGHT) * (weight === STRONG_WEIGHT ? NAME_MULTIPLIER : 1) : weight;
      score += earned;
      if (inName) nameScore += earned;
      hits.push(inName ? `name:${phrase}` : phrase);
    };

    for (const phrase of rule.strong ?? []) add(phrase, STRONG_WEIGHT);
    for (const phrase of rule.weak ?? []) add(phrase, WEAK_WEIGHT);
    return { industry: rule.industry, score, nameScore, evidence: hits };
  })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  // A company that names its sector has settled the question itself. Without
  // this, a multi-service IT provider loses to whichever single service its
  // homepage happens to push hardest that quarter -- "Advanced IT Services"
  // scored higher on cyber security than on IT services, and was dropped as a
  // tie even though its own name says what it is.
  const named = scored.filter((entry) => entry.nameScore > 0);
  if (named.length) {
    const topName = named.reduce((a, b) => (b.nameScore > a.nameScore ? b : a));
    const contested = named.filter((entry) => entry.nameScore === topName.nameScore);
    if (contested.length === 1 && topName.score >= MIN_SCORE) {
      return {
        industry: topName.industry,
        evidence: topName.evidence,
        score: topName.score,
        runnerUp: null,
        reason: 'ok',
      };
    }
  }

  const best = scored[0];
  if (!best || best.score < MIN_SCORE) {
    return {
      industry: null,
      evidence: best?.evidence ?? [],
      score: best?.score ?? 0,
      runnerUp: null,
      reason: body.length < 20 ? 'no-text' : 'no-signal',
    };
  }

  const second = scored[1] ?? null;
  const runnerUp = second ? { industry: second.industry, score: second.score } : null;
  if (second && best.score - second.score < MIN_MARGIN) {
    return { industry: null, evidence: best.evidence, score: best.score, runnerUp, reason: 'too-close' };
  }

  return { industry: best.industry, evidence: best.evidence, score: best.score, runnerUp, reason: 'ok' };
}

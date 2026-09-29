const fallbackGradients = [
  'linear-gradient(135deg, rgba(37, 99, 235, 0.92), rgba(15, 23, 42, 0.98))',
  'linear-gradient(135deg, rgba(79, 70, 229, 0.92), rgba(6, 182, 212, 0.78))',
  'linear-gradient(135deg, rgba(14, 165, 233, 0.92), rgba(17, 24, 39, 0.98))',
  'linear-gradient(135deg, rgba(22, 163, 74, 0.9), rgba(15, 23, 42, 0.96))',
  'linear-gradient(135deg, rgba(217, 119, 6, 0.88), rgba(30, 41, 59, 0.98))',
  'linear-gradient(135deg, rgba(225, 29, 72, 0.88), rgba(79, 70, 229, 0.9))',
];

function hashValue(value: string) {
  return Array.from(value).reduce((total, character) => total + character.charCodeAt(0), 0);
}

export function getFindShowGradient(seed: string) {
  return fallbackGradients[hashValue(seed) % fallbackGradients.length];
}

export function getFindShowAvatarUrl(name: string) {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&size=80&background=random&color=fff`;
}

const initialsStopWords = new Set(['a', 'an', 'and', 'de', 'di', 'du', 'for', 'of', 'the', '&']);

/**
 * Up to two initials for an event, used when it has no logo or the logo fails
 * to load. Rendered locally so a missing logo costs no network request.
 */
export function getFindShowInitials(name: string) {
  const words = name
    .split(/[\s\-–—/]+/)
    .map((word) => word.replace(/[.,:;!?'"`()[\]{}&+*#@|<>]/g, ''))
    .filter((word) => word && !initialsStopWords.has(word.toLowerCase()));

  return (
    words
      .slice(0, 2)
      .map((word) => Array.from(word)[0])
      .join('')
      .toUpperCase() || '?'
  );
}

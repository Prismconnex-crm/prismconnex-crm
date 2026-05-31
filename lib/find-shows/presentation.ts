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

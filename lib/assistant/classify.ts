import {
  ENTITY_SIGNALS,
  HEAD_MULTIPLIER,
  HEAD_PHRASES,
  LEAD_MULTIPLIER,
  PROXIMITY_WORDS,
  QUALIFIER_MULTIPLIER,
  QUALIFIER_PHRASES,
} from './signals';
import { ASSISTANT_ENTITIES, type AssistantEntity } from './types';

export type ClassifyResult = {
  scores: Record<AssistantEntity, number>;
  winner: AssistantEntity | null;
  /** (top - runnerUp) / top, clamped 0-1. Zero when there is no winner. */
  margin: number;
};

function tokenize(message: string): string[] {
  return message
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/** Word indices where `phrase` starts, plus the index of its last word. */
function findPhrase(words: string[], phrase: string): Array<{ start: number; end: number }> {
  const parts = phrase.split(' ');
  const hits: Array<{ start: number; end: number }> = [];
  for (let i = 0; i + parts.length <= words.length; i += 1) {
    if (parts.every((part, offset) => words[i + offset] === part)) {
      hits.push({ start: i, end: i + parts.length - 1 });
    }
  }
  return hits;
}

type Marker = { end: number; kind: 'head' | 'qualifier' };

/**
 * Locates head and qualifier phrases, and the word indices they occupy.
 *
 * Occupied words are excluded from signal scoring: "show me" is a head phrase,
 * and without this its own "show" would score for events on every single
 * "show me companies…" question.
 */
function findMarkers(words: string[]): { markers: Marker[]; occupied: Set<number> } {
  const markers: Marker[] = [];
  const occupied = new Set<number>();

  // Longest phrases first so "at the" is matched before the shorter "at".
  const byLengthDesc = (a: string, b: string) => b.split(' ').length - a.split(' ').length;

  for (const phrase of [...QUALIFIER_PHRASES].sort(byLengthDesc)) {
    for (const { start, end } of findPhrase(words, phrase)) {
      if (start <= end && !occupied.has(start)) {
        markers.push({ end, kind: 'qualifier' });
        for (let i = start; i <= end; i += 1) occupied.add(i);
      }
    }
  }

  for (const phrase of [...HEAD_PHRASES].sort(byLengthDesc)) {
    for (const { start, end } of findPhrase(words, phrase)) {
      if (start <= end && !occupied.has(start)) {
        markers.push({ end, kind: 'head' });
        for (let i = start; i <= end; i += 1) occupied.add(i);
      }
    }
  }

  return { markers, occupied };
}

/**
 * Positional weight for a signal starting at word `index`.
 *
 * The nearest preceding marker within PROXIMITY_WORDS decides: a deliverable
 * noun after "show me" is what the user wants back, a noun after "at" or
 * "attending" is merely qualifying it. This is what makes "companies
 * exhibiting at SaaStr" resolve to companies and not events.
 *
 * A signal opening the sentence gets a smaller lead boost — enough to beat a
 * trailing mention, small enough that "companies and contacts" stays an
 * honest near-tie rather than a confident answer.
 */
function positionalMultiplier(index: number, markers: Marker[]): number {
  let nearest: Marker | null = null;
  for (const marker of markers) {
    if (marker.end >= index) continue;
    if (index - marker.end > PROXIMITY_WORDS) continue;
    if (!nearest || marker.end > nearest.end) nearest = marker;
  }

  if (nearest) return nearest.kind === 'head' ? HEAD_MULTIPLIER : QUALIFIER_MULTIPLIER;
  return index === 0 ? LEAD_MULTIPLIER : 1;
}

/**
 * Scores a message against every entity's signal list.
 *
 * Runs on EVERY message, not only when no API key is present — its agreement
 * or disagreement with the model classifier is what produces the confidence
 * number that gates auto-navigation.
 */
export function classify(message: string): ClassifyResult {
  const words = tokenize(message);
  const { markers, occupied } = findMarkers(words);

  const scores = ASSISTANT_ENTITIES.reduce(
    (acc, entity) => {
      acc[entity] = ENTITY_SIGNALS[entity].reduce((sum, signal) => {
        return (
          sum +
          findPhrase(words, signal.word)
            .filter(({ start }) => !occupied.has(start))
            .reduce(
              (total, { start }) =>
                total + (signal.weight ?? 1) * positionalMultiplier(start, markers),
              0
            )
        );
      }, 0);
      return acc;
    },
    {} as Record<AssistantEntity, number>
  );

  const ranked = [...ASSISTANT_ENTITIES].sort((a, b) => scores[b] - scores[a]);
  const top = scores[ranked[0]];
  if (top <= 0) return { scores, winner: null, margin: 0 };

  const runnerUp = scores[ranked[1]];
  return {
    scores,
    winner: ranked[0],
    margin: Math.max(0, Math.min(1, (top - runnerUp) / top)),
  };
}

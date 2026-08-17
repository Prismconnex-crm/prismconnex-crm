import type { ReactNode } from 'react';
import type { AssistantEntity, FilterChip, RouteAction } from '@/lib/assistant/types';

export type ConversationMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  entity: AssistantEntity | null;
  action: RouteAction | null;
  confidence: number | null;
  filters: unknown | null;
  chips: FilterChip[];
  droppedFilters: string[];
  rows: unknown[];
  /** Null when counting is too expensive — companies always is. */
  total: number | null;
  suggestions: string[];
  isComplete: boolean;
  error: { code: string; message: string } | null;
};

export type PendingHandoff = {
  from: AssistantEntity;
  to: AssistantEntity;
  /** The SOURCE page's own filters, so "go back" restores what was there. */
  sourceFilters: unknown;
  /** Filters phase one extracted, replayed verbatim in phase two. */
  presetFilters: unknown;
  /** The question that triggered the handoff, re-sent in phase two. */
  message: string;
};

export type ConversationState = {
  messages: ConversationMessage[];
  isStreaming: boolean;
  error: string | null;
  previousEntity: AssistantEntity | null;
  pendingHandoff: PendingHandoff | null;
};

/** The client twin of Spec 1's EntityAdapter. */
export type PageBinding<F> = {
  entity: AssistantEntity;
  /** Where navigation sends the user, e.g. "/app/people". */
  route: string;
  emptyFilters(): F;
  /** Incoming keys replace conflicting ones; unrelated current filters survive. */
  applyFilters(current: F, incoming: Partial<F>): F;
  renderRows(rows: unknown[]): ReactNode;
};

export function emptyMessage(id: string, role: 'user' | 'assistant'): ConversationMessage {
  return {
    id,
    role,
    text: '',
    entity: null,
    action: null,
    confidence: null,
    filters: null,
    chips: [],
    droppedFilters: [],
    rows: [],
    total: null,
    suggestions: [],
    isComplete: role === 'user',
    error: null,
  };
}

export function emptyConversation(): ConversationState {
  return {
    messages: [],
    isStreaming: false,
    error: null,
    previousEntity: null,
    pendingHandoff: null,
  };
}

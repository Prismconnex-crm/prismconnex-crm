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
  /**
   * Operator diagnostics from the server (e.g. a rejected API key). Only ever
   * populated for admins — the server decides, the client only renders.
   */
  notice: string | null;
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

/**
 * The client twin of Spec 1's EntityAdapter.
 *
 * `C` is the page's own row-interaction context — selection sets and handlers
 * the page already owns. It is opaque to the panel, which forwards it without
 * inspecting it, so each page/binding pair stays type-safe while the panel
 * stays entity-agnostic.
 */
export type PageBinding<F, C = unknown> = {
  entity: AssistantEntity;
  /** Where navigation sends the user, e.g. "/app/people". */
  route: string;
  emptyFilters(): F;
  /** Incoming keys replace conflicting ones; unrelated current filters survive. */
  applyFilters(current: F, incoming: Partial<F>): F;
  renderRows(rows: unknown[], context: C): ReactNode;
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
    notice: null,
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

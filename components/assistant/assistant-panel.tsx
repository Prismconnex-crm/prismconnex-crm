"use client";

import { useEffect, useRef, useState } from 'react';
import { AiSearchPanel, CompactSearchBar } from '@/components/search/ai-search-panel';
import type { SavedQueryKind } from '@/components/search/query-store';
import { useAssistantChat } from './use-assistant-chat';
import { AssistantMessage } from './assistant-message';
import { HandoffBar } from './handoff-bar';
import type { AssistantEntity } from '@/lib/assistant/types';

/** Per-entity copy. The query-store kind keeps each page's history separate. */
const COPY: Record<
  AssistantEntity,
  { kind: SavedQueryKind; kindLabel: string; title: string; subtitle: string; placeholder: string; followUp: string }
> = {
  people: {
    kind: 'people_query',
    kindLabel: 'People query',
    title: 'Find anything',
    subtitle:
      "Describe the contacts you're looking for in simple terms and we'll find and answer questions about them.",
    placeholder: 'e.g., Verified marketing managers at AI companies in Germany...',
    followUp: 'Ask a follow-up about these contacts...',
  },
  events: {
    kind: 'event_query',
    kindLabel: 'Event query',
    title: 'Find anything',
    subtitle:
      "Describe the trade shows you're looking for in simple terms and we'll find and answer questions about them.",
    placeholder: 'e.g., Packaging expos in Germany next spring...',
    followUp: 'Ask a follow-up about these shows...',
  },
  companies: {
    kind: 'lead_query',
    kindLabel: 'Company query',
    title: 'Find anything',
    subtitle:
      "Describe the companies you're looking for in simple terms and we'll find and answer questions about them.",
    placeholder: 'e.g., SaaS companies in Germany with 51-200 employees...',
    followUp: 'Ask a follow-up about these companies...',
  },
};

/**
 * The shared assistant surface, mounted by each page in its own layout slot.
 *
 * Two states, matching the PeopleChatPanel it replaces: the AiSearchPanel hero
 * when the thread is empty, and a CompactSearchBar pinned above the thread
 * once it is not.
 */
export function AssistantPanel({
  currentPage,
  activeFilters,
  rowContext,
  onGoBack,
}: {
  currentPage: AssistantEntity;
  activeFilters?: Record<string, unknown>;
  /** The page's own row handlers, forwarded opaquely to its binding. */
  rowContext?: unknown;
  onGoBack: (entity: AssistantEntity, filters: unknown) => void;
}) {
  const chat = useAssistantChat({ currentPage, activeFilters });
  const [draft, setDraft] = useState('');
  const endRef = useRef<HTMLDivElement | null>(null);
  const copy = COPY[currentPage];

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [chat.messages.length, chat.isStreaming]);

  const submit = (prompt: string) => {
    setDraft('');
    void chat.send(prompt);
  };

  if (chat.messages.length === 0) {
    return (
      <AiSearchPanel
        title={copy.title}
        subtitle={copy.subtitle}
        placeholder={copy.placeholder}
        kind={copy.kind}
        kindLabel={copy.kindLabel}
        isBusy={chat.isStreaming}
        defaultTab="recent"
        onSubmit={submit}
        onSelectQuery={(entry) => submit(entry.query)}
      />
    );
  }

  const handoff = chat.pendingHandoff;
  const showBar = handoff !== null && handoff.to === currentPage;

  return (
    <div className="flex h-full flex-col gap-3">
      {showBar && handoff && (
        <HandoffBar
          from={handoff.from}
          onBack={() => {
            onGoBack(handoff.from, handoff.sourceFilters);
            chat.clearHandoff();
          }}
          onDismiss={chat.clearHandoff}
        />
      )}

      <CompactSearchBar
        value={draft}
        placeholder={copy.followUp}
        kind={copy.kind}
        kindLabel={copy.kindLabel}
        isBusy={chat.isStreaming}
        onChange={setDraft}
        onSubmit={submit}
        onClear={() => {
          setDraft('');
          chat.reset();
        }}
        onSelectQuery={(entry) => submit(entry.query)}
      />

      <div className="flex-1 space-y-5 overflow-y-auto pr-1">
        {chat.messages.map((message) => (
          <AssistantMessage
            key={message.id}
            message={message}
            rowContext={rowContext}
            onSuggestion={submit}
            onRetry={chat.retry}
          />
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
}

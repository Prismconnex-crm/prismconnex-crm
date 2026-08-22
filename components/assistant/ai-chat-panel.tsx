"use client";

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AiSearchPanel, CompactSearchBar } from '@/components/search/ai-search-panel';
import { targetEntityOf, type SavedQuery, type SavedQueryKind } from '@/components/search/query-store';
import { useAssistantChat } from './use-assistant-chat';
import { AssistantMessage } from './assistant-message';
import { HandoffBar } from './handoff-bar';
import { HandoffCountdown } from './handoff-countdown';
import { bindingFor, hasBinding } from './registry';
import { readScroll, saveScroll, scrollKey } from './scroll-store';
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
 * Two states: the AiSearchPanel hero
 * when the thread is empty, and a CompactSearchBar pinned above the thread
 * once it is not.
 */
export function AIChatPanel({
  entity,
  rowContext,
}: {
  entity: AssistantEntity;
  /** The page's own row handlers, forwarded opaquely to its binding. */
  rowContext?: unknown;
}) {
  const chat = useAssistantChat({ entity });
  const router = useRouter();
  const [draft, setDraft] = useState('');
  const endRef = useRef<HTMLDivElement | null>(null);
  const threadRef = useRef<HTMLDivElement | null>(null);
  const [arrivedFrom, setArrivedFrom] = useState<AssistantEntity | null>(null);
  const copy = COPY[entity];
  const offsetKey = scrollKey(chat.conversationId, entity);

  // useLayoutEffect, not useEffect: restoring after paint shows the thread at
  // the top for one frame and then jumps, which reads as a glitch.
  useLayoutEffect(() => {
    if (threadRef.current) threadRef.current.scrollTop = readScroll(offsetKey);
  }, [offsetKey]);

  // In an effect, never in the render initializer: reading window during render
  // is a hydration mismatch. `via` is the only durable signal that the user
  // arrived from somewhere — session-mirror never restores pendingHandoff.
  useEffect(() => {
    const via = new URLSearchParams(window.location.search).get('via');
    setArrivedFrom(via === 'people' || via === 'events' || via === 'companies' ? via : null);
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [chat.messages.length, chat.isStreaming]);

  const submit = (prompt: string) => {
    setDraft('');
    void chat.send(prompt);
  };

  /**
   * Restores the exact search rather than re-asking the model, which is the
   * point of having saved the payload. Falls back to re-asking when the entry
   * predates payloads, or when its entity has no binding yet (companies, until
   * Spec 3b) — those still work, they just cost a model call.
   */
  const openSaved = (saved: SavedQuery) => {
    const target = targetEntityOf(saved);
    if (saved.payload == null || !hasBinding(target)) {
      submit(saved.query);
      return;
    }
    const binding = bindingFor(target) as unknown as {
      route: string;
      serializeFilters(filters: unknown): string;
    };
    router.push(`${binding.route}${binding.serializeFilters(saved.payload)}`);
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
        onSelectQuery={openSaved}
      />
    );
  }

  const handoff = chat.pendingHandoff;
  const isCountingDown = handoff !== null && handoff.status === 'counting_down';
  const showArrivalBar =
    handoff !== null && handoff.status === 'navigating' && handoff.to === entity;

  return (
    <div className="flex h-full flex-col gap-3">
      {isCountingDown && handoff && (
        <HandoffCountdown
          to={handoff.to}
          message={handoff.message}
          onCancel={chat.cancelHandoff}
        />
      )}

      {(showArrivalBar || arrivedFrom !== null) && (
        <HandoffBar
          from={(handoff?.from ?? arrivedFrom) as AssistantEntity}
          onBack={() => {
            // A route push, not a callback the page has to service — the URL
            // now holds the filters, so "back" is just history.
            window.history.back();
            setArrivedFrom(null);
            chat.clearHandoff();
          }}
          onDismiss={() => {
            setArrivedFrom(null);
            chat.clearHandoff();
          }}
        />
      )}

      {chat.handoffWarning && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400">
          {chat.handoffWarning}
        </p>
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
        onSelectQuery={openSaved}
      />

      <div
        ref={threadRef}
        onScroll={(event) => saveScroll(offsetKey, event.currentTarget.scrollTop)}
        className="flex-1 space-y-5 overflow-y-auto pr-1"
      >
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

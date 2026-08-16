"use client";

import { useCallback, useRef, useState } from "react";
import type { PeopleChatEvent } from "@/lib/people/chat-stream";
import type { PeopleFilterChip } from "@/lib/people/chips";
import type { PeopleFilters, Person } from "@/types/people";

/**
 * Owns the chat thread and the NDJSON read loop.
 *
 * The stream's contract (filters, then results, then prose) is what lets this
 * fill the table before the answer exists. A stream that dies mid-answer keeps
 * whatever prose arrived, marks the message incomplete and offers Retry —
 * partial output is more useful than a discarded one.
 */

export type PeopleChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  filters: PeopleFilters | null;
  chips: PeopleFilterChip[];
  results: Person[];
  total: number;
  isComplete: boolean;
  error: { code: string; message: string } | null;
};

function newId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function usePeopleChat({ activeFilters }: { activeFilters: PeopleFilters }) {
  const [messages, setMessages] = useState<PeopleChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const lastQuestionRef = useRef<string>("");
  const conversationIdRef = useRef<string>(newId());

  const patchAssistant = useCallback((id: string, patch: Partial<PeopleChatMessage>) => {
    setMessages((current) =>
      current.map((message) => (message.id === id ? { ...message, ...patch } : message))
    );
  }, []);

  const run = useCallback(
    async (question: string) => {
      const controller = new AbortController();
      abortRef.current = controller;
      lastQuestionRef.current = question;

      const assistantId = newId();
      setError(null);
      setIsStreaming(true);
      setMessages((current) => [
        ...current,
        {
          id: newId(),
          role: "user",
          text: question,
          filters: null,
          chips: [],
          results: [],
          total: 0,
          isComplete: true,
          error: null,
        },
        {
          id: assistantId,
          role: "assistant",
          text: "",
          filters: null,
          chips: [],
          results: [],
          total: 0,
          isComplete: false,
          error: null,
        },
      ]);

      try {
        const response = await fetch("/api/people/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: question,
            conversationId: conversationIdRef.current,
            activeFilters,
            page: 1,
          }),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error(`Request failed (${response.status})`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let prose = "";

        // NDJSON: split on newlines, keep the trailing partial line buffered.
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.trim()) continue;
            let event: PeopleChatEvent;
            try {
              event = JSON.parse(line) as PeopleChatEvent;
            } catch {
              continue; // ignore a malformed frame rather than killing the read
            }

            if (event.type === "filters") {
              patchAssistant(assistantId, { filters: event.filters, chips: event.chips });
            } else if (event.type === "results") {
              patchAssistant(assistantId, { results: event.results, total: event.total });
            } else if (event.type === "token") {
              prose += event.text;
              patchAssistant(assistantId, { text: prose });
            } else if (event.type === "error") {
              patchAssistant(assistantId, {
                error: { code: event.code, message: event.message },
                isComplete: true,
              });
              setError(event.message);
            } else if (event.type === "done") {
              patchAssistant(assistantId, { isComplete: true });
            }
          }
        }

        // The stream ended without a `done` frame — keep the partial answer and
        // let the user retry rather than discarding what arrived.
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantId && !message.isComplete
              ? { ...message, error: { code: "interrupted", message: "Answer incomplete." } }
              : message
          )
        );
      } catch (caught) {
        if ((caught as Error).name === "AbortError") {
          patchAssistant(assistantId, { isComplete: true });
        } else {
          const message = caught instanceof Error ? caught.message : "Something went wrong.";
          patchAssistant(assistantId, {
            isComplete: true,
            error: { code: "request_failed", message },
          });
          setError(message);
        }
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [activeFilters, patchAssistant]
  );

  const send = useCallback(
    async (message: string) => {
      const question = message.trim();
      if (!question || isStreaming) return;
      await run(question);
    },
    [isStreaming, run]
  );

  const retry = useCallback(async () => {
    if (!lastQuestionRef.current || isStreaming) return;
    // Drop the failed exchange so the thread does not accumulate dead turns.
    setMessages((current) => current.slice(0, -2));
    await run(lastQuestionRef.current);
  }, [isStreaming, run]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    conversationIdRef.current = newId();
    lastQuestionRef.current = "";
    setMessages([]);
    setError(null);
  }, []);

  return { messages, isStreaming, error, send, retry, stop, reset };
}

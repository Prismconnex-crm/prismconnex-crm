import { describe, expect, it, vi } from 'vitest';
import { readAssistantStream } from '@/components/assistant/stream-reader';
import type { AssistantEvent } from '@/lib/assistant/types';

function responseOf(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Response(stream);
}

const doneLine = `${JSON.stringify({ type: 'done' })}\n`;

describe('readAssistantStream', () => {
  it('parses one event per line', async () => {
    const seen: AssistantEvent[] = [];
    await readAssistantStream(
      responseOf([`${JSON.stringify({ type: 'token', text: 'hi' })}\n`, doneLine]),
      (event) => seen.push(event)
    );
    expect(seen.map((e) => e.type)).toEqual(['token', 'done']);
  });

  it('reassembles an event split across chunk boundaries', async () => {
    const seen: AssistantEvent[] = [];
    await readAssistantStream(
      responseOf(['{"type":"tok', 'en","text":"split"}\n', doneLine]),
      (event) => seen.push(event)
    );
    const token = seen[0];
    if (token.type !== 'token') throw new Error('expected token');
    expect(token.text).toBe('split');
  });

  it('skips a malformed frame and keeps reading', async () => {
    const seen: AssistantEvent[] = [];
    await readAssistantStream(
      responseOf(['not json\n', `${JSON.stringify({ type: 'token', text: 'ok' })}\n`, doneLine]),
      (event) => seen.push(event)
    );
    expect(seen.map((e) => e.type)).toEqual(['token', 'done']);
  });

  it('ignores blank lines', async () => {
    const seen: AssistantEvent[] = [];
    await readAssistantStream(responseOf(['\n', '   \n', doneLine]), (event) => seen.push(event));
    expect(seen).toHaveLength(1);
  });

  it('emits a trailing event with no final newline', async () => {
    const seen: AssistantEvent[] = [];
    await readAssistantStream(responseOf([JSON.stringify({ type: 'done' })]), (event) =>
      seen.push(event)
    );
    expect(seen.map((e) => e.type)).toEqual(['done']);
  });

  it('throws when the response has no body', async () => {
    await expect(readAssistantStream(new Response(null), vi.fn())).rejects.toThrow(/body/i);
  });

  it('throws on a non-2xx response', async () => {
    await expect(
      readAssistantStream(new Response('nope', { status: 500 }), vi.fn())
    ).rejects.toThrow(/500/);
  });
});

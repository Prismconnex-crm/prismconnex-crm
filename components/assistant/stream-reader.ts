import type { AssistantEvent } from '@/lib/assistant/types';

/**
 * Reads an NDJSON response, invoking `onEvent` per frame.
 *
 * Extracted from components/people/use-people-chat.ts so the buffering and
 * malformed-frame behaviour is testable in node — inside the hook it was only
 * ever exercised by hand.
 */
export async function readAssistantStream(
  response: Response,
  onEvent: (event: AssistantEvent) => void
): Promise<void> {
  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`);
  }
  if (!response.body) {
    throw new Error('Response has no body');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const emit = (line: string) => {
    if (!line.trim()) return;
    try {
      onEvent(JSON.parse(line) as AssistantEvent);
    } catch {
      // Ignore a malformed frame rather than killing the read.
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    // Keep the trailing partial line buffered.
    buffer = lines.pop() ?? '';
    for (const line of lines) emit(line);
  }

  // A final frame with no trailing newline still counts.
  emit(buffer);
}

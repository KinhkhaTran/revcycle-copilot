import type { Card } from "./types";

export type StreamEvent =
  | { type: "text"; text: string }
  | { type: "tool_use"; name: string; input: unknown }
  | { type: "card"; card: Card }
  | { type: "done" }
  | { type: "error"; message: string };

interface WireMessage {
  role: "user" | "assistant";
  content: string;
}

export type Mode = "learn" | "pro";
export type Segment = "all" | "front" | "back";

// True when an error came from the caller aborting the request (Stop button).
function isAbort(err: unknown) {
  return (err as { name?: string })?.name === "AbortError";
}

// POST the conversation, parse the SSE stream, and invoke onEvent for each event.
// Pass an AbortSignal to let the caller stop generation mid-stream.
export async function streamChat(
  messages: WireMessage[],
  mode: Mode,
  segment: Segment,
  onEvent: (e: StreamEvent) => void,
  signal?: AbortSignal
) {
  let res: Response;
  try {
    res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, mode, segment }),
      signal,
    });
  } catch (err) {
    if (isAbort(err)) return; // user stopped before the stream opened
    onEvent({ type: "error", message: "Network error — couldn't reach Cadence." });
    return;
  }

  if (!res.ok || !res.body) {
    let message = `Request failed (${res.status})`;
    try {
      const j = await res.json();
      if (j?.error) message = j.error;
    } catch {
      /* ignore */
    }
    onEvent({ type: "error", message });
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const chunks = buffer.split("\n\n");
      buffer = chunks.pop() || "";
      for (const chunk of chunks) {
        const line = chunk.split("\n").find((l) => l.startsWith("data: "));
        if (!line) continue;
        try {
          onEvent(JSON.parse(line.slice(6)) as StreamEvent);
        } catch {
          /* ignore malformed */
        }
      }
    }
  } catch (err) {
    if (!isAbort(err)) throw err; // swallow aborts; surface real read errors
  }
}

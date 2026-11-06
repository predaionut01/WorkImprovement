import type { ChatRequest, ChatStreamEvent } from "@/lib/types";

/**
 * Streams POST /api/chat (NDJSON) and calls onEvent for every parsed line.
 * Lines may arrive split across chunks; we buffer until "\n".
 * Resolves when the stream ends; rejects on network / HTTP errors.
 */
export async function streamChat(
  req: ChatRequest,
  onEvent: (e: ChatStreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/x-ndjson" },
    body: JSON.stringify(req),
    signal,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Chat API ${res.status}${text ? `: ${text.slice(0, 200)}` : ""}`);
  }
  if (!res.body) throw new Error("Răspuns fără corp (stream indisponibil)");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const emitLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    try {
      onEvent(JSON.parse(trimmed) as ChatStreamEvent);
    } catch {
      onEvent({ type: "error", message: `Linie NDJSON invalidă: ${trimmed.slice(0, 120)}` });
    }
  };

  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx = buffer.indexOf("\n");
      while (idx >= 0) {
        emitLine(buffer.slice(0, idx));
        buffer = buffer.slice(idx + 1);
        idx = buffer.indexOf("\n");
      }
    }
    buffer += decoder.decode();
    if (buffer.trim()) emitLine(buffer);
  } finally {
    reader.releaseLock();
  }
}

export function newSessionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `sess_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

/**
 * POST /api/chat — body ChatRequest; response is NDJSON (one ChatStreamEvent
 * per line), flushed as each event happens.
 */
import type { NextRequest } from "next/server";
import { runTurn } from "@/lib/pipeline";
import type { ChatRequest, ChatStreamEvent } from "@/lib/types";

function parseBody(raw: unknown): ChatRequest | null {
  if (!raw || typeof raw !== "object") return null;
  const b = raw as Partial<ChatRequest>;
  if (typeof b.message !== "string") return null;
  const history = Array.isArray(b.history) ? b.history.filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string") : [];
  return {
    sessionId: typeof b.sessionId === "string" && b.sessionId ? b.sessionId : "demo-session",
    customerId: typeof b.customerId === "string" && b.customerId ? b.customerId : "cust_demo_01",
    message: b.message,
    history,
    simulate: b.simulate && typeof b.simulate === "object" ? { providerDown: Boolean(b.simulate.providerDown) } : undefined,
  };
}

export async function POST(req: NextRequest) {
  const raw = await req.json().catch(() => null);
  const body = parseBody(raw);
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const emit = (e: ChatStreamEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(e)}\n`));
        } catch {
          closed = true;
        }
      };
      if (!body) {
        emit({ type: "error", message: "Cerere invalidă: lipsește câmpul `message`." });
      } else {
        try {
          await runTurn(body, emit);
        } catch (err) {
          emit({ type: "error", message: err instanceof Error ? err.message : String(err) });
        }
      }
      closed = true;
      controller.close();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
      Connection: "keep-alive",
    },
  });
}

/**
 * `dev-http` provider — a vendor-neutral hook for LOCAL DEVELOPMENT ONLY.
 *
 * When `HB_DEV_PROVIDER_URL` is set (normally in .env.local, which is not
 * committed), the gateway can send the assembled prompt to that URL and read
 * the answer back. The repository knows nothing about what runs behind the
 * URL; the production chain is Dialogflow CX + Gemini (Vertex AI).
 *
 * Protocol (POST, JSON body):
 *   { "system": string, "messages": [{ "role": "user"|"assistant", "content": string }], "json": boolean }
 * Response: either `application/x-ndjson` with lines
 *   { "type": "token", "text": string } … { "type": "done", "model"?: string, "usage"?: {...} }
 * or any other content type, read as the full answer text.
 */
import type { ChatMessage } from "@/lib/types";

export const DEV_HTTP_TIMEOUT_MS = 90_000;

export function devHttpUrl(): string | undefined {
  const u = process.env.HB_DEV_PROVIDER_URL?.trim();
  return u ? u : undefined;
}

export function devHttpEnabled(): boolean {
  return Boolean(devHttpUrl());
}

export interface DevHttpOutput {
  text: string;
  model?: string;
  usage?: { input_tokens: number; output_tokens: number; cached_tokens?: number };
  extra: Record<string, unknown>;
}

export async function devHttpGenerate(args: {
  system: string;
  messages: ChatMessage[];
  onToken?: (t: string) => void;
  signal?: AbortSignal;
  json?: boolean;
}): Promise<DevHttpOutput> {
  const url = devHttpUrl();
  if (!url) throw new Error("dev-http: HB_DEV_PROVIDER_URL lipsește");

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/x-ndjson, text/plain" },
    body: JSON.stringify({ system: args.system, messages: args.messages, json: Boolean(args.json) }),
    signal: args.signal,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`dev-http: ${res.status} ${body.slice(0, 160)}`);
  }

  const ctype = res.headers.get("content-type") ?? "";
  let text = "";
  let model: string | undefined;
  let usage: DevHttpOutput["usage"];

  if (ctype.includes("ndjson") && res.body) {
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    const handle = (line: string) => {
      if (!line.trim()) return;
      const ev = JSON.parse(line) as { type: string; text?: string; model?: string; usage?: DevHttpOutput["usage"]; message?: string };
      if (ev.type === "token" && ev.text) {
        text += ev.text;
        args.onToken?.(ev.text);
      } else if (ev.type === "done") {
        model = ev.model ?? model;
        usage = ev.usage ?? usage;
      } else if (ev.type === "error") {
        throw new Error(`dev-http: ${ev.message ?? "eroare"}`);
      }
    };
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i: number;
      while ((i = buf.indexOf("\n")) >= 0) {
        handle(buf.slice(0, i));
        buf = buf.slice(i + 1);
      }
    }
    if (buf.trim()) handle(buf);
  } else {
    text = await res.text();
    if (!args.json && args.onToken && text) args.onToken(text);
  }

  text = text.trim();
  if (!text) throw new Error("dev-http: răspuns gol");
  return { text, model, usage, extra: { doar_dezvoltare_locala: true, url_configurat: true } };
}

/** Strip ```json fences and parse the first {...} object. */
export function parseJsonLoose(text: string): unknown {
  const t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  return JSON.parse(start >= 0 && end > start ? t.slice(start, end + 1) : t);
}

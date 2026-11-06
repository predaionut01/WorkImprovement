/**
 * Step 5 — Inference Gateway: one internal interface, a pluggable provider
 * chain, per-attempt telemetry, streaming, typed error handling.
 *
 * Chain (env HB_PROVIDER_CHAIN, default
 * "dialogflow,gemini-pro,gemini-flash,dev-http,template"):
 *   dialogflow   → Dialogflow CX detectIntent (non-streaming; one token)
 *   gemini-pro   → Gemini main model on Vertex AI / Gemini API, streaming
 *   gemini-flash → Gemini Flash, streaming
 *   dev-http     → neutral local-development hook (HB_DEV_PROVIDER_URL only)
 *   template     → deterministic Romanian answer from the context pack
 * Unconfigured providers are skipped with a trace note; failures move on to
 * the next provider; the template never fails.
 */
import type { ChatMessage, Intent } from "@/lib/types";
import { DEV_HTTP_TIMEOUT_MS, devHttpGenerate } from "./devHttp";
import { detectIntent, dialogflowConfigured, dialogflowDetails } from "./dialogflow";
import { classifyError, GEMINI_MODELS, geminiThinkingConfig, getGemini, LLM_TIMEOUT_MS, markDown, vendorAvailable, vendorStatus, type Vendor } from "./llm";
import { composeTemplate, streamTemplate } from "./template";
import type { ContextPack, DialogflowResult, GatewayAttempt, GatewayResult, RouterEntities } from "./types";

export const DEFAULT_CHAIN = ["dialogflow", "gemini-pro", "gemini-flash", "dev-http", "template"];

export interface GenerateArgs {
  system: string;
  messages: ChatMessage[];
  onToken: (text: string) => void;
  signal: AbortSignal;
  /** Inputs for the deterministic template provider. */
  template: { intent: Intent; pack: ContextPack; entities: RouterEntities; message: string };
  /** Inputs for the Dialogflow provider (+ a cached detectIntent result from the router). */
  dialogflow: { sessionId: string; tokenizedMessage: string; pack: ContextPack; cached?: DialogflowResult };
}

export interface ProviderOutput {
  text: string;
  usage?: GatewayResult["usage"];
  extra?: Record<string, unknown>;
}

export interface Provider {
  id: string;
  vendor: Vendor | "dialogflow";
  model: string;
  configured(): boolean;
  status(): string;
  /** Per-provider wall-clock limit (default LLM_TIMEOUT_MS). */
  timeoutMs?: number;
  generate(args: GenerateArgs): Promise<ProviderOutput>;
}

function toGeminiContents(messages: ChatMessage[]) {
  return messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
}

function geminiProvider(id: string, model: string): Provider {
  return {
    id,
    vendor: "gemini",
    model,
    configured: () => vendorAvailable("gemini"),
    status: () => vendorStatus("gemini"),
    async generate({ system, messages, onToken, signal }) {
      const stream = await getGemini().models.generateContentStream({
        model,
        contents: toGeminiContents(messages),
        config: {
          systemInstruction: system,
          maxOutputTokens: 2048,
          abortSignal: signal,
          httpOptions: { timeout: LLM_TIMEOUT_MS },
          ...geminiThinkingConfig(model),
        },
      });
      let text = "";
      let last: Awaited<ReturnType<typeof stream.next>>["value"] | undefined;
      for await (const chunk of stream) {
        last = chunk;
        const t = chunk.text;
        if (t) {
          text += t;
          onToken(t);
        }
      }
      const finish = last?.candidates?.[0]?.finishReason;
      if (!text.trim()) throw new Error(`gemini: răspuns gol (finishReason=${finish ?? "n/a"}${last?.promptFeedback?.blockReason ? `, blockReason=${last.promptFeedback.blockReason}` : ""})`);
      const u = last?.usageMetadata;
      return {
        text,
        usage: u ? { input_tokens: u.promptTokenCount ?? 0, output_tokens: u.candidatesTokenCount ?? 0, cached_tokens: u.cachedContentTokenCount ?? undefined, thinking_tokens: u.thoughtsTokenCount ?? undefined } : undefined,
        extra: { finish_reason: finish ?? null },
      };
    },
  };
}

const dialogflowProvider: Provider = {
  id: "dialogflow",
  vendor: "dialogflow",
  model: "dialogflow-cx",
  configured: () => dialogflowConfigured(),
  status: () => (dialogflowConfigured() ? "disponibil" : "neconfigurat (DF_PROJECT_ID / DF_LOCATION / DF_AGENT_ID lipsesc)"),
  async generate({ dialogflow, onToken, signal }) {
    const r = dialogflow.cached ?? (await detectIntent({ sessionId: dialogflow.sessionId, text: dialogflow.tokenizedMessage, pack: dialogflow.pack, signal }));
    if (!r.text.trim()) throw new Error(`dialogflow: fără text în răspuns (match ${r.matchType})`);
    onToken(r.text);
    return { text: r.text, extra: { ...dialogflowDetails(r), reused_router_call: Boolean(dialogflow.cached) } };
  },
};

const devHttpProvider: Provider = {
  id: "dev-http",
  vendor: "dev-http",
  model: "dev-http",
  timeoutMs: DEV_HTTP_TIMEOUT_MS,
  configured: () => vendorAvailable("dev-http"),
  status: () => vendorStatus("dev-http"),
  async generate({ system, messages, onToken, signal }) {
    const out = await devHttpGenerate({ system, messages, onToken, signal });
    return { text: out.text, usage: out.usage, extra: { ...out.extra, model_raportat: out.model ?? null } };
  },
};

const templateProvider: Provider = {
  id: "template",
  vendor: "template",
  model: "template",
  configured: () => true,
  status: () => "disponibil",
  async generate({ template, onToken, signal }) {
    const text = composeTemplate(template);
    await streamTemplate(text, onToken, signal);
    return { text };
  },
};

export const PROVIDERS: Record<string, Provider> = {
  dialogflow: dialogflowProvider,
  "gemini-pro": geminiProvider("gemini-pro", GEMINI_MODELS.main),
  "gemini-flash": geminiProvider("gemini-flash", GEMINI_MODELS.small),
  "dev-http": devHttpProvider,
  template: templateProvider,
};

export function providerChain(): Provider[] {
  const raw = (process.env.HB_PROVIDER_CHAIN || DEFAULT_CHAIN.join(","))
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const chain = raw.map((id) => PROVIDERS[id]).filter((p): p is Provider => Boolean(p));
  if (!chain.some((p) => p.id === "template")) chain.push(templateProvider);
  return chain;
}

export async function generate(args: Omit<GenerateArgs, "signal"> & { simulateProviderDown?: boolean }): Promise<GatewayResult> {
  const attempts: GatewayAttempt[] = [];
  const skipped: GatewayResult["skipped"] = [];
  const chain = providerChain();
  // "Provider down" kills the first provider that would actually run.
  const firstLive = chain.find((p) => p.id !== "template" && p.configured());

  for (const p of chain) {
    if (!p.configured()) {
      skipped.push({ provider: p.id, reason: p.status() });
      continue;
    }
    const t0 = Date.now();
    if (args.simulateProviderDown && firstLive && p.id === firstLive.id) {
      attempts.push({ provider: p.id, model: p.model, ok: false, ms: 0, error: "simulare: furnizor indisponibil (demo)" });
      continue;
    }
    const limit = p.timeoutMs ?? LLM_TIMEOUT_MS;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(new Error(`timeout după ${limit} ms`)), limit + 500);
    let streamed = "";
    try {
      const out = await p.generate({
        ...args,
        signal: ctrl.signal,
        onToken: (t) => {
          streamed += t;
          args.onToken(t);
        },
      });
      attempts.push({ provider: p.id, model: p.model, ok: true, ms: Date.now() - t0 });
      const liveProvidersExist = Boolean(firstLive);
      return {
        text: out.text,
        provider: p.id,
        vendor: p.vendor,
        model: typeof out.extra?.model_raportat === "string" ? out.extra.model_raportat : p.model,
        mode: p.vendor === "template" ? "offline" : "llm",
        // The template is a "fallback" only when a live provider existed and failed.
        fallbackUsed: attempts.length > 1 || (p.vendor === "template" && liveProvidersExist),
        attempts,
        skipped,
        usage: out.usage,
        extra: out.extra,
      };
    } catch (err) {
      const c = classifyError(err);
      if (c.kind === "no_credentials" && (p.vendor === "gemini" || p.vendor === "dev-http")) markDown(p.vendor, c.message);
      attempts.push({ provider: p.id, model: p.model, ok: false, ms: Date.now() - t0, error: c.message + (streamed ? ` (după ${streamed.length} caractere streamate)` : "") });
      // If a provider streamed partial text before failing, the next provider restarts the answer.
      if (streamed) args.onToken("\n\n");
    } finally {
      clearTimeout(timer);
    }
  }
  // unreachable: the template provider never throws
  throw new Error("gateway: niciun furnizor nu a răspuns");
}

export function gatewayDetails(r: GatewayResult): Record<string, unknown> {
  return {
    mode: r.vendor,
    provider: r.provider,
    model: r.model,
    fallback: r.fallbackUsed,
    lant: providerChain().map((p) => p.id),
    incercari: r.attempts.map((a) => ({ furnizor: a.provider, model: a.model, ok: a.ok, ms: a.ms, ...(a.error ? { eroare: a.error } : {}) })),
    sarite: r.skipped.map((s) => `${s.provider}: ${s.reason}`),
    ...(r.usage ? { tokeni: r.usage } : {}),
    ...(r.extra ?? {}),
    caractere_raspuns: r.text.length,
  };
}

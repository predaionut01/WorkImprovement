/**
 * Vendor layer: Google Gemini (Vertex AI / Gemini API) + the neutral
 * `dev-http` hook + offline detection.
 *
 * - Gemini via `@google/genai`: `new GoogleGenAI({})` reads GEMINI_API_KEY /
 *   GOOGLE_API_KEY (Gemini Developer API) or GOOGLE_GENAI_USE_VERTEXAI=true +
 *   GOOGLE_CLOUD_PROJECT + GOOGLE_CLOUD_LOCATION (Vertex AI with ADC).
 * - dev-http: only when HB_DEV_PROVIDER_URL is set (local development).
 *
 * The whole pipeline must work without any credentials: every LLM-backed step
 * checks `isOffline()` first and falls back to its deterministic twin. Once a
 * vendor reports missing credentials we remember it for the process so later
 * turns don't pay a failing round-trip.
 */
import { ApiError, GoogleGenAI, ThinkingLevel } from "@google/genai";
import { z } from "zod";
import { DEV_HTTP_TIMEOUT_MS, devHttpEnabled, devHttpGenerate, parseJsonLoose } from "./devHttp";

export type Vendor = "gemini" | "dev-http" | "template";

export const GEMINI_MODELS = {
  main: process.env.GEMINI_MODEL_MAIN || "gemini-3.1-pro-preview",
  small: process.env.GEMINI_MODEL_SMALL || "gemini-3.8-flash",
} as const;

export const LLM_TIMEOUT_MS = 15_000;
export const SMALL_TIMEOUT_MS = 10_000;

let gemini: GoogleGenAI | null = null;
const down: Partial<Record<Vendor, string>> = {};

export function forcedOffline(): boolean {
  const v = process.env.HB_FORCE_OFFLINE;
  return v === "1" || v === "true";
}

export function geminiConfigured(): boolean {
  const env = process.env;
  if (env.GEMINI_API_KEY || env.GOOGLE_API_KEY) return true;
  const vertex = env.GOOGLE_GENAI_USE_VERTEXAI === "true" || env.GOOGLE_GENAI_USE_ENTERPRISE === "true";
  return vertex && Boolean(env.GOOGLE_CLOUD_PROJECT) && Boolean(env.GOOGLE_CLOUD_LOCATION);
}

export function vendorAvailable(v: Vendor): boolean {
  if (forcedOffline()) return v === "template";
  if (v === "template") return true;
  if (down[v]) return false;
  if (v === "dev-http") return devHttpEnabled();
  return geminiConfigured();
}

/** Why a vendor is unavailable (for the trace). */
export function vendorStatus(v: Vendor): string {
  if (forcedOffline()) return "HB_FORCE_OFFLINE=1";
  if (down[v]) return down[v]!;
  if (v === "gemini" && !geminiConfigured()) return "neconfigurat (GEMINI_API_KEY / GOOGLE_API_KEY / Vertex env lipsesc)";
  if (v === "dev-http" && !devHttpEnabled()) return "dezactivat (HB_DEV_PROVIDER_URL doar pentru dezvoltare locală)";
  return "disponibil";
}

export function isOffline(): { offline: boolean; reason: string } {
  if (forcedOffline()) return { offline: true, reason: "HB_FORCE_OFFLINE=1" };
  if (vendorAvailable("gemini") || vendorAvailable("dev-http")) return { offline: false, reason: "" };
  return { offline: true, reason: `gemini: ${vendorStatus("gemini")}; dev-http: ${vendorStatus("dev-http")}` };
}

export function markDown(v: Vendor, reason: string) {
  if (v !== "template") down[v] = reason;
}

/** Forget remembered outages (e.g. after /api/ops/reset). */
export function resetOffline() {
  delete down.gemini;
  delete down["dev-http"];
}

export function getGemini(): GoogleGenAI {
  if (!gemini) gemini = new GoogleGenAI({});
  return gemini;
}

/** Gemini 3+/4 accept `thinkingLevel`; older models reject it. */
export function geminiThinkingConfig(model: string) {
  return /^gemini-(3|4)/.test(model) ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } } : {};
}

export interface ClassifiedError {
  kind: "no_credentials" | "api" | "timeout" | "other";
  message: string;
}

/**
 * Classify an error thrown by a vendor. "no_credentials" marks that vendor
 * down for the process; everything else is a per-attempt failure.
 */
export function classifyError(err: unknown): ClassifiedError {
  if (err instanceof ApiError) {
    if (err.status === 401 || err.status === 403) return { kind: "no_credentials", message: `${err.status} ${err.message.slice(0, 160)}` };
    return { kind: "api", message: `${err.status} ${err.message.slice(0, 160)}` };
  }
  const msg = err instanceof Error ? err.message : String(err);
  if (/could not resolve authentication|api key|credential|unable to authenticate|could not load the default credentials|project.*location|not logged in|log in|authentication|ECONNREFUSED|fetch failed/i.test(msg)) {
    return { kind: "no_credentials", message: msg.slice(0, 160) };
  }
  if (/abort|timeout|timed out/i.test(msg)) return { kind: "timeout", message: msg.slice(0, 160) };
  return { kind: "other", message: msg.slice(0, 160) };
}

export function withTimeout(ms: number): { signal: AbortSignal; clear: () => void } {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(new Error(`timeout after ${ms}ms`)), ms);
  return { signal: ctrl.signal, clear: () => clearTimeout(t) };
}

export interface StructuredResult<T> {
  value: T;
  vendor: Exclude<Vendor, "template">;
  model: string;
}

/**
 * One structured-JSON call for the router / judges. Gemini Flash first
 * (responseMimeType + responseJsonSchema); the dev-http hook only when Gemini
 * is not configured. Throws when no vendor is available — callers fall back
 * to their offline heuristics.
 */
export async function structuredJson<S extends z.ZodType>(args: { system: string; user: string; schema: S; maxTokens?: number; timeoutMs?: number }): Promise<StructuredResult<z.infer<S>>> {
  const timeoutMs = args.timeoutMs ?? SMALL_TIMEOUT_MS;
  const errors: string[] = [];

  if (vendorAvailable("gemini")) {
    const model = GEMINI_MODELS.small;
    const t = withTimeout(timeoutMs);
    try {
      const res = await getGemini().models.generateContent({
        model,
        contents: args.user,
        config: {
          systemInstruction: args.system,
          responseMimeType: "application/json",
          responseJsonSchema: z.toJSONSchema(args.schema),
          maxOutputTokens: args.maxTokens ?? 2048,
          abortSignal: t.signal,
          httpOptions: { timeout: timeoutMs },
          ...geminiThinkingConfig(model),
        },
      });
      const text = res.text;
      if (!text) throw new Error(`gemini: empty response (${res.candidates?.[0]?.finishReason ?? "no candidates"})`);
      return { value: args.schema.parse(JSON.parse(text)), vendor: "gemini", model };
    } catch (err) {
      const c = classifyError(err);
      if (c.kind === "no_credentials") markDown("gemini", c.message);
      errors.push(`gemini/${model}: ${c.message}`);
    } finally {
      t.clear();
    }
  }

  if (vendorAvailable("dev-http")) {
    const t = withTimeout(DEV_HTTP_TIMEOUT_MS);
    try {
      const schemaJson = JSON.stringify(z.toJSONSchema(args.schema));
      const out = await devHttpGenerate({
        system: `${args.system}\n\nRăspunzi DOAR cu un obiect JSON valid (fără text în plus, fără \`\`\`), conform acestei scheme JSON Schema:\n${schemaJson}`,
        messages: [{ role: "user", content: args.user }],
        signal: t.signal,
        json: true,
      });
      return { value: args.schema.parse(parseJsonLoose(out.text)), vendor: "dev-http", model: out.model ?? "dev-http" };
    } catch (err) {
      const c = classifyError(err);
      if (c.kind === "no_credentials") markDown("dev-http", c.message);
      errors.push(`dev-http: ${c.message}`);
    } finally {
      t.clear();
    }
  }

  throw new Error(errors.length ? errors.join(" | ") : `niciun furnizor LLM disponibil (${isOffline().reason})`);
}

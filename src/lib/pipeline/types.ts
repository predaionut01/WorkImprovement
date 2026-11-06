/**
 * Internal pipeline types (not part of the UI contract in src/lib/types.ts).
 */
import type { Branch, ChatStreamEvent, Intent, TraceStep, TxCategory } from "@/lib/types";

export type Emit = (event: ChatStreamEvent) => void;

/** Which engine actually produced a step's result. */
export type Mode = "llm" | "offline";

export interface RouterEntities {
  last4?: string;
  amount?: number;
  currency?: "RON" | "EUR" | "USD";
  personToken?: string;
  category?: TxCategory;
  /** YYYY-MM */
  month?: string;
  merchant?: string;
  product?: string;
}

export interface RouterResult {
  branch: Branch;
  intent: Intent;
  confidence: number;
  entities: RouterEntities;
  mode: Mode;
  vendor?: "gemini" | "dev-http" | "dialogflow";
  model?: string;
  /** Deterministic rules that overrode / confirmed the classification. */
  rulesApplied: string[];
  rawError?: string;
  /** Cached Dialogflow CX detectIntent result (reused by the gateway when the match came from a Playbook). */
  dialogflow?: DialogflowResult;
}

export interface DialogflowResult {
  text: string;
  matchType: string;
  intentDisplayName?: string;
  confidence?: number;
  parameters: Record<string, unknown>;
  currentPlaybooks?: string[];
  generativeInfo?: unknown;
  responseId?: string;
  ms: number;
}

export interface Policy {
  id: string;
  text: string;
}

export interface KnowledgeHit {
  file: string;
  title: string;
  text: string;
  score: number;
}

export interface ContextPack {
  schema: string;
  customer: { segment: string; package: string; lang: string; country: "RO" };
  policies: Policy[];
  fetched_ms: number;
  knowledge?: KnowledgeHit[];
  [key: string]: unknown;
}

export interface ContextResult {
  pack: ContextPack;
  /** Which bank.* calls were made (for the trace). */
  calls: string[];
  /** Retrieval details (GENERAL_QA only). */
  retrieval?: { query: string; hits: { file: string; title: string; score: number }[]; injectionDropped: number };
}

export interface GatewayAttempt {
  /** provider id from the chain: dialogflow | gemini-pro | gemini-flash | dev-http | template */
  provider: string;
  model: string;
  ok: boolean;
  ms: number;
  error?: string;
}

export interface GatewayResult {
  text: string;
  provider: string;
  vendor: "dialogflow" | "gemini" | "dev-http" | "template";
  model: string;
  mode: Mode;
  fallbackUsed: boolean;
  attempts: GatewayAttempt[];
  /** Providers in the chain that were not configured and were skipped. */
  skipped: { provider: string; reason: string }[];
  /** Dialogflow-only extras for the trace. */
  extra?: Record<string, unknown>;
  usage?: { input_tokens: number; output_tokens: number; cached_tokens?: number; thinking_tokens?: number };
}

export interface GuardCheck {
  name: string;
  pass: boolean;
  count: number;
  note?: string;
}

export interface OutputGuardResult {
  /** Detokenized, final text for the client. */
  text: string;
  /** Still-pseudonymized text, for the store / judges. */
  pseudonymizedText: string;
  verdict: "pass" | "warn" | "fail";
  checks: GuardCheck[];
  ungroundedNumbers: string[];
}

export type StepRecorder = {
  running: (summary: string, details?: Record<string, unknown>) => void;
  ok: (summary: string, details?: Record<string, unknown>) => TraceStep;
  blocked: (summary: string, details?: Record<string, unknown>) => TraceStep;
  skipped: (summary: string, details?: Record<string, unknown>) => TraceStep;
  error: (summary: string, details?: Record<string, unknown>) => TraceStep;
};

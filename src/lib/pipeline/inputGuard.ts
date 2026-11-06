/**
 * Step 1 — Input guard: pseudonymize, detect prompt injection, basic hygiene.
 * Trace details are redacted (counts + token names only, never raw PII).
 */
import { detectAbuse, detectInjection } from "./injection";
import type { Vault, TokenizeStats } from "./vault";

export const MAX_MESSAGE_CHARS = 1500;

export type InputGuardReason = "injection" | "empty" | "too_long" | "abuse";

export interface InputGuardResult {
  ok: boolean;
  reason?: InputGuardReason;
  /** Fixed reply when blocked (no LLM involved). */
  reply?: string;
  /** Pseudonymized message (always computed, even when blocked, for the store). */
  tokenizedMessage: string;
  stats: TokenizeStats;
  injection: { hit: boolean; patterns: string[] };
  length: number;
}

export const FIXED_REPLIES: Record<InputGuardReason, string> = {
  injection:
    "Nu pot da curs acestei cereri. Asistentul Home'Bank răspunde doar la întrebări despre conturile tale și despre produsele băncii, în limitele regulilor de securitate. Dacă ai nevoie de ajutor, un coleg din call center te poate prelua.",
  empty: "Nu am primit niciun mesaj. Scrie-mi, te rog, cu ce te pot ajuta.",
  too_long: `Mesajul este prea lung (limita este ${MAX_MESSAGE_CHARS} de caractere). Te rog să îl scurtezi sau să îl împarți în mai multe întrebări.`,
  abuse: "Înțeleg că ești nemulțumit. Te rog să păstrăm un ton respectuos; dacă preferi, te pot pune în legătură cu un coleg din call center.",
};

export function runInputGuard(message: string, vault: Vault): InputGuardResult {
  const raw = message ?? "";
  const trimmed = raw.trim();
  const { text: tokenizedMessage, stats } = vault.tokenizeWithStats(trimmed);
  const injection = detectInjection(trimmed);
  const base = { tokenizedMessage, stats, injection, length: trimmed.length };

  if (!trimmed) return { ...base, ok: false, reason: "empty", reply: FIXED_REPLIES.empty };
  if (trimmed.length > MAX_MESSAGE_CHARS) return { ...base, ok: false, reason: "too_long", reply: FIXED_REPLIES.too_long };
  if (injection.hit) return { ...base, ok: false, reason: "injection", reply: FIXED_REPLIES.injection };
  const abuse = detectAbuse(trimmed);
  if (abuse.hit) return { ...base, ok: false, reason: "abuse", reply: FIXED_REPLIES.abuse };
  return { ...base, ok: true };
}

/** Redacted details for the trace panel. */
export function inputGuardDetails(r: InputGuardResult): Record<string, unknown> {
  const pii = Object.fromEntries(Object.entries(r.stats.counts).filter(([, n]) => n > 0));
  return {
    lungime: r.length,
    limita: MAX_MESSAGE_CHARS,
    pii_detectat: pii,
    tokeni: r.stats.tokens,
    injection: r.injection.hit ? { detectat: true, tipare: r.injection.patterns } : { detectat: false },
    motiv_blocare: r.reason ?? null,
  };
}

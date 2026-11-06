/**
 * Per-session pseudonymization vault.
 *
 * Raw PII (IBAN, CNP, phone, email, card numbers, known person names) is
 * replaced with stable tokens such as <IBAN_01> / <PERSON_02>. The mapping
 * lives only in this process, keyed by sessionId. Detokenization happens
 * exactly once, in the output guard, right before delivery.
 */
import { bank } from "@/lib/mock/bank";

export type PiiKind = "IBAN" | "CNP" | "PHONE" | "EMAIL" | "CARD" | "PERSON";

export interface TokenizeStats {
  counts: Record<PiiKind, number>;
  tokens: string[];
}

interface NameEntry {
  /** canonical display value (what detokenize restores) */
  value: string;
  /** all surface forms that map to the same token, lower-cased */
  forms: string[];
  token: string;
}

const TOKEN_RE = /<([A-Z]+)_(\d+)>/g;

// Regexes. Order matters: IBAN before CARD/CNP (an IBAN contains long digit runs).
const IBAN_RE = /\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]){11,30}\b/g;
const CNP_RE = /\b[1-9]\d{12}\b/g;
const CARD_RE = /\b(?:\d[ -]?){13,19}\b/g;
const PHONE_RE = /(?:\+40[\s.-]?|\b0)(?:7\d{2}|2\d{2}|3\d{2})[\s.-]?\d{3}[\s.-]?\d{3}\b/g;
const EMAIL_RE = /\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/g;

export class Vault {
  private counters: Record<PiiKind, number> = { IBAN: 0, CNP: 0, PHONE: 0, EMAIL: 0, CARD: 0, PERSON: 0 };
  private valueToToken = new Map<string, string>();
  private tokenToValue = new Map<string, string>();
  private names: NameEntry[] = [];
  /** Single regex over all known name forms, rebuilt when names change. */
  private nameRe: RegExp | null = null;

  constructor(
    public readonly sessionId: string,
    public readonly customerId: string,
  ) {
    this.seedKnownNames();
  }

  private seedKnownNames() {
    let data;
    try {
      data = {
        customer: bank.customer(this.customerId),
        beneficiaries: bank.beneficiaries(this.customerId),
        transfers: bank.transfers(this.customerId),
        transactions: bank.transactions(this.customerId),
      };
    } catch {
      return;
    }
    const c = data.customer;
    this.registerName(`${c.firstName} ${c.lastName}`);
    for (const b of data.beneficiaries) this.registerName(b.name);
    for (const t of data.transfers) this.registerName(t.toName);
    for (const t of data.transactions) if (t.counterparty?.name) this.registerName(t.counterparty.name);
    // Known PII values of the customer get stable tokens too.
    this.tokenFor("CNP", c.cnp);
    this.tokenFor("PHONE", c.phone);
    this.tokenFor("EMAIL", c.email);
  }

  /** Register a person/organisation name; same name → same token. */
  registerName(name: string): string {
    const clean = name.trim().replace(/\s+/g, " ");
    if (!clean) return "";
    const lower = clean.toLowerCase();
    const existing = this.names.find((n) => n.forms.includes(lower));
    if (existing) return existing.token;
    const token = this.tokenFor("PERSON", clean);
    const forms = new Set<string>([lower]);
    const parts = clean.split(" ");
    if (parts.length === 2) {
      forms.add(`${parts[1]} ${parts[0]}`.toLowerCase()); // "Ionescu Maria"
      // first name alone (≥ 4 chars, unique among known names) — e.g. "Maria"
      const first = parts[0].toLowerCase();
      if (first.length >= 4 && !this.names.some((n) => n.forms.includes(first))) forms.add(first);
    }
    this.names.push({ value: clean, forms: [...forms], token });
    this.nameRe = null;
    return token;
  }

  private tokenFor(kind: PiiKind, value: string): string {
    const key = `${kind}:${value}`;
    const found = this.valueToToken.get(key);
    if (found) return found;
    this.counters[kind] += 1;
    const token = `<${kind}_${String(this.counters[kind]).padStart(2, "0")}>`;
    this.valueToToken.set(key, token);
    this.tokenToValue.set(token, value);
    return token;
  }

  private buildNameRe(): RegExp {
    if (this.nameRe) return this.nameRe;
    const forms = this.names
      .flatMap((n) => n.forms)
      .sort((a, b) => b.length - a.length)
      .map((f) => f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    this.nameRe = forms.length ? new RegExp(`(?<![\\p{L}])(?:${forms.join("|")})(?![\\p{L}])`, "giu") : /$^/g;
    return this.nameRe;
  }

  /** Replace raw PII in free text with tokens. Returns stats safe to display. */
  tokenizeWithStats(text: string): { text: string; stats: TokenizeStats } {
    const counts: Record<PiiKind, number> = { IBAN: 0, CNP: 0, PHONE: 0, EMAIL: 0, CARD: 0, PERSON: 0 };
    const tokens = new Set<string>();
    let out = text;
    const sub = (kind: PiiKind, re: RegExp, normalize: (s: string) => string = (s) => s) => {
      out = out.replace(re, (m) => {
        // never re-tokenize an existing token
        if (/^<[A-Z]+_\d+>$/.test(m)) return m;
        const t = this.tokenFor(kind, normalize(m));
        counts[kind] += 1;
        tokens.add(t);
        return t;
      });
    };
    sub("IBAN", IBAN_RE, (s) => s.replace(/\s/g, "").toUpperCase());
    sub("EMAIL", EMAIL_RE);
    sub("CNP", CNP_RE);
    sub("CARD", CARD_RE, (s) => s.replace(/[ -]/g, ""));
    sub("PHONE", PHONE_RE);
    if (this.names.length) {
      const re = this.buildNameRe();
      out = out.replace(re, (m) => {
        const entry = this.names.find((n) => n.forms.includes(m.toLowerCase()));
        if (!entry) return m;
        counts.PERSON += 1;
        tokens.add(entry.token);
        return entry.token;
      });
    }
    return { text: out, stats: { counts, tokens: [...tokens] } };
  }

  tokenize(text: string): string {
    return this.tokenizeWithStats(text).text;
  }

  /** Recursively tokenize every string inside a JSON-like value. */
  tokenizeDeep<T>(value: T): T {
    if (typeof value === "string") return this.tokenize(value) as unknown as T;
    if (Array.isArray(value)) return value.map((v) => this.tokenizeDeep(v)) as unknown as T;
    if (value && typeof value === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = this.tokenizeDeep(v);
      return out as T;
    }
    return value;
  }

  /** Restore real values. Unknown tokens are left untouched (the output guard removes them first). */
  detokenize(text: string): string {
    return text.replace(TOKEN_RE, (m) => this.tokenToValue.get(m) ?? m);
  }

  knownTokens(): string[] {
    return [...this.tokenToValue.keys()];
  }

  hasToken(token: string): boolean {
    return this.tokenToValue.has(token);
  }
}

const vaults = new Map<string, Vault>();

export function getVault(sessionId: string, customerId: string): Vault {
  const key = `${sessionId}::${customerId}`;
  let v = vaults.get(key);
  if (!v) {
    v = new Vault(sessionId, customerId);
    vaults.set(key, v);
  }
  return v;
}

export function resetVaults() {
  vaults.clear();
}

/** All `<KIND_NN>` tokens present in a text. */
export function findTokens(text: string): string[] {
  return [...new Set(text.match(/<[A-Z]+_\d+>/g) ?? [])];
}

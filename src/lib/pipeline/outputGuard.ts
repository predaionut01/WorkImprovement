/**
 * Step 6 — Output guard. Runs on the full (still pseudonymized) answer:
 *  a) raw PII leak → "[redactat]"       b) unknown tokens → removed
 *  c) forbidden advice → safe refusal    d) grounding of numbers (warn only)
 *  e) detokenize LAST, inside the perimeter.
 * Trace details carry pass/fail + counts, never raw values.
 */
import type { Branch, Intent } from "@/lib/types";
import { HUMAN_OFFER } from "./template";
import type { ContextPack, GuardCheck, OutputGuardResult } from "./types";
import { findTokens, type Vault } from "./vault";

const RAW_PII: { name: string; re: RegExp }[] = [
  { name: "iban", re: /\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]){11,30}\b/g },
  { name: "email", re: /\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/g },
  { name: "cnp", re: /\b[1-9]\d{12}\b/g },
  { name: "card", re: /\b(?:\d[ -]?){13,19}\b/g },
  { name: "phone", re: /(?:\+40[\s.-]?|\b0)(?:7\d{2}|2\d{2}|3\d{2})[\s.-]?\d{3}[\s.-]?\d{3}\b/g },
];

const FORBIDDEN_ADVICE = [
  /\b(îți|iti|vă|va)?\s*recomand(ăm|am)?\s+(să|sa)\s+(investe[sș]ti|cump[eă]ri|vinzi|vinde[tț]i|cump[aă]ra[tț]i|investi[tț]i|iei|lua[tț]i)\b/i,
  /\b(ar trebui|e bine|este bine|merit[ăa])\s+(să|sa)\s+(investe[sș]ti|cump[eă]ri|vinzi|iei (un )?credit|iei creditul|faci (un )?credit|contractezi)\b/i,
  /\b(investe[sș]te|cump[aă]r[aă]|vinde)\s+(acum|în|in)\s+(etf|ac[tț]iuni|fonduri|aur|crypto|bitcoin)\b/i,
  /\b(sfatul meu|te sf[aă]tuiesc|î[tț]i sugerez s[aă] investe[sș]ti)\b/i,
  /\b(i recommend|you should)\s+(invest|buy|sell)\b/i,
];

const SAFE_REFUSAL = `Nu pot oferi recomandări de investiții, ipotecare, juridice sau fiscale. Îți pot arăta oricând datele din contul tău și informațiile publice despre produse. ${HUMAN_OFFER}`;

const SECTION_BY_INTENT: Partial<Record<Intent, string>> = {
  transfer_status: "Plăți",
  spend_by_category: "Rapoarte",
  balance: "Acasă",
  card_info: "Acasă › Carduri",
  transaction_lookup: "Tranzacții",
  deposit_info: "Economii",
  loan_info: "Credite",
  insurance_info: "Asigurări",
  investment_info: "Investiții",
  roundup_info: "Economii › Round Up",
};

/** Numeric interpretations of a number-looking string: "1.234,56" → [1234.56, …]. */
export function numberCandidates(raw: string): number[] {
  const s = raw.trim();
  const out = new Set<number>();
  const push = (v: string) => {
    const n = Number(v);
    if (!Number.isNaN(n)) out.add(Math.round(n * 100) / 100);
  };
  if (s.includes(",") && s.includes(".")) {
    push(s.replace(/\./g, "").replace(",", ".")); // RO: 1.234,56
    push(s.replace(/,/g, "")); // EN: 1,234.56
  } else if (s.includes(",")) {
    push(s.replace(",", ".")); // 240,00
    push(s.replace(/,/g, "")); // 1,234
  } else if (s.includes(".")) {
    push(s); // 240.00
    push(s.replace(/\./g, "")); // 1.234
  } else push(s);
  return [...out];
}

export function extractNumbers(text: string): string[] {
  return (text.match(/\d+(?:[.,]\d+)*/g) ?? []).filter((n) => !/^<[A-Z]+_\d+>$/.test(n));
}

/** Every number present anywhere in the context pack (values + inside strings). */
export function packNumbers(pack: ContextPack): Set<number> {
  const set = new Set<number>();
  const walk = (v: unknown) => {
    if (typeof v === "number") set.add(Math.round(v * 100) / 100);
    else if (typeof v === "string") for (const n of extractNumbers(v)) for (const c of numberCandidates(n)) set.add(c);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v as Record<string, unknown>).forEach(walk);
  };
  walk(pack);
  return set;
}

function grounded(n: number, known: Set<number>): boolean {
  for (const k of known) if (Math.abs(k - n) <= 0.01) return true;
  return false;
}

export function runOutputGuard(args: { text: string; pack: ContextPack; vault: Vault; branch: Branch; intent: Intent }): OutputGuardResult {
  const { pack, vault, branch, intent } = args;
  const checks: GuardCheck[] = [];
  let text = args.text;
  let verdict: OutputGuardResult["verdict"] = "pass";

  // a) raw PII leak
  let piiCount = 0;
  for (const p of RAW_PII) {
    text = text.replace(p.re, (m) => {
      if (/^<[A-Z]+_\d+>$/.test(m)) return m;
      piiCount++;
      return "[redactat]";
    });
  }
  checks.push({ name: "pii_in_clar", pass: piiCount === 0, count: piiCount });
  if (piiCount) verdict = "warn";

  // b) unknown tokens (data of someone else / invented)
  const unknown = findTokens(text).filter((t) => !vault.hasToken(t));
  for (const t of unknown) text = text.split(t).join("").replace(/\s{2,}/g, " ");
  checks.push({ name: "tokeni_necunoscuti", pass: unknown.length === 0, count: unknown.length, ...(unknown.length ? { note: unknown.join(", ") } : {}) });
  if (unknown.length) verdict = "warn";

  // c) forbidden advice
  const advice = FORBIDDEN_ADVICE.filter((re) => re.test(text)).length;
  checks.push({ name: "sfaturi_interzise", pass: advice === 0, count: advice });
  if (advice) {
    text = SAFE_REFUSAL;
    verdict = "fail";
  }

  // d) grounding (numbers ≥ 10 must exist in the context pack / knowledge)
  const known = packNumbers(pack);
  const ungrounded: string[] = [];
  if (!advice) {
    for (const raw of extractNumbers(text)) {
      const cands = numberCandidates(raw);
      if (cands.every((c) => c < 10)) continue;
      if (!cands.some((c) => grounded(c, known))) ungrounded.push(raw);
    }
  }
  const uniqUngrounded = [...new Set(ungrounded)];
  checks.push({ name: "grounding_cifre", pass: uniqUngrounded.length === 0, count: uniqUngrounded.length, ...(uniqUngrounded.length ? { note: `nefondate: ${uniqUngrounded.join(", ")}` } : {}) });
  if (uniqUngrounded.length && branch === "ACCOUNT_QA") {
    if (verdict === "pass") verdict = "warn";
    text = `${text.trimEnd()} (te rog verifică în secțiunea ${SECTION_BY_INTENT[intent] ?? "Tranzacții"})`;
  }

  // e) detokenize last
  const pseudonymizedText = text;
  const finalText = vault.detokenize(text);
  checks.push({ name: "detokenizare", pass: true, count: findTokens(pseudonymizedText).length });

  return { text: finalText, pseudonymizedText, verdict, checks, ungroundedNumbers: uniqUngrounded };
}

export function outputGuardDetails(r: OutputGuardResult): Record<string, unknown> {
  return {
    verdict: r.verdict,
    verificari: r.checks.map((c) => ({ verificare: c.name, trecut: c.pass, numar: c.count, ...(c.note ? { nota: c.note } : {}) })),
    caractere: r.text.length,
  };
}

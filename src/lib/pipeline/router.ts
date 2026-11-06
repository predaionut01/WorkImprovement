/**
 * Step 2 — Router: branch + fine intent + confidence + entities.
 *
 * LLM path: Gemini Flash with a strict JSON schema (structured outputs).
 * Offline path: keyword rules. Deterministic "hard rules" are applied on top
 * of both so that ACTION / forbidden-advice / human-request never depend on
 * the model.
 */
import { z } from "zod";
import { bank } from "@/lib/mock/bank";
import { TODAY } from "@/lib/mock/data";
import type { Branch, Intent, TxCategory } from "@/lib/types";
import { monthNameToIndex, stripDiacritics } from "./format";
import { detectIntent, dialogflowConfigured, dialogflowDetails, intentToBranch, mapDisplayNameToIntent } from "./dialogflow";
import { forcedOffline, isOffline, structuredJson } from "./llm";
import type { RouterEntities, RouterResult } from "./types";

export const CONFIDENCE_THRESHOLD = 0.55;

const BRANCHES = ["ACTION", "ACCOUNT_QA", "GENERAL_QA", "HUMAN", "BLOCKED"] as const satisfies readonly Branch[];
const INTENTS = [
  "transfer_status",
  "spend_by_category",
  "balance",
  "card_info",
  "card_block",
  "card_unblock",
  "transaction_lookup",
  "deposit_info",
  "loan_info",
  "insurance_info",
  "investment_info",
  "roundup_info",
  "product_info",
  "fees_info",
  "how_to",
  "advice_forbidden",
  "human_request",
  "smalltalk",
  "unknown",
] as const satisfies readonly Intent[];

const RouterSchema = z.object({
  branch: z.enum(BRANCHES),
  intent: z.enum(INTENTS),
  confidence: z.number().min(0).max(1),
  entities: z.object({
    last4: z.string().nullable(),
    amount: z.number().nullable(),
    currency: z.enum(["RON", "EUR", "USD"]).nullable(),
    personToken: z.string().nullable(),
    category: z.string().nullable(),
    month: z.string().nullable(),
    merchant: z.string().nullable(),
    product: z.string().nullable(),
  }),
  reason: z.string(),
});

const ROUTER_SYSTEM = `Ești routerul unui asistent bancar (Home'Bank, România). Primești mesajul unui client (deja pseudonimizat: <PERSON_01>, <IBAN_01> etc.) și întorci STRICT JSON conform schemei.

Ramuri (branch):
- ACTION: clientul cere o schimbare în cont (blochează/deblochează card, fă un transfer, plătește). LLM-ul nu execută nimic; fluxul e determinist.
- ACCOUNT_QA: întrebare despre contul propriu (transferuri, cheltuieli, sold, carduri, tranzacții, depozite, credite, asigurări, investiții, Round Up).
- GENERAL_QA: întrebare generală despre produse, dobânzi, comisioane, cum se face ceva, contact; sau smalltalk.
- HUMAN: cere explicit un om/agent/operator, sau cere sfaturi de investiții/ipotecar/juridic/fiscal (intent advice_forbidden), sau nu înțelegi (confidence mică).
- BLOCKED: nu folosi (input guard-ul decide).

Intenții: transfer_status, spend_by_category, balance, card_info, card_block, card_unblock, transaction_lookup, deposit_info, loan_info, insurance_info, investment_info, roundup_info, product_info, fees_info, how_to, advice_forbidden, human_request, smalltalk, unknown.
Dacă clientul întreabă despre produsele băncii în general ("ce dobândă are depozitul la 12 luni?") → GENERAL_QA/product_info. Dacă întreabă despre ale lui ("depozitul meu") → ACCOUNT_QA.

Entități (null dacă lipsesc): last4 (ultimele 4 cifre card), amount (număr), currency (RON/EUR/USD), personToken (ex. "<PERSON_01>"), category (una din: Mâncare & Băutură, Cumpărături, Transport, Utilități, Sănătate, Divertisment, Transfer, Salariu, Comisioane, Dobânzi, Economii, Locuință, Abonamente, Altele), month (YYYY-MM; "luna asta" = ${TODAY.toISOString().slice(0, 7)}), merchant, product.
confidence: 0..1. reason: o propoziție scurtă.`;

// ---------- Keyword rules (offline) ----------

interface Rule {
  intent: Intent;
  branch: Branch;
  re: RegExp;
  confidence: number;
}

const POSSESSIVE = /\b(meu|mea|mele|mei|al meu|ale mele|am|imi|mi-|imi|eu)\b/;

const RULES: Rule[] = [
  { intent: "human_request", branch: "HUMAN", confidence: 0.95, re: /\b(agent|operator|un om|cu un om|persoana reala|coleg|call ?center|vorbesc cu cineva|human|uman)\b/ },
  { intent: "advice_forbidden", branch: "HUMAN", confidence: 0.95, re: /\b(merita|ar trebui sa (investesc|cumpar|vand|iau|imi iau|fac)|ce sa (cumpar|vand|investesc)|recomanzi|recomandare|ce sfat|sfatuiesti|e bine sa (investesc|cumpar|iau)|should i (invest|buy|sell)|worth (investing|buying)|is it worth|in ce sa investesc|ce actiuni|ce etf|ipotecar.*(merita|ar trebui|convine)|optimizare fiscala|ce impozit)\b/ },
  { intent: "card_block", branch: "ACTION", confidence: 0.95, re: /\b(bloch(eaza|eaz|ez|ati|a)|blocare|blocheaza-mi|blocati|ingheat|inghet|suspend|opreste|opriti|dezactiv)\w*\b.*\bcard|\bcard\w*\b.*\b(bloch|blocat|inghet|suspend|opr|dezactiv)|\b(pierdut|furat)\b.*\bcard|\bcard\w*\b.*\b(pierdut|furat)/ },
  { intent: "card_unblock", branch: "ACTION", confidence: 0.95, re: /\b(debloc|reactiv|redeschid)\w*\b.*\bcard|\bcard\w*\b.*\b(debloc|reactiv)/ },
  { intent: "how_to", branch: "ACTION", confidence: 0.9, re: /\b(fa|fac|fa-mi|trimite|trimit|trimite-i|initiaz|initiez|efectueaz|plateste|platesc|achit|vireaz|virez|transfera|transfer)\w*\b\s+(un\s+|o\s+|niste\s+|\d+\s*\w*\s+)?(transfer|plata|bani|lei|euro|eur|ron|factura|rata)/ },
  { intent: "transfer_status", branch: "ACCOUNT_QA", confidence: 0.9, re: /\b(unde (e|este|sunt|mi-e|mi-a)|status|stadiu|a ajuns|au ajuns|ajuns|situatia|ce se intampla|cand ajung|cand ajunge|s-a procesat|a fost procesat|respins|de ce (nu|a))\b.*\b(transfer|virament|plata|platii|banii)|\b(transferul|viramentul|plata)\b.*\b(meu|mea|catre|pentru|de \d)/ },
  { intent: "spend_by_category", branch: "ACCOUNT_QA", confidence: 0.9, re: /\b(cat am (cheltuit|dat|platit)|cheltuit|cheltuieli(le)?|cheltuiala|cat (am )?dat pe|am platit pe|cat ma costa|raport)\b/ },
  { intent: "balance", branch: "ACCOUNT_QA", confidence: 0.9, re: /\b(sold|soldul|soldurile|balanta|cati bani (am|mai am)|cat am in cont|cat mai am|disponibil|disponibilul)\b/ },
  { intent: "transaction_lookup", branch: "ACCOUNT_QA", confidence: 0.85, re: /\b(tranzacti|ultimele plati|ultima plata|plata la|platile la|am platit la|istoric|ce am platit|plati(le)? (din|de))\b/ },
  { intent: "roundup_info", branch: "ACCOUNT_QA", confidence: 0.85, re: /\b(round ?up|rotunjir)\w*\b/ },
  { intent: "deposit_info", branch: "ACCOUNT_QA", confidence: 0.85, re: /\bdepozit\w*\b/ },
  { intent: "loan_info", branch: "ACCOUNT_QA", confidence: 0.85, re: /\b(credit\w*|imprumut\w*|rata|ratele|extra'?rol|overdraft|descoperit de cont|ipotecar\w*)\b/ },
  { intent: "insurance_info", branch: "ACCOUNT_QA", confidence: 0.85, re: /\basigurar\w*\b/ },
  { intent: "investment_info", branch: "ACCOUNT_QA", confidence: 0.85, re: /\b(investiti\w*|portofoliu|fond\w*|etf|actiuni|actiunile)\b/ },
  { intent: "fees_info", branch: "GENERAL_QA", confidence: 0.85, re: /\b(comision\w*|taxa|taxe|cat costa|costuri)\b/ },
  { intent: "card_info", branch: "ACCOUNT_QA", confidence: 0.8, re: /\bcard\w*\b/ },
  { intent: "how_to", branch: "GENERAL_QA", confidence: 0.8, re: /\b(cum (pot|fac|imi|se|as putea|activez|schimb)|cum sa|pasii|procedura)\b/ },
  { intent: "product_info", branch: "GENERAL_QA", confidence: 0.8, re: /\b(dobanda|dobanzi|produs\w*|oferta|conditii|contact\w*|program\w*|telefon|sucursal\w*|sepa|cut-?off|ce (este|e|inseamna))\b/ },
  { intent: "smalltalk", branch: "GENERAL_QA", confidence: 0.8, re: /^(salut|buna|buna ziua|hello|hi|hey|multumesc|mersi|ms|ok|bye|la revedere|ce faci|noapte buna)[\s!.?]*$/ },
];

/** Products/intents that become GENERAL_QA when asked about in general (no possessive). */
const GENERAL_WHEN_NOT_POSSESSIVE: Intent[] = ["deposit_info", "loan_info", "insurance_info", "investment_info", "roundup_info"];

const CATEGORY_KEYWORDS: { re: RegExp; category: TxCategory }[] = [
  { re: /restaurant|mancare|bautur|cafea|cafenea|alimente|supermarket|glovo|fast ?food|mancat/, category: "Mâncare & Băutură" },
  { re: /cumparatur|haine|shopping|emag|magazin|electronice/, category: "Cumpărături" },
  { re: /transport|taxi|bolt|uber|benzin|combustibil|masina|stb|metrou/, category: "Transport" },
  { re: /utilitat|factur|curent|gaz|internet|energie/, category: "Utilități" },
  { re: /sanatate|farmaci|medic|clinic|spital/, category: "Sănătate" },
  { re: /divertisment|cinema|film|concert|distractie/, category: "Divertisment" },
  { re: /abonament|netflix|spotify|streaming/, category: "Abonamente" },
  { re: /chirie|locuint/, category: "Locuință" },
  { re: /economii|economisit/, category: "Economii" },
  { re: /comision/, category: "Comisioane" },
  { re: /salariu|venit/, category: "Salariu" },
];

function currentMonth(): string {
  return TODAY.toISOString().slice(0, 7);
}

function shiftMonth(yyyyMm: string, delta: number): string {
  const [y, m] = yyyyMm.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

export function extractEntities(tokenizedMessage: string, customerId: string): RouterEntities {
  const t = stripDiacritics(tokenizedMessage.toLowerCase());
  const e: RouterEntities = {};

  const amount = t.match(/(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?|\d+(?:[.,]\d+)?)\s*(eur|euro|ron|lei|usd|dolari)\b/);
  if (amount) {
    const raw = amount[1];
    const normalized = raw.includes(",") && raw.includes(".") ? raw.replace(/\./g, "").replace(",", ".") : raw.replace(",", ".");
    const n = Number(normalized);
    if (!Number.isNaN(n)) e.amount = n;
    e.currency = amount[2].startsWith("eur") ? "EUR" : amount[2].startsWith("usd") || amount[2].startsWith("dol") ? "USD" : "RON";
  }

  const person = tokenizedMessage.match(/<PERSON_\d+>/);
  if (person) e.personToken = person[0];

  let cards: ReturnType<typeof bank.cards> = [];
  try {
    cards = bank.cards(customerId);
  } catch {
    cards = [];
  }
  for (const m of t.matchAll(/\b(\d{4})\b/g)) {
    if (cards.some((c) => c.last4 === m[1])) {
      e.last4 = m[1];
      break;
    }
  }

  for (const c of CATEGORY_KEYWORDS) {
    if (c.re.test(t)) {
      e.category = c.category;
      break;
    }
  }

  if (/luna (asta|aceasta|curenta|in curs)|in aceasta luna|in luna curenta/.test(t)) e.month = currentMonth();
  else if (/luna trecuta|luna precedenta|in luna anterioara/.test(t)) e.month = shiftMonth(currentMonth(), -1);
  else {
    const mn = t.match(/\b(ianuarie|februarie|martie|aprilie|mai|iunie|iulie|august|septembrie|octombrie|noiembrie|decembrie)\b/);
    if (mn) {
      const idx = monthNameToIndex(mn[1]);
      if (idx) {
        const [cy, cm] = currentMonth().split("-").map(Number);
        const year = idx > cm ? cy - 1 : cy;
        e.month = `${year}-${String(idx).padStart(2, "0")}`;
      }
    }
  }

  try {
    const merchants = new Set(bank.transactions(customerId).map((x) => x.merchant));
    for (const m of merchants) {
      const key = stripDiacritics(m.toLowerCase());
      if (key.length >= 4 && t.includes(key)) {
        e.merchant = m;
        break;
      }
    }
  } catch {
    /* unknown customer: no merchant match */
  }

  const product = t.match(/\b(depozit\w*|round ?up|extra'?rol|card de credit|card virtual|card de debit|asigurar\w*|credit de nevoi|ipotecar|cont de economii|sepa|transfer instant)\b/);
  if (product) e.product = product[1];

  return e;
}

export function classifyByKeywords(tokenizedMessage: string): { branch: Branch; intent: Intent; confidence: number; rule: string } {
  const t = stripDiacritics(tokenizedMessage.toLowerCase()).replace(/\s+/g, " ").trim();
  for (const r of RULES) {
    if (!r.re.test(t)) continue;
    let branch = r.branch;
    if (GENERAL_WHEN_NOT_POSSESSIVE.includes(r.intent) && !POSSESSIVE.test(t)) branch = "GENERAL_QA";
    return { branch, intent: branch === "GENERAL_QA" && r.branch === "ACCOUNT_QA" ? "product_info" : r.intent, confidence: r.confidence, rule: r.intent };
  }
  return { branch: "HUMAN", intent: "unknown", confidence: 0.3, rule: "no_match" };
}

/** Deterministic overrides applied regardless of which model classified. */
function hardRules(tokenizedMessage: string): { branch: Branch; intent: Intent; rule: string } | null {
  const t = stripDiacritics(tokenizedMessage.toLowerCase()).replace(/\s+/g, " ").trim();
  const pick = (intent: Intent) => RULES.find((r) => r.intent === intent)!;
  if (pick("human_request").re.test(t)) return { branch: "HUMAN", intent: "human_request", rule: "explicit_human_request" };
  if (pick("advice_forbidden").re.test(t)) return { branch: "HUMAN", intent: "advice_forbidden", rule: "advice_denylist" };
  if (pick("card_block").re.test(t) && !/^cum\b/.test(t)) return { branch: "ACTION", intent: "card_block", rule: "action_verb_card_block" };
  if (pick("card_unblock").re.test(t) && !/^cum\b/.test(t)) return { branch: "ACTION", intent: "card_unblock", rule: "action_verb_card_unblock" };
  const transferAction = RULES.find((r) => r.intent === "how_to" && r.branch === "ACTION")!;
  if (transferAction.re.test(t) && !/^cum\b/.test(t)) return { branch: "ACTION", intent: "how_to", rule: "action_verb_transfer" };
  return null;
}

async function classifyWithLlm(tokenizedMessage: string): Promise<{ branch: Branch; intent: Intent; confidence: number; entities: Partial<RouterEntities>; reason: string; vendor: "gemini" | "dev-http"; model: string }> {
  const { value: p, vendor, model } = await structuredJson({ system: ROUTER_SYSTEM, user: tokenizedMessage, schema: RouterSchema });
  const entities: Partial<RouterEntities> = {};
  if (p.entities.last4) entities.last4 = p.entities.last4;
  if (p.entities.amount != null) entities.amount = p.entities.amount;
  if (p.entities.currency) entities.currency = p.entities.currency;
  if (p.entities.personToken) entities.personToken = p.entities.personToken;
  if (p.entities.category) entities.category = p.entities.category as TxCategory;
  if (p.entities.month) entities.month = p.entities.month;
  if (p.entities.merchant) entities.merchant = p.entities.merchant;
  if (p.entities.product) entities.product = p.entities.product;
  return { branch: p.branch, intent: p.intent, confidence: p.confidence, entities, reason: p.reason, vendor, model };
}

/** Deterministic overrides + confidence threshold, applied on top of any model. */
export function applyRules(result: RouterResult, tokenizedMessage: string): RouterResult {
  const rulesApplied: string[] = [];
  const hard = hardRules(tokenizedMessage);
  if (hard) {
    result.branch = hard.branch;
    result.intent = hard.intent;
    result.confidence = Math.max(result.confidence, 0.9);
    rulesApplied.push(hard.rule);
  }
  if (result.confidence < CONFIDENCE_THRESHOLD && result.branch !== "ACTION") {
    result.branch = "HUMAN";
    rulesApplied.push(`low_confidence<${CONFIDENCE_THRESHOLD}`);
  }
  // The model must never route to BLOCKED on its own (input guard decides).
  if (result.branch === "BLOCKED") {
    result.branch = "HUMAN";
    result.intent = "unknown";
    rulesApplied.push("blocked_only_by_input_guard");
  }
  result.rulesApplied = [...result.rulesApplied, ...rulesApplied];
  return result;
}

/**
 * Dialogflow CX router mode: one detectIntent call; `match.intent.displayName`
 * maps to our Intent enum. Playbook / knowledge matches keep the keyword
 * classification (so the Context Service still knows what to fetch) and the
 * detectIntent response is cached on the turn for the gateway.
 */
async function classifyWithDialogflow(tokenizedMessage: string, sessionId: string, kw: ReturnType<typeof classifyByKeywords>): Promise<Omit<RouterResult, "entities">> {
  const r = await detectIntent({ sessionId, text: tokenizedMessage });
  const mapped = mapDisplayNameToIntent(r.intentDisplayName);
  const generative = r.matchType === "PLAYBOOK" || r.matchType === "KNOWLEDGE_CONNECTOR";
  if (mapped) {
    return { branch: intentToBranch(mapped), intent: mapped, confidence: r.confidence ?? 0.9, mode: "llm", vendor: "dialogflow", model: "dialogflow-cx", rulesApplied: [`dialogflow:${r.matchType}:${r.intentDisplayName}`], dialogflow: r };
  }
  if (generative) {
    const intent = kw.intent === "unknown" ? "product_info" : kw.intent;
    const branch = kw.intent === "unknown" ? "GENERAL_QA" : kw.branch;
    return { branch, intent, confidence: Math.max(r.confidence ?? 0.7, 0.7), mode: "llm", vendor: "dialogflow", model: "dialogflow-cx", rulesApplied: [`dialogflow:${r.matchType}`, `keyword:${kw.rule}`], dialogflow: r };
  }
  // NO_MATCH / NO_INPUT / EVENT / unknown intent name → low confidence, keyword hint
  return { branch: kw.branch, intent: kw.intent, confidence: Math.min(kw.confidence, r.confidence ?? 0.4), mode: "llm", vendor: "dialogflow", model: "dialogflow-cx", rulesApplied: [`dialogflow:${r.matchType}${r.intentDisplayName ? `:${r.intentDisplayName}` : ""}`, `keyword:${kw.rule}`], dialogflow: r };
}

export async function runRouter(tokenizedMessage: string, customerId: string, opts: { sessionId?: string } = {}): Promise<RouterResult> {
  const regexEntities = extractEntities(tokenizedMessage, customerId);
  const kw = classifyByKeywords(tokenizedMessage);
  const offlineResult = (rawError?: string): RouterResult => ({ branch: kw.branch, intent: kw.intent, confidence: kw.confidence, entities: regexEntities, mode: "offline", rulesApplied: [`keyword:${kw.rule}`], ...(rawError ? { rawError } : {}) });

  let result: RouterResult | null = null;
  const errors: string[] = [];

  if (!forcedOffline() && dialogflowConfigured() && opts.sessionId) {
    try {
      const df = await classifyWithDialogflow(tokenizedMessage, opts.sessionId, kw);
      const dfEntities: RouterEntities = {};
      const p = df.dialogflow?.parameters ?? {};
      if (typeof p.last4 === "string") dfEntities.last4 = p.last4;
      if (typeof p.amount === "number") dfEntities.amount = p.amount;
      if (typeof p.category === "string") dfEntities.category = p.category as TxCategory;
      if (typeof p.month === "string") dfEntities.month = p.month;
      if (typeof p.merchant === "string") dfEntities.merchant = p.merchant;
      result = { ...df, entities: { ...regexEntities, ...dfEntities } };
    } catch (err) {
      errors.push(`dialogflow: ${(err instanceof Error ? err.message : String(err)).slice(0, 160)}`);
    }
  }

  if (!result && !isOffline().offline) {
    try {
      const llm = await classifyWithLlm(tokenizedMessage);
      result = { branch: llm.branch, intent: llm.intent, confidence: llm.confidence, entities: { ...regexEntities, ...llm.entities }, mode: "llm", vendor: llm.vendor, model: llm.model, rulesApplied: [`llm:${llm.reason.slice(0, 120)}`] };
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }

  if (!result) result = offlineResult(errors.length ? errors.join(" | ") : undefined);
  else if (errors.length) result.rawError = errors.join(" | ");
  return applyRules(result, tokenizedMessage);
}

export function routerDetails(r: RouterResult): Record<string, unknown> {
  return {
    ramura: r.branch,
    intentie: r.intent,
    incredere: Number(r.confidence.toFixed(2)),
    prag: CONFIDENCE_THRESHOLD,
    entitati: r.entities,
    mode: r.vendor ?? (r.mode === "offline" ? "template" : "llm"),
    provider: r.vendor ?? "rules",
    model: r.model ?? "keyword-rules",
    ...(r.dialogflow ? { dialogflow: dialogflowDetails(r.dialogflow) } : {}),
    reguli: r.rulesApplied,
    ...(r.rawError ? { eroare_llm: r.rawError } : {}),
  };
}

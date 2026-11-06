/**
 * Step 3 — Context Service. One fetcher per intent (data minimization),
 * calling the mock core banking directly. Output is a versioned, pseudonymized
 * context_pack. GENERAL_QA pulls public knowledge chunks instead.
 */
import { bank } from "@/lib/mock/bank";
import { TODAY } from "@/lib/mock/data";
import type { Branch, Intent, Transaction, TxCategory } from "@/lib/types";
import { retrieve } from "@/lib/knowledge";
import type { ContextPack, ContextResult, Policy, RouterEntities } from "./types";
import type { Vault } from "./vault";

// ---------- Policies (public rules the answer may cite) ----------

export const POLICIES: Record<string, Policy> = {
  cutoff_sepa: { id: "cutoff_sepa", text: "Transferurile SEPA primite până la ora 15:00 se procesează în aceeași zi lucrătoare; ETA la beneficiar: maximum 1 zi lucrătoare de la procesare." },
  cutoff_ron: { id: "cutoff_ron", text: "Transferurile în RON către alte bănci primite până la ora 16:00 se procesează în aceeași zi; transferurile intra-bancă și instant sunt imediate." },
  aml_check: { id: "aml_check", text: "Un transfer poate trece printr-o verificare suplimentară (AML); durează de regulă câteva ore, cel mult 1 zi lucrătoare, și nu necesită nicio acțiune din partea clientului." },
  transfer_rejected: { id: "transfer_rejected", text: "La un transfer respins, suma este din nou disponibilă în cont; motivul se vede în detaliile transferului." },
  available_vs_balance: { id: "available_vs_balance", text: "Disponibilul poate fi mai mic decât soldul din cauza tranzacțiilor în așteptare (pending) sau a sumelor rezervate." },
  stats_scope: { id: "stats_scope", text: "Statisticile de cheltuieli includ toate debitările din contul curent RON, grupate pe categorii; restaurantele și cafenelele intră în categoria Mâncare & Băutură." },
  card_block_flow: { id: "card_block_flow", text: "Blocarea și deblocarea cardului se fac doar printr-un flux securizat cu confirmare explicită; asistentul nu execută operațiuni." },
  card_no_pan: { id: "card_no_pan", text: "Numărul complet al cardului nu este niciodată afișat; se folosesc doar ultimele 4 cifre." },
  deposit_rules: { id: "deposit_rules", text: "Dobânda depozitului se plătește la scadență; lichidarea anticipată pierde dobânda acumulată." },
  loan_rules: { id: "loan_rules", text: "Rata se debitează automat din contul curent la data scadenței; Extra'ROL percepe dobândă doar pe suma folosită." },
  insurance_rules: { id: "insurance_rules", text: "Asigurările sunt oferite de un asigurător partener; pentru daune se contactează direct asigurătorul." },
  investment_no_advice: { id: "investment_no_advice", text: "Asistentul prezintă doar valorile curente ale portofoliului; nu oferă recomandări de investiții." },
  roundup_rules: { id: "roundup_rules", text: "Round Up rotunjește plățile cu cardul de debit la următorul multiplu de 5 sau 10 RON și transferă diferența în contul Round Up." },
  no_advice: { id: "no_advice", text: "Fără sfaturi de investiții, ipotecare, juridice sau fiscale; pentru acestea clientul este îndrumat către un specialist." },
  illustrative: { id: "illustrative", text: "Valorile din informațiile publice sunt ilustrative, pentru PoC." },
};

function policies(...ids: (keyof typeof POLICIES)[]): Policy[] {
  return ids.map((i) => POLICIES[i]);
}

// ---------- Pack shapes (exported for the template provider) ----------

export interface TransferLite {
  id: string;
  toName: string;
  toIban: string;
  amount: number;
  currency: string;
  initiated: string;
  status: string;
  eta?: string;
  reference: string;
  scheme: string;
  rejectReason?: string;
}
export interface TxLite {
  id: string;
  date: string;
  amount: number;
  currency: string;
  merchant: string;
  category: TxCategory;
  status: string;
  type: string;
  counterparty?: string;
}
export interface TransferStatusPack extends ContextPack {
  transfers: TransferLite[];
  transactions: TxLite[];
}
export interface SpendPack extends ContextPack {
  month: string;
  income: number;
  spend: number;
  byCategory: { category: TxCategory; amount: number; count: number }[];
  category?: TxCategory;
  categoryTotal?: { amount: number; count: number };
  topMerchants?: { merchant: string; amount: number; count: number }[];
  previousMonth?: { month: string; categoryAmount?: number; spend: number };
}
export interface AccountLite {
  id: string;
  name: string;
  type: string;
  currency: string;
  balance: number;
  available: number;
  rate?: number;
}
export interface BalancePack extends ContextPack {
  accounts: AccountLite[];
}
export interface CardLite {
  id: string;
  last4: string;
  type: string;
  brand: string;
  status: string;
  expiry: string;
  contactless: boolean;
  onlinePayments: boolean;
  creditLimit?: number;
  creditUsed?: number;
  walletEnrolled?: string[];
}
export interface CardPack extends ContextPack {
  cards: CardLite[];
}
export interface TxLookupPack extends ContextPack {
  filter: { merchant?: string; category?: TxCategory; month?: string };
  transactions: TxLite[];
}
export interface DepositPack extends ContextPack {
  deposits: { id: string; name: string; principal: number; currency: string; rate: number; termMonths: number; startDate: string; maturityDate: string; interestAccrued: number; autoRenew: boolean }[];
}
export interface LoanPack extends ContextPack {
  loans: { id: string; type: string; name: string; currency: string; outstanding: number; rate: number; monthlyPayment?: number; nextPaymentDate?: string; remainingMonths?: number; limit?: number; used?: number; status: string }[];
}
export interface InsurancePack extends ContextPack {
  insurance: { id: string; type: string; name: string; insurer: string; premium: number; currency: string; frequency: string; coverage: number; status: string; nextPaymentDate: string }[];
}
export interface InvestmentPack extends ContextPack {
  investments: { id: string; type: string; name: string; ticker?: string; currency: string; value: number; invested: number; pnl: number; pnlPct: number }[];
  totalByCurrency: Record<string, { value: number; invested: number; pnl: number }>;
}
export interface RoundUpPack extends ContextPack {
  roundUp: { enabled: boolean; roundTo: number; totalSaved: number; thisMonth: number; bonusRatePct: number };
  account?: AccountLite;
}

// ---------- helpers ----------

function currentMonth(): string {
  return TODAY.toISOString().slice(0, 7);
}
function shiftMonth(yyyyMm: string, delta: number): string {
  const [y, m] = yyyyMm.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
}
function txLite(t: Transaction): TxLite {
  return {
    id: t.id,
    date: t.date,
    amount: t.amount,
    currency: t.currency,
    merchant: t.merchant,
    category: t.category,
    status: t.status,
    type: t.type,
    ...(t.counterparty?.name ? { counterparty: t.counterparty.name } : {}),
  };
}
function accountLite(a: ReturnType<typeof bank.accounts>[number]): AccountLite {
  return { id: a.id, name: a.name, type: a.type, currency: a.currency, balance: a.balance, available: a.available, ...(a.rate != null ? { rate: a.rate } : {}) };
}

type Fetcher = (cid: string, e: RouterEntities) => { data: Record<string, unknown>; policies: Policy[]; calls: string[] };

const FETCHERS: Partial<Record<Intent, Fetcher>> = {
  transfer_status: (cid) => {
    const transfers = bank.transfers(cid, { limit: 10 }).map<TransferLite>((t) => ({
      id: t.id,
      toName: t.toName,
      toIban: t.toIban,
      amount: t.amount,
      currency: t.currency,
      initiated: t.initiated,
      status: t.status,
      ...(t.eta ? { eta: t.eta } : {}),
      reference: t.reference,
      scheme: t.scheme,
      ...(t.rejectReason ? { rejectReason: t.rejectReason } : {}),
    }));
    const transactions = bank
      .transactions(cid, { limit: 200 })
      .filter((t) => t.type === "transfer_out" || t.type === "transfer_in")
      .filter((t) => t.currency === "EUR" || t.currency === "RON")
      .slice(0, 10)
      .map(txLite);
    return { data: { transfers, transactions }, policies: policies("cutoff_sepa", "cutoff_ron", "aml_check", "transfer_rejected"), calls: ["bank.transfers", "bank.transactions"] };
  },
  spend_by_category: (cid, e) => {
    const month = e.month ?? currentMonth();
    const s = bank.statsForMonth(cid, month);
    const prev = bank.statsForMonth(cid, shiftMonth(month, -1));
    const data: Record<string, unknown> = {
      month,
      income: s?.income ?? 0,
      spend: s?.spend ?? 0,
      byCategory: s?.byCategory ?? [],
    };
    if (e.category) {
      const cat = s?.byCategory.find((c) => c.category === e.category);
      data.category = e.category;
      data.categoryTotal = { amount: cat?.amount ?? 0, count: cat?.count ?? 0 };
      const txs = bank.transactions(cid, { accountId: "acc_ron_main", category: e.category, from: `${month}-01`, to: `${shiftMonth(month, 1)}-01` });
      const agg = new Map<string, { amount: number; count: number }>();
      for (const t of txs) {
        if (t.amount >= 0) continue;
        const a = agg.get(t.merchant) ?? { amount: 0, count: 0 };
        a.amount += -t.amount;
        a.count++;
        agg.set(t.merchant, a);
      }
      data.topMerchants = [...agg.entries()]
        .map(([merchant, v]) => ({ merchant, amount: Math.round(v.amount * 100) / 100, count: v.count }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5);
      if (prev) data.previousMonth = { month: prev.month, spend: prev.spend, categoryAmount: prev.byCategory.find((c) => c.category === e.category)?.amount ?? 0 };
    } else if (prev) {
      data.previousMonth = { month: prev.month, spend: prev.spend };
    }
    return { data, policies: policies("stats_scope"), calls: ["bank.statsForMonth", ...(e.category ? ["bank.transactions"] : [])] };
  },
  balance: (cid) => ({
    data: { accounts: bank.accounts(cid).map(accountLite) },
    policies: policies("available_vs_balance"),
    calls: ["bank.accounts"],
  }),
  card_info: (cid, e) => {
    let cards = bank.cards(cid);
    if (e.last4) cards = cards.filter((c) => c.last4 === e.last4);
    const lite = cards.map<CardLite>((c) => ({
      id: c.id,
      last4: c.last4,
      type: c.type,
      brand: c.brand,
      status: c.status,
      expiry: c.expiry,
      contactless: c.contactless,
      onlinePayments: c.onlinePayments,
      ...(c.creditLimit != null ? { creditLimit: c.creditLimit } : {}),
      ...(c.creditUsed != null ? { creditUsed: c.creditUsed } : {}),
      ...(c.walletEnrolled ? { walletEnrolled: c.walletEnrolled } : {}),
    }));
    return { data: { cards: lite }, policies: policies("card_block_flow", "card_no_pan"), calls: ["bank.cards"] };
  },
  transaction_lookup: (cid, e) => {
    const month = e.month;
    const txs = bank
      .transactions(cid, {
        merchant: e.merchant,
        category: e.category,
        from: month ? `${month}-01` : undefined,
        to: month ? `${shiftMonth(month, 1)}-01` : undefined,
        limit: 15,
      })
      .map(txLite);
    return { data: { filter: { merchant: e.merchant, category: e.category, month }, transactions: txs }, policies: policies("available_vs_balance"), calls: ["bank.transactions"] };
  },
  deposit_info: (cid) => ({
    data: { deposits: bank.deposits(cid).map((d) => ({ id: d.id, name: d.name, principal: d.principal, currency: d.currency, rate: d.rate, termMonths: d.termMonths, startDate: d.startDate, maturityDate: d.maturityDate, interestAccrued: d.interestAccrued, autoRenew: d.autoRenew })) },
    policies: policies("deposit_rules"),
    calls: ["bank.deposits"],
  }),
  loan_info: (cid) => ({
    data: { loans: bank.loans(cid).map((l) => ({ id: l.id, type: l.type, name: l.name, currency: l.currency, outstanding: l.outstanding, rate: l.rate, monthlyPayment: l.monthlyPayment, nextPaymentDate: l.nextPaymentDate, remainingMonths: l.remainingMonths, limit: l.limit, used: l.used, status: l.status })) },
    policies: policies("loan_rules", "no_advice"),
    calls: ["bank.loans"],
  }),
  insurance_info: (cid) => ({
    data: { insurance: bank.insurance(cid).map((i) => ({ id: i.id, type: i.type, name: i.name, insurer: i.insurer, premium: i.premium, currency: i.currency, frequency: i.frequency, coverage: i.coverage, status: i.status, nextPaymentDate: i.nextPaymentDate })) },
    policies: policies("insurance_rules"),
    calls: ["bank.insurance"],
  }),
  investment_info: (cid) => {
    const inv = bank.investments(cid);
    const totalByCurrency: Record<string, { value: number; invested: number; pnl: number }> = {};
    for (const i of inv) {
      const t = (totalByCurrency[i.currency] ??= { value: 0, invested: 0, pnl: 0 });
      t.value = Math.round((t.value + i.value) * 100) / 100;
      t.invested = Math.round((t.invested + i.invested) * 100) / 100;
      t.pnl = Math.round((t.pnl + i.pnl) * 100) / 100;
    }
    return {
      data: { investments: inv.map((i) => ({ id: i.id, type: i.type, name: i.name, ticker: i.ticker, currency: i.currency, value: i.value, invested: i.invested, pnl: i.pnl, pnlPct: i.pnlPct })), totalByCurrency },
      policies: policies("investment_no_advice", "no_advice"),
      calls: ["bank.investments"],
    };
  },
  roundup_info: (cid) => {
    const r = bank.roundUp(cid);
    const acc = bank.account(cid, r.savingsAccountId);
    return {
      data: { roundUp: { enabled: r.enabled, roundTo: r.roundTo, totalSaved: r.totalSaved, thisMonth: r.thisMonth, bonusRatePct: r.bonusRatePct }, ...(acc ? { account: accountLite(acc) } : {}) },
      policies: policies("roundup_rules"),
      calls: ["bank.roundUp", "bank.account"],
    };
  },
};

/** Fallback for ACCOUNT_QA intents without a dedicated fetcher: a minimal account overview. */
const OVERVIEW: Fetcher = (cid) => ({
  data: { accounts: bank.accounts(cid).map(accountLite) },
  policies: policies("available_vs_balance"),
  calls: ["bank.accounts"],
});

export function runContext(args: { branch: Branch; intent: Intent; entities: RouterEntities; customerId: string; tokenizedMessage: string; vault: Vault }): ContextResult {
  const { branch, intent, entities, customerId, tokenizedMessage, vault } = args;
  const t0 = Date.now();
  const customer = bank.customer(customerId);
  const base = { customer: { segment: customer.segment, package: customer.package, lang: customer.lang, country: "RO" as const } };

  if (branch === "GENERAL_QA") {
    const r = retrieve(tokenizedMessage, 3);
    const pack: ContextPack = {
      schema: `ctx.general_qa.v1`,
      ...base,
      intent,
      knowledge: r.hits,
      policies: policies("illustrative", "no_advice"),
      fetched_ms: Date.now() - t0,
    };
    return {
      pack: vault.tokenizeDeep(pack),
      calls: ["knowledge.retrieve"],
      retrieval: { query: r.query, hits: r.hits.map((h) => ({ file: h.file, title: h.title, score: h.score })), injectionDropped: r.injectionDropped },
    };
  }

  const fetcher = FETCHERS[intent] ?? OVERVIEW;
  const { data, policies: pol, calls } = fetcher(customerId, entities);
  const pack: ContextPack = {
    schema: `ctx.${FETCHERS[intent] ? intent : "overview"}.v1`,
    ...base,
    ...data,
    policies: pol,
    fetched_ms: Date.now() - t0,
  };
  return { pack: vault.tokenizeDeep(pack), calls };
}

/** Displayable (already pseudonymized) summary for the trace panel. */
export function contextDetails(r: ContextResult): Record<string, unknown> {
  const { schema, policies: pol, fetched_ms, customer, knowledge, ...rest } = r.pack;
  const sizes: Record<string, number | string> = {};
  for (const [k, v] of Object.entries(rest)) sizes[k] = Array.isArray(v) ? `${v.length} înregistrări` : typeof v === "object" && v ? `${Object.keys(v as object).length} câmpuri` : String(v);
  return {
    schema,
    client: customer,
    apeluri: r.calls,
    campuri: sizes,
    politici: pol.map((p) => p.id),
    ...(knowledge ? { cunostinte: knowledge.map((h) => ({ fisier: h.file, titlu: h.title, scor: h.score })) } : {}),
    ...(r.retrieval ? { interogare: r.retrieval.query, chunkuri_eliminate_injection: r.retrieval.injectionDropped } : {}),
    durata_ms: fetched_ms,
    pack_pseudonimizat: r.pack,
  };
}

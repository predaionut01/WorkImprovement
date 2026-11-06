/**
 * Shared domain + chat-pipeline types for the Home'Bank PoC.
 * Everything here is fictional demo data. No real customer data.
 */

// ---------- Banking domain ----------

export type Currency = "RON" | "EUR" | "USD";

export interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  /** fake, demo only */
  cnp: string;
  phone: string;
  email: string;
  address: string;
  segment: "retail" | "premium";
  package: "ING Go" | "ING Complete" | "ING Extra";
  lang: "ro" | "en";
  customerSince: string; // ISO date
}

export type AccountType = "current" | "savings" | "roundup";

export interface Account {
  id: string;
  iban: string;
  currency: Currency;
  type: AccountType;
  name: string;
  balance: number;
  available: number;
  /** For savings: annual rate (%) */
  rate?: number;
}

export type CardType = "debit" | "credit" | "virtual";
export type CardStatus = "active" | "blocked" | "frozen";

export interface Card {
  id: string;
  accountId: string;
  type: CardType;
  brand: "Visa" | "Mastercard";
  last4: string;
  holder: string;
  expiry: string; // MM/YY
  status: CardStatus;
  contactless: boolean;
  onlinePayments: boolean;
  /** credit only */
  creditLimit?: number;
  creditUsed?: number;
  walletEnrolled?: ("Apple Pay" | "Google Pay")[];
}

export type TxCategory =
  | "Mâncare & Băutură"
  | "Cumpărături"
  | "Transport"
  | "Utilități"
  | "Sănătate"
  | "Divertisment"
  | "Transfer"
  | "Salariu"
  | "Comisioane"
  | "Dobânzi"
  | "Economii"
  | "Locuință"
  | "Abonamente"
  | "Altele";

export type TxType =
  | "card"
  | "transfer_in"
  | "transfer_out"
  | "fee"
  | "interest"
  | "direct_debit"
  | "roundup";

export interface Transaction {
  id: string;
  accountId: string;
  cardId?: string;
  date: string; // ISO datetime
  amount: number; // signed, negative = debit
  currency: Currency;
  merchant: string;
  category: TxCategory;
  status: "posted" | "pending";
  type: TxType;
  description?: string;
  counterparty?: { name: string; iban?: string };
}

export type TransferStatus =
  | "pending"
  | "pending_aml"
  | "processing"
  | "completed"
  | "rejected";

export interface Transfer {
  id: string;
  fromAccountId: string;
  toIban: string;
  toName: string;
  amount: number;
  currency: Currency;
  initiated: string; // ISO datetime
  status: TransferStatus;
  eta?: string; // ISO date
  reference: string;
  scheme: "intra" | "SEPA" | "SWIFT" | "instant";
  rejectReason?: string;
}

export interface Deposit {
  id: string;
  sourceAccountId: string;
  name: string;
  principal: number;
  currency: Currency;
  rate: number; // % annual
  termMonths: number;
  startDate: string;
  maturityDate: string;
  interestAccrued: number;
  autoRenew: boolean;
}

export type LoanType = "personal" | "credit_card" | "overdraft" | "mortgage";

export interface Loan {
  id: string;
  type: LoanType;
  name: string;
  currency: Currency;
  principal?: number;
  outstanding: number;
  rate: number; // % annual
  monthlyPayment?: number;
  nextPaymentDate?: string;
  remainingMonths?: number;
  /** overdraft / credit card */
  limit?: number;
  used?: number;
  status: "active" | "closed" | "overdue";
}

export interface Investment {
  id: string;
  type: "fund" | "etf" | "stock";
  name: string;
  ticker?: string;
  units: number;
  unitPrice: number;
  currency: Currency;
  value: number;
  invested: number;
  pnl: number;
  pnlPct: number;
}

export interface Insurance {
  id: string;
  type: "life" | "health" | "income";
  name: string;
  insurer: string;
  premium: number;
  currency: Currency;
  frequency: "monthly" | "yearly";
  coverage: number;
  status: "active" | "lapsed";
  nextPaymentDate: string;
  since: string;
}

export interface RoundUp {
  enabled: boolean;
  savingsAccountId: string;
  roundTo: 5 | 10;
  totalSaved: number;
  thisMonth: number;
  bonusRatePct: number;
}

export interface CategoryStat {
  category: TxCategory;
  amount: number; // positive spend
  count: number;
}

export interface MonthlyStat {
  month: string; // YYYY-MM
  income: number;
  spend: number;
  byCategory: CategoryStat[];
}

export interface Beneficiary {
  id: string;
  name: string;
  iban: string;
  bank: string;
  lastUsed?: string;
}

/** Everything the mock "core banking" knows about one customer. */
export interface CustomerData {
  customer: Customer;
  accounts: Account[];
  cards: Card[];
  transactions: Transaction[];
  transfers: Transfer[];
  deposits: Deposit[];
  loans: Loan[];
  investments: Investment[];
  insurance: Insurance[];
  roundUp: RoundUp;
  beneficiaries: Beneficiary[];
  stats: MonthlyStat[];
}

// ---------- Chat pipeline ----------

export type Branch = "ACTION" | "ACCOUNT_QA" | "GENERAL_QA" | "HUMAN" | "BLOCKED";

export type Intent =
  | "transfer_status"
  | "spend_by_category"
  | "balance"
  | "card_info"
  | "card_block"
  | "card_unblock"
  | "transaction_lookup"
  | "deposit_info"
  | "loan_info"
  | "insurance_info"
  | "investment_info"
  | "roundup_info"
  | "product_info"
  | "fees_info"
  | "how_to"
  | "advice_forbidden"
  | "human_request"
  | "smalltalk"
  | "unknown";

export type StepKey =
  | "input_guard"
  | "router"
  | "context"
  | "prompt"
  | "inference"
  | "output_guard"
  | "delivery"
  | "store";

export const STEP_ORDER: StepKey[] = [
  "input_guard",
  "router",
  "context",
  "prompt",
  "inference",
  "output_guard",
  "delivery",
  "store",
];

export const STEP_LABELS: Record<StepKey, { n: number; title: string; short: string }> = {
  input_guard: { n: 1, title: "Input guard", short: "Filtrăm și pseudonimizăm mesajul" },
  router: { n: 2, title: "Router", short: "Alegem ramura (model mic)" },
  context: { n: 3, title: "Context fetch", short: "Aducem datele clientului" },
  prompt: { n: 4, title: "Asamblare prompt", short: "Reguli + politici + context" },
  inference: { n: 5, title: "Inferență", short: "Gateway cu fallback" },
  output_guard: { n: 6, title: "Output guard", short: "Verificăm și detokenizăm" },
  delivery: { n: 7, title: "Livrare", short: "Răspuns / acțiune / om" },
  store: { n: 8, title: "Store + Eval", short: "Salvăm și evaluăm" },
};

export type StepStatus = "pending" | "running" | "ok" | "blocked" | "skipped" | "error";

export interface TraceStep {
  key: StepKey;
  status: StepStatus;
  /** One-line human summary, Romanian, for the Trace panel */
  summary?: string;
  /** Structured details shown when expanded (redacted, safe to display) */
  details?: Record<string, unknown>;
  startedAt?: number;
  durationMs?: number;
}

export interface ChatAction {
  kind: "confirm_card_block" | "confirm_card_unblock" | "open_section" | "handover";
  label: string;
  payload?: Record<string, unknown>;
}

/** Events streamed from POST /api/chat as NDJSON lines. */
export type ChatStreamEvent =
  | { type: "turn"; turnId: string }
  | { type: "trace"; step: TraceStep }
  | { type: "token"; text: string }
  | { type: "action"; action: ChatAction }
  | { type: "handover"; reason: string }
  | { type: "done"; turnId: string; branch: Branch; intent: Intent; model?: string; totalMs: number }
  | { type: "error"; message: string };

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  sessionId: string;
  customerId: string;
  message: string;
  history: ChatMessage[];
  /** demo switches */
  simulate?: { providerDown?: boolean };
}

// ---------- Store / eval ----------

export interface JudgeScore {
  judge: "faithfulness" | "hallucination" | "guardrails" | "resolution" | "tone";
  score: number; // 0..1, 1 = good
  verdict: "pass" | "warn" | "fail";
  note: string;
}

export interface StoredTurn {
  turnId: string;
  sessionId: string;
  customerId: string;
  ts: string;
  /** pseudonymized */
  userMessage: string;
  branch: Branch;
  intent: Intent;
  routerConfidence: number;
  contextSchema?: string;
  contextPack?: Record<string, unknown>; // pseudonymized
  promptVersion: string;
  model?: string;
  fallbackUsed?: boolean;
  /** pseudonymized */
  assistantMessage: string;
  steps: TraceStep[];
  totalMs: number;
  judges?: JudgeScore[];
  judgedAt?: string;
}

export interface OpsSummary {
  turns: number;
  byBranch: Record<Branch, number>;
  avgLatencyMs: number;
  fallbackRate: number;
  escalationRate: number;
  blockedRate: number;
  avgJudge: Record<JudgeScore["judge"], number>;
  byModel: Record<string, { turns: number; avgLatencyMs: number }>;
}

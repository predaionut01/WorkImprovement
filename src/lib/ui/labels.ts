import type { Branch, CardType, Intent, LoanType, StepStatus, TransferStatus, TxCategory } from "@/lib/types";

export const TRANSFER_STATUS: Record<TransferStatus, { label: string; tone: "info" | "success" | "danger" | "warning" | "neutral" }> = {
  pending: { label: "În așteptare", tone: "neutral" },
  pending_aml: { label: "În verificare", tone: "warning" },
  processing: { label: "În procesare", tone: "info" },
  completed: { label: "Finalizat", tone: "success" },
  rejected: { label: "Respins", tone: "danger" },
};

export const CARD_TYPE: Record<CardType, string> = {
  debit: "Card de debit",
  credit: "Card de credit",
  virtual: "Card virtual",
};

export const LOAN_TYPE: Record<LoanType, string> = {
  personal: "Credit de nevoi personale",
  credit_card: "Card de credit",
  overdraft: "Descoperit de cont",
  mortgage: "Credit ipotecar",
};

export const BRANCH: Record<Branch, { label: string; tone: "info" | "success" | "danger" | "warning" | "neutral" }> = {
  ACTION: { label: "Acțiune", tone: "info" },
  ACCOUNT_QA: { label: "Întrebare cont", tone: "success" },
  GENERAL_QA: { label: "Întrebare generală", tone: "neutral" },
  HUMAN: { label: "Către agent", tone: "warning" },
  BLOCKED: { label: "Blocat", tone: "danger" },
};

export const INTENT: Record<Intent, string> = {
  transfer_status: "status transfer",
  spend_by_category: "cheltuieli pe categorie",
  balance: "sold",
  card_info: "info card",
  card_block: "blocare card",
  card_unblock: "deblocare card",
  transaction_lookup: "căutare tranzacție",
  deposit_info: "info depozit",
  loan_info: "info credit",
  insurance_info: "info asigurare",
  investment_info: "info investiții",
  roundup_info: "info Round Up",
  product_info: "info produs",
  fees_info: "comisioane",
  how_to: "cum fac să…",
  advice_forbidden: "sfat interzis",
  human_request: "cere agent",
  smalltalk: "conversație",
  unknown: "necunoscut",
};

export const STEP_STATUS: Record<StepStatus, string> = {
  pending: "în așteptare",
  running: "rulează",
  ok: "ok",
  blocked: "blocat",
  skipped: "sărit",
  error: "eroare",
};

export const CATEGORY_COLORS: Record<TxCategory, string> = {
  "Mâncare & Băutură": "#ff6200",
  Cumpărături: "#2f6fed",
  Transport: "#7b61ff",
  Utilități: "#0aa2a6",
  Sănătate: "#2e8b57",
  Divertisment: "#e0479e",
  Transfer: "#8a8a8a",
  Salariu: "#2e8b57",
  Comisioane: "#b35c00",
  Dobânzi: "#1d8f5e",
  Economii: "#ffb366",
  Locuință: "#5a5a5a",
  Abonamente: "#b84bd6",
  Altele: "#a3a3a3",
};

export const ALL_CATEGORIES: TxCategory[] = [
  "Mâncare & Băutură",
  "Cumpărături",
  "Transport",
  "Utilități",
  "Sănătate",
  "Divertisment",
  "Transfer",
  "Salariu",
  "Comisioane",
  "Dobânzi",
  "Economii",
  "Locuință",
  "Abonamente",
  "Altele",
];

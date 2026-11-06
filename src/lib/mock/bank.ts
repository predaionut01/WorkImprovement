/**
 * "Core banking" service layer. In the real architecture these are
 * separate microservices behind the API marketplace; here they are
 * functions over the in-memory mock DB. The Context Service and the UI
 * both call these (UI through /api/bank/*, pipeline directly).
 *
 * Every function is read-only except the explicit ACTION ones at the
 * bottom (blockCard / unblockCard), which the LLM never calls directly.
 */
import { getCustomerData } from "./data";
import type {
  Account,
  Card,
  CustomerData,
  Transaction,
  Transfer,
  TxCategory,
} from "../types";

function data(customerId: string): CustomerData {
  const d = getCustomerData(customerId);
  if (!d) throw new Error(`Unknown customer ${customerId}`);
  return d;
}

export const bank = {
  customer: (cid: string) => data(cid).customer,
  accounts: (cid: string): Account[] => data(cid).accounts,
  account: (cid: string, accountId: string) =>
    data(cid).accounts.find((a) => a.id === accountId),
  cards: (cid: string): Card[] => data(cid).cards,
  card: (cid: string, cardId: string) => data(cid).cards.find((c) => c.id === cardId),
  cardByLast4: (cid: string, last4: string) =>
    data(cid).cards.find((c) => c.last4 === last4),

  transactions: (
    cid: string,
    opts: {
      accountId?: string;
      cardId?: string;
      from?: string; // ISO date
      to?: string;
      category?: TxCategory;
      merchant?: string;
      limit?: number;
      status?: Transaction["status"];
    } = {},
  ): Transaction[] => {
    let txs = data(cid).transactions;
    if (opts.accountId) txs = txs.filter((t) => t.accountId === opts.accountId);
    if (opts.cardId) txs = txs.filter((t) => t.cardId === opts.cardId);
    if (opts.from) txs = txs.filter((t) => t.date >= opts.from!);
    if (opts.to) txs = txs.filter((t) => t.date <= opts.to!);
    if (opts.category) txs = txs.filter((t) => t.category === opts.category);
    if (opts.status) txs = txs.filter((t) => t.status === opts.status);
    if (opts.merchant) {
      const m = opts.merchant.toLowerCase();
      txs = txs.filter((t) => t.merchant.toLowerCase().includes(m));
    }
    return txs.slice(0, opts.limit ?? 200);
  },

  transfers: (cid: string, opts: { status?: Transfer["status"]; limit?: number } = {}) => {
    let t = data(cid).transfers;
    if (opts.status) t = t.filter((x) => x.status === opts.status);
    return t.slice(0, opts.limit ?? 50);
  },
  transfer: (cid: string, id: string) => data(cid).transfers.find((t) => t.id === id),

  deposits: (cid: string) => data(cid).deposits,
  loans: (cid: string) => data(cid).loans,
  investments: (cid: string) => data(cid).investments,
  insurance: (cid: string) => data(cid).insurance,
  roundUp: (cid: string) => data(cid).roundUp,
  beneficiaries: (cid: string) => data(cid).beneficiaries,
  stats: (cid: string, months = 3) => data(cid).stats.slice(0, months),
  statsForMonth: (cid: string, month: string) =>
    data(cid).stats.find((s) => s.month === month),

  /** Full snapshot for the UI dashboard. */
  snapshot: (cid: string): CustomerData => data(cid),

  // ---- ACTIONS (deterministic flows only; require explicit confirmation in UI) ----
  blockCard: (cid: string, cardId: string): Card => {
    const c = data(cid).cards.find((x) => x.id === cardId);
    if (!c) throw new Error("Card not found");
    c.status = "blocked";
    return c;
  },
  unblockCard: (cid: string, cardId: string): Card => {
    const c = data(cid).cards.find((x) => x.id === cardId);
    if (!c) throw new Error("Card not found");
    c.status = "active";
    return c;
  },
  setCardFlag: (cid: string, cardId: string, flag: "contactless" | "onlinePayments", value: boolean): Card => {
    const c = data(cid).cards.find((x) => x.id === cardId);
    if (!c) throw new Error("Card not found");
    c[flag] = value;
    return c;
  },
};

export type Bank = typeof bank;

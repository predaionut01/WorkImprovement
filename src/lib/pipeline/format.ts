/**
 * Romanian formatting helpers shared by the template provider and the guards.
 */
import type { TransferStatus } from "@/lib/types";

const MONTHS_RO = [
  "ianuarie",
  "februarie",
  "martie",
  "aprilie",
  "mai",
  "iunie",
  "iulie",
  "august",
  "septembrie",
  "octombrie",
  "noiembrie",
  "decembrie",
];

/** 1234.5 → "1.234,50 EUR" */
export function fmtMoney(amount: number, currency: string): string {
  const abs = Math.abs(amount);
  const [int, dec] = abs.toFixed(2).split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${amount < 0 ? "-" : ""}${grouped},${dec} ${currency}`;
}

/** 5.25 → "5,25%" */
export function fmtPct(n: number): string {
  return `${n.toFixed(2).replace(".", ",").replace(/,00$/, "")}%`;
}

/** ISO date/datetime → "5 noiembrie 2026" (withYear) or "5 noiembrie" */
export function fmtDate(iso: string, withYear = false): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const day = d.getDate();
  const m = MONTHS_RO[d.getMonth()];
  return withYear ? `${day} ${m} ${d.getFullYear()}` : `${day} ${m}`;
}

/** "2026-11" → "noiembrie 2026" */
export function fmtMonth(yyyyMm: string): string {
  const [y, m] = yyyyMm.split("-").map(Number);
  if (!y || !m) return yyyyMm;
  return `${MONTHS_RO[m - 1]} ${y}`;
}

export function monthNameToIndex(name: string): number | undefined {
  const n = stripDiacritics(name.toLowerCase());
  const idx = MONTHS_RO.findIndex((m) => stripDiacritics(m) === n || stripDiacritics(m).startsWith(n.slice(0, 3)));
  return idx >= 0 ? idx + 1 : undefined;
}

export function stripDiacritics(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ș|ş/g, "s")
    .replace(/ț|ţ/g, "t");
}

export const TRANSFER_STATUS_RO: Record<TransferStatus, string> = {
  pending: "în așteptare",
  pending_aml: "în verificare (AML)",
  processing: "în procesare",
  completed: "finalizat",
  rejected: "respins",
};

export const CARD_STATUS_RO: Record<string, string> = {
  active: "activ",
  blocked: "blocat",
  frozen: "înghețat temporar",
};

import type { Currency } from "@/lib/types";

const money = new Map<string, Intl.NumberFormat>();

function nf(min: number, max: number): Intl.NumberFormat {
  const key = `${min}-${max}`;
  let f = money.get(key);
  if (!f) {
    f = new Intl.NumberFormat("ro-RO", { minimumFractionDigits: min, maximumFractionDigits: max });
    money.set(key, f);
  }
  return f;
}

/** "1.234,56 RON" */
export function fmtMoney(amount: number, currency: Currency | string = "RON", opts?: { sign?: boolean; decimals?: number }): string {
  const d = opts?.decimals ?? 2;
  const abs = nf(d, d).format(Math.abs(amount));
  const sign = amount < 0 ? "-" : opts?.sign && amount > 0 ? "+" : "";
  return `${sign}${abs} ${currency}`;
}

export function fmtNumber(n: number, decimals = 2): string {
  return nf(decimals, decimals).format(n);
}

export function fmtPct(n: number, decimals = 2): string {
  return `${nf(decimals, decimals).format(n)}%`;
}

const dateShort = new Intl.DateTimeFormat("ro-RO", { day: "numeric", month: "short", year: "numeric" });
const dateLong = new Intl.DateTimeFormat("ro-RO", { day: "numeric", month: "long", year: "numeric" });
const dateTime = new Intl.DateTimeFormat("ro-RO", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});
const timeOnly = new Intl.DateTimeFormat("ro-RO", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
const monthLong = new Intl.DateTimeFormat("ro-RO", { month: "long", year: "numeric" });

export function fmtDate(iso: string): string {
  return dateShort.format(new Date(iso));
}
export function fmtDateLong(iso: string): string {
  return dateLong.format(new Date(iso));
}
export function fmtDateTime(iso: string): string {
  return dateTime.format(new Date(iso));
}
export function fmtTime(iso: string): string {
  return timeOnly.format(new Date(iso));
}
/** "YYYY-MM" -> "noiembrie 2026" */
export function fmtMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const s = monthLong.format(new Date(y, m - 1, 1));
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function fmtMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

export function maskIban(iban: string): string {
  return iban.replace(/(.{4})/g, "$1 ").trim();
}

export function monthsBetween(fromIso: string, toIso: string): number {
  const a = new Date(fromIso);
  const b = new Date(toIso);
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

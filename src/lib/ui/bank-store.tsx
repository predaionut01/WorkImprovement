"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Account, Card, CustomerData } from "@/lib/types";
import { fmtDate, fmtDateTime, fmtMoney } from "./format";

export const CUSTOMER_ID = "cust_demo_01";

interface BankStore {
  data: CustomerData | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  /** POST /api/bank/cards/:id/(block|unblock|contactless|online) then refresh */
  cardAction: (cardId: string, action: "block" | "unblock" | "contactless" | "online", value?: boolean) => Promise<Card>;
  accountById: (id: string) => Account | undefined;
  cardById: (id: string) => Card | undefined;
  fmtMoney: typeof fmtMoney;
  fmtDate: typeof fmtDate;
  fmtDateTime: typeof fmtDateTime;
}

const Ctx = createContext<BankStore | null>(null);

export function BankProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<CustomerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const inflight = useRef<Promise<void> | null>(null);

  const refresh = useCallback(async () => {
    if (inflight.current) return inflight.current;
    const p = (async () => {
      try {
        const res = await fetch("/api/bank/snapshot", { headers: { "x-customer-id": CUSTOMER_ID }, cache: "no-store" });
        if (!res.ok) throw new Error(`Snapshot ${res.status}`);
        const json = (await res.json()) as CustomerData;
        setData(json);
        setError(null);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
        inflight.current = null;
      }
    })();
    inflight.current = p;
    return p;
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const cardAction = useCallback<BankStore["cardAction"]>(
    async (cardId, action, value) => {
      const res = await fetch(`/api/bank/cards/${cardId}/${action}`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-customer-id": CUSTOMER_ID },
        body: value === undefined ? undefined : JSON.stringify({ value }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Eroare ${res.status}`);
      }
      const card = (await res.json()) as Card;
      await refresh();
      return card;
    },
    [refresh],
  );

  const value = useMemo<BankStore>(
    () => ({
      data,
      loading,
      error,
      refresh,
      cardAction,
      accountById: (id) => data?.accounts.find((a) => a.id === id),
      cardById: (id) => data?.cards.find((c) => c.id === id),
      fmtMoney,
      fmtDate,
      fmtDateTime,
    }),
    [data, loading, error, refresh, cardAction],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBank(): BankStore {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useBank must be used inside <BankProvider>");
  return ctx;
}

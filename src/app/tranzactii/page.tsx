"use client";

import { useMemo, useState } from "react";
import type { Transaction, TxCategory } from "@/lib/types";
import { useBank } from "@/lib/ui/bank-store";
import { fmtDateTime, fmtMoney } from "@/lib/ui/format";
import { ALL_CATEGORIES } from "@/lib/ui/labels";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Money } from "@/components/ui/Money";
import { Drawer } from "@/components/ui/Drawer";
import { Field, Input, Select } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSkeleton } from "@/components/ui/Skeleton";
import { TransactionRow } from "@/components/bank/TransactionRow";

const TX_TYPE: Record<Transaction["type"], string> = {
  card: "Plată cu cardul",
  transfer_in: "Transfer primit",
  transfer_out: "Transfer trimis",
  fee: "Comision",
  interest: "Dobândă",
  direct_debit: "Debitare directă",
  roundup: "Round Up",
};

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-line/60 py-2 text-sm last:border-0">
      <span className="text-ink-muted">{k}</span>
      <span className="text-right font-medium">{v}</span>
    </div>
  );
}

export default function TransactionsPage() {
  const { data, loading, accountById, cardById } = useBank();
  const [account, setAccount] = useState("all");
  const [category, setCategory] = useState<TxCategory | "all">("all");
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sel, setSel] = useState<Transaction | null>(null);

  const rows = useMemo(() => {
    if (!data) return [];
    const needle = q.trim().toLowerCase();
    return data.transactions.filter((t) => {
      if (account !== "all" && t.accountId !== account) return false;
      if (category !== "all" && t.category !== category) return false;
      if (from && t.date < `${from}T00:00:00`) return false;
      if (to && t.date > `${to}T23:59:59`) return false;
      if (needle && !`${t.merchant} ${t.description ?? ""} ${t.counterparty?.name ?? ""}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [data, account, category, q, from, to]);

  if (loading || !data) return <PageSkeleton />;

  const pending = rows.filter((t) => t.status === "pending");
  const posted = rows.filter((t) => t.status === "posted");
  const totalOut = rows.filter((t) => t.amount < 0 && t.currency === "RON").reduce((s, t) => s + t.amount, 0);

  return (
    <div className="space-y-4">
      <PageHeader title="Tranzacții" subtitle={`${rows.length} tranzacții · ieșiri în RON ${fmtMoney(totalOut, "RON")}`} />

      <Card>
        <div className="grid gap-3 md:grid-cols-5">
          <Field label="Cont">
            <Select value={account} onChange={(e) => setAccount(e.target.value)}>
              <option value="all">Toate conturile</option>
              {data.accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Categorie">
            <Select value={category} onChange={(e) => setCategory(e.target.value as TxCategory | "all")}>
              <option value="all">Toate</option>
              {ALL_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Caută">
            <Input placeholder="comerciant, detalii…" value={q} onChange={(e) => setQ(e.target.value)} />
          </Field>
          <Field label="De la">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="Până la">
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
        </div>
      </Card>

      {pending.length > 0 && (
        <Card title="În procesare" subtitle="Sumele sunt rezervate, nu încă decontate" className="border-warning/40">
          <div className="-mx-2 divide-y divide-line/60">
            {pending.map((t) => (
              <TransactionRow key={t.id} tx={t} onClick={() => setSel(t)} />
            ))}
          </div>
        </Card>
      )}

      <Card title="Istoric" padded={false}>
        <div className="divide-y divide-line/60 px-3 py-2">
          {posted.length === 0 && <p className="py-8 text-center text-sm text-ink-muted">Nicio tranzacție pentru filtrele alese.</p>}
          {posted.map((t) => (
            <TransactionRow key={t.id} tx={t} onClick={() => setSel(t)} />
          ))}
        </div>
      </Card>

      <Drawer open={sel !== null} onClose={() => setSel(null)} title="Detalii tranzacție">
        {sel && (
          <div>
            <div className="mb-4 rounded-xl bg-surface p-4 text-center">
              <p className="text-sm text-ink-muted">{sel.merchant}</p>
              <Money amount={sel.amount} currency={sel.currency} signed size="xl" />
              <div className="mt-2">
                {sel.status === "pending" ? <Badge tone="warning" dot>În procesare</Badge> : <Badge tone="success" dot>Decontată</Badge>}
              </div>
            </div>
            <Row k="Data" v={fmtDateTime(sel.date)} />
            <Row k="Tip" v={TX_TYPE[sel.type]} />
            <Row k="Categorie" v={sel.category} />
            <Row k="Cont" v={accountById(sel.accountId)?.name ?? sel.accountId} />
            {sel.cardId && <Row k="Card" v={`••••${cardById(sel.cardId)?.last4 ?? "?"}`} />}
            {sel.description && <Row k="Detalii" v={sel.description} />}
            {sel.counterparty && (
              <>
                <Row k="Contrapartidă" v={sel.counterparty.name} />
                {sel.counterparty.iban && <Row k="IBAN" v={<span className="font-mono text-xs">{sel.counterparty.iban}</span>} />}
              </>
            )}
            <Row k="ID" v={<span className="font-mono text-xs">{sel.id}</span>} />
          </div>
        )}
      </Drawer>
    </div>
  );
}
